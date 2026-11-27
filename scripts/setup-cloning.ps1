$ErrorActionPreference='Stop'
$rootPath=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $rootPath
$env:UV_CACHE_DIR=Join-Path $rootPath '.cache/uv'
if(!(Test-Path '.venv/Scripts/python.exe')) { & "$PSScriptRoot/setup-neural.ps1" }
& .tools/uv/uv.exe pip install --python .venv/Scripts/python.exe 'torchaudio==2.8.0' --index-url https://download.pytorch.org/whl/cpu
if($LASTEXITCODE -ne 0){throw 'Audio dependency installation failed.'}
& .tools/uv/uv.exe pip install --python .venv/Scripts/python.exe omnivoice==0.2.1 --no-deps
if($LASTEXITCODE -ne 0){throw 'OmniVoice installation failed.'}
& .tools/uv/uv.exe pip install --python .venv/Scripts/python.exe -r neural/cloning.lock.txt
if($LASTEXITCODE -ne 0){throw 'Cloning dependency installation failed.'}
& .venv/Scripts/python.exe scripts/download-models.py omnivoice
if($LASTEXITCODE -ne 0){throw 'Model download failed.'}
Write-Host 'Free local cloning is ready. Open Voice cloning in the studio.'
