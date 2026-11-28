param(
    [switch]$All,
    [switch]$BengaliExpressive,
    [switch]$Cloning,
    [switch]$Transcription,
    [ValidateSet('auto','cpu','cuda','xpu','directml')][string]$Device='auto'
)
$ErrorActionPreference='Stop'
$rootPath=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $rootPath
if (!(Get-Command node -ErrorAction SilentlyContinue) -or !(Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw 'Install Node.js 22 LTS (including npm), reopen PowerShell, and rerun setup.'
}
$nodeMajor = [int]((& node --version).TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 22) { throw 'Node.js 22 or newer is required. Node.js 22 LTS is the tested version.' }
if ((& node -p 'process.arch') -ne 'x64') { throw 'This Windows setup requires x64 Node.js and an x64 Windows PC.' }
function Invoke-Step([string]$Name, [scriptblock]$Action) {
    Write-Host "`n=== $Name ==="
    & $Action
}
Invoke-Step 'Install locked web dependencies' {
    & npm.cmd ci --legacy-peer-deps
    if ($LASTEXITCODE -ne 0) { throw 'npm install failed. Resolve the error above before continuing.' }
}
Invoke-Step 'Install base and English expressive engines' { & "$PSScriptRoot/setup-neural.ps1" -Expressive -Device $Device }
if ($All -or $BengaliExpressive) {
    Write-Host 'Indic requires your own approved Hugging Face access: https://huggingface.co/ai4bharat/indic-parler-tts'
    & .venv/Scripts/python.exe -c 'from huggingface_hub import get_token; raise SystemExit(0 if get_token() else 1)'
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'Log in locally with a read token from your approved account. The browser approval is a separate step.'
        & .venv/Scripts/hf.exe auth login
        if ($LASTEXITCODE -ne 0) { throw 'Hugging Face login failed. Approve access and rerun setup.' }
    }
    Invoke-Step 'Install Bengali expressive model and both tokenizers' { & "$PSScriptRoot/setup-bengali-expressive.ps1" }
}
if ($All -or $Cloning) {
    Write-Host 'Optional OmniVoice weights have noncommercial/community terms; see THIRD_PARTY_NOTICES.md.'
    Invoke-Step 'Install optional cloning' { & "$PSScriptRoot/setup-cloning.ps1" -Device $Device }
}
if ($All -or $Transcription) {
    Invoke-Step 'Install optional offline reference transcription' { & "$PSScriptRoot/setup-transcription.ps1" }
}
Invoke-Step 'Check installation' {
    if ($All) { & npm.cmd run doctor -- --all } else { & npm.cmd run doctor }
    if ($LASTEXITCODE -ne 0) { throw 'Installation checks failed. Follow the missing-package/model instructions above.' }
}
try { & "$PSScriptRoot/create-shortcuts.ps1" -Desktop }
catch { Write-Warning "Setup passed, but shortcuts could not be created: $($_.Exception.Message). You can still use Start-Studio.cmd." }
Write-Host "`nSetup checks passed. Double-click START ByteminusVoiceStudio on your Desktop or in this folder. Keep its terminal open while using the app."
