@echo off
chcp 65001 > nul
title Notes - 笔记应用
color 0A

cd /d "%~dp0"

echo.
echo  ╔═══════════════════════════════════════════════╗
echo  ║       Notes 笔记应用 v1.2.0                  ║
echo  ╚═══════════════════════════════════════════════╝
echo.

:: 检查 Node.js
where node > nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

:: 检查端口
netstat -ano | findstr ":5173" > nul
if %errorlevel% equ 0 (
    echo [提示] 检测到服务已运行，正在打开浏览器...
    start http://localhost:5173
) else (
    echo [启动] 正在启动开发服务器...
    echo.

    :: 启动 npm run dev
    start "Notes - 开发服务器" cmd /k "npm run dev"

    :: 等待服务启动
    echo [等待] 服务启动中，请稍候...
    timeout /t 5 /nobreak > nul

    :: 检查是否启动成功
    curl -s http://localhost:5173 > nul 2>&1
    if %errorlevel% equ 0 (
        echo [成功] 服务已启动，正在打开浏览器...
        start http://localhost:5173
    ) else (
        echo [警告] 服务可能启动较慢，请在浏览器中手动访问:
        echo         http://localhost:5173
    )
)

echo.
echo ===============================================
echo  Notes 笔记应用
echo  访问地址: http://localhost:5173
echo ===============================================
echo.
echo  提示: 关闭此窗口不会关闭笔记应用
echo        如需停止服务，请在任务管理器中结束 node.exe
echo.
pause