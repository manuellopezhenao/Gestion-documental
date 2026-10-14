@echo off
setlocal
set TASKNAME=GestionDocumental

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Pidiendo permiso de administrador...
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo Registrando la tarea "%TASKNAME%" para que arranque con Windows...
schtasks /create /tn "%TASKNAME%" /tr "\"%~dp0iniciar.bat\"" /sc onstart /ru SYSTEM /rl HIGHEST /f
if %errorlevel% neq 0 (
    echo.
    echo No se pudo crear la tarea. Revisa el mensaje de arriba.
    pause
    exit /b 1
)

echo.
echo Listo. La app va a arrancar sola la proxima vez que se encienda el PC.
echo Tambien queda corriendo ahora mismo.
schtasks /run /tn "%TASKNAME%"
echo Abriendo el navegador en unos segundos (puede tardar en levantar)...
timeout /t 6 >nul
start http://localhost:3000
pause
