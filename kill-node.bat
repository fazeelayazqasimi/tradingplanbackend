@echo off
taskkill /f /im node.exe 2>nul
timeout /t 2 /nobreak >nul