# Build and Release Rules

## Allowed Binaries in the Build (extraResources)
- `bin/auto-editor.exe`
- `bin/ffmpeg.exe`
- `bin/ffplay.exe`
- `bin/ffprobe.exe`
- `bin/whisper/ggml-tiny.bin` — ONLY model allowed in the bundle
- `bin/whisper-cpu/` — official CPU build of whisper.cpp (whisper-cli.exe + whisper.dll + ggml.dll + ggml-base.dll + ggml-cpu-*.dll + VC++ runtime msvcp140/vcruntime140/vcomp140, ~11 MB) — allows generating subtitles using tiny WITHOUT any download

## FORBIDDEN Binaries in the Build
- `bin/whisper/whisper-cli.exe` and `bin/whisper/*.dll` — DEV CUDA setup; in production, embedded whisper comes from `bin/whisper-cpu/`
- `bin/whisper/ggml-*.bin` (except tiny) — downloaded by the user via the menu
- CUDA DLLs (ggml-cuda.dll, cublas64_12.dll, cudart64_12.dll, nvrtc...) — downloaded by the user via GPU download
- `dist/win-unpacked/` — electron-builder output, do not bundle

## CUDA (NVIDIA GPU)
- DO NOT include in the app build
- Delivered via GitHub Releases: upload `whisper-cuda.zip` (~422 MB)
- URL: `https://github.com/LuizFelipeRDev/corgi-editor/releases/download/v1.0.0/whisper-cuda.zip`
- User downloads via the "DOWNLOAD GPU" button in Settings > General
- Files extracted to `%APPDATA%/corgi-editor/bin/whisper/`

## Whisper Models
- Only `ggml-tiny.bin` comes bundled in the build
- Other models (base, small, medium, large-v3) are downloaded by the user
- Downloads are saved to `%APPDATA%/corgi-editor/bin/whisper/`

## Production Directory Structure
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
      whisper-cli.exe        (bundled CPU; CUDA download replaces it)
      ggml*.dll / ggml-cpu-*.dll / VC++ runtime (bundled CPU)
      ggml-cuda.dll          (downloaded via CUDA)
      cublas64_12.dll        (downloaded via CUDA)
      ...                    (other downloaded models)
  fonts/
    *.ttf
```

## Subtitle Editing Rules
- "SPLIT" button removed from SubtitlesPanel
- "SAVE" button remains semi-transparent (opacity-30) as long as there are no edits
- When editing any subtitle (text, timing, adding, deleting), the "SAVE" button becomes active
- Upon saving, serializes the subtitle array back to SRT format and writes it to the `_words.srt` file