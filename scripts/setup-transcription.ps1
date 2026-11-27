$ErrorActionPreference='Stop'
$rootPath=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $rootPath
$env:UV_CACHE_DIR=Join-Path $rootPath '.cache/uv'
if(!(Test-Path '.venv/Scripts/python.exe')) { & "$PSScriptRoot/setup-neural.ps1" }
& .tools/uv/uv.exe pip install --python .venv/Scripts/python.exe -r neural/transcription.lock.txt
if($LASTEXITCODE -ne 0){throw 'Transcription dependency installation failed.'}
& .venv/Scripts/python.exe scripts/download-models.py whisper
if($LASTEXITCODE -ne 0){throw 'Transcription model download failed.'}
Write-Host 'Free offline Bengali and English transcription is ready.'
