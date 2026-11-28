$ErrorActionPreference = 'Stop'
$studioRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot)).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
$listeners = Get-NetTCPConnection -LocalPort 8123 -State Listen -ErrorAction SilentlyContinue
if (!$listeners) { Write-Host 'No neural server is listening on port 8123.'; exit 0 }
foreach ($speechPid in ($listeners.OwningProcess | Select-Object -Unique)) {
    $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId=$speechPid"
    if (!$processInfo.ExecutablePath -or !$processInfo.ExecutablePath.StartsWith($studioRoot, [StringComparison]::OrdinalIgnoreCase) -or $processInfo.CommandLine -notmatch 'neural\.server:app') {
        throw 'Port 8123 is owned by another process. It was not stopped.'
    }
    & taskkill.exe /PID $speechPid /T /F
    if ($LASTEXITCODE -ne 0) { throw 'Could not stop the old neural server.' }
}
Write-Host 'Stopped this project neural server and its workers. Start npm run dev again.'
