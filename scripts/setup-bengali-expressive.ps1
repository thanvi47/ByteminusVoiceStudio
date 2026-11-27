$ErrorActionPreference='Stop'
$rootPath=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $rootPath
if(!(Test-Path '.runtime/parler-env/Scripts/python.exe')) { & "$PSScriptRoot/setup-neural.ps1" -Expressive }
if(!(Test-Path '.venv/Scripts/python.exe')) { throw 'Install the base neural environment first.' }
$requiredModelFiles=@('model.safetensors','config.json','tokenizer.json','tokenizer_config.json')
$localModelReady=($requiredModelFiles | Where-Object { !(Test-Path -LiteralPath (Join-Path '.models/indic' $_)) }).Count -eq 0
if($localModelReady) {
    Write-Host 'Using the already downloaded Indic model; no new Hugging Face login is needed.'
    & .venv/Scripts/python.exe scripts/download-models.py indic-description
} else {
    & .venv/Scripts/python.exe scripts/download-models.py indic indic-description
}
if($LASTEXITCODE -ne 0){throw 'Accept the free model access on Hugging Face, sign in using hf auth login, and rerun this script.'}
Write-Host 'Restart the studio, then choose Bengali · Expressive. No paid API is used.'
