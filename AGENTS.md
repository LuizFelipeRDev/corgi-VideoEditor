# Regras de Build e Release

## Binarios permitidos na build (extraResources)
- `bin/auto-editor.exe`
- `bin/ffmpeg.exe`
- `bin/ffplay.exe`
- `bin/ffprobe.exe`
- `bin/whisper/ggml-tiny.bin` — UNICO modelo permitido no pacote

## Binarios PROIBIDOS na build
- `bin/whisper/whisper-cli.exe` — usuario baixa via CUDA download
- `bin/whisper/ggml-*.bin` (exceto tiny) — usuario baixa pelo menu
- `bin/whisper/*.dll` — CUDA DLLs baixadas pelo usuario
- `dist/win-unpacked/` — output do electron-builder, nao empacotar

## CUDA (GPU NVIDIA)
- NAO incluir na build do app
- Entrega via GitHub Releases: upload de `whisper-cuda.zip` (~422 MB)
- URL: `https://github.com/LuizFelipeRDev/corgi-editor/releases/download/v1.0.0/whisper-cuda.zip`
- Usuario baixa pelo botao "BAIXAR GPU" nas Configuracoes > Geral
- Arquivos extraidos para `%APPDATA%/corgi-editor/bin/whisper/`

## Modelos de whisper
- Apenas `ggml-tiny.bin` vem embutido na build
- Demais modelos (base, small, medium, large-v3) sao baixados pelo usuario
- Downloads salvos em `%APPDATA%/corgi-editor/bin/whisper/`

## Estrutura de diretorios em producao
```
%APPDATA%/corgi-editor/
  config.ini
  bin/
    auto-editor.exe
    ffmpeg.exe
    ffplay.exe
    ffprobe.exe
    whisper/
      ggml-tiny.bin          (bundled)
      whisper-cli.exe        (downloaded via CUDA)
      ggml-cuda.dll          (downloaded via CUDA)
      cublas64_12.dll        (downloaded via CUDA)
      ...                    (outros modelos downloads)
  fonts/
    *.ttf
```

## Regras de edicao de legendas
- Botao "DIVIDIR" removido do SubtitlesPanel
- Botao "SALVAR" fica opaco (opacity-30) enquanto nao houver edicoes
- Ao editar qualquer legenda (texto, tempo, adicionar, excluir), botao "SALVAR" fica ativo
- Ao salvar, serializa o array de legendas de volta para formato SRT e grava no arquivo `_words.srt`
