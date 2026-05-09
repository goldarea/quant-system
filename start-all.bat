@echo off
setlocal

cd /d "%~dp0"

start "Quant System Backend" cmd /k ""%~dp0start-backend.bat""
start "Quant System Frontend" cmd /k ""%~dp0start-frontend.bat""

echo Backend:  http://127.0.0.1:8000
echo Frontend: http://127.0.0.1:5173
