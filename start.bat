@echo off
setlocal

echo.
echo =========================================
echo   Eventadex — Starting without Docker
echo =========================================
echo.

:: Check Node
node --version >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install from https://nodejs.org
  pause & exit /b 1
)

:: Check pm2
pm2 --version >nul 2>&1
if errorlevel 1 (
  echo [INFO] Installing pm2 and serve globally...
  call npm install -g pm2 serve
)

:: Check serve
serve --version >nul 2>&1
if errorlevel 1 (
  echo [INFO] Installing serve globally...
  call npm install -g serve
)

:: Check server/.env exists
if not exist "server\.env" (
  echo [ERROR] server\.env not found.
  echo         Copy .env.example to server\.env and fill in MONGO_URI and JWT_SECRET.
  pause & exit /b 1
)

:: Build React apps if dist folders are missing
if not exist "client-master\dist" (
  echo [INFO] Building React apps — this takes ~30 seconds...
  call npm run build:all
)

echo.
echo [INFO] Starting all services via pm2...
call npm run start:prod

echo.
echo [INFO] Done! Services running at:
echo        Platform Admin   : http://localhost:3000
echo        Event Admin      : http://localhost:3001
echo        Registration Form: http://localhost:3002
echo        API              : http://localhost:5000/api/health
echo.
echo [INFO] Run "npm run logs"   to tail logs
echo [INFO] Run "npm run stop"   to stop all services
echo [INFO] Run "npm run status" to check pm2 status
echo.
pause
