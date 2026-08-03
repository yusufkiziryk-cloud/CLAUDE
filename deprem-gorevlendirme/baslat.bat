@echo off
chcp 65001 >nul
title Deprem Gorevlendirme Sistemi
set PORT=3000
echo Uygulama baslatiliyor... (durdurmak icin bu pencereyi kapatin)
echo Adres: http://localhost:%PORT%
call npm start
pause
