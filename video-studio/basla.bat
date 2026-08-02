@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo === AI Video Studyosu baslatiliyor ===

where pnpm >nul 2>nul
if errorlevel 1 (
  echo HATA: pnpm bulunamadi. Node.js 20+ kurun, sonra bir terminalde "corepack enable" calistirin.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Bagimliliklar kuruluyor ^(ilk calistirmada birkac dakika surer^)...
  call pnpm install
  if errorlevel 1 ( pause & exit /b 1 )
)

echo Paketler derleniyor...
call pnpm turbo run build
if errorlevel 1 ( pause & exit /b 1 )

start "AI Video Studyosu - API" cmd /k pnpm --filter @studio/api dev
start "AI Video Studyosu - Web" cmd /k pnpm --filter @studio/web dev

echo.
echo Iki pencere acildi (API + Web). Hazir olunca tarayicida su adresi acin:
echo    http://localhost:3000
echo Kapatmak icin acilan iki pencereyi kapatmaniz yeterli.
pause
