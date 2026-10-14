@echo off
cd /d "%~dp0"
rem Al arrancar el PC el servicio de SQL Server puede tardar: hasta 20
rem reintentos de 15s (5 min) antes de rendirse, ver iniciar.js.
set DB_REINTENTOS=20
node iniciar.js >> inicio.log 2>&1
