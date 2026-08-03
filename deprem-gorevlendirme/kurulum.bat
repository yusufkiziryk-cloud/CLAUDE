@echo off
chcp 65001 >nul
title Deprem Gorevlendirme Sistemi - Kurulum
echo ============================================
echo  Deprem Gorevlendirme Sistemi - KURULUM
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo HATA: Node.js bulunamadi. Lutfen once https://nodejs.org adresinden LTS surumunu kurun.
  pause
  exit /b 1
)

echo [1/4] Bagimliliklar kuruluyor (birkac dakika surebilir)...
call npm install --no-audit --no-fund
if errorlevel 1 ( echo HATA: npm install basarisiz oldu. & pause & exit /b 1 )

echo [2/4] Ayar dosyasi olusturuluyor...
if not exist .env copy .env.example .env >nul

echo [3/4] Demo verisi yukleniyor...
call npm run seed
if errorlevel 1 ( echo HATA: seed basarisiz oldu. & pause & exit /b 1 )

echo [4/4] Uygulama derleniyor...
call npm run build
if errorlevel 1 ( echo HATA: derleme basarisiz oldu. & pause & exit /b 1 )

echo.
echo ============================================
echo  KURULUM TAMAMLANDI
echo  Baslatmak icin: baslat.bat
echo  Adres: http://localhost:3000
echo ============================================
pause
