# PicShader 本地构建

在 Windows PowerShell 中进入项目根目录。

## Windows x64

需要 .NET Framework 4.6.2+，运行时需要 WebView2 Evergreen。

```powershell
powershell -ExecutionPolicy Bypass -File .\build.ps1
```

产物：`dist/FrameStudio/FrameStudio.exe` 和 `dist/FrameStudio-win-x64.zip`。

## Android 测试 APK

准备 JDK 17–22、Kotlin/JVM 命令行编译器 2.0.21，以及 Android SDK 的 Platform 35 和 Build Tools 35.0.0。将 `JAVA_HOME`、`KOTLIN_HOME`、`ANDROID_HOME` 分别指向它们的安装目录。

```powershell
powershell -ExecutionPolicy Bypass -File .\android\build.ps1
```

产物：`dist/PicShader-android-debug.apk`（Android 10+，需较新的系统 WebView）。首次构建会在 `~/.android/picshader-debug.p12` 生成本机测试签名；保留它以便覆盖安装。

连接已开启 USB 调试的手机后可安装：

```powershell
& "$env:ANDROID_HOME\platform-tools\adb.exe" install -r .\dist\PicShader-android-debug.apk
```
