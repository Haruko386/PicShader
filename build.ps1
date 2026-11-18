$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$target = Join-Path $root 'dist\FrameStudio'
$sdk = Join-Path $root 'vendor\webview2'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
New-Item -ItemType Directory -Force -Path $target | Out-Null
Copy-Item -Force -Recurse (Join-Path $root 'app') $target
Copy-Item -Force -Recurse (Join-Path $root 'licenses') $target
Copy-Item -Force (Join-Path $root 'README.md') $target
Copy-Item -Force (Join-Path $sdk '*.dll') $target
& $compiler /nologo /target:winexe /platform:x64 /optimize+ /codepage:65001 "/win32manifest:$root\desktop\app.manifest" "/win32icon:$root\desktop\studio.ico" "/out:$target\FrameStudio.exe" /reference:System.Drawing.dll /reference:System.Windows.Forms.dll "/reference:$sdk\Microsoft.Web.WebView2.Core.dll" "/reference:$sdk\Microsoft.Web.WebView2.WinForms.dll" "$root\desktop\Program.cs"
if ($LASTEXITCODE -ne 0) { throw 'Desktop build failed.' }
Compress-Archive -Path $target -DestinationPath (Join-Path $root 'dist\FrameStudio-win-x64.zip') -Force
Write-Output "Built: $target\FrameStudio.exe"
