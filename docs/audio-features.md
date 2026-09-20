# Audio Features - Plano Futuro

## Visao Geral

Adicionar processamento de audio no corgi-editor utilizando os filtros do ffmpeg ja embutido no `bin/ffmpeg.exe`.

## Funcionalidades Planejadas

### 1. Reducao de Ruido
- **Filtro**: `afftdn=nf=-25`
- **Descricao**: Redutor de ruido baseado em FFT. Remove ruido de fundo (ventilador, ar condicionado, estatica) preservando a voz.
- **Valor padrao**: `nf=-25` (noise floor em -25dB, equilibrio entre reducao e qualidade)

### 2. Normalizador de Volume
- **Filtro**: `loudnorm=I=-16:TP=-1.5:LRA=11`
- **Descricao**: Normalizacao EBU R128. Padroniza o volume para niveis consistentes, ideal para YouTube e redes sociais.
- **Parametros**:
  - `I=-16` - Loudness alvo (-16 LUFS, padrao YouTube)
  - `TP=-1.5` - Teto de pico (-1.5 dBTP)
  - `LRA=11` - Loudness Range (11 LU, dynamics)

### 3. Compressor de Voz
- **Filtro**: `compand=attacks=0.3:decays=0.8:points=-80/-80|-45/-45|-27/-20|0/-7:gain=3`
- **Descricao**: Compressao de faixa dinamica para voz mais encorpada e uniforme. Reduz a diferenca entre partes baixas e altas.
- **Parametros**:
  - `attacks=0.3` - Tempo de ataque (300ms)
  - `decays=0.8` - Tempo de decay (800ms)
  - `points` - Curva de compressao
  - `gain=3` - Ganho extra (+3dB)

## Ordenacao dos Filtros

```
audio original → afftdn (ruido) → compand (compressao) → loudnorm (normalizacao) → saida
```

1. Primeiro remove ruido (para nao amplificar ruido depois)
2. Depois comprime (uniformiza dinamica)
3. Por ultimo normaliza (volume padrao)

## Comando FFmpeg Completo

```bash
ffmpeg -i input.mp4 -af "afftdn=nf=-25,compand=attacks=0.3:decays=0.8:points=-80/-80|-45/-45|-27/-20|0/-7:gain=3,loudnorm=I=-16:TP=-1.5:LRA=11" -c:v copy output.mp4
```

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `electron/main.cjs` | Defaults: `audio_denoise`, `audio_normalize`, `audio_compressor` |
| `src/App.jsx` | useState, loadConfig, handleSaveSettings, filtro `-af` no handleExport |
| `src/components/SettingsModal.jsx` | Nova aba "Audio" com 3 checkboxes ON/OFF |

## UI Planejada

Aba **"Audio"** no SettingsModal (junto com Geral, Saida, Legendas):

```
┌─────────────────────────────────────┐
│  [x] Reducao de ruido              │
│      Remove ruido de fundo          │
│                                     │
│  [x] Normalizar volume             │
│      Volume padrao YouTube          │
│                                     │
│  [x] Compressor de voz             │
│      Voz mais encorpada             │
└─────────────────────────────────────┘
```

## Config.ini

```ini
audio_denoise=false
audio_normalize=false
audio_compressor=false
```

## Notas Tecnicas

- Os filtros sao aplicados **depois** do corte de silencio (auto-editor)
- Para videos: usa `-af` (aplica no audio, mantem video com `-c:v copy`)
- Para audios: usa `-af` no encode final
- `afftdn` e mais leve que `arnndn` (RNN), suficiente para maioria dos casos
- `loudnorm` faz 2 passes internamente para melhor precisao
- `compand` e o filtro mais versatil - pode ser ajustado para podcast, entrevista, etc.
