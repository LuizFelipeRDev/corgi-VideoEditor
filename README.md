# CORGI-EDITOR

Automatic video/audio editing with AI-powered subtitles.

![Version](https://img.shields.io/badge/version-1.2.0-blue)
![Platform](https://img.shields.io/badge/platform-Windows-lightgrey)
![License](https://img.shields.io/badge/license-MIT-green)

<!-- Version is defined in: src/global_config/version.js -->
<!-- Update package.json version to match -->

---

## What is CORGI-EDITOR?

CORGI-EDITOR is a desktop application for automatic video and audio editing. It removes silences, generates word-level subtitles using AI (whisper.cpp), and exports with burned-in subtitles in multiple styles.

### Key Features

- **Auto-silence removal** — Automatically cuts silences from video/audio using auto-editor
- **AI subtitle generation** — Word-level transcription via whisper.cpp with CUDA GPU support
- **7 subtitle styles** — Hormozi, MrBeast, Karaoke, Minimal, Word Pop, Simple, Highlight Box
- **Live preview** — Real-time subtitle overlay with word-by-word animation
- **Per-style configuration** — Custom fonts, colors, font size, words per line per style
- **Smart subtitle mode** — Automatic sentence-break detection at punctuation
- **Output resolution** — Original, Landscape (16:9), or Portrait (9:16)
- **Green screen mode** — Generate subtitle video with green background for chroma key
- **Multiple formats** — MP3, WAV, FLAC, OGG, AAC, M4A, MP4, MKV, MOV, WEBM, AVI

---

## Installation

### Download

Download the latest installer from [GitHub Releases](https://github.com/LuizFelipeRDev/corgi-editor/releases).

### Steps

1. Run the `.exe` installer (NSIS — allows custom install directory)
2. Launch CORGI-EDITOR
3. (Optional) Go to **Settings > General** and click **BAIXAR GPU** for faster subtitle generation
4. (Optional) Download larger whisper models (base, small, medium, large-v3) from Settings

### First Launch

On first run, bundled binaries are copied to `%APPDATA%/corgi-editor/`:
- `auto-editor.exe` — silence removal
- `ffmpeg.exe`, `ffplay.exe`, `ffprobe.exe` — media processing
- `ggml-tiny.bin` — default whisper model (75 MB)

---

## How to Use

### 1. Import Media

Drag and drop a video or audio file onto the application window, or click to browse.

### 2. Configure Settings

Click the gear icon to open Settings:

| Tab | Options |
|-----|---------|
| **Geral** | Output folder, GPU download, whisper model |
| **Saida** | Output format, resolution (Original/Landscape/Portrait) |
| **Legendas** | Enable subtitles, position, words per line, persistence, smart mode |

### 3. Adjust Audio Processing

Use the sliders in the Controls panel:
- **Threshold** (dB) — Volume level to detect silence (default: -30 dB)
- **Margin** (seconds) — Buffer around detected silences (default: 0.5s)

### 4. Generate Subtitles

1. Enable subtitles in Settings > Legendas
2. Choose a subtitle style from the Subtitles panel
3. Click **GERAR LEGENDAS** — whisper.cpp transcribes with word-level timestamps
4. Preview the subtitles on the video in real-time

### 5. Export

Click **EXPORTAR** to process the file:
1. auto-editor removes silences
2. Subtitles are remapped to the edited timeline
3. FFmpeg encodes the final output with embedded subtitles

---

## Subtitle Styles

| Style | Font | Animation | Best For |
|-------|------|-----------|----------|
| **Hormozi** | Montserrat | Highlight (cyan) | Business & motivation |
| **MrBeast** | Komika Axis | Bounce (gold) | Gaming & entertainment |
| **Karaoke** | Montserrat | Cumulative fill | Music & sing-alongs |
| **Minimal** | Bebas Neue | Scale | Professional & clean |
| **Word Pop** | Montserrat | Pop animation (cyan) | TikTok & viral content |
| **Simple** | Montserrat | Static | Podcast & conversation |
| **Highlight Box** | Montserrat | Background box on active word (purple) | Viral & trending content |

### Per-Style Configuration

Click the gear icon next to any style to customize:
- **Font** — 16 bundled fonts: Montserrat, Bebas Neue, Bangers, Lilita One, Komika Axis, IBM Plex Sans, Anton, Archivo Black, Poppins, Rubik, Roboto, Oswald, Inter, Fira Sans Condensed, Luckiest Guy, Titan One (all free for commercial use — see `src/global_config/fonts/LICENSES.md`)
- **Font Size** — 60-200 range
- **Colors** — Primary (text) and Highlight (active word)
- **Words per Line** — 3-6 words
- **Lines Count** — 1-3 lines

---

## Smart Subtitle Mode

When enabled in Settings > Legendas:
- Detects sentence-ending punctuation (`.`, `!`, `?)
- Removes trailing periods from displayed text
- `!` and `?` remain visible
- Automatically breaks subtitle blocks at sentence boundaries

**Example:**
- Input: `"Oi ricardo, voce conhece Samantha? Ela"`
- Without smart: One block with all 6 words
- With smart: `"Oi ricardo, voce conhece Samantha?"` → `"Ela é minha amiga da escola"`

---

## Subtitle Persistence

Controls how long subtitles remain visible during silence gaps.

| Setting | Behavior |
|---------|----------|
| **0.5s** | Minimal persistence — subtitles disappear quickly |
| **1.0s** (default) | Standard — subtitles persist 1 second between phrases |
| **2.0s** | Extended — subtitles stay longer during pauses |
| **3.0s** | Maximum — subtitles persist up to 3 seconds |

---

## GPU Support (CUDA)

GPU acceleration is available for NVIDIA GPUs:

1. Go to **Settings > General**
2. Click **BAIXAR GPU (NVIDIA)** (~422 MB download)
3. The app downloads `whisper-cuda.zip` from GitHub Releases
4. Files are extracted to `%APPDATA%/corgi-editor/bin/whisper/`

### Downloaded Files

| File | Purpose |
|------|---------|
| `whisper-cli.exe` | whisper.cpp CLI with CUDA support |
| `ggml-cuda.dll` | CUDA inference backend |
| `cublas64_12.dll` | NVIDIA cuBLAS library |

---

## Whisper Models

| Model | Size | VRAM | Speed | Quality |
|-------|------|------|-------|---------|
| **Tiny** | 75 MB | ~1 GB | Fast | Basic |
| **Base** | 142 MB | ~1 GB | Fast | Better |
| **Small** | 466 MB | ~2 GB | Medium | Good balance |
| **Medium** | 1.5 GB | ~5 GB | Slow | High quality |
| **Large v3** | 2.9 GB | ~10 GB | Slowest | Best quality |

Only `ggml-tiny.bin` is bundled. Download others from Settings > General.

---

## Configuration

Settings are saved automatically in `%APPDATA%/corgi-editor/config.ini`.

---

## License

MIT License

---

---

# Português

## O que é o CORGI-EDITOR?

CORGI-EDITOR é uma aplicação desktop para edição automática de vídeo e áudio. Ele remove silêncios, gera legendas com nível de palavra usando IA (whisper.cpp) e exporta com legendas queimadas em múltiplos estilos.

### Funcionalidades Principais

- **Remoção automática de silêncios** — Corta silêncios automaticamente usando auto-editor
- **Geração de legendas com IA** — Transcrição nível de palavra via whisper.cpp com suporte CUDA GPU
- **7 estilos de legenda** — Hormozi, MrBeast, Karaoke, Minimal, Word Pop, Simple, Highlight Box
- **Pré-visualização em tempo real** — Overlay de legendas com animação palavra por palavra
- **Configuração por estilo** — Fontes, cores, tamanho, palavras por linha personalizáveis
- **16 fontes embutidas** — Montserrat, Bebas Neue, Bangers, Lilita One, Komika Axis, IBM Plex Sans, Anton, Archivo Black, Poppins, Rubik, Roboto, Oswald, Inter, Fira Sans Condensed, Luckiest Guy e Titan One (todas gratuitas para uso comercial — veja `src/global_config/fonts/LICENSES.md`)
- **Modo legenda inteligente** — Detecção automática de quebra de frase em pontuação
- **Quebra automática de linha** — Quando o texto não cabe na largura, quebra a linha e mantém o mesmo grupo (opcional)
- **Resolução de saída** — Original, Paisagem (16:9) ou Retrato (9:16)
- **Modo tela verde** — Gera vídeo com legendas e fundo verde para chroma key
- **Múltiplos formatos** — MP3, WAV, FLAC, OGG, AAC, M4A, MP4, MKV, MOV, WEBM, AVI

---

## Instalação

### Download

Baixe o instalador mais recente em [GitHub Releases](https://github.com/LuizFelipeRDev/corgi-editor/releases).

### Passos

1. Execute o instalador `.exe` (NSIS — permite diretório de instalação personalizado)
2. Inicie o CORGI-EDITOR
3. (Opcional) Vá em **Configurações > Geral** e clique em **BAIXAR GPU** para legendas mais rápidas
4. (Opcional) Baixe modelos maiores do whisper (base, small, medium, large-v3) nas Configurações

---

## Como Usar

### 1. Importar Mídia

Arraste e solte um arquivo de vídeo ou áudio na janela, ou clique para procurar.

### 2. Configurar

Clique no ícone de engrenagem para abrir Configurações:

| Aba | Opções |
|-----|--------|
| **Geral** | Pasta de destino, download GPU, modelo whisper |
| **Saída** | Formato, resolução (Original/Paisagem/Retrato) |
| **Legendas** | Ativar legendas, posição, palavras por linha, persistência, modo inteligente, quebra automática de linha |

### 3. Ajustar Processamento de Áudio

Use os sliders no painel Controles:
- **Limiar** (dB) — Nível de volume para detectar silêncio (padrão: -30 dB)
- **Margem** (segundos) — Buffer ao redor dos silêncios detectados (padrão: 0,5s)

### 4. Gerar Legendas

1. Ative as legendas em Configurações > Legendas
2. Escolha um estilo na legenda no painel Legendas
3. Clique em **GERAR LEGENDAS** — whisper.cpp transcreve com timestamps nível de palavra
4. Visualize as legendas no vídeo em tempo real

### 5. Exportar

Clique em **EXPORTAR** para processar o arquivo:
1. auto-editor remove os silêncios
2. Legendas são remapeadas para a linha do tempo editada
3. FFmpeg codifica a saída final com legendas embutidas

---

## Estilos de Legenda

| Estilo | Fonte | Animação | Ideal Para |
|--------|-------|----------|------------|
| **Hormozi** | Montserrat | Highlight (ciano) | Business e motivação |
| **MrBeast** | Komika Axis | Bounce (dourado) | Gaming e entretenimento |
| **Karaoke** | Montserrat | Preenchimento acumulado | Música e karaoke |
| **Minimal** | Bebas Neue | Escala | Profissional e limpo |
| **Word Pop** | Montserrat | Pop animação (ciano) | TikTok e conteúdo viral |
| **Simple** | Montserrat | Estático | Podcast e conversação |
| **Highlight Box** | Montserrat | Caixa de fundo na palavra ativa (roxo) | Viral e trending |

---

## Suporte GPU (CUDA)

Aceleração GPU disponível para GPUs NVIDIA:

1. Vá em **Configurações > Geral**
2. Clique em **BAIXAR GPU (NVIDIA)** (~422 MB)
3. O app baixa `whisper-cuda.zip` do GitHub Releases
4. Arquivos são extraídos para `%APPDATA%/corgi-editor/bin/whisper/`

---

## Licença

Licença MIT
