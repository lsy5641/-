@echo off
chcp 65001 >nul
title JobCoach 求职助手（关闭本窗口即停止软件）
cd /d "%~dp0"
echo ==============================================
echo  正在启动 JobCoach，启动期间请勿关闭本窗口
echo  首次启动约需 10-30 秒，浏览器随后会自动打开
echo  地址: http://localhost:5173
echo  （若页面打不开，等几秒后按 F5 刷新）
echo ==============================================
timeout /t 8 >nul
start "" "http://localhost:5173"
npm run dev
pause
