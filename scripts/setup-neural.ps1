param([switch]$Expressive)
$ErrorActionPreference = 'Stop'
$rootPath = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $rootPath
$env:UV_CACHE_DIR = Join-Path $rootPath '.cache/uv'
$uvPath = Join-Path $rootPath '.tools/uv/uv.exe'
if (!(Test-Path -LiteralPath $uvPath)) {
    New-Item -ItemType Directory -Force '.tools' | Out-Null
    Invoke-WebRequest -Uri 'https://github.com/astral-sh/uv/releases/download/0.13.10/uv-x86_64-pc-windows-msvc.zip' -OutFile '.tools/uv.zip'
    Expand-Archive -LiteralPath '.tools/uv.zip' -DestinationPath '.tools/uv' -Force
}
function Invoke-Uv {
    & $uvPath @args
    if ($LASTEXITCODE -ne 0) { throw "Python setup failed. Review the error above." }
}
Invoke-Uv python install 3.12 --install-dir '.runtime/python'
$pythonPath = Join-Path $rootPath '.runtime/python/cpython-3.12-windows-x86_64-none/python.exe'
if (!(Test-Path '.venv')) { Invoke-Uv venv .venv --python $pythonPath }
Invoke-Uv pip install --python '.venv/Scripts/python.exe' 'torch==2.8.0' --index-url 'https://download.pytorch.org/whl/cpu'
Invoke-Uv pip install --python '.venv/Scripts/python.exe' -r 'neural/requirements.lock.txt'
& $pythonPath scripts/download-models.py mithi kokoro
if ($LASTEXITCODE -ne 0) { throw 'Model download failed.' }
if ($Expressive) {
    if (!(Test-Path '.runtime/parler-env')) { Invoke-Uv venv .runtime/parler-env --python $pythonPath }
    Invoke-Uv pip install --python '.runtime/parler-env/Scripts/python.exe' 'torch==2.8.0' 'torchaudio==2.8.0' --index-url 'https://download.pytorch.org/whl/cpu'
    Invoke-Uv pip install --python '.runtime/parler-env/Scripts/python.exe' -r 'neural/parler.lock.txt'
    & $pythonPath scripts/download-models.py parler
    if ($LASTEXITCODE -ne 0) { throw 'Expressive model download failed.' }
}
Write-Host 'Neural setup complete. Run npm run dev to open the studio.'
