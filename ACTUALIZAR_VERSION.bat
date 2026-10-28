@echo off
echo ============================================================
echo   CapaSuite - Incremento Automatico de Version
echo ============================================================
echo.
node tools/bump-version.js %*
echo.
echo Presione cualquier tecla para salir...
pause >nul
