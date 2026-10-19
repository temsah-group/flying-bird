@echo off
chcp 65001 >nul
title Flying Bird - Public Server
cd /d "%~dp0"

where cloudflared >nul 2>nul
if errorlevel 1 (
  echo cloudflared is not installed. Installing it now...
  winget install --id Cloudflare.cloudflared -e --accept-source-agreements --accept-package-agreements
  echo.
  echo Done. Close this window and double-click run-public.bat again.
  pause
  exit /b
)

echo Starting the auth server...
start "Flying Bird Server" cmd /k "npm start"
timeout /t 5 /nobreak >nul

echo.
echo ============================================================
echo  Opening a public HTTPS link...
echo  Look below for a line like:
echo     https://something-random.trycloudflare.com
echo  Your API link = that link + /api
echo  Keep BOTH windows open. Closing them stops the server.
echo ============================================================
echo.
cloudflared tunnel --url http://localhost:3000
pause
