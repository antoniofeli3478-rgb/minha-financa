@echo off
chcp 65001 >nul
title Minhas Financas
cd /d "%~dp0"
where py >nul 2>nul && (py -3 financas.py & goto fim)
where python >nul 2>nul && (python financas.py & goto fim)
echo.
echo  O Python nao foi encontrado.
echo  Instale em https://www.python.org/downloads/  (marque "Add python.exe to PATH")
echo  Ou abra o arquivo app\index.html direto no navegador (modo navegador).
echo.
:fim
pause
