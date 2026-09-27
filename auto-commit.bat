@echo off
setlocal
cd /d "%~dp0"
echo Starting Git Auto-Commit & Push Watcher (every 15 minutes)...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\auto-commit-push.ps1" %*
endlocal
