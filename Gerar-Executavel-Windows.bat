@echo off
title Lote360 Studio - Gerador de Executavel Windows (.exe)
cd /d "%~dp0"

if not exist "node_modules" (
  echo Instalando dependencias...
  call npm install
)

echo Compilando instalador e executavel portatil (.exe) em release/...
call npm run dist:win
echo.
echo Concluido! Verifique a pasta dist_electron / dist para o arquivo .exe.
pause
