@echo off
setlocal
title ByteminusVoiceStudio
pushd "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\create-shortcuts.ps1"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is missing. Install Node.js 22 LTS, then reopen this launcher.
  pause
  popd
  exit /b 1
)
node scripts\dev-studio.mjs --open
if errorlevel 1 (
  echo.
  echo Studio could not start. Read the error above. Setup must finish before starting.
  pause
)
popd
endlocal
