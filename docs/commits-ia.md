## Regras de Build e Release

### Binarios permitidos na build (extraResources)
- `bin/auto-editor.exe`
- `bin/ffmpeg.exe`
- `bin/ffplay.exe`
- `bin/ffprobe.exe`
- `bin/whisper/ggml-tiny.bin` — UNICO modelo permitido no pacote

### Binarios PROIBIDOS na build
- `bin/whisper/whisper-cli.exe` — usuario baixa via CUDA download
- `bin/whisper/ggml-*.bin` (exceto tiny) — usuario baixa pelo menu
- `bin/whisper/*.dll` — CUDA DLLs baixadas pelo usuario
- `dist/win-unpacked/` — output do electron-builder, nao empacotar

### CUDA (GPU NVIDIA)
- NAO incluir na build do app
- Entrega via GitHub Releases: upload de `whisper-cuda.zip` (~422 MB)
- URL fixa: `https://github.com/LuizFelipeRDev/corgi-editor/releases/download/v1.0.0/whisper-cuda.zip`
- Usuario baixa pelo botao "BAIXAR GPU" nas Configuracoes > Geral
- Arquivos extraidos para `%APPDATA%/corgi-editor/bin/whisper/`

### Modelos de whisper
- Apenas `ggml-tiny.bin` vem embutido na build
- Demais modelos (base, small, medium, large-v3) sao baixados pelo usuario
- Downloads salvos em `%APPDATA%/corgi-editor/bin/whisper/`

### Estrutura de diretorios em producao
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
      cublas64_12.dll         (downloaded via CUDA)
      ...                    (outros modelos downloads)
  fonts/
    *.ttf
```

### Build target
- **NSIS installer** (`dist/CORGI-EDITOR-Setup-*.exe`)
- Instalador uma vez em `C:\Program Files\CORGI-EDITOR\`
- App roda da pasta de instalacao — abre instantaneamente
- NAO usar `portable` (extrai a cada execucao, sempre lento)

# Git — Commit, Tag and Release

Push the changes to GitHub following ****strictly**** the conventions below.

*>* ****IMPORTANT:**** *Do not invent information, versions, features, fixes, or files.*

*> Use only information demonstrably present in the changes made to the project or provided by the user.*

---

## Commits

Commit the changes.

### Message Format

The message must be ****short and objective****, following:

`<type>: <version> - short description of the changes`

Example:

`feat: v1.3.0 - playlist subfolder, show-filesize option, deploy docs`

### Allowed Types

Use only one of the following types:

* `feat` — new feature
* `docs` — documentation
* `chore` — maintenance tasks
* `fix` — problem fix
* `bugfix` — bug fix
* `perf` — performance improvement
* `refactor` — refactoring without behavior changes
* `style` — style/formatting changes
* `test` — tests
* `revert` — reverting a change
* `ci` — integration/automation
* `build` — build-related changes

### Important Rules

* ****All commit, release, and tag messages MUST be written in ENGLISH.****
* Do not invent the commit type.
* Analyze the actual changes (`git diff`, `git status`) before determining the type.
* Do not describe features that are not present in the changes.
* Do not include changes unrelated to the purpose of the commit.
* Do not automatically run `git add .` if this could include unrelated files.
* Check which files will be included before committing.
* Do not modify files just to justify a commit message.
* If there are unrelated changes, ask the user whether they should be included.
* The message must represent ****only what was actually changed****.

---

## Versions

The version must follow:

* `v1.0.0` = first stable release
* `v0.1.0` = module implementation, significant feature, refactoring, or significant change
* `v0.0.1` = fixes, bugfixes, small adjustments, etc.

* Check if `src/components/AboutModal.jsx` has the new version. If it isn't, adjust the version.


### Mandatory Rule

****The version MUST NOT be invented or automatically inferred.****

* The user must specify which version they want to use.
* If the user ****does not provide the version****, STOP and ask which version should be used.
* Do not choose `v0.0.1`, `v0.1.0`, or any other version on your own.
* Do not modify `package.json`, `package-lock.json`, `version`, manifests, or other version-related files unless the user explicitly requested it.
* Do not create a new version based solely on the quantity or importance of the changes.

---

## Tags

After the commit, create and push the tag corresponding to the version provided by the user.

### Tag Format

The tag must follow:

`v1.3.0`

And the tag message must follow:

`Release v1.3.0`

### Mandatory Rules

* The user must provide the version.
* If the version has not been provided, ****ask before continuing****.
* Do not invent the version.
* Do not create additional tags.
* Do not modify or overwrite an existing tag without the user's explicit authorization.
* Before creating the tag, check whether it already exists.
* The tag must point to the commit created in this operation.
* After creating the tag, push the tag to GitHub.

---

## Release

Create the Release corresponding to the created tag.

### Title

The Release title must be:

`Release v1.3.0`

Replace `v1.3.0` with the version provided by the user.

### Release Body

The body must contain:

1. The version.
2. A summary of the changes made.
3. The changes organized according to the `commit info`.
4. Only information verified by the changes made.

Example:

```commit

## feat: v1.3.0 - playlist subfolder, show-filesize option, deploy docs

### Features

- **Rename**: YtCorgiDown → CorgiDown

- **Multiplatform**: Support for Facebook, Dailymotion, Bilibili, and other sites via yt-dlp

- **Crop thumbnail 1:1**: Music covers cropped to a square aspect ratio (center crop)

- **Metadata warning**: Message when link information cannot be retrieved (5 seconds)

### Fix

- "Saved to:" message now displays the correct file path

- Video format with fallbacks for compatibility with more sites

- ffmpeg path corrected for thumbnail cropping

- Automatic cleanup of residual `.jpg` files

- Detailed error including yt-dlp `stderr`

### Stack

- Electron 44 + Vite 6 + React 19 + Tailwind CSS 4

- yt-dlp + ffmpeg + Deno

```

### Mandatory Release Rules

* If the user asks to attach the program build to the Release, generate a new build and place it in a ZIP file.
