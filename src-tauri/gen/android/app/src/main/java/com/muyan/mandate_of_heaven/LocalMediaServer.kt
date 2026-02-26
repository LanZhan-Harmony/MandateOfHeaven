package com.muyan.mandate_of_heaven

import android.content.Context
import android.content.res.AssetFileDescriptor
import android.util.Log
import fi.iki.elonen.NanoHTTPD

/**
 * 本地 HTTP 媒体服务器 —— 彻底绕过 WebView shouldInterceptRequest 的限制。
 *
 * 为什么需要这个：
 * Android WebView 的 shouldInterceptRequest 对大文件（100MB+）视频播放存在根本性问题：
 * 1. WebView 可能不传递 Range 请求头给 shouldInterceptRequest
 * 2. 每次请求同步 readBytes 100MB 阻塞 WebView IO 线程 5-10 秒
 * 3. ByteArrayInputStream 响应占用大量堆内存
 *
 * 解决方案：启动一个本地 HTTP 服务器，视频/音频 URL 指向 127.0.0.1:PORT。
 * 浏览器通过标准 TCP 获取数据，Range 请求正常工作。
 * 使用 AssetFileDescriptor.createInputStream() 流式读取 APK 内的资源，
 * skip() 底层使用 lseek() 实现 O(1) 定位，不读取整个文件。
 *
 * 前置条件：aaptOptions.noCompress 必须包含视频/音频格式
 *           （openFd() 仅对未压缩资源可用）
 */
class LocalMediaServer private constructor(
    private val context: Context,
    port: Int
) : NanoHTTPD("127.0.0.1", port) {

    companion object {
        private const val TAG = "MediaServer"
        const val PORT = 18765

        @Volatile
        private var instance: LocalMediaServer? = null

        fun start(context: Context) {
            if (instance != null) return
            try {
                val server = LocalMediaServer(context.applicationContext, PORT)
                server.start(SOCKET_READ_TIMEOUT, false)
                instance = server
                Log.i(TAG, "Media server started on port $PORT")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start media server on port $PORT: ${e.message}")
            }
        }

        fun stop() {
            instance?.stop()
            instance = null
            Log.i(TAG, "Media server stopped")
        }
    }

    override fun serve(session: IHTTPSession): Response {
        // CORS 预检请求
        if (Method.OPTIONS == session.method) {
            return newFixedLengthResponse(Response.Status.OK, "text/plain", "").apply {
                addCorsHeaders()
            }
        }

        val path = session.uri?.trimStart('/') ?: ""
        if (path.isEmpty()) {
            return newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "Not found")
        }

        // openFd() 获取 AssetFileDescriptor（只对 noCompress 的未压缩资源有效）
        val afd: AssetFileDescriptor = try {
            context.assets.openFd(path)
        } catch (e: Exception) {
            Log.w(TAG, "Asset not found: $path (${e.message})")
            return newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "Not found: $path")
        }

        val fileLength = afd.length
        if (fileLength == AssetFileDescriptor.UNKNOWN_LENGTH) {
            afd.close()
            return newFixedLengthResponse(
                Response.Status.INTERNAL_ERROR, "text/plain", "Unknown file length"
            )
        }

        val mimeType = guessMimeType(path)

        // NanoHTTPD 的 headers key 全部是小写
        val rangeHeader = session.headers["range"]
        if (rangeHeader != null && rangeHeader.startsWith("bytes=")) {
            return serveRange(afd, fileLength, mimeType, path, rangeHeader)
        }

        return serveFull(afd, fileLength, mimeType, path)
    }

    /**
     * 200 完整响应 —— 流式传输，createInputStream() 不把整个文件读进内存。
     * NanoHTTPD 内部按 16KB 分块从 InputStream 读取并写入 socket。
     * Response.close() 时自动关闭 InputStream → AutoCloseInputStream → afd.close()。
     */
    private fun serveFull(
        afd: AssetFileDescriptor, fileLength: Long, mimeType: String, path: String
    ): Response {
        Log.d(TAG, "200: $path ($fileLength bytes, ${fileLength / 1024}KB)")
        val stream = afd.createInputStream()
        return newFixedLengthResponse(Response.Status.OK, mimeType, stream, fileLength).apply {
            addHeader("Accept-Ranges", "bytes")
            addCorsHeaders()
        }
    }

    /**
     * 206 部分内容 —— createInputStream().skip() 底层使用 lseek()，O(1) 定位。
     * NanoHTTPD 只从 InputStream 读取 contentLength 个字节后停止。
     */
    private fun serveRange(
        afd: AssetFileDescriptor, fileLength: Long, mimeType: String,
        path: String, rangeHeader: String
    ): Response {
        val rangeSpec = rangeHeader.removePrefix("bytes=")
        val parts = rangeSpec.split("-", limit = 2)
        val start = parts[0].toLongOrNull() ?: 0L
        val requestedEnd = if (parts.size > 1 && parts[1].isNotEmpty())
            parts[1].toLongOrNull() ?: (fileLength - 1)
        else
            fileLength - 1

        if (start < 0 || start >= fileLength) {
            afd.close()
            return newFixedLengthResponse(
                Response.Status.RANGE_NOT_SATISFIABLE, "text/plain", ""
            ).apply {
                addHeader("Content-Range", "bytes */$fileLength")
                addCorsHeaders()
            }
        }

        val end = minOf(requestedEnd, fileLength - 1)
        val contentLength = end - start + 1

        Log.d(TAG, "206: $path [$start-$end/$fileLength] (${contentLength / 1024}KB)")

        // createInputStream() 返回 AutoCloseInputStream（包装 FileInputStream）
        // skip() 底层 → IoBridge.skip() → Libcore.os.lseek(fd, n, SEEK_CUR) → O(1)
        val stream = afd.createInputStream()
        if (start > 0) {
            var remaining = start
            while (remaining > 0) {
                val skipped = stream.skip(remaining)
                if (skipped <= 0) break
                remaining -= skipped
            }
        }

        // NanoHTTPD 只读取 contentLength 字节，然后关闭 stream → afd.close()
        return newFixedLengthResponse(
            Response.Status.PARTIAL_CONTENT, mimeType, stream, contentLength
        ).apply {
            addHeader("Content-Range", "bytes $start-$end/$fileLength")
            addHeader("Accept-Ranges", "bytes")
            addCorsHeaders()
        }
    }

    private fun Response.addCorsHeaders() {
        addHeader("Access-Control-Allow-Origin", "*")
        addHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
        addHeader("Access-Control-Allow-Headers", "Range")
        addHeader("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges")
    }

    private fun guessMimeType(path: String): String {
        val ext = path.substringAfterLast('.', "").lowercase()
        return when (ext) {
            "mp4" -> "video/mp4"
            "webm" -> "video/webm"
            "mp3" -> "audio/mpeg"
            "ogg", "opus" -> "audio/ogg"
            "wav" -> "audio/wav"
            "png" -> "image/png"
            "jpg", "jpeg" -> "image/jpeg"
            "gif" -> "image/gif"
            "webp" -> "image/webp"
            "svg" -> "image/svg+xml"
            "vtt" -> "text/vtt"
            "json" -> "application/json"
            "js" -> "application/javascript"
            "css" -> "text/css"
            "html", "htm" -> "text/html"
            "woff" -> "font/woff"
            "woff2" -> "font/woff2"
            "ttf" -> "font/ttf"
            "otf" -> "font/otf"
            else -> "application/octet-stream"
        }
    }
}
