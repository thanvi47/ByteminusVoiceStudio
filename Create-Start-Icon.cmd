@echo off
setlocal
pushd "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\create-shortcuts.ps1" -Desktop
if errorlevel 1 (
  echo Shortcut could not be created. Read the error above.
  pause
)
popd
endlocal
