$ErrorActionPreference='Stop'
$rootPath=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $rootPath
$uvPath=Join-Path $rootPath '.tools/uv/uv.exe'
if (!(Test-Path $uvPath) -or !(Test-Path '.venv/Scripts/python.exe')) {
    & "$PSScriptRoot/setup-neural.ps1" -Expressive -Device cpu
}
if (!(Test-Path '.runtime/directml-env/Scripts/python.exe')) {
    & $uvPath venv .runtime/directml-env --python .venv/Scripts/python.exe
    if ($LASTEXITCODE -ne 0) { throw 'Could not create isolated DirectML environment.' }
}
& $uvPath pip install --python .runtime/directml-env/Scripts/python.exe -r neural/directml.requirements.txt
if ($LASTEXITCODE -ne 0) { throw 'DirectML dependency installation failed.' }
& .runtime/directml-env/Scripts/python.exe neural/probe_hardware.py --backend directml
if ($LASTEXITCODE -ne 0) { throw 'DirectML tensor probe failed. Check the DirectX 12 driver/GPU. CPU remains available.' }
Write-Host 'DirectML tensor probe passed. Speech operators are checked when each model runs; automatic mode can fall back to the same model on CPU.'
