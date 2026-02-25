package com.muyan.mandate_of_heaven

import android.content.Context
import android.content.res.AssetManager
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import java.io.ByteArrayInputStream

/**
 * 从 APK assets/ 目录提供静态资源，支持 HTTP Range 请求（视频 seek 必须）。
 * 此文件不在 generated/ 目录中，不会被 tauri android build 覆盖。
 */
object AssetHelper {

    fun serveFromAssets(context: Context, request: WebResourceRequest): WebResourceResponse? {
        val path = request.url.path?.trimStart('/') ?: return null
        if (path.isEmpty()) return null

        val assetManager = context.applicationContext.assets

        // 读取整个文件到内存
        val allBytes: ByteArray
        try {
            allBytes = assetManager.open(path, AssetManager.ACCESS_RANDOM).use { it.readBytes() }
        } catch (e: Exception) {
            return null // 文件不存在
        }

        val fileLength = allBytes.size.toLong()
        val mimeType = guessMimeType(path)
        val rangeHeader = request.requestHeaders["Range"]

        if (rangeHeader != null && rangeHeader.startsWith("bytes=")) {
            val rangeSpec = rangeHeader.removePrefix("bytes=")
            val parts = rangeSpec.split("-", limit = 2)
            val start = parts[0].toLongOrNull() ?: 0L
            val end = if (parts.size > 1 && parts[1].isNotEmpty())
                parts[1].toLongOrNull() ?: (fileLength - 1)
            else
                fileLength - 1

            if (start >= fileLength || end >= fileLength || start > end) {
                val headers = mapOf(
                    "Content-Range" to "bytes */$fileLength",
                    "Access-Control-Allow-Origin" to "*"
                )
                return WebResourceResponse(
                    mimeType, null, 416, "Range Not Satisfiable",
                    headers, ByteArrayInputStream(ByteArray(0))
                )
            }

            val contentLength = end - start + 1
            val rangeBytes = allBytes.copyOfRange(start.toInt(), (end + 1).toInt())

            val headers = mapOf(
                "Content-Type" to mimeType,
                "Content-Range" to "bytes $start-$end/$fileLength",
                "Content-Length" to "$contentLength",
                "Accept-Ranges" to "bytes",
                "Access-Control-Allow-Origin" to "*",
                "Access-Control-Expose-Headers" to "content-range"
            )
            return WebResourceResponse(
                mimeType, null, 206, "Partial Content",
                headers, ByteArrayInputStream(rangeBytes)
            )
        } else {
            val headers = mapOf(
                "Content-Type" to mimeType,
                "Content-Length" to "$fileLength",
                "Accept-Ranges" to "bytes",
                "Access-Control-Allow-Origin" to "*"
            )
            return WebResourceResponse(
                mimeType, null, 200, "OK",
                headers, ByteArrayInputStream(allBytes)
            )
        }
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
