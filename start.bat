@echo off
REM Windows Batch file to install dependencies and start the server
REM This bypasses PowerShell execution policy issues

echo Installing Node.js dependencies...
call npm install

echo.
echo Creating .env file from template if it doesn't exist...
if not exist .env (
    copy .env.example .env
    echo Please edit .env file with your API keys before running the server
)

echo.
echo Starting development server...
call npm run dev