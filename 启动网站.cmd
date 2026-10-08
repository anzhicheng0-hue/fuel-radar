@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-Website.ps1" -Open
if errorlevel 1 pause
