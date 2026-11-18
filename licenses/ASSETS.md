# 内置素材与组件

本工具不是任何相机或手机品牌的官方产品。品牌名和图形用于标识拍摄设备，不表示品牌认可；分发者须自行遵守相应品牌的使用规范。

- **华为**：华为全球站页首组合标识，https://www.huawei.com/en/ 。取自 https://www.huawei.com/-/media/hcomponent-header/1.0.1.20260908162100/component/img/huawei_logo.png ，分别截出透明底花瓣和字标。
- **尼康黄色方标**：Nikon Brand Symbol，https://www.nikon.com/company/corporate/brand/brand_symbol/img/logo.svg 。
- **佳能**：Canon Global 页首矢量，https://global.canon/01cmn/img/common/logo.svg ，仅保留红色 Canon 字标路径。
- **其他矢量标识及 Nikon 字标**：Simple Icons 13.21.0，https://github.com/simple-icons/simple-icons/tree/13.21.0 ，收录 Nikon、Sony、Fujifilm、Leica、DJI、Apple、Xiaomi、Panasonic、Samsung、Oppo、vivo。图标集许可证见 simple-icons.md；商标权另计。
- **EXIF**：exifr 7.1.3 lite UMD，https://github.com/MikeKovarik/exifr ，见 exifr.txt。
- **Windows 互操作库**：Microsoft.Web.WebView2 1.0.3537.50（NuGet），https://www.nuget.org/packages/Microsoft.Web.WebView2/1.0.3537.50 ，见 webview2-LICENSE.txt 与 webview2-NOTICE.txt。
- **RAW 解码**：[libraw-wasm 1.6.0](https://github.com/ybouane/LibRaw-Wasm/tree/v1.6.0)，npm 包声明 ISC，作者 ybouane；分发 dist 中未修改的运行时。内含 [LibRaw 0.22.1 源码](https://github.com/LibRaw/LibRaw/tree/0.22.1)（CDDL 1.0，见 LibRaw-CDDL.txt）、[Little CMS 2.19.1](https://github.com/mm2/Little-CMS/tree/lcms2.19.1)（见 lcms-LICENSE.txt）和 JPEG 解码组件（见 jpeg-LICENSE.txt、jpeg-README.ijg）。This software is based in part on the work of the Independent JPEG Group. 对应构建步骤见上游 compileLibraw.sh。
