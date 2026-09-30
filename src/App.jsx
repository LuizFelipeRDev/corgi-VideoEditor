import { useState, useEffect, useRef, useMemo } from 'react'
import TitleBar from './components/TitleBar'
import DropZone from './components/DropZone'
import Controls from './components/Controls'
import BottomBar from './components/BottomBar'
import SettingsModal from './components/SettingsModal'
import ConfirmModal from './components/ConfirmModal'
import ErrorModal from './components/ErrorModal'
import InfoModal from './components/InfoModal'
import AboutModal from './components/AboutModal'
import CudaDownloadModal from './components/CudaDownloadModal'
import Toast from './components/Toast'
import SubtitlesPanel from './components/SubtitlesPanel'
import Sidebar from './components/Sidebar'
import AnalyzeModal from './components/AnalyzeModal'
import RnnoiseModal from './components/RnnoiseModal'
import ShortcutsModal from './components/ShortcutsModal'
import RecentProjectsModal from './components/RecentProjectsModal'
import SoundConfigModal from './components/SoundConfigModal'
import CutConfigModal from './components/CutConfigModal'
import Waveform from './components/Waveform'
import { generateAssContent, groupWordsIntoSegments, parsePremiereXml, remapSubtitleTimestamps, ensureExportFontLoaded } from './lib/subtitleRender'
import { buildSoundChain, mergeSoundConfig, DEFAULT_SOUND_CONFIG, findPreset } from './lib/soundChain'
import { parseRecents, touchRecent, evictRecent } from './lib/recentProjects'
import { validateExportRange, shiftSubtitlesForRange } from './lib/exportRange'
import realtimeChain from './lib/realtimeChain'
import { WINDOW_SUBTITLES_WIDTH, WINDOW_NO_SUBTITLES_WIDTH, WINDOW_DEFAULT_HEIGHT } from './global_config/window'
import { SUBTITLE_DISPLAY_DEFAULTS } from './global_config/subtitleConfig'
import { useLang } from './lib/i18n'
import { LANGS } from './global_config/languages'
import { SUBTITLE_LANG_AUTO } from './global_config/subtitleLanguages'

// Alvos da "Resolução de saída" (chaves = valores de output_resolution no
// config.ini e no .corgi.json). 'original' fica de fora: mantém a entrada.
const RESOLUTION_TARGETS = {
  landscape: { w: 1920, h: 1080 },
  landscape720: { w: 1280, h: 720 },
  portrait: { w: 1080, h: 1920 },
}
const resTarget = (r) => RESOLUTION_TARGETS[r] || null

function App() {
  const { t, lang } = useLang()
  const [selectedFile, setSelectedFile] = useState(null)
  const [outputFolder, setOutputFolder] = useState('')
  const [outputFormat, setOutputFormat] = useState('mp3')
  const [outputResolution, setOutputResolution] = useState('original')
  const [threshold, setThreshold] = useState('-30')
  const [marginVal, setMarginVal] = useState('0.5')
  // Cut: asymmetric margin (before/after) + smoothness (auto-editor --smooth)
  const [marginAfter, setMarginAfter] = useState('0.5')
  const [smooth, setSmooth] = useState('0.2')
  // --- AUTO CUT (v1.10.1): single toggle for silence cutting ---
  // OFF = preview and export WITHOUT cutting (like it used to be — silences intact);
  // ON = the cut was already generated (auto-editor, ON REQUEST — never by
  // itself) and the preview plays/shows the final result. cutState = { path, segments, fps }
  // of the preview's cut file (cutmap to remap subtitles and markers).
  const [cutEnabled, setCutEnabled] = useState(false)
  const [cutBusy, setCutBusy] = useState(false)
  const [cutState, setCutState] = useState(null)
  const [showCutConfig, setShowCutConfig] = useState(false)
  // Ref to the CURRENT file: generateCutPreview discards the result if the
  // user switches files mid-generation (the selectedFile closure would go
  // stale after the await).
  const selectedFileRef = useRef(null)
  useEffect(() => {
    selectedFileRef.current = selectedFile
  }, [selectedFile])
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState({ pct: 0, text: '0%' })
  const [showSettings, setShowSettings] = useState(false)
  const [showError, setShowError] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const whisperStoppingRef = useRef(false)
  const whisperGenRef = useRef(0)
  const [showAbout, setShowAbout] = useState(false)
  const [showExportToast, setShowExportToast] = useState(false)
  const [infoToast, setInfoToast] = useState(null)
  const [showAnalyze, setShowAnalyze] = useState(false)
  const [showRnnoise, setShowRnnoise] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false) // modal de atalhos (barra lateral)
  // Modal "ABRIR" (projetos recentes): lista vem do config no momento de abrir
  const [showRecent, setShowRecent] = useState(false)
  const [recentProjects, setRecentProjects] = useState([])
  // Status do modelo neural (get-rnnoise-status no boot): installed + path.
  const [rnnoiseStatus, setRnnoiseStatus] = useState(null)
  const [advancedTools, setAdvancedTools] = useState(true)
  const [exportedFolderPath, setExportedFolderPath] = useState('')
  const [showCudaModal, setShowCudaModal] = useState(false)
  const [cudaInstalled, setCudaInstalled] = useState(false)
  const [projectFilePath, setProjectFilePath] = useState(null) // v1.8.0: .corgi.json atual (salvo/aberto)
  const [confirmNewOpen, setConfirmNewOpen] = useState(false) // modal "salvar antes de limpar?"
  const [errorMessage, setErrorMessage] = useState('')
  const errorBuffer = useRef('')
  // Erro específico do ffmpeg (com stderr): chega antes do onFfmpegDone e
  // NÃO pode ser sobrescrito pela mensagem genérica de legenda.
  const ffmpegErrRef = useRef('')
  const lastPct = useRef(0)
  const videoDurationRef = useRef(0)
  const videoRef = useRef(null)
  const exportingRef = useRef(false)
  const waveSurferRef = useRef(null)
  const globalConfigRef = useRef(null) // v1.8.0: config.ini lido no boot (base do NOVO PROJETO)

  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false)
  const [subtitleModel, setSubtitleModel] = useState('tiny')
  const [subtitleLanguage, setSubtitleLanguage] = useState('auto')
  const [subtitlePosition, setSubtitlePosition] = useState('bottom')
  const [positionMode, setPositionMode] = useState('fixed')
  const [positionPercent, setPositionPercent] = useState(80)
  const [subtitleStyle, setSubtitleStyle] = useState('hormozi')
  const [greenScreen, setGreenScreen] = useState(false)
  const [burnSubtitles, setBurnSubtitles] = useState(true)
  const [subtitles, setSubtitles] = useState([])
  const [generatingSubtitles, setGeneratingSubtitles] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [seekTo, setSeekTo] = useState(null)
  const [wordsPerLine, setWordsPerLine] = useState(4)
  const [linesCount, setLinesCount] = useState(2)
  const [subtitlePersistence, setSubtitlePersistence] = useState(1)
  const [smartSubtitle, setSmartSubtitle] = useState(false)
  const [autoLineWrap, setAutoLineWrap] = useState(false)
  // Espacamento horizontal da legenda ate a borda/parede do video, em % da
  // largura. So produz efeito com autoLineWrap ligado (o valor efetivo é
  // calculado nos pontos de consumo: export e preview).
  const [subtitleHMargin, setSubtitleHMargin] = useState(0.5)
  const [subtitleConfigs, setSubtitleConfigs] = useState({})
  const [subtitlesEdited, setSubtitlesEdited] = useState(false)

  // --- Faixa de exportação (marcas I/O da onda) ---------------------------
  // start/end em SEGUNDOS; null = sem marca. selectedMarker = marca clicada
  // na onda, que o Delete apaga. exportRange é limpo ao trocar de arquivo.
  const [exportRange, setExportRange] = useState({ start: null, end: null })
  const [selectedMarker, setSelectedMarker] = useState(null)

  // --- Ctrl+Z (desfazer) --------------------------------------------------
  // Pilha de snapshots do array de legendas, guardados ANTES de cada edição
  // manual (texto/tempo, apagar, adicionar, limpar).
  const subtitlesHistoryRef = useRef([])
  const subtitlesRef = useRef(subtitles)

  // --- v1.7.0: tratamento de som -----------------------------------------
  // soundConfig.enabled é o interruptor MESTRE (botão 🎤): com ele desligado
  // o modal fica inacessível e NENHUMA cadeia vai para o export.
  const [soundConfig, setSoundConfig] = useState(DEFAULT_SOUND_CONFIG)
  const [customPresets, setCustomPresets] = useState([])
  const [showSound, setShowSound] = useState(false)
  const [abMode, setAbMode] = useState(null) // null = segue o 🎤 | 'original' | 'treated'
  const [realtimeDraft, setRealtimeDraft] = useState(null) // rascunho do modal em audição
  const [playRequest, setPlayRequest] = useState(0) // incrementa para tocar (A/B)

  // Margem horizontal EFETIVA (%): 0 quando a quebra automatica esta
  // desligada => export cai nos 10px legados e a preview no maxWidth 85/90%.
  const hMarginPct = autoLineWrap ? subtitleHMargin : 0

  // Aplica o config.ini (configuracoes GLOBAIS) nos estados — usado no boot e
  // pelo NOVO PROJETO, que precisa desfazer o que um projeto aberto sobrescreveu.
  const applyConfig = (c) => {
    if (!c) return
    setThreshold(c.threshold)
    setMarginVal(c.margin)
    setMarginAfter(c.margin_after ?? '0.5')
    setSmooth(c.smooth ?? '0.2')
    setOutputFormat(c.output_format || 'mp3')
    setOutputResolution(c.output_resolution || 'original')
    if (c.output_folder) setOutputFolder(c.output_folder)
    setSubtitlesEnabled(c.subtitles === 'true')
    setSubtitleModel(c.subtitle_model || 'tiny')
    setSubtitleLanguage(c.subtitle_language || 'auto')
    setSubtitlePosition(c.subtitle_position || 'bottom')
    setPositionMode(c.subtitle_position_mode || 'fixed')
    setPositionPercent(Math.min(70, Math.max(5, Number(c.subtitle_position_percent) || 80)))
    setSubtitleStyle(c.subtitle_style || 'hormozi')
    setGreenScreen(c.green_screen === 'true')
    setBurnSubtitles(c.burn_subtitles !== 'false')
    setWordsPerLine(Number(c.words_per_line) || 4)
    setLinesCount(Number(c.lines_count) || 2)
    setSubtitlePersistence(Number(c.subtitle_persistence) || 1)
    setSmartSubtitle(c.smart_subtitle === 'true')
    setAutoLineWrap(c.auto_line_wrap === 'true')
    const hMargin = Number(c.subtitle_h_margin)
    setSubtitleHMargin(Number.isFinite(hMargin) ? Math.min(20, Math.max(0, hMargin)) : 0.5)
    setAdvancedTools(c.advanced_tools !== 'false')
    try { setSubtitleConfigs(JSON.parse(c.subtitle_configs || '{}')) } catch { setSubtitleConfigs({}) }
    try { setSoundConfig(mergeSoundConfig(JSON.parse(c.sound_config || 'null'))) } catch { setSoundConfig(mergeSoundConfig(null)) }
    try { setCustomPresets(JSON.parse(c.sound_presets || '[]') || []) } catch { setCustomPresets([]) }
  }

  useEffect(() => {
    window.api.getConfig().then((c) => {
      globalConfigRef.current = c
      applyConfig(c)
    })

    window.api.checkCudaInstalled().then(setCudaInstalled)

    // Modelo neural (rnnoise): status inicial — installed + path pro -af.
    window.api.rnnoiseStatus?.().then((s) => s && setRnnoiseStatus(s)).catch(() => {})

    window.api.onOutput((raw) => {
      const clean = raw.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1b\[\?[0-9]*[a-zA-Z]/g, '')
      for (const line of clean.split('\n')) {
        const t = line.trim()
        if (!t) continue
        const tildeIdx = t.lastIndexOf('~')
        if (tildeIdx === -1) continue
        const remaining = parseFloat(t.substring(tildeIdx + 1))
        if (isNaN(remaining)) continue
        const pct = Math.max(0, Math.min(100, Math.round((1 - remaining) * 100)))
        if (pct >= lastPct.current) {
          lastPct.current = pct
          setProgress({ pct, text: `${pct}%` })
        }
        return
      }
      if (clean.includes('Finished')) setProgress({ pct: 100, text: '100%' })
      errorBuffer.current += raw
    })

    window.api.onDone((ok) => {
      if (!exportingRef.current) setProcessing(false)
      if (ok) {
        setProgress({ pct: 100, text: '100%' })
      } else {
        setProgress({ pct: 0, text: t('common.error') })
        if (errorBuffer.current.trim()) {
          setErrorMessage(errorBuffer.current.trim())
          setShowError(true)
        }
      }
      errorBuffer.current = ''
    })

    window.api.onError((msg) => {
      setErrorMessage(msg)
      setShowError(true)
    })

    window.api.onWhisperOutput((raw) => {
      console.log('Whisper output:', raw)
    })

    window.api.onWhisperDone((ok) => {
      setGeneratingSubtitles(false)
      if (!ok) {
        setErrorMessage(t('app.errGenerate'))
        setShowError(true)
      }
    })

    window.api.onWhisperError((msg) => {
      setGeneratingSubtitles(false)
      setErrorMessage(msg)
      setShowError(true)
    })

    window.api.onWhisperCliOutput((raw) => {
      console.log('Whisper CLI output:', raw)
      if (raw.includes('CUDA: no') || raw.includes('CUDA devices: 0')) {
        console.log('CUDA não detectado, usando CPU')
      }
    })

    window.api.onWhisperCliDone((ok) => {
      if (whisperStoppingRef.current) {
        setGeneratingSubtitles(false)
        return
      }
      setGeneratingSubtitles(false)
      if (!ok) {
        setErrorMessage(t('app.errGenerateWhisper'))
        setShowError(true)
      }
    })

    window.api.onWhisperCliError((msg) => {
      if (whisperStoppingRef.current || (msg && msg.toLowerCase().includes('cancelado'))) {
        setGeneratingSubtitles(false)
        return
      }
      setGeneratingSubtitles(false)
      if (msg) {
        setErrorMessage(msg)
        setShowError(true)
      }
    })

    window.api.onFfmpegOutput((raw) => {
      if (videoDurationRef.current > 0) {
        const timeMatch = raw.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/)
        if (timeMatch) {
          const [, hh, mm, ss, cs] = timeMatch
          const currentSecs = parseInt(hh) * 3600 + parseInt(mm) * 60 + parseInt(ss) + parseInt(cs) / 100
          const pct = Math.min(99, Math.round((currentSecs / videoDurationRef.current) * 100))
          if (pct > lastPct.current && pct >= 90) {
            lastPct.current = pct
            setProgress({ pct, text: `${pct}%` })
          }
        }
      }
    })

    window.api.onFfmpegDone((ok) => {
      if (!ok) {
        // O main manda ffmpeg-error (específico, com stderr) ANTES do done;
        // sem este ref a mensagem real era engolida pela genérica.
        setErrorMessage(ffmpegErrRef.current || t('app.errRender'))
        setShowError(true)
      }
      ffmpegErrRef.current = ''
    })

    window.api.onFfmpegError((msg) => {
      ffmpegErrRef.current = msg
      console.error('[ffmpeg]', msg)
      setErrorMessage(msg)
      setShowError(true)
    })
  }, [])

  useEffect(() => {
    if (subtitlesEnabled) {
      window.api.resizeWindow(WINDOW_SUBTITLES_WIDTH, WINDOW_DEFAULT_HEIGHT)
    } else {
      window.api.resizeWindow(WINDOW_NO_SUBTITLES_WIDTH, WINDOW_DEFAULT_HEIGHT)
    }
  }, [subtitlesEnabled])

  // --- v1.8.0: prévia em TEMPO REAL ("A/B instantâneo") ---------------------
  // A cadeia do 🎤 roda em Web Audio DENTRO do AudioContext do wavesurfer
  // (realtimeChain). Trocar de lado do A/B é um crossfade de ganho: sem
  // render ffmpeg, sem recarregar a fonte — dá pra ouvir na hora, de onde a
  // playhead estiver. O 'treated' ouve o RASCUNHO do modal; o resto, a cfg
  // salva. O EXPORT continua usando o ffmpeg exato.
  const realtimeActive = abMode === 'treated' || (soundConfig.enabled && abMode !== 'original')
  const realtimeCfg = abMode === 'treated' && realtimeDraft ? realtimeDraft : soundConfig
  // A FORMA da onda acompanha o que está sendo OUVIDO: tratada quando a
  // prévia está ativa e há o que tratar, original no lado A / 🎤 off.
  const shapeCfg = useMemo(
    () => (realtimeActive && buildSoundChain(realtimeCfg) ? realtimeCfg : null),
    [realtimeActive, realtimeCfg]
  )
  useEffect(() => {
    realtimeChain.setConfig(realtimeCfg)
    realtimeChain.setBypass(!realtimeActive)
  }, [realtimeCfg, realtimeActive])

  // Player (WebAudioPlayer) entregue pelo Waveform a cada criação/destruição
  const handlePlayerCreated = (player) => realtimeChain.attach(player)

  // Troca/limpeza de arquivo: zera o A/B e o rascunho em audição — a cadeia
  // em tempo real é religada no player novo pelo Waveform (handlePlayerCreated)
  useEffect(() => {
    setAbMode(null)
    setRealtimeDraft(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile])

  // 🎤: interruptor mestre do Som Avançado — a prévia em tempo real acompanha
  // na hora (crossfade no player, sem pausar nem renderizar nada)
  const handleToggleSound = async () => {
    if (!selectedFile || processing || generatingSubtitles) return
    const next = { ...soundConfig, enabled: !soundConfig.enabled }
    setSoundConfig(next)
    setAbMode(null)
    setRealtimeDraft(null)
    await handleSaveSettings({ sound_config: next })
    setInfoToast(next.enabled ? t('sound.toastOn') : t('sound.toastOff'))
  }

  // --- AUTO CUT (v1.10.1) ---------------------------------------------------
  // File the PREVIEW plays/shows: the cut one while the cut is on.
  // selectedFile stays the ORIGINAL — export always starts from it (and trims
  // the I/O range first, a contract the preview does not reproduce).
  const previewFile = useMemo(
    () =>
      cutEnabled && cutState && cutState.srcPath === selectedFile?.path
        ? { ...selectedFile, path: cutState.path }
        : selectedFile,
    [selectedFile, cutEnabled, cutState]
  )

  // Preview subtitles remapped to the cut timeline (same remap as export).
  // The edit panel stays on the ORIGINAL timeline: edit the source and remap
  // on the fly is exactly the export contract.
  const previewSubtitles = useMemo(
    () =>
      cutEnabled && cutState?.segments?.length && cutState.srcPath === selectedFile?.path
        ? remapSubtitleTimestamps(subtitles, cutState.segments, cutState.fps)
        : subtitles,
    [subtitles, selectedFile, cutEnabled, cutState]
  )

  // Generates the preview cut: auto-editor (cut audio) + Premiere cutmap
  // (segments to remap preview subtitles). Runs ON REQUEST ONLY — toggling
  // the switch on, saving config with the cut on, or applying the analyzer's
  // suggestion. `over` injects fresh threshold/margin (avoids a stale
  // closure right after setState).
  const generateCutPreview = async (over = {}) => {
    if (!selectedFile || cutBusy) return
    const thr = over.threshold ?? threshold
    const mar = over.margin ?? marginVal
    const marAfter = over.marginAfter ?? marginAfter
    const sm = over.smooth ?? smooth
    const base = selectedFile.name.replace(/\.[^.]+$/, '')
    const inputExt = selectedFile.name.split('.').pop().toLowerCase()
    // Asymmetric margin: equal → simple form (exactly like always);
    // different → "before,after" (auto-editor --margin A,B). Smoothness 0 →
    // --smooth 0 (off; the auto-editor docs use the bare number).
    const marginArg = mar === marAfter ? `${mar}s` : `${mar}s,${marAfter}s`
    const smoothArg = sm === '0' ? '0' : `${sm}s`
    const edit = [
      '--edit', `audio:${Math.pow(10, parseFloat(thr) / 20)}`,
      '--margin', marginArg,
      '--smooth', smoothArg,
    ]
    const startedPath = selectedFile.path
    // This file already has a cut WITH THESE PARAMETERS (e.g.: modal SAVE
    // with nothing changed): don't spawn auto-editor for nothing.
    if (
      cutState &&
      cutState.srcPath === startedPath &&
      cutState.thr === thr &&
      cutState.mar === mar &&
      cutState.marAfter === marAfter &&
      cutState.sm === sm
    ) {
      setCutEnabled(true)
      return
    }
    setCutBusy(true)
    try {
      const cutPath = await window.api.joinPath(selectedFile.folder, `${base}_CUT.${inputExt}`)
      const res = await window.api.runAutoEditor([selectedFile.path, ...edit, '--output', cutPath])
      if (!res.success) {
        console.warn('[cut] auto-editor falhou na prévia:', res.error)
        setInfoToast(t('cut.failed'))
        return
      }
      // cutmap: same segments as export, to remap preview subtitles
      let segments = null
      let fps = 24
      try {
        const xmlPath = await window.api.joinPath(selectedFile.folder, 'corgi_cutmap.xml')
        const xr = await window.api.runAutoEditorExport([
          selectedFile.path, '--export', 'premiere', ...edit, '--output', xmlPath
        ])
        if (xr.success) {
          const xmlText = await window.api.readFile(xmlPath)
          if (xmlText) {
            const parsed = parsePremiereXml(xmlText)
            if (parsed.segments.length > 0) {
              segments = parsed.segments
              fps = parsed.fps
            }
          }
          await window.api.deleteFile(xmlPath)
        } else {
          console.warn('[cut] cutmap falhou:', xr.error)
        }
      } catch (e) {
        console.warn('[cut] cutmap falhou (prévia segue sem remapear legendas):', e)
      }
      // File switched mid-generation: throw the CUT file away and do NOT
      // turn the toggle on for the new file (its preview doesn't exist yet —
      // the switch effect already reset the state).
      if (selectedFileRef.current?.path !== startedPath) {
        window.api.deleteFile(cutPath).catch(() => {})
        return
      }
      setCutState({ path: cutPath, segments, fps, srcPath: startedPath, thr, mar, marAfter, sm })
      setCutEnabled(true)
    } catch (e) {
      console.error('[cut] falha ao gerar corte da prévia:', e)
      setInfoToast(t('cut.failed'))
    } finally {
      setCutBusy(false)
    }
  }

  // Master toggle: OFF goes back to the original ("like it was before",
  // deleting the generated .CUT); ON generates the cut (the button shows
  // GENERATING CUT...) and the preview starts playing/showing the final result.
  const handleToggleCut = async () => {
    if (!selectedFile || processing || generatingSubtitles || cutBusy) return
    if (cutEnabled) {
      const old = cutState
      setCutEnabled(false)
      setCutState(null)
      if (old?.path) window.api.deleteFile(old.path).catch(() => {})
      return
    }
    await generateCutPreview()
  }

  // New file → start with no cut and the previous .CUT leaves the disk.
  useEffect(() => {
    if (cutState?.path) window.api.deleteFile(cutState.path).catch(() => {})
    setCutEnabled(false)
    setCutState(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile?.path])

  // Prévia A/B do modal — em TEMPO REAL: 'original' só põe o bypass (crossfade),
  // 'treated' troca a cfg do RASCUNHO (preset/ajustes ainda não aplicados) na
  // cadeia. Troca na hora, na posição atual — sem render e sem recarga.
  // NUNCA trata o arquivo final.
  const handleListenSound = (mode, draftCfg) => {
    if (!selectedFile || processing) return
    if (mode === 'treated') {
      const cfg = draftCfg || soundConfig
      // Cadeia vazia (tudo desligado) não tem o que tratar — toca o original
      if (!buildSoundChain(cfg)) {
        setAbMode('original')
      } else {
        setRealtimeDraft(cfg)
        setAbMode('treated')
      }
    } else {
      setAbMode('original')
    }
    setPlayRequest((r) => r + 1)
  }

  // APLICAR do modal: só SALVA e fecha — nada é tratado naquele momento (o
  // tratamento roda apenas na exportação). A prévia em tempo real passa a
  // seguir a cfg salva (o efeito do realtimeChain já religa a cadeia) e a
  // FORMA da onda redesenha conforme a nova cfg (render offline).
  const handleApplySound = async (cfg) => {
    setShowSound(false)
    setAbMode(null)
    setRealtimeDraft(null)
    await handleSaveSettings({ sound_config: cfg })
  }

  const handleSoundPresets = (presets) => handleSaveSettings({ sound_presets: presets })

  // --- v1.8.0: projetos ----------------------------------------------------
  const cloneDeep = (o) => JSON.parse(JSON.stringify(o))

  // Snapshot do que o projeto precisa para reabrir igual: mídia, legenda
  // gerada, PRESET de som (id + 🎤; tweaks não salvos como preset se perdem),
  // config de legenda e os ajustes de corte/exportação.
  const buildProjectData = () => ({
    version: 1,
    savedAt: new Date().toISOString(),
    mediaPath: selectedFile?.path || null,
    subtitles,
    subtitlesEdited,
    sound: { enabled: soundConfig.enabled, presetId: soundConfig.presetId },
    subtitle: {
      enabled: subtitlesEnabled,
      style: subtitleStyle,
      position: subtitlePosition,
      positionMode,
      positionPercent,
      wordsPerLine,
      linesCount,
      autoLineWrap,
      hMargin: subtitleHMargin,
      greenScreen,
      burnSubtitles,
      configs: subtitleConfigs,
    },
    generation: { model: subtitleModel, language: subtitleLanguage, persistence: subtitlePersistence, smart: smartSubtitle },
    edit: { threshold, margin: marginVal, marginAfter, smooth },
    export: { format: outputFormat, resolution: outputResolution },
  })

  // [💾]: primeira vez abre o "Salvar como" (pasta da mídia + nome dela);
  // depois que já existe caminho, regrava por cima sem perguntar.
  const handleSaveProject = async () => {
    if (processing || generatingSubtitles) return false
    let target = projectFilePath
    if (!target) {
      const defaultName = selectedFile ? selectedFile.name.replace(/\.[^.]+$/, '') : 'projeto'
      target = await window.api.selectProjectSavePath({ defaultDir: selectedFile?.folder || '', defaultName })
      if (!target) return false
    }
    const res = await window.api.writeFile(target, JSON.stringify(buildProjectData(), null, 2))
    if (res && res.success) {
      setProjectFilePath(target)
      setInfoToast(t('project.saved'))
      markProjectRecent(target) // salvo agora → topo dos recentes (fire-and-forget)
      return true
    }
    setErrorMessage(res?.error || t('project.saveFailed'))
    setShowError(true)
    return false
  }

  // Registra o projeto nos recentes (config.ini → recent_projects; o
  // save-config do main faz merge de chaves, então nada mais é tocado).
  // Chamado em abrir e em salvar — fonte da verdade é o config, sem lista
  // duplicada no renderer (o modal relê no momento de abrir).
  const markProjectRecent = async (path) => {
    if (!path) return
    try {
      const cur = await window.api.getConfig()
      const next = touchRecent(parseRecents(cur?.recent_projects), path)
      await window.api.saveConfig({ recent_projects: JSON.stringify(next) })
    } catch (err) {
      console.warn('[project] falha ao atualizar recentes:', err)
    }
  }

  // Recent ilegível (arquivo sumiu/corrompido) → tira da lista (auto-limpeza)
  const dropProjectRecent = async (path) => {
    try {
      const cur = await window.api.getConfig()
      const next = evictRecent(parseRecents(cur?.recent_projects), path)
      await window.api.saveConfig({ recent_projects: JSON.stringify(next) })
    } catch (err) {
      console.warn('[project] falha ao limpar recente:', err)
    }
  }

  // Carrega um projeto com o resultado já em mão — diálogo nativo OU path
  // direto do modal de recentes passam por aqui (mesmo corpo de aplicação).
  const applyLoadedProject = async (r) => {
    const d = r.data || {}
    const mediaPath = typeof d.mediaPath === 'string' ? d.mediaPath : ''

    // Som: o projeto guarda só o preset (sistema ou custom) + o estado do 🎤.
    // Tweaks não salvos como preset não estão aqui e se perdem por definição;
    // preset apagado → volta pras configurações globais.
    const savedSound = d.sound || {}
    let cfg
    const preset = findPreset(savedSound.presetId, customPresets)
    if (preset) {
      cfg = { ...cloneDeep(DEFAULT_SOUND_CONFIG), ...cloneDeep(preset.params), presetId: preset.id, enabled: savedSound.enabled === true }
    } else {
      try { cfg = mergeSoundConfig(JSON.parse(globalConfigRef.current?.sound_config || 'null')) } catch { cfg = mergeSoundConfig(null) }
      cfg = { ...cfg, enabled: savedSound.enabled === true }
    }

    // Restaura partindo dos GLOBAIS e aplicando por cima só o que o save tem
    // (nada de estado sobrando do projeto anterior).
    applyConfig(globalConfigRef.current)

    let file = null
    if (mediaPath && r.mediaExists) {
      const size = await window.api.getFileSize(mediaPath)
      file = { path: mediaPath, name: mediaPath.split(/[/\\]/).pop(), folder: mediaPath.replace(/[\\/][^\\/]+$/, ''), size: typeof size === 'number' ? size : undefined }
    }
    setSelectedFile(file)
    setSubtitles(Array.isArray(d.subtitles) ? d.subtitles : [])
    setSubtitlesEdited(d.subtitlesEdited === true)
    // Projeto novo na memória: o undo não pode desfazer edições do projeto anterior
    subtitlesHistoryRef.current = []
    setSoundConfig(cfg)

    const s = d.subtitle || {}
    if (typeof s.enabled === 'boolean') setSubtitlesEnabled(s.enabled)
    if (typeof s.style === 'string') setSubtitleStyle(s.style)
    if (typeof s.position === 'string') setSubtitlePosition(s.position)
    if (typeof s.positionMode === 'string') setPositionMode(s.positionMode)
    if (typeof s.positionPercent === 'number') setPositionPercent(Math.min(70, Math.max(5, s.positionPercent)))
    if (s.wordsPerLine) setWordsPerLine(Number(s.wordsPerLine) || 4)
    if (s.linesCount) setLinesCount(Number(s.linesCount) || 2)
    if (typeof s.autoLineWrap === 'boolean') setAutoLineWrap(s.autoLineWrap)
    if (typeof s.hMargin === 'number') setSubtitleHMargin(Math.min(20, Math.max(0, s.hMargin)))
    if (typeof s.greenScreen === 'boolean') setGreenScreen(s.greenScreen)
    if (typeof s.burnSubtitles === 'boolean') setBurnSubtitles(s.burnSubtitles)
    if (s.configs && typeof s.configs === 'object') setSubtitleConfigs(s.configs)

    const g = d.generation || {}
    if (typeof g.model === 'string') setSubtitleModel(g.model)
    if (typeof g.language === 'string') setSubtitleLanguage(g.language)
    if (g.persistence !== undefined && g.persistence !== null) setSubtitlePersistence(Number(g.persistence) || 1)
    if (typeof g.smart === 'boolean') setSmartSubtitle(g.smart)

    const e = d.edit || {}
    if (e.threshold !== undefined && e.threshold !== null && e.threshold !== '') setThreshold(String(e.threshold))
    if (e.margin !== undefined && e.margin !== null && e.margin !== '') setMarginVal(String(e.margin))
    if (e.marginAfter !== undefined && e.marginAfter !== null && e.marginAfter !== '') setMarginAfter(String(e.marginAfter))
    if (e.smooth !== undefined && e.smooth !== null && e.smooth !== '') setSmooth(String(e.smooth))

    const x = d.export || {}
    if (typeof x.format === 'string') setOutputFormat(x.format)
    if (typeof x.resolution === 'string') setOutputResolution(x.resolution)

    setProjectFilePath(r.path)
    setAbMode(null)
    setRealtimeDraft(null)
    setSeekTo(null)
    setCurrentTime(0)

    if (mediaPath && !r.mediaExists) {
      setErrorMessage(`${t('project.mediaMissing')} ${mediaPath}`)
      setShowInfo(true)
    } else {
      setInfoToast(t('project.loaded'))
    }
  }

  // ABRIR manual: diálogo nativo (fluxo original) → aplica + registra nos recentes
  const handleOpenProject = async () => {
    if (processing || generatingSubtitles) return
    const r = await window.api.openProject()
    if (!r || r.canceled) return
    if (!r.ok) {
      setErrorMessage(r.error || t('project.openFailed'))
      setShowError(true)
      return
    }
    await applyLoadedProject(r)
    await markProjectRecent(r.path)
  }

  // Clique numa linha do modal de recentes: lê o arquivo direto (sem diálogo),
  // aplica igual e reordena pro topo. Falhou → some da lista e avisa.
  const handleOpenRecent = async (path) => {
    if (processing || generatingSubtitles) return
    setShowRecent(false)
    let r
    try {
      const text = await window.api.readFile(path)
      if (text == null) throw new Error(`${t('project.recentMissing')} (${path})`)
      const data = JSON.parse(text)
      if (!data || typeof data !== 'object') throw new Error('invalid project file')
      const mediaPath = typeof data.mediaPath === 'string' ? data.mediaPath : ''
      const mediaExists = mediaPath ? await window.api.pathExists(mediaPath) : false
      r = { ok: true, path, data, mediaExists }
    } catch (err) {
      await dropProjectRecent(path)
      setErrorMessage(`${t('project.openFailed')}: ${err.message}`)
      setShowError(true)
      return
    }
    await applyLoadedProject(r)
    await markProjectRecent(path)
  }

  // ABRIR (TitleBar) → modal de recentes; a lista é relida do config aqui
  // pra sempre refletir o estado atual (abrir/salvar já persistiram antes).
  const handleOpenClick = async () => {
    if (processing || generatingSubtitles) return
    try {
      const cur = await window.api.getConfig()
      setRecentProjects(parseRecents(cur?.recent_projects))
    } catch {
      setRecentProjects([])
    }
    setShowRecent(true)
  }

  // "ABRIR MANUALMENTE" do modal → fecha e cai no diálogo nativo original
  const handleOpenManual = async () => {
    setShowRecent(false)
    await handleOpenProject()
  }

  const doNewProject = () => {
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.removeAttribute('src')
      videoRef.current.load()
    }
    setSelectedFile(null)
    setSubtitles([])
    setSubtitlesEdited(false)
    subtitlesHistoryRef.current = []
    setProjectFilePath(null)
    setAbMode(null)
    setRealtimeDraft(null)
    setSeekTo(null)
    setCurrentTime(0)
    applyConfig(globalConfigRef.current) // de volta pras configurações globais
    setInfoToast(t('project.created'))
  }

  // [📄]: com conteúdo, pergunta se salva antes de limpar (wireframe v1.8.0);
  // vazio, limpa direto.
  const requestNewProject = () => {
    if (processing || generatingSubtitles) return
    if (selectedFile || subtitles.length > 0 || projectFilePath) setConfirmNewOpen(true)
    else doNewProject()
  }

  const handleExport = async () => {
    if (!selectedFile || processing || generatingSubtitles || cutBusy) return
    // Faixa marcada (I/O): recorta SÓ quando início E fim estão marcados.
    // Falta um dos dois → avisa EXATAMENTE qual (antes de entrar em processing).
    const rangeState = validateExportRange(exportRange)
    if (rangeState === 'missing-start') {
      setErrorMessage(t('export.needStart'))
      setShowError(true)
      return
    }
    if (rangeState === 'missing-end') {
      setErrorMessage(t('export.needEnd'))
      setShowError(true)
      return
    }
    if (rangeState === 'bad-order') {
      setErrorMessage(t('export.badRange'))
      setShowError(true)
      return
    }
    const hasRange = rangeState === 'ok'
    // Player para imediatamente ao iniciar a exportacao — video e wavesurfer
    // pausados INDEPENDENTES (em arquivo de audio nao existe videoRef, e o
    // wavesurfer precisa parar tambem)
    if (videoRef.current) videoRef.current.pause()
    if (waveSurferRef?.current) waveSurferRef.current.pause()
    exportingRef.current = true
    setProcessing(true)
    errorBuffer.current = ''
    lastPct.current = 0
    videoDurationRef.current = 0
    setProgress({ pct: 0, text: '0%' })

    // 🎤 gate: o Som Avançado só vai para o export com o interruptor mestre
    // LIGADO — mesmo com preset escolhido, desligado não monta cadeia nenhuma.
    const soundChain = soundConfig.enabled
      ? buildSoundChain(soundConfig, { rnnoiseModel: rnnoiseStatus?.installed ? rnnoiseStatus.path : null })
      : ''
    if (soundChain) console.log('[export] som avançado (🎤 ligado):', soundChain)

    const base = selectedFile.name.replace(/\.[^.]+$/, '')
    const inputExt = selectedFile.name.split('.').pop().toLowerCase()
    // Com faixa marcada, só sobrevive o que está DENTRO do trecho — deslocado
    // para a timeline do recorte (o arquivo cortado começa em 0). Se nenhuma
    // legenda cair dentro, não queima nem grava SRT lateral.
    const rangeStartMs = hasRange ? Math.round(exportRange.start * 1000) : 0
    const rangeEndMs = hasRange ? Math.round(exportRange.end * 1000) : 0
    const sourceSubtitles = hasRange
      ? shiftSubtitlesForRange(subtitles, rangeStartMs, rangeEndMs)
      : subtitles
    const hasSubtitles = sourceSubtitles.length > 0
    const shouldBurn = burnSubtitles && hasSubtitles
    // Burn DESLIGADO + legendas geradas: grava um .srt lateral com o MESMO
    // nome do arquivo exportado (a promessa do hint settings.burnSrtOnly)
    const writeSidecarSrt = hasSubtitles && !burnSubtitles
    const videoExts = ['mp4', 'mkv', 'mov', 'webm', 'avi']
    const isVideoInput = videoExts.includes(inputExt)
    // O formato escolhido no Config e quem manda no container de saida: o
    // pipeline de video so roda quando a saida E video. Green screen e queima
    // de legenda so fazem sentido em saida de video (o SettingsModal ja avisa
    // "requer formato de video" nesse caso). Antes, qualquer recurso ligado
    // OU input de audio forçava mp4 e ignorava o formato escolhido.
    const needsVideo = videoExts.includes(outputFormat)
    if (!needsVideo && (greenScreen || shouldBurn)) {
      console.warn('[export] green screen/queima de legenda ignorados: saida em formato de audio')
    }
    const outPath = outputFolder
      ? await window.api.joinPath(outputFolder, `${base}_ALTERED.${outputFormat}`)
      : await window.api.joinPath(selectedFile.folder, `${base}_ALTERED.${outputFormat}`)

    const tempOutPath = outputFolder
      ? await window.api.joinPath(outputFolder, `${base}_TEMP.${inputExt}`)
      : await window.api.joinPath(selectedFile.folder, `${base}_TEMP.${inputExt}`)

    // Faixa marcada (I/O): recorta o trecho ANTES do auto-editor — o corte
    // por silêncio, o remapeamento de legendas e a queima rodam todos já
    // dentro do trecho. '-ss' na ENTRADA + '-t' na saída dá corte frame-
    // accurate (re-encode com o encoder padrão do container).
    let workPath = selectedFile.path
    let rangePath = null
    if (hasRange) {
      setProgress({ pct: 3, text: t('export.trimming') })
      rangePath = await window.api.joinPath(
        outputFolder || selectedFile.folder,
        `${base}_RANGE.${inputExt}`
      )
      const trimArgs = [
        '-y',
        '-ss', String(exportRange.start),
        '-i', selectedFile.path,
        '-t', String(exportRange.end - exportRange.start),
        rangePath,
      ]
      const trimResult = await window.api.runFfmpeg(trimArgs, outputFolder || selectedFile.folder)
      if (!trimResult.success) {
        await window.api.deleteFile(rangePath)
        exportingRef.current = false
        setProcessing(false)
        setProgress({ pct: 0, text: t('common.error') })
        return
      }
      workPath = rangePath
      console.log(`[export] faixa I/O: ${exportRange.start.toFixed(2)}s → ${exportRange.end.toFixed(2)}s (${(exportRange.end - exportRange.start).toFixed(2)}s)`)
    }

    // AUTO CUT ON → cuts as always (auto-editor). OFF → ffmpeg starts from
    // the work file (original or I/O range already trimmed): the export comes
    // out UNCUT, exactly like the preview with the toggle off.
    const doCut = cutEnabled
    let exportAudioPath = tempOutPath
    if (doCut) {
      const args = [
        workPath, '--progress', 'machine',
        '--edit', `audio:${Math.pow(10, parseFloat(threshold) / 20)}`,
        // Same recipe as the preview: asymmetric margin (equal → simple form)
        // + smoothness — preview and export cut EXACTLY the same.
        '--margin', marginVal === marginAfter ? `${marginVal}s` : `${marginVal}s,${marginAfter}s`,
        '--smooth', smooth === '0' ? '0' : `${smooth}s`,
        '--output', tempOutPath
      ]

      const result = await window.api.runAutoEditor(args)

      if (!result.success) {
        console.warn('[export] auto-editor falhou no corte:', result.error)
        if (rangePath) await window.api.deleteFile(rangePath)
        exportingRef.current = false
        setProcessing(false)
        setProgress({ pct: 0, text: t('common.error') })
        return
      }
    } else {
      exportAudioPath = workPath
      console.log('[export] AUTO CORTE desligado: exportando sem corte de silêncio')
    }

    setProgress({ pct: 90, text: t('export.converting') })

    const outputDir = outputFolder || selectedFile.folder

    let exportSubtitles = sourceSubtitles
    // The auto-editor cut changes the timeline: remap when subtitles
    // will be applied to the cut video (burn OR sidecar SRT). No cut
    // (AUTO CUT off) means the timeline doesn't change — they follow the original.
    if (doCut && (shouldBurn || writeSidecarSrt)) {
      try {
        setProgress({ pct: 91, text: t('export.analyzingCut') })
        const xmlPath = await window.api.joinPath(outputDir, 'corgi_cutmap.xml')
        const xmlArgs = [
          workPath,
          '--export', 'premiere',
          '--edit', `audio:${Math.pow(10, parseFloat(threshold) / 20)}`,
          '--margin', marginVal === marginAfter ? `${marginVal}s` : `${marginVal}s,${marginAfter}s`,
          '--smooth', smooth === '0' ? '0' : `${smooth}s`,
          '--output', xmlPath
        ]
        const xmlResult = await window.api.runAutoEditorExport(xmlArgs)
        if (xmlResult.success) {
          const xmlText = await window.api.readFile(xmlPath)
          if (xmlText) {
            const { fps, segments } = parsePremiereXml(xmlText)
            if (segments.length > 0) {
              exportSubtitles = remapSubtitleTimestamps(exportSubtitles, segments, fps)
              console.log(`[export] Remapped ${subtitles.length} subtitles via Premiere XML (${segments.length} segments, ${fps}fps)`)
            }
          }
          await window.api.deleteFile(xmlPath)
        } else {
          console.warn('[export] Premiere XML export failed:', xmlResult.error)
        }
      } catch (e) {
        console.warn('[export] Timestamp remapping failed, using original timestamps:', e)
      }
    }

    try {
      let assPath = null

      // Duracao usada só para animar a barra de progresso do ffmpeg — na
      // timeline EXPORTADA (com faixa I/O, já deslocada e aparada)
      const duration = exportSubtitles.length > 0
        ? parseSrtTime(exportSubtitles[exportSubtitles.length - 1].end) / 1000
        : 3600
      videoDurationRef.current = duration

      if (needsVideo) {
        let ffmpegArgs
        if (isVideoInput) {
          ffmpegArgs = [
            '-y',
            '-i', exportAudioPath,
          ]
        } else {
          // #00A800 = mesmo verde do preview (DropZone); o 'green' nomeado do
          // ffmpeg (#008000) saia escuro demais no video exportado.
          const bgColor = greenScreen ? '0x00A800' : 'black'
          const bgTgt = resTarget(outputResolution)
          const bgRes = bgTgt ? `${bgTgt.w}x${bgTgt.h}` : '1920x1080'
          ffmpegArgs = [
            '-y',
            '-f', 'lavfi',
            '-i', `color=c=${bgColor}:s=${bgRes}:d=${duration}`,
            '-i', exportAudioPath,
          ]
        }

        const videoFilters = []
        if (isVideoInput && outputResolution !== 'original') {
          // Id desconhecido (config antiga) mantém o comportamento antigo: paisagem.
          const tgt = resTarget(outputResolution) || RESOLUTION_TARGETS.landscape
          videoFilters.push(`scale=${tgt.w}:${tgt.h}`)
        }

        if (shouldBurn) {
          assPath = await window.api.joinPath(outputDir, 'corgi_sub.ass')
          const styleCfg = subtitleConfigs[subtitleStyle] || {}
          const inputW = videoRef.current?.videoWidth || 1920
          const inputH = videoRef.current?.videoHeight || 1080
          const tgt = resTarget(outputResolution)
          const videoW = tgt ? tgt.w : inputW
          const videoH = tgt ? tgt.h : inputH
          console.log(`[export] ASS: style=${subtitleStyle} ${styleCfg.wordsPerLine || wordsPerLine}palavras/${styleCfg.linesCount || linesCount}linha(s) wrap=${autoLineWrap} margemH=${hMarginPct}% res=${videoW}x${videoH}`)
          // O canvas so mede com a webfont depois que ela carrega; sem isto o
          // highlightbox sai com as palavras coladas no video final.
          const fontLoaded = await ensureExportFontLoaded(styleCfg.fontId || undefined, subtitleStyle, styleCfg.fontSize || undefined)
          if (!fontLoaded) {
            console.warn(`[export] AVISO: fonte de medicao nao confirmada (${styleCfg.fontId || 'default'}) - palavras podem sair coladas`)
          }
          const assContent = generateAssContent(
            exportSubtitles,
            subtitleStyle,
            subtitlePosition,
            videoW,
            videoH,
            styleCfg.wordsPerLine || wordsPerLine,
            styleCfg.linesCount || linesCount,
            styleCfg.primaryColor || undefined,
            styleCfg.highlightColor || undefined,
            styleCfg.fontId || undefined,
            styleCfg.fontSize || undefined,
            positionMode,
            positionPercent,
            autoLineWrap,
            hMarginPct
          )
          if (assContent) {
            await window.api.writeFile(assPath, assContent)

            setProgress({ pct: 95, text: t('export.burning') })

            // fontsdir: informa ao libass onde procurar fontes que nao estao instaladas no Windows
            // (ex: Komika Axis). Sem isso o export cai no fallback (Arial). Escaping validado com o ffmpeg:
            // unidade precisa de 2 barras (E\\:) e espacos de 1 barra (fonts\ com\ espaco).
            const fontsDir = await window.api.getFontsPath()
            if (!(await window.api.pathExists(fontsDir))) {
              console.warn(`[export] AVISO: pasta de fontes ausente (${fontsDir}) - video saindo com a fonte padrao do sistema`)
            }
            const escapedFontsDir = fontsDir
              .replace(/\\/g, '/')
              .replace(/^([A-Za-z]):/, '$1\\\\:')
              .replace(/ /g, '\\ ')
            videoFilters.push(`ass=corgi_sub.ass:fontsdir=${escapedFontsDir}`)
            console.log(`[export] fontsdir: ${escapedFontsDir}`)
          }
        }

        // O -vf fica FORA do if(shouldBurn): dentro dele, a resolucao (scale)
        // era ignorada quando a queima de legenda estava desligada.
        if (videoFilters.length > 0) {
          ffmpegArgs.push('-vf', videoFilters.join(','))
        }

        // Codecs por container: webm so aceita VP9/VP8 + Opus/Vorbis
        if (outputFormat === 'webm') {
          ffmpegArgs.push('-c:v', 'libvpx-vp9', '-cpu-used', '4', '-deadline', 'realtime', '-c:a', 'libopus')
        } else {
          ffmpegArgs.push('-c:v', 'libx264', '-c:a', 'aac')
        }
        // Tratamento de som (v1.7.0): mesma cadeia ouvida na prévia
        if (soundChain) ffmpegArgs.push('-af', soundChain)
        ffmpegArgs.push('-shortest', outPath)
        const ffmpegResult = await window.api.runFfmpeg(ffmpegArgs, outputDir)
        if (!ffmpegResult.success) {
          videoDurationRef.current = 0
          lastPct.current = 0
          setProgress({ pct: 0, text: t('common.error') })
          return
        }
      } else {
        // Saida de audio: descarta a trilha de video e usa o codec do formato
        // escolhido (o '-c:a aac' fixo antigo era rejeitado por mp3/wav/flac/ogg).
        const audioCodecs = { mp3: 'libmp3lame', wav: 'pcm_s16le', flac: 'flac', ogg: 'libvorbis', aac: 'aac', m4a: 'aac' }
        const ffmpegArgs = ['-y', '-i', exportAudioPath, '-vn']
        if (soundChain) {
          // Som avançado ligado: -af exige re-encode (impossível com 'copy')
          ffmpegArgs.push('-af', soundChain)
          ffmpegArgs.push('-c:a', audioCodecs[outputFormat] || 'aac')
        } else {
          // Mesmo formato da entrada: corta sem reencodar (perda zero)
          ffmpegArgs.push('-c:a', inputExt === outputFormat ? 'copy' : (audioCodecs[outputFormat] || 'aac'))
        }
        ffmpegArgs.push(outPath)
        const ffmpegResult = await window.api.runFfmpeg(ffmpegArgs)
        if (!ffmpegResult.success) {
          videoDurationRef.current = 0
          lastPct.current = 0
          setProgress({ pct: 0, text: t('common.error') })
          return
        }
      }

      // Burn DESLIGADO: grava o .srt lateral com o MESMO nome do arquivo
      // exportado (exportSubtitles ja remapeado para a timeline cortada)
      if (writeSidecarSrt) {
        try {
          const srtPath = outPath.replace(/\.[^.]+$/, '.srt')
          const srtLines = []
          exportSubtitles.forEach((sub, i) => {
            srtLines.push(String(i + 1))
            srtLines.push(`${sub.start} --> ${sub.end}`)
            srtLines.push(sub.text)
            srtLines.push('')
          })
          await window.api.writeFile(srtPath, srtLines.join('\n'))
          console.log(`[export] SRT lateral gravado: ${srtPath} (${exportSubtitles.length} legendas)`)
        } catch (e) {
          console.warn('[export] Falha ao gravar SRT lateral:', e.message)
        }
      }

      if (assPath) await window.api.deleteFile(assPath)

      videoDurationRef.current = 0
      lastPct.current = 0
      setProgress({ pct: 100, text: '100%' })
      setExportedFolderPath(outputFolder || selectedFile.folder)
      setShowExportToast(true)
    } finally {
      // No cut means no TEMP on disk (doCut false) — deleting would error.
      if (doCut) await window.api.deleteFile(tempOutPath)
      if (rangePath) await window.api.deleteFile(rangePath)
      exportingRef.current = false
      setProcessing(false)
    }
  }

  const handleGenerateSubtitles = async () => {
    if (!selectedFile || generatingSubtitles || processing) return
    // Player para imediatamente ao gerar legenda — video e wavesurfer
    // pausados INDEPENDENTES (em arquivo de audio nao existe videoRef)
    if (videoRef.current) videoRef.current.pause()
    if (waveSurferRef?.current) waveSurferRef.current.pause()
    whisperGenRef.current++
    whisperStoppingRef.current = false
    setGeneratingSubtitles(true)
    setSubtitles([])
    setSubtitlesEdited(false)
    // Geração nova substitui tudo: o undo anterior não faz mais sentido
    subtitlesHistoryRef.current = []

    try {
      const modelExists = await window.api.checkModel(subtitleModel)
      if (!modelExists) {
        setGeneratingSubtitles(false)
        setErrorMessage(t('app.errModelNotInstalled', { model: subtitleModel }))
        setShowError(true)
        return
      }

      const baseName = selectedFile.name.replace(/\.[^.]+$/, '')
      const wordsSrtPath = await window.api.joinPath(selectedFile.folder, `${baseName}_words`)

      console.log('[subtitle] Starting whisper-cli with:', {
        audioFile: selectedFile.path,
        model: subtitleModel,
        output: wordsSrtPath,
        language: subtitleLanguage,
        splitWords: true
      })

      const result = await window.api.runWhisperCli({
        audioFile: selectedFile.path,
        model: subtitleModel,
        output: wordsSrtPath,
        language: subtitleLanguage,
        splitWords: true
      })

      console.log('[subtitle] whisper-cli result:', result)

      if (result.stopped) {
        setGeneratingSubtitles(false)
        return
      }

      if (!result.success) {
        setGeneratingSubtitles(false)
        if (result.error) {
          setErrorMessage(result.error)
          setShowError(true)
        }
        return
      }

      if (result.cuda === false) {
        console.log('CUDA não disponível, usando CPU (pode ser mais lento)')
      }

    setTimeout(async () => {
      const wordsText = await window.api.readFile(wordsSrtPath + '.srt')
      console.log('[subtitle] SRT file content:', wordsText ? wordsText.substring(0, 200) : 'EMPTY')
      if (wordsText) {
        const wordTimings = parseSrt(wordsText)
        const styleCfg = subtitleConfigs[subtitleStyle] || {}
        const enriched = groupWordsIntoSegments(
          wordTimings,
          styleCfg.wordsPerLine || wordsPerLine,
          styleCfg.linesCount || linesCount,
          subtitlePersistence,
          smartSubtitle
        )
        setSubtitles(enriched)
      }
      setGeneratingSubtitles(false)
      // AUTO: informa o idioma que o whisper detectou no audio
      if (subtitleLanguage === SUBTITLE_LANG_AUTO && result?.detectedLanguage) {
        const detected = LANGS.find((l) => l.id === result.detectedLanguage)?.label
          || result.detectedLanguage.toUpperCase()
        setInfoToast(t('app.detectedLanguage', { lang: detected }))
      }
    }, 1000)
    } catch (err) {
      console.error('[subtitle] Error:', err)
      setGeneratingSubtitles(false)
      setErrorMessage(err.message || t('app.errUnknown'))
      setShowError(true)
    }
  }

  const parseSrtTimeMs = (timeStr) => {
    const match = timeStr.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/)
    if (!match) return 0
    const [, h, m, s, ms] = match
    return parseInt(h) * 3600000 + parseInt(m) * 60000 + parseInt(s) * 1000 + parseInt(ms)
  }

  const parseSrt = (srtContent) => {
    const blocks = srtContent.trim().split('\n\n')
    const result = []

    for (const block of blocks) {
      const lines = block.split('\n')
      if (lines.length >= 3) {
        const timecode = lines[1]
        const [start, end] = timecode.split(' --> ')
        const text = lines.slice(2).join(' ')
        result.push({ start, end, text })
      }
    }

    return result
  }

  const handleUpdateSubtitle = (index, updates) => {
    pushUndoSnapshot()
    setSubtitlesEdited(true)
    setSubtitles((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], ...updates }
      if (updates.text !== undefined) {
        next[index].words = []
      }
      return next
    })
  }

  const handleDeleteSubtitle = (index) => {
    pushUndoSnapshot()
    setSubtitlesEdited(true)
    setSubtitles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleAddSubtitle = () => {
    pushUndoSnapshot()
    setSubtitlesEdited(true)
    setSubtitles((prev) => {
      let lastEnd = '00:00:00,000'
      if (prev.length > 0) {
        lastEnd = prev[prev.length - 1].end
      }
      const startMs = parseSrtTime(lastEnd)
      const endMs = startMs + 2000
      return [
        ...prev,
        {
          start: formatSrtTime(startMs),
          end: formatSrtTime(endMs),
          text: t('panel.newSubtitle'),
        },
      ]
    })
  }

  const handleSaveSubtitles = async () => {
    const baseName = selectedFile.name.replace(/\.[^.]+$/, '')
    const srtPath = await window.api.joinPath(selectedFile.folder, `${baseName}_words.srt`)
    const lines = []
    subtitles.forEach((sub, i) => {
      lines.push(String(i + 1))
      lines.push(`${sub.start} --> ${sub.end}`)
      lines.push(sub.text)
      lines.push('')
    })
    const srtContent = lines.join('\n')
    await window.api.writeFile(srtPath, srtContent)
    setSubtitlesEdited(false)
  }

  const parseSrtTime = (timeStr) => {
    const match = timeStr.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/)
    if (!match) return 0
    const [, h, m, s, ms] = match
    return parseInt(h) * 3600000 + parseInt(m) * 60000 + parseInt(s) * 1000 + parseInt(ms)
  }

  const formatSrtTime = (ms) => {
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    const mill = Math.floor(ms % 1000)
    return (
      String(h).padStart(2, '0') + ':' +
      String(m).padStart(2, '0') + ':' +
      String(s).padStart(2, '0') + ',' +
      String(mill).padStart(3, '0')
    )
  }

  const handleSaveSettings = async (newConfig) => {
    if (newConfig.threshold !== undefined) setThreshold(newConfig.threshold)
    if (newConfig.margin !== undefined) setMarginVal(newConfig.margin)
    if (newConfig.margin_after !== undefined) setMarginAfter(newConfig.margin_after)
    if (newConfig.smooth !== undefined) setSmooth(newConfig.smooth)
    if (newConfig.output_folder !== undefined) setOutputFolder(newConfig.output_folder)
    if (newConfig.output_format !== undefined) setOutputFormat(newConfig.output_format)
    if (newConfig.output_resolution !== undefined) setOutputResolution(newConfig.output_resolution)
    if (newConfig.subtitles !== undefined) setSubtitlesEnabled(newConfig.subtitles === true || newConfig.subtitles === 'true')
    if (newConfig.subtitle_model !== undefined) setSubtitleModel(newConfig.subtitle_model)
    if (newConfig.subtitle_language !== undefined) setSubtitleLanguage(newConfig.subtitle_language)
    if (newConfig.subtitle_position !== undefined) setSubtitlePosition(newConfig.subtitle_position)
    if (newConfig.subtitle_position_mode !== undefined) setPositionMode(newConfig.subtitle_position_mode)
    if (newConfig.subtitle_position_percent !== undefined) setPositionPercent(newConfig.subtitle_position_percent)
    if (newConfig.subtitle_style !== undefined) setSubtitleStyle(newConfig.subtitle_style)
    if (newConfig.green_screen !== undefined) setGreenScreen(newConfig.green_screen)
    if (newConfig.burn_subtitles !== undefined) setBurnSubtitles(newConfig.burn_subtitles)
    if (newConfig.words_per_line !== undefined) setWordsPerLine(newConfig.words_per_line)
    if (newConfig.lines_count !== undefined) setLinesCount(newConfig.lines_count)
    if (newConfig.subtitle_persistence !== undefined) setSubtitlePersistence(newConfig.subtitle_persistence)
    if (newConfig.smart_subtitle !== undefined) setSmartSubtitle(newConfig.smart_subtitle)
    if (newConfig.auto_line_wrap !== undefined) setAutoLineWrap(newConfig.auto_line_wrap)
    if (newConfig.subtitle_h_margin !== undefined) {
      const hm = Number(newConfig.subtitle_h_margin)
      if (Number.isFinite(hm)) setSubtitleHMargin(Math.min(20, Math.max(0, hm)))
    }
    if (newConfig.advanced_tools !== undefined) setAdvancedTools(newConfig.advanced_tools === true || newConfig.advanced_tools === 'true')
    if (newConfig.subtitle_configs !== undefined) setSubtitleConfigs(newConfig.subtitle_configs)
    if (newConfig.sound_config !== undefined) setSoundConfig(newConfig.sound_config)
    if (newConfig.sound_presets !== undefined) setCustomPresets(newConfig.sound_presets)

    await window.api.saveConfig({
      threshold: newConfig.threshold ?? threshold,
      margin: newConfig.margin ?? marginVal,
      margin_after: newConfig.margin_after ?? marginAfter,
      smooth: newConfig.smooth ?? smooth,
      output_folder: newConfig.output_folder ?? outputFolder,
      output_format: newConfig.output_format ?? outputFormat,
      output_resolution: newConfig.output_resolution ?? outputResolution,
      subtitles: String(newConfig.subtitles ?? subtitlesEnabled),
      subtitle_model: newConfig.subtitle_model ?? subtitleModel,
      subtitle_language: newConfig.subtitle_language ?? subtitleLanguage,
      subtitle_position: newConfig.subtitle_position ?? subtitlePosition,
      subtitle_position_mode: newConfig.subtitle_position_mode ?? positionMode,
      subtitle_position_percent: String(newConfig.subtitle_position_percent ?? positionPercent),
      subtitle_style: newConfig.subtitle_style ?? subtitleStyle,
      green_screen: String(newConfig.green_screen ?? greenScreen),
      burn_subtitles: String(newConfig.burn_subtitles ?? burnSubtitles),
      words_per_line: String(newConfig.words_per_line ?? wordsPerLine),
      lines_count: String(newConfig.lines_count ?? linesCount),
      subtitle_persistence: String(newConfig.subtitle_persistence ?? subtitlePersistence),
      smart_subtitle: String(newConfig.smart_subtitle ?? smartSubtitle),
      auto_line_wrap: String(newConfig.auto_line_wrap ?? autoLineWrap),
      subtitle_h_margin: String(newConfig.subtitle_h_margin ?? subtitleHMargin),
      advanced_tools: String(newConfig.advanced_tools ?? advancedTools),
      subtitle_configs: JSON.stringify(newConfig.subtitle_configs ?? subtitleConfigs),
      sound_config: JSON.stringify(newConfig.sound_config ?? soundConfig),
      sound_presets: JSON.stringify(newConfig.sound_presets ?? customPresets),
      language: newConfig.language ?? lang,
    })
    // Globais do NOVO/LOAD acompanham o recém-salvo: antes o ref ficava com o
    // snapshot do boot e NOVO revertia (ex.: trocou a resolução, NOVO voltava
    // pra resolução antiga em vez da última salva).
    try {
      globalConfigRef.current = await window.api.getConfig()
    } catch { /* mantém o snapshot do boot */ }
  }

  // Clique nos botoes da barra lateral. ANALISAR precisa de arquivo carregado;
  // RNNOISE e ajuste de config, abre sempre.
  const handleSidebarSelect = (id) => {
    if (id === 'rnnoise') {
      setShowRnnoise(true)
      return
    }
    if (id === 'shortcuts') {
      setShowShortcuts(true)
      return
    }
    if (id !== 'analyze') return
    if (!selectedFile) {
      setInfoToast(t('analyze.noFile'))
      return
    }
    setShowAnalyze(true)
  }

  // APLICAR da sugestao: threshold + margin nos controles e denoise medido
  // ligado na cadeia de som (com o som ligado, senao o denoise nao faz efeito).
  // Persiste no config.ini na hora (merge, mesmo fluxo do idioma/tema).
  const handleApplySuggestions = async (suggestions) => {
    const { threshold, margin, denoiseDb } = suggestions
    setThreshold(String(threshold))
    setMarginVal(String(margin))
    // The suggestion is symmetric: BOTH margin sides take the measured value.
    setMarginAfter(String(margin))
    // AUTO CUT on: parameters changed → the preview went stale,
    // regenerate on the spot with fresh values (no waiting for a toggle).
    if (cutEnabled) generateCutPreview({ threshold: String(threshold), margin: String(margin), marginAfter: String(margin) })
    const nextSound = { ...soundConfig, enabled: true, noise: { ...soundConfig.noise, denoiseOn: true, denoiseDb } }
    setSoundConfig(nextSound)
    setShowAnalyze(false)
    setInfoToast(t('analyze.applied'))
    try {
      const current = await window.api.getConfig()
      if (current && window.api.saveConfig) {
        await window.api.saveConfig({
          ...current,
          threshold: String(threshold),
          margin: String(margin),
          // Symmetric suggestion: BOTH margin sides persist the measured value
          margin_after: String(margin),
          sound_config: JSON.stringify(nextSound),
        })
      }
    } catch (err) {
      console.warn('[analyze] falha ao persistir sugestoes:', err)
    }
  }

  // APLICAR do modulo RNNoise: motor de ruído escolhido persiste no config
  // (mesmo merge do ANALISAR). Com motor ativo o som mestre liga junto —
  // cadeia desligada não faz efeito nenhum.
  const handleApplyRnnoise = async (noiseDraft) => {
    const nextSound = { ...soundConfig, ...(noiseDraft.denoiseOn ? { enabled: true } : {}), noise: noiseDraft }
    setSoundConfig(nextSound)
    setShowRnnoise(false)
    setInfoToast(t('rnnoise.applied'))
    try {
      const current = await window.api.getConfig()
      if (current && window.api.saveConfig) {
        await window.api.saveConfig({ ...current, sound_config: JSON.stringify(nextSound) })
      }
    } catch (err) {
      console.warn('[rnnoise] falha ao persistir motor de ruido:', err)
    }
  }

  const handleTimeUpdate = (time) => {
    setCurrentTime(time)
  }

  const handleSeekTo = (time) => {
    setSeekTo(time)
  }

  // --- Undo (Ctrl+Z) ------------------------------------------------------
  // Snapshot guardado ANTES da edição (ver pushUndoSnapshot nos handlers).
  const pushUndoSnapshot = () => {
    const hist = subtitlesHistoryRef.current
    hist.push(subtitlesRef.current)
    if (hist.length > 100) hist.shift()
  }

  const undoSubtitles = () => {
    const hist = subtitlesHistoryRef.current
    if (hist.length === 0) return
    const prev = hist.pop()
    setSubtitles(prev)
    setSubtitlesEdited(prev.length > 0)
  }

  // Espelho do array de legendas: o snapshot lê o valor ATUAL em render
  // (o setSubtitles funcional dos handlers não entrega o valor pra fora).
  useEffect(() => {
    subtitlesRef.current = subtitles
  }, [subtitles])

  // Troca de arquivo zera as marcas I/O do export (a faixa é do arquivo).
  useEffect(() => {
    setExportRange({ start: null, end: null })
    setSelectedMarker(null)
  }, [selectedFile?.path])

  // --- Transporte por teclado ---------------------------------------------
  const togglePlayPause = () => {
    const ws = waveSurferRef.current
    const vid = videoRef.current
    if (ws) {
      if (ws.isPlaying()) {
        ws.pause()
        if (vid) vid.pause()
      } else {
        ws.play()
        if (vid) vid.play()
      }
    } else if (vid) {
      if (vid.paused) vid.play()
      else vid.pause()
    }
  }

  // ←/→ pula 5s na timeline (o seek do wavesurfer espelha no vídeo)
  const nudgeSeek = (delta) => {
    const ws = waveSurferRef.current
    const vid = videoRef.current
    if (ws) {
      const d = ws.getDuration() || 0
      const t = Math.max(0, d ? Math.min(d, ws.getCurrentTime() + delta) : ws.getCurrentTime() + delta)
      ws.setTime(t)
    } else if (vid) {
      const d = vid.duration || 0
      vid.currentTime = Math.max(0, d ? Math.min(d, vid.currentTime + delta) : vid.currentTime + delta)
    }
  }

  // I = INÍCIO do export no playhead atual · O = FIM
  const setExportMarker = (which) => {
    const ws = waveSurferRef.current
    if (!selectedFile || !ws) return
    const t = ws.getCurrentTime()
    setExportRange((prev) => ({ ...prev, [which]: t }))
    setSelectedMarker(which)
  }

  const deleteSelectedMarker = () => {
    if (!selectedMarker) return
    setExportRange((prev) => ({ ...prev, [selectedMarker]: null }))
    setSelectedMarker(null)
  }

  // --- Atalhos de teclado globais -----------------------------------------
  // Ctrl+S salvar · Ctrl+O abrir · Ctrl+N novo · Ctrl+Z desfazer ·
  // Espaço play/pause · ←/→ pular · I/O marcar faixa do export ·
  // Delete apaga a marca selecionada.
  // Nada disso dispara enquanto o foco está num campo de texto (INPUT,
  // TEXTAREA, SELECT ou contenteditable) — Ctrl+* segue valendo para salvar
  // o projeto mesmo editando uma legenda.
  useEffect(() => {
    const onKey = (e) => {
      if (processing || generatingSubtitles) return
      const tgt = e.target
      const typing = !!tgt && (
        tgt.tagName === 'INPUT' ||
        tgt.tagName === 'TEXTAREA' ||
        tgt.tagName === 'SELECT' ||
        tgt.isContentEditable
      )

      if (e.ctrlKey || e.metaKey) {
        const k = (e.key || '').toLowerCase()
        if (k === 's') { e.preventDefault(); handleSaveProject() }
        else if (k === 'o') { e.preventDefault(); handleOpenClick() }
        else if (k === 'n') { e.preventDefault(); requestNewProject() }
        else if (k === 'z') { e.preventDefault(); undoSubtitles() }
        return
      }

      if (typing || e.altKey) return

      if (e.key === ' ') {
        e.preventDefault() // não deixa a tecla "clicar" o botão em foco
        togglePlayPause()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        nudgeSeek(-5)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        nudgeSeek(5)
      } else if (e.key === 'i' || e.key === 'I') {
        setExportMarker('start')
      } else if (e.key === 'o' || e.key === 'O') {
        setExportMarker('end')
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelectedMarker()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="w-full h-full flex flex-col border-[4px] border-retro-black bg-retro-box">
      <TitleBar
        onNew={requestNewProject}
        onSave={handleSaveProject}
        onOpen={handleOpenClick}
        disabled={processing || generatingSubtitles}
      />
      <div className="flex flex-1 min-h-0">
        {advancedTools && (
          <Sidebar onSelect={handleSidebarSelect} disabled={processing || generatingSubtitles || cutBusy} />
        )}
        <div className={`flex flex-col min-w-0 ${subtitlesEnabled ? 'w-[75%]' : 'w-full'}`}>
          <div className="flex flex-1 min-h-0">
            <div className="flex flex-col w-[66.6%] min-w-0 border-r-2 border-retro-black">
              <DropZone
                selectedFile={previewFile}
                setSelectedFile={setSelectedFile}
                processing={processing}
                onTimeUpdate={handleTimeUpdate}
                seekTo={seekTo}
                onClear={() => {
                  pushUndoSnapshot()
                  setSubtitles([])
                }}
                videoRef={videoRef}
                waveSurferRef={waveSurferRef}
                subtitles={previewSubtitles}
                subtitleStyle={subtitleStyle}
                subtitlePosition={subtitlePosition}
                subtitleConfigs={subtitleConfigs}
                positionMode={positionMode}
                positionPercent={positionPercent}
                outputResolution={outputResolution}
                greenScreen={greenScreen}
                subtitlesEnabled={subtitlesEnabled}
                currentTime={currentTime}
                wordsPerLine={wordsPerLine}
                linesCount={linesCount}
                hMarginPct={hMarginPct}
              />
            </div>
            <Controls
              processing={processing}
              generatingSubtitles={generatingSubtitles}
              onExport={handleExport}
              progress={progress}
              soundEnabled={soundConfig.enabled}
              onOpenSound={() => setShowSound(true)}
              onToggleSound={handleToggleSound}
              hasFile={!!selectedFile}
              cutEnabled={cutEnabled}
              cutBusy={cutBusy}
              onOpenCut={() => setShowCutConfig(true)}
              onToggleCut={handleToggleCut}
            />
          </div>
          <div className="px-4 pb-2 shrink-0">
            <Waveform
              selectedFile={previewFile}
              onTimeUpdate={handleTimeUpdate}
              seekTo={seekTo}
              videoRef={videoRef}
              waveSurferRef={waveSurferRef}
              processing={processing}
              generatingSubtitles={generatingSubtitles}
              onPlayer={handlePlayerCreated}
              playRequest={playRequest}
              shapeCfg={shapeCfg}
              // I/O markers live on the ORIGINAL timeline (export trims
              // before cutting) — with the cut on, the ruler is the CUT
              // timeline and the markers would lie: hidden until turned off.
              exportRange={cutEnabled ? null : exportRange}
              selectedMarker={selectedMarker}
              onSelectMarker={setSelectedMarker}
            />
          </div>
        </div>
        {subtitlesEnabled && (
          <SubtitlesPanel
            subtitles={subtitles}
            onGenerate={handleGenerateSubtitles}
            generating={generatingSubtitles}
            processing={processing}
            onStop={() => {
              whisperStoppingRef.current = true
              window.api.stopWhisperCli()
              setGeneratingSubtitles(false)
            }}
            selectedFile={selectedFile}
            subtitlesEnabled={subtitlesEnabled}
            onUpdateSubtitle={handleUpdateSubtitle}
            onDeleteSubtitle={handleDeleteSubtitle}
            onAddSubtitle={handleAddSubtitle}
            onSeekTo={handleSeekTo}
            currentTime={currentTime}
            subtitleStyle={subtitleStyle}
            subtitlePosition={subtitlePosition}
            positionMode={positionMode}
            positionPercent={positionPercent}
            wordsPerLine={wordsPerLine}
            linesCount={linesCount}
            subtitleConfigs={subtitleConfigs}
            onStyleChange={(style) => handleSaveSettings({ subtitle_style: style })}
            onPositionChange={(pos) => handleSaveSettings({ subtitle_position: pos })}
            onPositionModeChange={(mode) => handleSaveSettings({ subtitle_position_mode: mode })}
            onPositionPercentChange={(pct) => handleSaveSettings({ subtitle_position_percent: pct })}
            onConfigSave={(cfg) => handleSaveSettings({ subtitle_configs: cfg })}
            hasChanges={subtitlesEdited}
            onSave={handleSaveSubtitles}
          />
        )}
      </div>
      <BottomBar
        outputFolder={outputFolder}
        selectedFile={selectedFile}
        onOpenSettings={() => setShowSettings(true)}
        onOpenAbout={() => setShowAbout(true)}
      />
      {showSettings && (
        <SettingsModal
          outputFolder={outputFolder}
          outputFormat={outputFormat}
          outputResolution={outputResolution}
          subtitles={subtitlesEnabled}
          subtitleModel={subtitleModel}
          subtitleLanguage={subtitleLanguage}
          greenScreen={greenScreen}
          burnSubtitles={burnSubtitles}
          selectedFile={selectedFile}
          wordsPerLine={wordsPerLine}
          linesCount={linesCount}
          subtitlePersistence={subtitlePersistence}
          smartSubtitle={smartSubtitle}
          autoLineWrap={autoLineWrap}
          subtitleHMargin={subtitleHMargin}
          positionMode={positionMode}
          positionPercent={positionPercent}
          cudaInstalled={cudaInstalled}
          advancedTools={advancedTools}
          rnnoiseInstalled={!!rnnoiseStatus?.installed}
          onClose={() => setShowSettings(false)}
          onSave={handleSaveSettings}
          onRequestCudaDownload={() => setShowCudaModal(true)}
        />
      )}
      {showAnalyze && selectedFile && (
        <AnalyzeModal
          filePath={selectedFile.path}
          onApply={handleApplySuggestions}
          onClose={() => setShowAnalyze(false)}
        />
      )}
      {showRnnoise && (
        <RnnoiseModal
          config={soundConfig}
          rnnoiseInstalled={!!rnnoiseStatus?.installed}
          onStatusChange={() => window.api.rnnoiseStatus?.().then((s) => s && setRnnoiseStatus(s)).catch(() => {})}
          onApply={handleApplyRnnoise}
          onClose={() => setShowRnnoise(false)}
        />
      )}
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      {showRecent && (
        <RecentProjectsModal
          projects={recentProjects}
          onOpenPath={handleOpenRecent}
          onOpenManual={handleOpenManual}
          onClose={() => setShowRecent(false)}
        />
      )}
      {showSound && (
        <SoundConfigModal
          config={soundConfig}
          rnnoiseInstalled={!!rnnoiseStatus?.installed}
          customPresets={customPresets}
          onPreview={(c) => setRealtimeDraft(c)}
          onClose={() => {
            setShowSound(false)
            setAbMode(null)
            // Rascunho descartado (sem APLICAR): a cadeia volta a seguir a cfg SALVA
            setRealtimeDraft(null)
          }}
          onApply={handleApplySound}
          onPresetsChange={handleSoundPresets}
          onListen={handleListenSound}
        />
      )}
      {showCutConfig && (
        <CutConfigModal
          threshold={threshold}
          marginVal={marginVal}
          marginAfter={marginAfter}
          smooth={smooth}
          onClose={() => setShowCutConfig(false)}
          onSave={(v) => {
            handleSaveSettings({ threshold: v.threshold, margin: v.margin, margin_after: v.marginAfter, smooth: v.smooth })
            // Cut on + fresh parameters: regenerate the preview on the spot.
            if (cutEnabled) generateCutPreview(v)
          }}
        />
      )}
      <CudaDownloadModal
        open={showCudaModal}
        onClose={() => setShowCudaModal(false)}
        onComplete={() => window.api.checkCudaInstalled().then(setCudaInstalled)}
      />
      {showError && !whisperStoppingRef.current && (
        <ErrorModal
          message={errorMessage}
          onClose={() => setShowError(false)}
        />
      )}
      {showInfo && (
        <InfoModal
          message={errorMessage}
          onClose={() => setShowInfo(false)}
        />
      )}
      {showAbout && (
        <AboutModal onClose={() => setShowAbout(false)} />
      )}
      {confirmNewOpen && (
        <ConfirmModal
          message={t('project.confirmNew')}
          primaryLabel={t('project.saveAndClear')}
          secondaryLabel={t('project.clear')}
          cancelLabel={t('project.cancel')}
          onPrimary={async () => {
            setConfirmNewOpen(false)
            const ok = await handleSaveProject()
            if (ok) doNewProject()
          }}
          onSecondary={() => {
            setConfirmNewOpen(false)
            doNewProject()
          }}
          onCancel={() => setConfirmNewOpen(false)}
        />
      )}
      {showExportToast && (
        <Toast
          message={t('app.exportToast')}
          linkLabel={t('app.openFolder')}
          onLinkClick={() => window.api.openFolder(exportedFolderPath)}
          duration={5000}
          onClose={() => setShowExportToast(false)}
        />
      )}
      {infoToast && (
        <Toast
          message={infoToast}
          duration={5000}
          onClose={() => setInfoToast(null)}
        />
      )}
    </div>
  )
}

export default App
