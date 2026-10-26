@echo off
set "PATH=C:\Users\8344511\AppData\Local\Programs\nodejs24;%PATH%"
title JobCoach - close this window to stop the app
cd /d "%~dp0"
echo ==================================================
echo  Starting JobCoach... DO NOT close this window!
echo  Browser will open http://127.0.0.1:5173 soon.
echo  If page fails to load, wait 10s then press F5.
echo ==================================================
timeout /t 8 >nul
start "" "http://127.0.0.1:5173"
npm run dev
pause
