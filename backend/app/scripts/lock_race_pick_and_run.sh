@echo off
REM ─────────────────────────────────────────────────────────────────────────────
REM FlashSeat — Pick seat and run 500-concurrent lock race test (Windows)
REM
REM Usage (from repo root):
REM     lock_race_pick_and_run.bat http://localhost:8000
REM     lock_race_pick_and_run.bat http://localhost:8000 200
REM ─────────────────────────────────────────────────────────────────────────────

set BASE_URL=%~1
set CONCURRENT=%~2

if "%BASE_URL%"=="" (
    echo [ERROR] Usage: lock_race_pick_and_run.bat ^<base-url^> [concurrent-users]
    exit /b 1
)

if "%CONCURRENT%"=="" (
    set CONCURRENT=500
)

set PICK_SCRIPT=app\scripts\db_pick_seat_for_race.py
set TEST_SCRIPT=app\scripts\lock_race_load_test.py
set PICK_JSON=%TEMP%\flashseat_pick.json
set REPORT_OUT=app\scripts\lock_race_report.json

REM ── Step 1: Pick seat identifiers from DB ─────────────────────────────────
echo [1/3] Picking available seat from DB...
cd backend
python -m app.scripts.db_pick_seat_for_race --db-only > %PICK_JSON%

if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to pick seat from DB. Is the backend running?
    exit /b 1
)

REM ── Step 2: Parse JSON using PowerShell ──────────────────────────────────
echo [2/3] Parsing seat identifiers...

for /f "usebackq delims=" %%A in (
    `powershell -NoProfile -Command "(Get-Content '%PICK_JSON%' | ConvertFrom-Json).event_id"`
) do set EVENT_ID=%%A

for /f "usebackq delims=" %%A in (
    `powershell -NoProfile -Command "(Get-Content '%PICK_JSON%' | ConvertFrom-Json).session_id"`
) do set SESSION_ID=%%A

for /f "usebackq delims=" %%A in (
    `powershell -NoProfile -Command "(Get-Content '%PICK_JSON%' | ConvertFrom-Json).seat_id"`
) do set SEAT_ID=%%A

for /f "usebackq delims=" %%A in (
    `powershell -NoProfile -Command "(Get-Content '%PICK_JSON%' | ConvertFrom-Json).seat_label"`
) do set SEAT_LABEL=%%A

if "%EVENT_ID%"=="" (
    echo [ERROR] Could not parse event_id from pick output.
    exit /b 1
)

echo.
echo    Event ID   : %EVENT_ID%
echo    Session ID : %SESSION_ID%
echo    Seat ID    : %SEAT_ID%
echo    Seat Label : %SEAT_LABEL%
echo    Users      : %CONCURRENT%
echo.

REM ── Step 3: Run load test ─────────────────────────────────────────────────
echo [3/3] Running load test with %CONCURRENT% concurrent users...
python -m app.scripts.lock_race_load_test ^
    --base-url %BASE_URL% ^
    --event-id %EVENT_ID% ^
    --session-id %SESSION_ID% ^
    --seat-id %SEAT_ID% ^
    --concurrent-users %CONCURRENT% ^
    --phase1-delay-ms 0 ^
    --out %REPORT_OUT%

if %ERRORLEVEL% neq 0 (
    echo [ERROR] Load test failed.
    exit /b 1
)

echo.
echo [DONE] Report saved to: backend\%REPORT_OUT%