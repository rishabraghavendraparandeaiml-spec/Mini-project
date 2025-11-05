@echo off
REM Install dependencies only
echo Installing Node.js dependencies...
call npm install
echo.
echo Dependencies installed successfully!
echo.
echo Next steps:
echo 1. Copy .env.example to .env
echo 2. Edit .env with your API keys
echo 3. Run: npm start (or npm run dev for development)
pause