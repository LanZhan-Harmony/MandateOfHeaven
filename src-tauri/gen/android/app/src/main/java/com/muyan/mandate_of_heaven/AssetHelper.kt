package com.muyan.mandate_of_heaven

import android.content.Context
import android.content.res.AssetManager
import android.util.Log
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import java.io.ByteArrayInputStream

/**
 * 从 APK assets/ 目录提供静态资源（HTML、CSS、JS、图片、字体、字幕等）。
 *
 * 视频/音频等大文件由 LocalMediaServer (NanoHTTPD) 通过标准 HTTP 提供，
 * 彻底绕过 shouldInterceptRequest 的同步 I/O 限制。
 *
 * 此文件不在 generated/ 目录中，不会被 tauri android build 覆盖。
 */
object AssetHelper {

    private const val TAG = "AssetHelper"

    private const val MAX_CACHE_ENTRIES = 32
    private const val MAX_CACHEABLE_SIZE = 2L * 1024 * 1024  // 2 MB

    private class CachedAsset(val bytes: ByteArray, val mimeType: String)

    private val cache = object : LinkedHashMap<String, CachedAsset>(32, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, CachedAsset>?): Boolean {
            return size > MAX_CACHE_ENTRIES
        }
    }

    private val CORS_HEADERS = mapOf(
        "Access-Control-Allow-Origin" to "*"
    )

    fun serveFromAssets(context: Context, request: WebResourceRequest): WebResourceResponse? {
        // 不拦截发往本地媒体服务器的请求（让它走 TCP 到 NanoHTTPD）
        val host = request.url.host
        if (host == "127.0.0.1" || host == "localhost") return null

        val path = request.url.path?.trimStart('/') ?: return null
        if (path.isEmpty()) return null

        val mimeType = guessMimeType(path)

        // LRU 缓存命中 → 直接返回
        val cached = synchronized(cache) { cache[path]?.bytes }
        if (cached != null) {
            return serve200(cached, mimeType)
        }

        // 从 assets/ 读取
        val bytes = try {
            context.applicationContext.assets
                .open(path, AssetManager.ACCESS_STREAMING)
                .use { it.readBytes() }
        } catch (e: Exception) {
            Log.w(TAG, "Asset not found: $path (${e.message})")
            return null
        }

        // 缓存小文件
        if (bytes.size <= MAX_CACHEABLE_SIZE) {
            synchronized(cache) {
                cache[path] = CachedAsset(bytes, mimeType)
            }
        }

        return serve200(bytes, mimeType)
    }

    private fun serve200(bytes: ByteArray, mimeType: String): WebResourceResponse {
        return WebResourceResponse(
            mimeType, null, 200, "OK",
            mapOf(
                "Content-Type" to mimeType,
                "Content-Length" to "${bytes.size}",
            ) + CORS_HEADERS,
            ByteArrayInputStream(bytes)
        )
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
