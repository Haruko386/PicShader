# 映框 · Frame Studio

离线照片边框工作台，Windows x64 便携版。完整解压 `dist/FrameStudio-win-x64.zip` 后双击 `FrameStudio.exe`；在源码目录中也可以直接运行 `dist/FrameStudio/FrameStudio.exe`。不要把 EXE 单独移出文件夹。

## 使用

1. 点击加号、按 Ctrl+O 或拖入多张照片；文件夹按钮会导入所选目录及子目录的支持文件。用侧栏列表切换，逐张编辑与导出。启动时没有示例照片。支持 JPEG、PNG、WebP、BMP、AVIF 和 GIF（静态输出）。右上角主题默认随系统，可手动切换深浅色。
2. 选择「经典白框」或「背景虚化」。默认完整保留原图；画幅不一致时边框会变宽。选「居中裁切」则填满画框。比例指最终画布（宽:高），不是原照片的裁切比例。支持六个预设、自定义整数比例（1:10 到 10:1）。
3. 从支持的 EXIF 标签读取厂商、型号、焦距、光圈、快门和 ISO；自动匹配已知品牌。可在「照片参数」里修改文字、开启型号显示。没有 EXIF 的文件可正常处理，不编造参数。手填参数要带上期望的单位，如 50mm、F2.8、1/125s、ISO100。
4. 手动选择品牌与标识版本，或选「不显示」。华为有花瓣及字标；尼康有黄色方标及字标。其他品牌提供对应图标或字标；「纯文字」指系统字体排版，不冒充官方字标。
5. 选择 JPEG（质量 95%）或 PNG，点击「导出照片」，指定保存位置。默认用原图长边，可选 2048、3840、6000 px。为控制内存，输出长边上限 8192 px、面积约 3200 万像素；最终尺寸显示在导出按钮下方。原始照片不被编辑；另存时避免覆盖原文件。导出是已合成的像素，不复制原始 EXIF/GPS。

## RAW 输入

RAW 文件与普通照片可混合添加，不用先转成 JPEG。桌面版离线按需加载 LibRaw，只解码当前一张：读取传感器数据、相机白平衡和拍摄参数，生成全尺寸 sRGB 图像，再按画布设置合成。不是提取内嵌缩略图，也不写回 RAW。色彩不保证与相机厂商的 JPEG 风格一致。成品为 8 位 JPEG / PNG，遵循上面的导出尺寸上限。

可选择 DNG、ARW、NEF、CR2、CR3、RAF、ORF、RW2、PEF 等，能否解码取决于具体机型与压缩方式。已实测 Sony FX30 ARW、Nikon D3S NEF、Canon EOS 40D sRAW CR2。无法识别的文件会提示错误，可切换队列中的其他照片。

## 构建与移植

Windows x64，.NET Framework 4.6.2+，Microsoft Edge WebView2 Evergreen Runtime。系统缺少运行时时从微软安装 WebView2 x64；便携包不含浏览器内核。普通用户运行不需要 Node、Python、Java 或开发工具。

在 Windows PowerShell 运行：

    powershell -ExecutionPolicy Bypass -File .\build.ps1

脚本调用系统自带的 .NET Framework x64 C# 编译器，生成 EXE 和 ZIP；所有构建依赖已随源码保存，无需在线还原。Windows 壳负责加载本地静态资源并处理原生另存为。用户配置目录为 %LOCALAPPDATA%/PicShader/WebView2。照片在本机解码、排版与导出，无上传服务。

- app/render.js：品牌目录、EXIF 格式化、模糊缓存、Canvas 合成。预览和导出使用同一布局。
- app/studio.js：文件导入、参数编辑、预览与编码。浏览器调试 RAW 时需使用 localhost 或 HTTPS，返回 Cross-Origin-Opener-Policy: same-origin 和 Cross-Origin-Embedder-Policy: require-corp，并以 application/wasm 提供 WASM。桌面版已处理。
- desktop/Program.cs：Windows WebView2/WinForms 壳。后续安卓可在系统 WebView 复用 app/，另接照片选择器、文件保存和生命周期。本版不含 APK。
- licenses/：第三方库许可证与素材来源。
