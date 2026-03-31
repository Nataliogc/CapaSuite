@echo off
setlocal
echo ===================================================
echo    CapaSuite - Servidor Local Optimizado 2026
echo ===================================================
echo.
echo CapaSuite requiere un servidor local para funcionar 
echo correctamente (CORS, Firebase y Almacenamiento).
echo.

REM Set desired port
set PORT=8000

echo [1/3] Comprobando entorno...
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [+] Python detectado. Iniciando servidor...
    start http://localhost:%PORT%
    python -m http.server %PORT%
    goto END
)

py --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [+] Python Launcher detectado. Iniciando servidor...
    start http://localhost:%PORT%
    py -3 -m http.server %PORT%
    goto END
)

node --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [+] Node.js detectado. Usando npx http-server...
    start http://localhost:%PORT%
    npx http-server -p %PORT%
    goto END
)

echo.
echo [!] ERROR: No se ha encontrado ni Python ni Node.js.
echo.
echo SOLUCION: 
echo 1. Instala Python desde python.org 
echo 2. O instala Node.js desde nodejs.org
echo 3. O abre 'index.html' directamente (algunas funciones fallarán)
echo.

:END
pause
