@echo off
setlocal
set TASKNAME=GestionDocumental

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Pidiendo permiso de administrador...
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

schtasks /delete /tn "%TASKNAME%" /f
echo.
echo Listo, la tarea de arranque automatico fue eliminada.
echo (La app sigue estando en esta carpeta, solo dejo de arrancar sola.)
pause
