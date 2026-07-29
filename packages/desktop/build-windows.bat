@echo off
setlocal

echo === Installing dependencies ===
cd /d "%~dp0.."
call bun install

echo === Prebuilding ===
cd /d "%~dp0"
call bun run prebuild

echo === Building ===
call bun run build

echo === Packaging for Windows ===
call bun run package:win

echo === Done ===
echo Output: dist\opencode-desktop-win-x64.exe
