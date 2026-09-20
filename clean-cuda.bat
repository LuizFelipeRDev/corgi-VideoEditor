@echo off
echo Deletando arquivos CUDA de bin\whisper...
del /q "E:\02-Programacao\11-ProjetoPessoal\corgi-editor\bin\whisper\*.dll" 2>nul
del /q "E:\02-Programacao\11-ProjetoPessoal\corgi-editor\bin\whisper\whisper-cli.exe" 2>nul
echo.
echo Arquivos restantes:
dir "E:\02-Programacao\11-ProjetoPessoal\corgi-editor\bin\whisper"
echo.
pause
