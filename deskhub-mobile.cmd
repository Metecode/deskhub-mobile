@echo off
rem Double-click: sets deskhub-mobile up and starts it. See README.md.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\launch.ps1" %*
if errorlevel 1 pause
