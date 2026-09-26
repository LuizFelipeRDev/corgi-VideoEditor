# Regras de Build e Release

## Binarios permitidos na build (extraResources)
- `bin/auto-editor.exe`
- `bin/ffmpeg.exe`
- `bin/ffplay.exe`
- `bin/ffprobe.exe`
- `bin/whisper/ggml-tiny.bin` — UNICO modelo permitido no pacote
- `bin/whisper-cpu/` — build CPU oficial do whisper.cpp (whisper-cli.exe + whisper.dll + ggml.dll + ggml-base.dll + ggml-cpu-*.dll + runtime VC++ msvcp140/vcruntime140/vcomp140, ~11 MB) — permite gerar legenda com o tiny SEM nenhum download

## Binarios PROIBIDOS na build
- `bin/whisper/whisper-cli.exe` e `bin/whisper/*.dll` — set CUDA de DEV; em producao o whisper embutido vem de `bin/whisper-cpu/`
- `bin/whisper/ggml-*.bin` (exceto tiny) — usuario baixa pelo menu
- CUDA DLLs (ggml-cuda.dll, cublas64_12.dll, cudart64_12.dll, nvrtc...) — baixadas pelo usuario via download GPU
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
      whisper-cli.exe        (bundled CPU; CUDA download substitui)
      ggml*.dll / ggml-cpu-*.dll / runtime VC++ (bundled CPU)
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
