import java.io.FileInputStream
import java.util.Properties

plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
  id("rust")
}

val tauriProperties = Properties().apply {
  val propFile = file("tauri.properties")
  if (propFile.exists()) {
    propFile.inputStream().use { load(it) }
  }
}

android {
  compileSdk = 36
  namespace = "com.muyan.mandate_of_heaven"
  defaultConfig {
    manifestPlaceholders["usesCleartextTraffic"] = "false"
    applicationId = "com.muyan.mandate_of_heaven"
    minSdk = 26
    targetSdk = 36
    versionCode = tauriProperties.getProperty("tauri.android.versionCode", "1").toInt()
    versionName = tauriProperties.getProperty("tauri.android.versionName", "1.0")
  }
  signingConfigs {
    create("release") {
      val keystorePropertiesFile = rootProject.file("keystore.properties")
      val keystoreProperties = Properties()
      if (keystorePropertiesFile.exists()) {
        keystoreProperties.load(FileInputStream(keystorePropertiesFile))
      }

      keyAlias = keystoreProperties["keyAlias"] as String
      keyPassword = keystoreProperties["keyPassword"] as String
      storeFile = file(keystoreProperties["storeFile"] as String)
      storePassword = keystoreProperties["storePassword"] as String
    }
  }
  buildTypes {
    getByName("debug") {
      manifestPlaceholders["usesCleartextTraffic"] = "true"
      isDebuggable = true
      isJniDebuggable = true
      isMinifyEnabled = false
      packaging {
        jniLibs.keepDebugSymbols.add("*/arm64-v8a/*.so")
        jniLibs.keepDebugSymbols.add("*/armeabi-v7a/*.so")
        jniLibs.keepDebugSymbols.add("*/x86/*.so")
        jniLibs.keepDebugSymbols.add("*/x86_64/*.so")
      }
    }
    getByName("release") {
      manifestPlaceholders["usesCleartextTraffic"] = "true"
      isMinifyEnabled = true
      proguardFiles(
        *fileTree(".") { include("**/*.pro") }
          .plus(getDefaultProguardFile("proguard-android-optimize.txt"))
          .toList().toTypedArray()
      )
      signingConfig = signingConfigs.getByName("release")
    }
  }
  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
  kotlinOptions {
    jvmTarget = "17"
  }
  buildFeatures {
    buildConfig = true
  }
  // 禁止 AAPT 压缩媒体/字体等已压缩格式，这样 AssetManager 可以直接读取而非先解压
  aaptOptions {
    noCompress += listOf(
      "mp4", "webm",                           // 视频
      "mp3", "ogg", "opus", "wav",              // 音频
      "webp", "png", "jpg", "jpeg", "gif",      // 图片
      "svg", "vtt", "json",                     // 文本数据
      "woff", "woff2", "ttf", "otf"             // 字体
    )
  }
}

rust {
  rootDirRel = "../../../"
}

dependencies {
  implementation("androidx.webkit:webkit:1.15.0")
  implementation("androidx.appcompat:appcompat:1.7.1")
  implementation("org.nanohttpd:nanohttpd:2.3.1")
  implementation("androidx.activity:activity-ktx:1.12.2")
  implementation("com.google.android.material:material:1.13.0")
  testImplementation("junit:junit:4.13.2")
  androidTestImplementation("androidx.test.ext:junit:1.3.0")
  androidTestImplementation("androidx.test.espresso:espresso-core:3.7.0")
}

apply(from = "tauri.build.gradle.kts")

// ─── 自动 patch 自动生成的 RustWebViewClient.kt ───
// tauri android build 每次都会覆盖 generated/ 目录下的文件，
// 所以在 Kotlin 编译前自动注入 AssetHelper 回退逻辑 + 错误日志。
val patchGeneratedFiles by tasks.registering {
  val generatedFile = file("src/main/java/com/muyan/mandate_of_heaven/generated/RustWebViewClient.kt")
  doLast {
    if (!generatedFile.exists()) return@doLast
    var text = generatedFile.readText()
    // 幂等：已 patch 则跳过
    if (text.contains("AssetHelper")) return@doLast

    // ─ Patch 1: 注入 import ─
    text = text.replace(
      "import android.webkit.*",
      "import android.webkit.*\nimport android.util.Log"
    )

    // ─ Patch 2: assets-first 策略 ─
    text = text.replace(
      """            val rustWebview = view as RustWebView;
            val response = handleRequest(rustWebview.id, request, rustWebview.isDocumentStartScriptEnabled)
            interceptedState[request.url.toString()] = response != null
            return response""",
      """            // 先尝试从 APK assets/ 目录读取（媒体资源、图片、字体等）
            val assetResponse = AssetHelper.serveFromAssets(view.context, request)
            if (assetResponse != null) {
                interceptedState[request.url.toString()] = true
                return assetResponse
            }
            // assets/ 未命中 → 走 Rust 处理（嵌入的 dist HTML/JS/CSS）
            val rustWebview = view as RustWebView;
            val response = handleRequest(rustWebview.id, request, rustWebview.isDocumentStartScriptEnabled)
            interceptedState[request.url.toString()] = response != null
            return response"""
    )

    // ─ Patch 3: 增强 onReceivedError 日志 ─
    text = text.replace(
      "super.onReceivedError(view, request, error)",
      """Log.e("WebViewClient", "onReceivedError: url=${'$'}{request.url} code=${'$'}{error.errorCode} desc=${'$'}{error.description}")
            super.onReceivedError(view, request, error)"""
    )

    generatedFile.writeText(text)
    println("✅ Patched RustWebViewClient.kt: assets-first + error logging")
  }
}

// 确保所有 Kotlin 编译任务在 patch 之后执行
tasks.configureEach {
  if (name.contains("compile", ignoreCase = true) && name.contains("Kotlin", ignoreCase = true)) {
    dependsOn(patchGeneratedFiles)
  }
}