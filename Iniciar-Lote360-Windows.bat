@echo off
title Lote360 Studio - Inicializador Windows
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [ERRO] Node.js nao encontrado. Instale o Node.js LTS em https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [1/2] Instalando dependencias na primeira execucao...
  call npm install
)

echo [2/2] Iniciando Lote360 Studio (App Desktop Windows)...
call npm run electron:start
