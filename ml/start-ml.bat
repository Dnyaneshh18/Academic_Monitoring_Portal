@echo off
REM ============================================================
REM  ML Microservice - Local NLP Auto-Evaluation
REM  Starts the Flask service on port 8000
REM ============================================================

REM --- Activate virtual environment if it exists ---
if exist ".venv\Scripts\activate.bat" call ".venv\Scripts\activate.bat"
if exist "venv\Scripts\activate.bat" call "venv\Scripts\activate.bat"

REM --- Install dependencies if flask is missing ---
python -c "import flask" 2>nul
if errorlevel 1 (
    echo [ml] Installing dependencies...
    python -m pip install -r requirements.txt
)

REM --- Start the service ---
echo.
echo ============================================================
echo   ML Microservice starting on http://localhost:8000
echo   Health check: http://localhost:8000/health
echo   Keep this window open while using the portal.
echo ============================================================
echo.
python main.py

pause
