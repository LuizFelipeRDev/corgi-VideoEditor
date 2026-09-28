/*
  English (DEFAULT) — fonte de referencia das chaves.
  Regras:
  - Chaves pontilhadas e estaveis; nunca usar o texto visivel como chave.
  - Todo idioma deve ter EXATAMENTE as mesmas chaves deste arquivo
    (paridade checada em index.js / checkLangParity).
  - Textos entre {chave} sao interpolados: t('chave', { chave: valor }).
  - Este arquivo e a traducao do PT que ja existia no UI; PT mantem o texto
    original byte a byte.
*/
export default {
  // --- Comum ---
  'common.save': 'SAVE',
  'common.yes': 'YES',
  'common.no': 'NO',
  'common.close': 'CLOSE',
  'common.error': 'ERROR',

  // --- Abas do SettingsModal ---
  'tabs.system': 'System',
  'tabs.general': 'General',
  'tabs.output': 'Output',
  'tabs.subtitles': 'Subtitles',

  // --- Aba Sistema ---
  'system.language': 'LANGUAGE',
  'system.languageHint': 'System Language.',
  'system.theme': 'THEME',
  'system.themeHint': 'Interface appearance, applied immediately.',

  // --- Settings > Geral ---
  'settings.folderLabel': 'OUTPUT FOLDER',
  'settings.folderPlaceholder': 'Same folder as the file',
  'settings.gpuLabel': 'GPU (NVIDIA)',
  'settings.gpuTooltip': 'For NVIDIA graphics cards, subtitle generation is faster with CUDA installed.',
  'settings.gpuInstalled': 'GPU installed',
  'settings.reinstall': 'REINSTALL',
  'settings.gpuNotInstalled': 'Not installed',
  'settings.downloadGpu': 'DOWNLOAD GPU (NVIDIA)',
  'settings.openDriversFolder': 'OPEN DRIVERS FOLDER',
  'settings.whisperModel': 'WHISPER MODEL',
  'settings.modelOption': '{label} ({size}) - GPU: {vram}',
  'settings.downloading': 'Downloading {model}...',
  'settings.modelNotDownloaded': 'Model not downloaded',
  'settings.downloadModelBtn': 'DOWNLOAD MODEL',
  'settings.modelInstalled': 'Model installed',
  'settings.modelDesc.tiny': 'Fast, basic quality',
  'settings.modelDesc.base': 'Better than tiny, still fast',
  'settings.modelDesc.small': 'Good speed/quality balance',
  'settings.modelDesc.medium': 'High quality, slower',
  'settings.modelDesc.large-v3': 'Maximum quality, very slow',

  // --- Settings > Saida ---
  'settings.formatLabel': 'OUTPUT FORMAT',
  'settings.resolutionLabel': 'OUTPUT RESOLUTION',
  'settings.resOriginal': 'Original',
  'settings.resLandscape': 'Landscape (16:9)',
  'settings.resPortrait': 'Portrait (9:16)',
  'settings.resOriginalDesc': 'Same resolution as input video',
  'settings.resLandscapeDesc': '1920x1080 - Standard 16:9 format',
  'settings.resPortraitDesc': '1080x1920 - 9:16 format for phones',
  'settings.auto': 'Auto',
  'settings.audioNoBurn': 'Current format ({format}) does not support burned-in subtitles',

  // --- Settings > Legendas ---
  'settings.enableSubtitles': 'Enable subtitles',
  'settings.positionModeLabel': 'POSITION MODE',
  'settings.posFixed': 'Preset position',
  'settings.posFree': 'Free adjust',
  'settings.wordsPerLine': 'WORDS PER LINE',
  'settings.linesCount': 'LINES PER SUBTITLE',
  'settings.persistence': 'SUBTITLE PERSISTENCE — {value}s',
  'settings.persistenceHint': 'Time the subtitle stays visible between phrases',
  'settings.smartSubtitle': 'Smart subtitle',
  'settings.smartTooltip': 'Auto-break on punctuation (. ! ?). Removes the final dot, keeps ! and ?',
  'settings.burnSubtitles': 'Burn subtitles into file',
  'settings.burnTooltip': 'Attaches the subtitle to the video instead of creating an SRT file.',
  'settings.burnSrtOnly': 'Only a separate .srt file will be generated',
  'settings.requiresVideo': 'Requires video format (MP4, MKV, etc)',
  'settings.greenScreen': 'Create video with green background',
  'settings.greenScreenTooltip': 'Option available only for audio input',
  'settings.autoLineWrap': 'Automatic Line Break',
  'settings.autoLineWrapTooltip':
    'Checked: if the text does not fit the width, it breaks the line and stays in the same group until the word count is complete. Unchecked: what does not fit in one line goes to the next subtitle group.',
  'settings.inputDetected': 'Input detected: audio - subtitles will be created on {bg} background',
  'settings.bgGreen': 'green',
  'settings.bgBlack': 'black',

  // --- Confirmacoes (dialogo do SettingsModal) ---
  'settings.confirmBurn': 'Burning subtitles requires video output. Switch to MP4 automatically?',
  'settings.confirmGreen': 'Green background video requires video output. Switch to MP4 automatically?',
  'settings.confirmAudioFormat': 'Audio format does not support burned-in subtitles or green background. Disable these options?',
  'settings.confirmSubtitles': 'Burned-in subtitles require video output. Switch to MP4 automatically?',
  'settings.confirmDownloadModel': 'Download model "{label}" ({size})?',

  // --- Painel de legendas ---
  'panel.title': 'SUBTITLES',
  'panel.style': 'Style',
  'panel.position': 'Position',
  'panel.bottom': 'BOTTOM',
  'panel.top': 'TOP',
  'panel.configBtn': 'SUBTITLE SETTINGS',
  'panel.selectFile': 'Select a file to generate subtitles',
  'panel.noneGenerated': 'No subtitles generated',
  'panel.generate': 'GENERATE SUBTITLES',
  'panel.generating': 'Generating subtitles...',
  'panel.stop': 'STOP',
  'panel.delete': 'DELETE',
  'panel.add': '+ ADD SUBTITLE',
  'panel.regenerate': 'REGENERATE SUBTITLE',
  'panel.regenerating': 'REGENERATING...',

  // --- Waveform (barra de transporte) ---
  'waveform.loading': 'Loading...',
  'waveform.ready': 'Ready',

  // --- Controls (export) ---
  'controls.minVolume': 'MIN VOLUME',
  'controls.margin': 'MARGIN',
  'controls.exportBtn': 'EXPORT',
  'controls.processing': 'PROCESSING...',

  // --- Barra inferior ---
  'bottombar.folder': 'FOLDER:',
  'bottombar.sameAsFile': 'SAME AS FILE',
  'bottombar.about': 'About',
  'bottombar.openOutputFolder': 'Open output folder',
  'bottombar.settings': 'Settings',

  // --- App (erros / toast) ---
  'app.errGenerate': 'Error generating subtitles',
  'app.errGenerateWhisper': 'Error generating subtitles with whisper.cpp',
  'app.errRender': 'Error rendering subtitles',
  'app.errUnknown': 'Unknown error generating subtitles',
  'app.errModelNotInstalled':
    'The model "{model}" is not installed.\n\nGo to Settings (gear icon) > General and download the model.',
  'app.exportToast': 'Export completed!',
  'app.openFolder': 'OPEN FOLDER',

  // --- DropZone (zona de arraste + info do arquivo) ---
  'dropzone.clear': 'Clear',
  'dropzone.orClickHere': 'or click here',
  'dropzone.fullscreen': 'Fullscreen',
  'dropzone.exitFullscreen': 'Exit fullscreen',
  'dropzone.usePlayerBelow': 'Use the player below',
  'dropzone.name': 'NAME:',
  'dropzone.size': 'SIZE:',

  // --- SubtitleConfigModal (configuracao por estilo) ---
  'subConfig.title': 'Settings - {name}',
  'subConfig.font': 'Font',
  'subConfig.fontSize': 'Font size - {size}',
  'subConfig.primaryColor': 'Primary color (text)',
  'subConfig.highlightColor': 'Highlight color (accent)',
  'subConfig.useGlobal': 'Use global settings',
  'subConfig.wordsPerLine': 'Words per line',
  'subConfig.linesCount': 'Subtitle lines',
  'subConfig.reset': 'RESET',

  // --- CudaDownloadModal (download GPU) ---
  'cuda.downloading': 'Downloading GPU files...',
  'cuda.progress': 'Progress',
  'cuda.dontClose': 'Do not close the program',
  'cuda.desc':
    'Downloads the files needed to use the NVIDIA GPU for subtitle generation. Without this, processing uses the CPU and can be slow for models above tiny.',
  'cuda.size': 'Size: ~420 MB',
  'cuda.cancel': 'CANCEL',
  'cuda.download': 'DOWNLOAD',
  'cuda.error': 'Download failed',

  // --- Export (textos de progresso) ---
  'export.converting': 'Converting...',
  'export.analyzingCut': 'Analyzing cut...',
  'export.burning': 'Burning subtitles...',

  // --- Painel (legendas) ---
  'panel.newSubtitle': 'New subtitle',

  // --- Posicoes da legenda (botoes do painel) ---
  'positions.top': 'TOP',
  'positions.middle': 'MIDDLE',
  'positions.bottom': 'BOTTOM',

  // --- Settings > Saida: idioma de saida da legenda ---
  'settings.subtitleLangLabel': 'SUBTITLE LANGUAGE',
  'settings.subtitleLangAuto': 'AUTO (DETECT SPOKEN LANGUAGE)',
  'settings.subtitleLangTooltip':
    'Auto detects the language spoken in the audio (subtitle comes out in that language). English translates any audio to English. Other languages force the spoken language — only use them when the audio really is in that language, otherwise the result comes out wrong.',
  'app.detectedLanguage': 'Detected language: {lang}',

  // --- Advanced sound (v1.7.0) ---
  'sound.modalTitle': 'SOUND SETTINGS',
  'sound.advBtn': 'ADV. SOUND',
  'sound.micTipOn': 'Advanced sound ON — click to turn off',
  'sound.micTipOff': 'Advanced sound OFF — click to turn on',
  'sound.micTipNoFile': 'Load a file first',
  'sound.toastOn': '🔊 Advanced sound enabled',
  'sound.toastOff': 'Advanced sound disabled',
  'sound.toastRendering': 'Rendering treated audio preview...',
  'sound.toastRenderFail': 'Failed to render treated audio preview',
  'sound.preset': 'PRESET',
  'sound.presetSystem': 'SYSTEM',
  'sound.presetCustom': 'MY PRESETS',
  'sound.preset.podcast': 'Podcast / clean voice',
  'sound.preset.broadcast': 'Broadcast (R128)',
  'sound.preset.cleanup': 'Heavy cleanup',
  'sound.preset.uniform': 'Uniform volume',
  'sound.preset.hiss': 'Remove hiss only',
  'sound.saveAs': 'SAVE AS PRESET',
  'sound.presetName': 'Preset name',
  'sound.delete': 'DELETE PRESET',
  'sound.deleteAsk': 'Click again to delete',
  'sound.deleteSystemTip': 'System presets cannot be deleted',
  'sound.chainLabel': 'ACTIVE CHAIN',
  'sound.chainEmpty': 'no treatment — nothing goes to export',
  'sound.tab.noise': 'NOISE',
  'sound.tab.dynamics': 'DYNAMICS',
  'sound.tab.eq': 'EQ',
  'sound.tab.fx': 'EFFECTS',
  'sound.denoise': 'REMOVE NOISE (FFT)',
  'sound.strength': 'Strength',
  'sound.highpass': 'CUT WIND/RUMBLE',
  'sound.lowpass': 'CUT HISS (highs)',
  'sound.freq': 'Frequency',
  'sound.deEss': 'SOFTEN "S" (de-esser)',
  'sound.normalize': 'NORMALIZE LOUDNESS',
  'sound.lufsTarget': 'Target',
  'sound.lufs16': '-16 LUFS (YouTube/podcast)',
  'sound.lufs23': '-23 LUFS (Broadcast)',
  'sound.lufs14': '-14 LUFS (streaming)',
  'sound.comp': 'COMPRESSOR',
  'sound.threshold': 'Threshold',
  'sound.ratio': 'Ratio',
  'sound.attack': 'Attack',
  'sound.limiter': 'LIMITER',
  'sound.limiterHint': 'With normalization on, the max peak becomes the loudnorm TP.',
  'sound.ceiling': 'Max peak',
  'sound.eqOn': 'VOICE EQ',
  'sound.tone': 'Tone',
  'sound.toneFlat': 'Flat',
  'sound.toneBrilho': 'Bright',
  'sound.toneQuente': 'Warm',
  'sound.toneRadio': 'Radio / phone',
  'sound.low': 'Lows',
  'sound.mid': 'Mids',
  'sound.high': 'Highs',
  'sound.speed': 'SPEED',
  'sound.speedWarn': 'Speeds up audio only — video and subtitles stay at original time (use with care)',
  'sound.echo': 'ECHO / DELAY',
  'sound.echoDelay': 'Delay',
  'sound.echoDecay': 'Decay',
  'sound.listenOriginal': 'PLAY ORIGINAL',
  'sound.listenTreated': 'PLAY TREATED',
  'sound.previewIdle': 'Treated preview not generated yet — pick a preset or use the PLAY TREATED button',
  'sound.previewLoading': 'Generating the treated sound preview...',
  'sound.previewReady': 'Treated preview ready — use the PLAY TREATED button to listen',
  'sound.restore': 'RESTORE',
  'sound.apply': 'APPLY',
  'sound.applyHint': 'APPLY only saves — sound is treated on export',
}
