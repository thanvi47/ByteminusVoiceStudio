param([switch]$Desktop)
$ErrorActionPreference = 'Stop'
$studioRoot = Split-Path -Parent $PSScriptRoot
$launcher = Join-Path $studioRoot 'Start-Studio.cmd'
$icon = Join-Path $studioRoot 'public/studio-start.ico'
if (!(Test-Path -LiteralPath $launcher) -or !(Test-Path -LiteralPath $icon)) { throw 'Launcher or icon is missing. Update the full project first.' }
$shortcutShell = New-Object -ComObject WScript.Shell
$destinations = @($studioRoot)
if ($Desktop) { $destinations += [Environment]::GetFolderPath('Desktop') }
foreach ($destination in $destinations) {
    if (!$destination) { continue }
    $shortcut = $shortcutShell.CreateShortcut((Join-Path $destination 'START ByteminusVoiceStudio.lnk'))
    $shortcut.TargetPath = $launcher
    $shortcut.WorkingDirectory = $studioRoot
    $shortcut.IconLocation = "$icon,0"
    $shortcut.Description = 'Click to start ByteminusVoiceStudio and open the voice studio in your browser.'
    $shortcut.WindowStyle = 1
    $shortcut.Save()
    Write-Host "Created START ByteminusVoiceStudio in $destination"
}
