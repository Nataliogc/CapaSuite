@echo off
echo =========================================
echo    CapaSuite - Servidor Local
echo =========================================
echo.
echo Intentando iniciar servidor en http://localhost:8000
echo.

REM Prueba con diferentes comandos de Python
py -3 -m http.server 8000 2>nul || python -m http.server 8000 2>nul || python3 -m http.server 8000 2>nul || python -m SimpleHTTPServer 8000 2>nul || (
    echo.
    echo ERROR: No se ha podido iniciar el servidor automaticamente.
    echo.
    echo Para solucionar esto:
    echo 1. Abre Edge y escribe: edge://settings/privacy
    echo 2. Desactiva "Tracking prevention" (Prevencion de seguimiento).
    echo 3. Abre 'index.html' directamente con doble clic.
    echo.
    pause
)
