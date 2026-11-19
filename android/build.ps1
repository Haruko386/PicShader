param(
    [string]$Sdk = $env:ANDROID_HOME,
    [string]$Kotlin = $env:KOTLIN_HOME,
    [string]$Jdk = $env:JAVA_HOME
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot
$tools = Join-Path $Sdk 'build-tools\35.0.0'
$platform = Join-Path $Sdk 'platforms\android-35\android.jar'
$env:JAVA_HOME = $Jdk
$env:PATH = "$Jdk\bin;$env:PATH"
$work = Join-Path ([IO.Path]::GetTempPath()) ("picshader-build-" + [guid]::NewGuid().ToString("N"))
$null = New-Item -Type Directory $work
$dist = Join-Path $root 'dist'
$null = New-Item -Force -Type Directory $dist
function Invoke-Build($tool, [string[]]$arguments) {
    & $tool @arguments
    if ($LASTEXITCODE -ne 0) { throw "Failed: $tool ($LASTEXITCODE)" }
}
try {
    Invoke-Build "$tools\aapt2.exe" @('compile','--dir',"$PSScriptRoot\res",'-o',"$work\res.zip")
    Invoke-Build "$tools\aapt2.exe" @('link','-o',"$work\base.apk",'-I',$platform,'--manifest',"$PSScriptRoot\AndroidManifest.xml",'-A',"$root\app",'-R',"$work\res.zip",'--auto-add-overlay')
    Invoke-Build "$Kotlin\bin\kotlinc.bat" @("$PSScriptRoot\StudioActivity.kt",'-cp',$platform,'-jvm-target','1.8','-d',"$work\studio.jar")
    Invoke-Build "$tools\d8.bat" @('--min-api','29','--lib',$platform,'--output',$work,"$work\studio.jar","$Kotlin\lib\kotlin-stdlib.jar")
    $null = New-Item -Type Directory "$work\assets"
    Copy-Item -Recurse "$root\licenses" "$work\assets\licenses" -Force
    Push-Location $work
    try { Invoke-Build "$Jdk\bin\jar.exe" @('uf','base.apk','classes.dex','assets/licenses') } finally { Pop-Location }
    Invoke-Build "$tools\zipalign.exe" @('-f','4',"$work\base.apk","$work\aligned.apk")
    $keys = Join-Path $env:USERPROFILE '.android'
    $null = New-Item -Force -Type Directory $keys
    $key = Join-Path $keys 'picshader-debug.p12'
    if (!(Test-Path -LiteralPath $key)) {
        Invoke-Build "$Jdk\bin\keytool.exe" @('-genkeypair','-storetype','PKCS12','-keystore',$key,'-storepass','android','-keypass','android','-alias','androiddebugkey','-keyalg','RSA','-keysize','2048','-validity','10000','-dname','CN=PicShader Debug')
    }
    $apk = Join-Path $dist 'PicShader-android-debug.apk'
    Invoke-Build "$tools\apksigner.bat" @('sign','--ks',$key,'--ks-pass','pass:android','--v4-signing-enabled','false','--out',$apk,"$work\aligned.apk")
    Invoke-Build "$tools\apksigner.bat" @('verify','--verbose',$apk)
    Write-Output $apk
} finally {
    $resolved = (Resolve-Path -LiteralPath $work).Path
    if ((Split-Path $resolved) -eq ([IO.Path]::GetTempPath()).TrimEnd('\') -and (Split-Path $resolved -Leaf) -match '^picshader-build-[0-9a-f]{32}$') {
        Remove-Item -LiteralPath $resolved -Recurse -Force
    }
}
