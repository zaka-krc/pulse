@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

set "PY=backend\.venv\Scripts\python.exe"
if not exist "%PY%" (
    if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
        set "SYS_PY=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    ) else (
        set "SYS_PY=python"
    )
    echo [setup] Creation de l'environnement virtuel Python...
    "!SYS_PY!" -m venv backend\.venv || exit /b 1
    echo [setup] Installation des dependances Python...
    "%PY%" -m pip install -q --disable-pip-version-check -r backend\requirements-dev.txt || exit /b 1
)

if not exist "frontend\node_modules" (
    echo [setup] Installation des dependances npm...
    pushd frontend
    call npm.cmd install --no-audit --no-fund
    popd
)

if /I "%~1"=="test" (
    echo === Backend : ruff + pytest ===
    pushd backend
    .venv\Scripts\ruff.exe check . || (popd & exit /b 1)
    .venv\Scripts\python.exe -m pytest || (popd & exit /b 1)
    popd
    echo.
    echo === Frontend : tsc + vitest ===
    pushd frontend
    call npm.cmd run typecheck || (popd & exit /b 1)
    call npx.cmd vitest run || (popd & exit /b 1)
    popd
    exit /b 0
)

echo.
echo ===============================================================
echo   Pulse Tracker - Demarrage (API FastAPI + Frontend React)
echo   Application : http://localhost:5173
echo   Swagger API : http://localhost:8000/api/docs
echo   Arret       : Ctrl+C
echo ===============================================================
echo.

"%PY%" -u -c "import os, subprocess, threading, time; env = {**os.environ, 'PULSE_SEED_DEMO': 'true', 'PYTHONUNBUFFERED': '1'}; py = os.path.abspath(r'backend/.venv/Scripts/python.exe'); cmds = [('api', [py, '-m', 'uvicorn', 'app.main:app', '--reload', '--port', '8000'], 'backend'), ('front', ['cmd.exe', '/c', 'npm.cmd', 'run', 'dev'], 'frontend')]; procs = [subprocess.Popen(c, cwd=d, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8', errors='replace') for _, c, d in cmds]; [threading.Thread(target=lambda n, p: [print(f'[{n}] {line}', end='', flush=True) for line in p.stdout], args=(name, proc), daemon=True).start() for (name, _, _), proc in zip(cmds, procs)]; exec('try:\n while all(p.poll() is None for p in procs): time.sleep(0.3)\nexcept KeyboardInterrupt:\n pass\nfinally:\n print(\"\\nArret des services...\", flush=True)\n for p in procs: subprocess.run([\"taskkill\", \"/F\", \"/T\", \"/PID\", str(p.pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)')"
