$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
$AssetsDir = Join-Path $ProjectDir "app\src\main\assets"
$ModelDir = Join-Path $AssetsDir "model-pt"
$TempDir = Join-Path $env:TEMP "gumate-vosk-model"
$ZipPath = Join-Path $TempDir "model.zip"
$Url = "https://alphacephei.com/vosk/models/vosk-model-small-pt-0.3.zip"

if (Test-Path (Join-Path $ModelDir "conf\mfcc.conf")) {
    Write-Host "Modelo Vosk ja instalado em $ModelDir"
    exit 0
}

Remove-Item $TempDir -Recurse -Force -ErrorAction SilentlyContinue
New-Item $TempDir -ItemType Directory -Force | Out-Null
New-Item $AssetsDir -ItemType Directory -Force | Out-Null
Write-Host "Baixando modelo portugues do Vosk..."
Invoke-WebRequest -Uri $Url -OutFile $ZipPath
Expand-Archive -Path $ZipPath -DestinationPath (Join-Path $TempDir "unpacked") -Force
$SourceDir = Get-ChildItem (Join-Path $TempDir "unpacked") -Directory | Select-Object -First 1
Remove-Item $ModelDir -Recurse -Force -ErrorAction SilentlyContinue
Move-Item $SourceDir.FullName $ModelDir
Write-Host "Modelo instalado em $ModelDir"
