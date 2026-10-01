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
import { replaceInSubtitles } from './lib/wordReplace'
import realtimeChain from './lib/realtimeChain'
import { WINDOW_SUBTITLES_WIDTH, WINDOW_NO_SUBTITLES_WIDTH, WINDOW_DEFAULT_HEIGHT } from './global_config/window'
import { SUBTITLE_DISPLAY_DEFAULTS } from './global_config/subtitleConfig'
import { useLang } from './lib/i18n'
import { LANGS } from './global_config/languages'
import { SUBTITLE_LANG_AUTO } from './global_config/subtitleLanguages'

// Targets of "Output resolution" (keys = output_resolution values in
// config.ini and in .corgi.json). 'original' stays out: keeps the input.
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
  // Cut timing (Settings > Output): true = the toggle runs auto-editor right
  // away (historical behavior); false = the preview keeps the original and
  // the cut runs only at export (the AUTO CUT toggle must stay on for that).
  const [cutImmediate, setCutImmediate] = useState(true)
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
  const [showShortcuts, setShowShortcuts] = useState(false) // shortcuts modal (sidebar)
  // "OPEN" modal (recent projects): the list comes from config when opening
  const [showRecent, setShowRecent] = useState(false)
  const [recentProjects, setRecentProjects] = useState([])
  // Neural model status (get-rnnoise-status on boot): installed + path.
  const [rnnoiseStatus, setRnnoiseStatus] = useState(null)
  const [advancedTools, setAdvancedTools] = useState(true)
  const [exportedFolderPath, setExportedFolderPath] = useState('')
  const [showCudaModal, setShowCudaModal] = useState(false)
  const [cudaInstalled, setCudaInstalled] = useState(false)
  const [projectFilePath, setProjectFilePath] = useState(null) // v1.8.0: current .corgi.json (saved/opened)
  const [confirmNewOpen, setConfirmNewOpen] = useState(false) // "save before clearing?" modal
  const [errorMessage, setErrorMessage] = useState('')
  const errorBuffer = useRef('')
  // ffmpeg-specific error (with stderr): arrives before onFfmpegDone and
  // must NOT be overwritten by the generic subtitle message.
  const ffmpegErrRef = useRef('')
  const lastPct = useRef(0)
  const videoDurationRef = useRef(0)
  const videoRef = useRef(null)
  const exportingRef = useRef(false)
  const waveSurferRef = useRef(null)
  const globalConfigRef = useRef(null) // v1.8.0: config.ini read at boot (basis of NEW PROJECT)

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
  // Horizontal spacing from the subtitle to the video edge/wall, in % of
  // the width. Only takes effect with autoLineWrap on (the effective value is
  // computed at the consumption points: export and preview).
  const [subtitleHMargin, setSubtitleHMargin] = useState(0.5)
  const [subtitleConfigs, setSubtitleConfigs] = useState({})
  // Font ids starred in the SubtitleConfigModal dropdown (persisted in config.ini)
  const [favoriteFonts, setFavoriteFonts] = useState([])
  const [subtitlesEdited, setSubtitlesEdited] = useState(false)

  // --- Export range (I/O marks on the waveform) ---------------------------
  // start/end in SECONDS; null = no mark. selectedMarker = the mark clicked
  // on the waveform, which Delete clears. exportRange is cleared when the file changes.
  const [exportRange, setExportRange] = useState({ start: null, end: null })
  const [selectedMarker, setSelectedMarker] = useState(null)

  // --- Ctrl+Z (undo) ------------------------------------------------------
  // Stack of snapshots of the subtitle array, saved BEFORE each manual
  // edit (text/timing, delete, add, clear).
  const subtitlesHistoryRef = useRef([])
  const subtitlesRef = useRef(subtitles)

  // --- v1.7.0: sound processing -------------------------------------------
  // soundConfig.enabled is the MASTER switch (🎤 button): with it off
  // the modal becomes inaccessible and NO chain goes to the export.
  const [soundConfig, setSoundConfig] = useState(DEFAULT_SOUND_CONFIG)
  const [customPresets, setCustomPresets] = useState([])
  const [showSound, setShowSound] = useState(false)
  const [abMode, setAbMode] = useState(null) // null = follows the 🎤 | 'original' | 'treated'
  const [realtimeDraft, setRealtimeDraft] = useState(null) // modal draft under audition
  const [playRequest, setPlayRequest] = useState(0) // increments to play (A/B)

  // EFFECTIVE horizontal margin (%): 0 when automatic line wrap is
  // off => export falls back to the legacy 10px and the preview to maxWidth 85/90%.
  const hMarginPct = autoLineWrap ? subtitleHMargin : 0

  // Applies config.ini (GLOBAL settings) to state — used on boot and by
  // NEW PROJECT, which needs to undo what an open project overwrote.
  const applyConfig = (c) => {
    if (!c) return
    setThreshold(c.threshold)
    setMarginVal(c.margin)
    setMarginAfter(c.margin_after ?? '0.5')
    setSmooth(c.smooth ?? '0.2')
    setCutImmediate(c.cut_immediate !== 'false')
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
    setFavoriteFonts(String(c.favorite_fonts || '').split(',').map((id) => id.trim()).filter(Boolean))
    try { setSoundConfig(mergeSoundConfig(JSON.parse(c.sound_config || 'null'))) } catch { setSoundConfig(mergeSoundConfig(null)) }
    try { setCustomPresets(JSON.parse(c.sound_presets || '[]') || []) } catch { setCustomPresets([]) }
  }

  // Star toggle in the font dropdown: state updates instantly (the list
  // re-sorts with favorites first) and saveConfig merges this single key
  // into config.ini, leaving every other setting untouched. The config ref
  // is kept in sync too — applyConfig re-runs from it on NEW PROJECT.
  const toggleFavoriteFont = (fontId) => {
    const next = favoriteFonts.includes(fontId)
      ? favoriteFonts.filter((id) => id !== fontId)
      : [...favoriteFonts, fontId]
    const joined = next.join(',')
    setFavoriteFonts(next)
    globalConfigRef.current = { ...globalConfigRef.current, favorite_fonts: joined }
    window.api.saveConfig({ favorite_fonts: joined })
  }

  useEffect(() => {
    window.api.getConfig().then((c) => {
      globalConfigRef.current = c
      applyConfig(c)
    })

    window.api.checkCudaInstalled().then(setCudaInstalled)

    // Neural model (rnnoise): initial status — installed + path for -af.
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
        // main sends ffmpeg-error (specific, with stderr) BEFORE done;
        // without this ref the real message was swallowed by the generic one.
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

  // --- v1.8.0: preview in REAL TIME ("instant A/B") -------------------------
  // The 🎤 chain runs in Web Audio INSIDE the wavesurfer AudioContext
  // (realtimeChain). Switching A/B sides is a gain crossfade: no
  // ffmpeg render, no font reload — you can hear it right away, from wherever
  // the playhead is. 'treated' hears the modal DRAFT; the rest, the saved
  // config. EXPORT still uses the exact ffmpeg.
  const realtimeActive = abMode === 'treated' || (soundConfig.enabled && abMode !== 'original')
  const realtimeCfg = abMode === 'treated' && realtimeDraft ? realtimeDraft : soundConfig
  // The SHAPE of the waveform follows what is being HEARD: treated when the
  // preview is active and there is something to treat, original on side A / 🎤 off.
  const shapeCfg = useMemo(
    () => (realtimeActive && buildSoundChain(realtimeCfg) ? realtimeCfg : null),
    [realtimeActive, realtimeCfg]
  )
  useEffect(() => {
    realtimeChain.setConfig(realtimeCfg)
    realtimeChain.setBypass(!realtimeActive)
  }, [realtimeCfg, realtimeActive])

  // Player (WebAudioPlayer) handed over by the Waveform on each creation/destruction
  const handlePlayerCreated = (player) => realtimeChain.attach(player)

  // File switch/clear: resets the A/B and the draft under audition — the
  // real-time chain is re-connected on the new player by the Waveform (handlePlayerCreated)
  useEffect(() => {
    setAbMode(null)
    setRealtimeDraft(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile])

  // 🎤: master switch of Advanced Sound — the real-time preview follows
  // right away (crossfade in the player, without pausing or rendering anything)
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
  // File the PREVIEW plays/shows: the cut one while the cut is on AND instant
  // cut is on (instant off → the preview keeps the original until export).
  // selectedFile stays the ORIGINAL — export always starts from it (and trims
  // the I/O range first, a contract the preview does not reproduce).
  const previewFile = useMemo(
    () =>
      cutImmediate && cutEnabled && cutState && cutState.srcPath === selectedFile?.path
        ? { ...selectedFile, path: cutState.path }
        : selectedFile,
    [selectedFile, cutImmediate, cutEnabled, cutState]
  )

  // Preview subtitles remapped to the cut timeline (same remap as export —
  // same instant-cut gate as the video above). The edit panel stays on the
  // ORIGINAL timeline: edit the source and remap on the fly is exactly the
  // export contract.
  const previewSubtitles = useMemo(
    () =>
      cutImmediate && cutEnabled && cutState?.segments?.length && cutState.srcPath === selectedFile?.path
        ? remapSubtitleTimestamps(subtitles, cutState.segments, cutState.fps)
        : subtitles,
    [subtitles, selectedFile, cutImmediate, cutEnabled, cutState]
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
  // Instant cut OFF (Settings > Output): ON only flips the switch — the
  // preview stays on the original and auto-editor runs at export time.
  const handleToggleCut = async () => {
    if (!selectedFile || processing || generatingSubtitles || cutBusy) return
    if (cutEnabled) {
      const old = cutState
      setCutEnabled(false)
      setCutState(null)
      if (old?.path) window.api.deleteFile(old.path).catch(() => {})
      return
    }
    if (!cutImmediate) {
      setCutEnabled(true)
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

  // Modal A/B preview — in REAL TIME: 'original' just applies the bypass (crossfade),
  // 'treated' swaps the DRAFT config (preset/tweaks not yet applied) into the
  // chain. Switches instantly, at the current position — no render, no reload.
  // NEVER processes the final file.
  const handleListenSound = (mode, draftCfg) => {
    if (!selectedFile || processing) return
    if (mode === 'treated') {
      const cfg = draftCfg || soundConfig
      // Empty chain (everything off) has nothing to treat — plays the original
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

  // Modal APPLY: only SAVES and closes — nothing is processed at that moment (the
  // processing runs only at export). The real-time preview then follows the
  // saved config (the realtimeChain effect reconnects the chain) and the
  // SHAPE of the waveform redraws for the new config (offline render).
  const handleApplySound = async (cfg) => {
    setShowSound(false)
    setAbMode(null)
    setRealtimeDraft(null)
    await handleSaveSettings({ sound_config: cfg })
  }

  const handleSoundPresets = (presets) => handleSaveSettings({ sound_presets: presets })

  // --- v1.8.0: projects ----------------------------------------------------
  const cloneDeep = (o) => JSON.parse(JSON.stringify(o))

  // Snapshot of what the project needs to reopen the same way: media,
  // generated subtitles, sound PRESET (id + 🎤; tweaks not saved as preset are lost),
  // subtitle config and the cut/export settings.
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

  // [💾]: first time opens "Save as" (media folder + its name);
  // once a path exists, overwrites in place without asking.
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
      markProjectRecent(target) // saved now → top of recents (fire-and-forget)
      return true
    }
    setErrorMessage(res?.error || t('project.saveFailed'))
    setShowError(true)
    return false
  }

  // Registers the project in recents (config.ini → recent_projects; main's
  // save-config merges keys, so nothing else is touched).
  // Called on open and on save — the config is the source of truth, no list
  // duplicated in the renderer (the modal re-reads it when opening).
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

  // Unreadable recent (file gone/corrupted) → drops it from the list (self-cleanup)
  const dropProjectRecent = async (path) => {
    try {
      const cur = await window.api.getConfig()
      const next = evictRecent(parseRecents(cur?.recent_projects), path)
      await window.api.saveConfig({ recent_projects: JSON.stringify(next) })
    } catch (err) {
      console.warn('[project] falha ao limpar recente:', err)
    }
  }

  // Loads a project with the result already in hand — native dialog OR path
  // straight from the recents modal go through here (same apply body).
  const applyLoadedProject = async (r) => {
    const d = r.data || {}
    const mediaPath = typeof d.mediaPath === 'string' ? d.mediaPath : ''

    // Sound: the project stores only the preset (system or custom) + the 🎤 state.
    // Tweaks not saved as preset are not here and are lost by definition;
    // preset deleted → falls back to the global settings.
    const savedSound = d.sound || {}
    let cfg
    const preset = findPreset(savedSound.presetId, customPresets)
    if (preset) {
      cfg = { ...cloneDeep(DEFAULT_SOUND_CONFIG), ...cloneDeep(preset.params), presetId: preset.id, enabled: savedSound.enabled === true }
    } else {
      try { cfg = mergeSoundConfig(JSON.parse(globalConfigRef.current?.sound_config || 'null')) } catch { cfg = mergeSoundConfig(null) }
      cfg = { ...cfg, enabled: savedSound.enabled === true }
    }

    // Restores starting from the GLOBALS and applying on top only what the save
    // has (no leftover state from the previous project).
    applyConfig(globalConfigRef.current)

    let file = null
    if (mediaPath && r.mediaExists) {
      const size = await window.api.getFileSize(mediaPath)
      file = { path: mediaPath, name: mediaPath.split(/[/\\]/).pop(), folder: mediaPath.replace(/[\\/][^\\/]+$/, ''), size: typeof size === 'number' ? size : undefined }
    }
    setSelectedFile(file)
    setSubtitles(Array.isArray(d.subtitles) ? d.subtitles : [])
    setSubtitlesEdited(d.subtitlesEdited === true)
    // New project in memory: undo cannot revert edits from the previous project
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

  // MANUAL OPEN: native dialog (original flow) → applies + registers in recents
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

  // Click on a row of the recents modal: reads the file directly (no dialog),
  // applies it the same way and reorders to the top. Failed → drops off the list and warns.
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

  // OPEN (TitleBar) → recents modal; the list is re-read from the config here
  // so it always reflects the current state (open/save already persisted before).
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

  // "OPEN MANUALLY" from the modal → closes and falls into the original native dialog
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
    applyConfig(globalConfigRef.current) // back to the global settings
    setInfoToast(t('project.created'))
  }

  // [📄]: with content, asks whether to save before clearing (wireframe v1.8.0);
  // empty, clears right away.
  const requestNewProject = () => {
    if (processing || generatingSubtitles) return
    if (selectedFile || subtitles.length > 0 || projectFilePath) setConfirmNewOpen(true)
    else doNewProject()
  }

  const handleExport = async () => {
    if (!selectedFile || processing || generatingSubtitles || cutBusy) return
    // Marked range (I/O): trims ONLY when start AND end are both marked.
    // One of the two missing → warns EXACTLY which one (before entering processing).
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
    // Player stops immediately when the export starts — video and wavesurfer
    // paused INDEPENDENTLY (an audio file has no videoRef, and the
    // wavesurfer needs to stop too)
    if (videoRef.current) videoRef.current.pause()
    if (waveSurferRef?.current) waveSurferRef.current.pause()
    exportingRef.current = true
    setProcessing(true)
    errorBuffer.current = ''
    lastPct.current = 0
    videoDurationRef.current = 0
    setProgress({ pct: 0, text: '0%' })

    // 🎤 gate: Advanced Sound only goes to the export with the master switch
    // ON — even with a preset chosen, off builds no chain at all.
    const soundChain = soundConfig.enabled
      ? buildSoundChain(soundConfig, { rnnoiseModel: rnnoiseStatus?.installed ? rnnoiseStatus.path : null })
      : ''
    if (soundChain) console.log('[export] som avançado (🎤 ligado):', soundChain)

    const base = selectedFile.name.replace(/\.[^.]+$/, '')
    const inputExt = selectedFile.name.split('.').pop().toLowerCase()
    // With a marked range, only what is INSIDE the segment survives — shifted
    // to the trim timeline (the cut file starts at 0). If no subtitle
    // falls inside, it neither burns nor writes a sidecar SRT.
    const rangeStartMs = hasRange ? Math.round(exportRange.start * 1000) : 0
    const rangeEndMs = hasRange ? Math.round(exportRange.end * 1000) : 0
    const sourceSubtitles = hasRange
      ? shiftSubtitlesForRange(subtitles, rangeStartMs, rangeEndMs)
      : subtitles
    const hasSubtitles = sourceSubtitles.length > 0
    const shouldBurn = burnSubtitles && hasSubtitles
    // Burn OFF + generated subtitles: writes a sidecar .srt with the SAME
    // name as the exported file (the promise of the settings.burnSrtOnly hint)
    const writeSidecarSrt = hasSubtitles && !burnSubtitles
    const videoExts = ['mp4', 'mkv', 'mov', 'webm', 'avi']
    const isVideoInput = videoExts.includes(inputExt)
    // The format chosen in Config rules the output container: the
    // video pipeline only runs when the output IS video. Green screen and subtitle
    // burn only make sense for video output (SettingsModal already warns
    // "requires video format" in that case). Before, any feature on
    // OR an audio input forced mp4 and ignored the chosen format.
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

    // Marked range (I/O): trims the segment BEFORE auto-editor — the silence
    // cut, subtitle remapping and the burn all already run
    // inside the segment. '-ss' on the INPUT + '-t' on the output gives a frame-
    // accurate cut (re-encode with the container's default encoder).
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

      // Duration used only to animate the ffmpeg progress bar — on the
      // EXPORTED timeline (with the I/O range, already shifted and trimmed)
      const duration = exportSubtitles.length > 0
        ? parseSrtTime(exportSubtitles[exportSubtitles.length - 1].end) / 1000
        : 3600
      // REAL duration of the work file (cut/trimmed). The subtitle/3600 guess
      // fed BOTH the progress base and the lavfi background: an audio-input
      // export with no subtitles built a 1-hour black canvas and -shortest
      // left seconds of black+silence past the audio (mp4 silent tail).
      const workDuration = (await window.api.getMediaDuration(exportAudioPath)) || duration
      videoDurationRef.current = Math.min(duration, workDuration)

      if (needsVideo) {
        let ffmpegArgs
        if (isVideoInput) {
          ffmpegArgs = [
            '-y',
            '-i', exportAudioPath,
          ]
        } else {
          // #00A800 = same green as the preview (DropZone); ffmpeg's named
          // 'green' (#008000) came out too dark in the exported video.
          const bgColor = greenScreen ? '0x00A800' : 'black'
          const bgTgt = resTarget(outputResolution)
          const bgRes = bgTgt ? `${bgTgt.w}x${bgTgt.h}` : '1920x1080'
          // Background ends WITH the work file: d=duration (subtitles/3600
          // guess) let the black canvas outlive the audio and the -shortest
          // overshoot wrote seconds of black+silence after the last frame.
          ffmpegArgs = [
            '-y',
            '-f', 'lavfi',
            '-i', `color=c=${bgColor}:s=${bgRes}:d=${workDuration}`,
            '-i', exportAudioPath,
          ]
        }

        const videoFilters = []
        if (isVideoInput && outputResolution !== 'original') {
          // Unknown id (old config) keeps the old behavior: landscape.
          const tgt = resTarget(outputResolution) || RESOLUTION_TARGETS.landscape
          // Same framing as the preview (object-contain over the canvas):
          // scale keeping the source aspect ratio, then pad the leftover
          // bands black. A plain scale=W:H stretched mismatched aspects
          // (landscape source on a portrait target came out "amassado").
          videoFilters.push(`scale=${tgt.w}:${tgt.h}:force_original_aspect_ratio=decrease,pad=${tgt.w}:${tgt.h}:(ow-iw)/2:(oh-ih)/2:color=black`)
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
          // The canvas only measures after the webfont loads; without this the
          // highlightbox comes out with the words glued together in the final video.
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

            // fontsdir: tells libass where to look for fonts not installed in Windows
            // (e.g.: Komika Axis). Without it the export falls back (Arial). Escaping validated with ffmpeg:
            // the drive needs 2 backslashes (E\\:) and spaces 1 backslash (fonts\ with\ space).
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

        // The -vf stays OUTSIDE if(shouldBurn): inside it, the resolution (scale)
        // was ignored when subtitle burning was off.
        if (videoFilters.length > 0) {
          ffmpegArgs.push('-vf', videoFilters.join(','))
        }

        // Codecs per container: webm only accepts VP9/VP8 + Opus/Vorbis
        if (outputFormat === 'webm') {
          ffmpegArgs.push('-c:v', 'libvpx-vp9', '-cpu-used', '4', '-deadline', 'realtime', '-c:a', 'libopus')
        } else {
          ffmpegArgs.push('-c:v', 'libx264', '-c:a', 'aac')
        }
        // Sound processing (v1.7.0): same chain heard in the preview
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
        // Audio output: drops the video track and uses the chosen format's
        // codec (the old fixed '-c:a aac' was rejected by mp3/wav/flac/ogg).
        const audioCodecs = { mp3: 'libmp3lame', wav: 'pcm_s16le', flac: 'flac', ogg: 'libvorbis', aac: 'aac', m4a: 'aac' }
        const ffmpegArgs = ['-y', '-i', exportAudioPath, '-vn']
        if (soundChain) {
          // Advanced sound on: -af requires re-encode (impossible with 'copy')
          ffmpegArgs.push('-af', soundChain)
          ffmpegArgs.push('-c:a', audioCodecs[outputFormat] || 'aac')
        } else {
          // Same format as the input: cuts without re-encoding (zero loss)
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

      // Burn OFF: writes the sidecar .srt with the SAME name as the file
      // exported (exportSubtitles already remapped to the cut timeline)
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
    // Player stops immediately when generating subtitles — video and wavesurfer
    // paused INDEPENDENTLY (an audio file has no videoRef)
    if (videoRef.current) videoRef.current.pause()
    if (waveSurferRef?.current) waveSurferRef.current.pause()
    whisperGenRef.current++
    whisperStoppingRef.current = false
    setGeneratingSubtitles(true)
    setSubtitles([])
    setSubtitlesEdited(false)
    // New generation replaces everything: the previous undo no longer makes sense
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
      // AUTO: reports the language whisper detected in the audio
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

  // Replaces every whole-word match of `before` across the whole track in one
  // undo snapshot — word timings are kept, only the strings change.
  const handleReplaceWord = (before, after, ignoreCase) => {
    if (!before || !after || before === after) return 0
    const { next, count } = replaceInSubtitles(subtitles, before, after, ignoreCase)
    if (count === 0) return 0
    pushUndoSnapshot()
    setSubtitlesEdited(true)
    setSubtitles(next)
    return count
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

  const handleSaveSubtitles = async (list) => {
    // `list` lets the Enter commit+save pass the next array directly: at that
    // point `subtitles` state has not flushed yet. The SAVE button calls it
    // bare and serializes current state.
    const src = Array.isArray(list) ? list : subtitles
    const baseName = selectedFile.name.replace(/\.[^.]+$/, '')
    const srtPath = await window.api.joinPath(selectedFile.folder, `${baseName}_words.srt`)
    const lines = []
    src.forEach((sub, i) => {
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
    if (newConfig.cut_immediate !== undefined) setCutImmediate(newConfig.cut_immediate === true || newConfig.cut_immediate === 'true')
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
      cut_immediate: String(newConfig.cut_immediate ?? cutImmediate),
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
    // NEW/LOAD globals follow the just-saved ones: before, the ref kept the
    // boot snapshot and NEW reverted (e.g.: changed the resolution, NEW went
    // back to the old resolution instead of the last saved one).
    try {
      globalConfigRef.current = await window.api.getConfig()
    } catch { /* keeps the boot snapshot */ }

    // Instant cut just turned ON while AUTO CUT is active: the preview cut
    // never ran (or is stale) — build it now with the fresh values.
    const wantImmediate = newConfig.cut_immediate === true || newConfig.cut_immediate === 'true'
    if (wantImmediate && cutEnabled) generateCutPreview()
  }

  // Click on the sidebar buttons. ANALYZE needs a loaded file;
  // RNNOISE and config settings always open.
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

  // Suggestion APPLY: threshold + margin on the controls and measured denoise
  // enabled in the sound chain (with sound on, otherwise denoise has no effect).
  // Persists to config.ini right away (merge, same flow as language/theme).
  const handleApplySuggestions = async (suggestions) => {
    const { threshold, margin, denoiseDb } = suggestions
    setThreshold(String(threshold))
    setMarginVal(String(margin))
    // The suggestion is symmetric: BOTH margin sides take the measured value.
    setMarginAfter(String(margin))
    // AUTO CUT on + instant cut: parameters changed → the preview went stale,
    // regenerate on the spot with fresh values (no waiting for a toggle).
    if (cutEnabled && cutImmediate) generateCutPreview({ threshold: String(threshold), margin: String(margin), marginAfter: String(margin) })
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

  // RNNoise module APPLY: chosen noise engine persists in the config
  // (same merge as ANALYZE). With an engine active the master audio turns on
  // as well — a chain turned off has no effect at all.
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
  // Snapshot saved BEFORE the edit (see pushUndoSnapshot in the handlers).
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

  // Mirror of the subtitle array: the snapshot reads the CURRENT value at
  // render (the handlers' functional setSubtitles does not deliver the value outside).
  useEffect(() => {
    subtitlesRef.current = subtitles
  }, [subtitles])

  // File switch clears the export I/O marks (the range belongs to the file).
  useEffect(() => {
    setExportRange({ start: null, end: null })
    setSelectedMarker(null)
  }, [selectedFile?.path])

  // --- Keyboard transport --------------------------------------------------
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

  // ←/→ jumps 5s on the timeline (the wavesurfer seek mirrors to the video)
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

  // I = START of the export at the current playhead · O = END
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

  // --- Global keyboard shortcuts ------------------------------------------
  // Ctrl+S save · Ctrl+O open · Ctrl+N new · Ctrl+Z undo ·
  // Space play/pause · ←/→ jump · I/O mark the export range ·
  // Delete clears the selected mark.
  // None of this fires while focus is in a text field (INPUT,
  // TEXTAREA, SELECT or contenteditable) — Ctrl+* still saves
  // the project even while editing a subtitle.
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
        e.preventDefault() // keeps the key from "clicking" the focused button
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
            onReplaceWord={handleReplaceWord}
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
            favoriteFonts={favoriteFonts}
            onToggleFavoriteFont={toggleFavoriteFont}
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
          cutImmediate={cutImmediate}
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
            // Draft discarded (no APPLY): the chain goes back to following the SAVED config
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
            // Cut on + instant cut + fresh parameters: regenerate the preview on the spot.
            if (cutEnabled && cutImmediate) generateCutPreview(v)
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
