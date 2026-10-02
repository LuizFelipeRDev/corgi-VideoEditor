import { useState, useEffect, useRef } from 'react'
import { IconZoomScan, IconRectangle, IconRectangleVertical } from '@tabler/icons-react'
import Tooltip from './Tooltip'
import { useLang } from '../lib/i18n'
import { SUBTITLE_LANGS, SUBTITLE_LANG_AUTO } from '../global_config/subtitleLanguages'
import { useTheme } from '../lib/theme'
import { LANGS } from '../global_config/languages'

const OUTPUT_FORMATS = [
  { value: 'mp3', label: 'MP3' },
  { value: 'wav', label: 'WAV' },
  { value: 'flac', label: 'FLAC' },
  { value: 'ogg', label: 'OGG' },
  { value: 'aac', label: 'AAC' },
  { value: 'm4a', label: 'M4A' },
  { value: 'mp4', label: 'MP4' },
  { value: 'mkv', label: 'MKV' },
  { value: 'mov', label: 'MOV' },
  { value: 'webm', label: 'WEBM' },
  { value: 'avi', label: 'AVI' },
]

const AUDIO_FORMATS = ['mp3', 'wav', 'flac', 'ogg', 'aac', 'm4a']

const WHISPER_MODELS = [
  { id: 'tiny', name: 'tiny', label: 'Tiny', size: '75 MB', vram: '~1 GB', descKey: 'settings.modelDesc.tiny' },
  { id: 'base', name: 'base', label: 'Base', size: '142 MB', vram: '~1 GB', descKey: 'settings.modelDesc.base' },
  { id: 'small', name: 'small', label: 'Small', size: '466 MB', vram: '~2 GB', descKey: 'settings.modelDesc.small' },
  { id: 'medium', name: 'medium', label: 'Medium', size: '1.5 GB', vram: '~5 GB', descKey: 'settings.modelDesc.medium' },
  { id: 'large-v3', name: 'large-v3', label: 'Large v3', size: '2.9 GB', vram: '~10 GB', descKey: 'settings.modelDesc.large-v3' },
]

function SettingsModal({ outputFolder, outputFormat, outputResolution, cutImmediate, subtitles, subtitleModel, subtitleLanguage, greenScreen, burnSubtitles, selectedFile, wordsPerLine, linesCount, subtitlePersistence, smartSubtitle, autoLineWrap, subtitleHMargin, positionMode, positionPercent, onClose, onSave, onRequestCudaDownload, cudaInstalled, advancedTools, duckingEnabled }) {
  const { lang, setLang, t } = useLang()
  const { theme, setTheme } = useTheme()
  const [tab, setTab] = useState('sistema')
  const [localFolder, setLocalFolder] = useState(outputFolder)
  const [localFormat, setLocalFormat] = useState(outputFormat)
  const [localResolution, setLocalResolution] = useState(outputResolution || 'original')
  const [localCutImmediate, setLocalCutImmediate] = useState(cutImmediate ?? true)
  const [showResPopup, setShowResPopup] = useState(false)
  const resPopupRef = useRef(null)
  const [localSubtitles, setLocalSubtitles] = useState(subtitles)
  const [localSubtitleModel, setLocalSubtitleModel] = useState(subtitleModel || 'tiny')
  const [localSubtitleLanguage, setLocalSubtitleLanguage] = useState(subtitleLanguage || 'auto')
  const [localGreenScreen, setLocalGreenScreen] = useState(greenScreen)
  const [localBurnSubtitles, setLocalBurnSubtitles] = useState(burnSubtitles)
  const [localWordsPerLine, setLocalWordsPerLine] = useState(wordsPerLine || 4)
  const [localLinesCount, setLocalLinesCount] = useState(linesCount || 2)
  const [localPersistence, setLocalPersistence] = useState(subtitlePersistence ?? 1)
  const [localSmartSubtitle, setLocalSmartSubtitle] = useState(smartSubtitle)
  const [localAutoLineWrap, setLocalAutoLineWrap] = useState(autoLineWrap)
  const [localHMargin, setLocalHMargin] = useState(Number.isFinite(Number(subtitleHMargin)) ? Math.min(20, Math.max(0, Number(subtitleHMargin))) : 0.5)
  const [localPositionMode, setLocalPositionMode] = useState(positionMode || 'fixed')
  const [localPositionPercent, setLocalPositionPercent] = useState(positionPercent ?? 80)
  const [localAdvancedTools, setLocalAdvancedTools] = useState(advancedTools ?? true)
  const [localDucking, setLocalDucking] = useState(duckingEnabled ?? false)

  const [confirmDialog, setConfirmDialog] = useState(null)
  const [modelInstalled, setModelInstalled] = useState({})
  const [downloading, setDownloading] = useState(null)
  const [downloadProgress, setDownloadProgress] = useState(0)

  // Language switch: applies immediately across the app and persists in config.ini
  // (merges with the current config so the other keys are not erased).
  const handleLanguageChange = async (next) => {
    setLang(next)
    try {
      const current = window.api && window.api.getConfig ? await window.api.getConfig() : null
      if (current && window.api.saveConfig) {
        await window.api.saveConfig({ ...current, language: next })
      }
    } catch (err) {
      console.warn('[i18n] falha ao persistir idioma:', err)
    }
  }

  // Theme switch: applies immediately (data-theme on <html>) and persists in
  // config.ini (same merge as the language so the other keys are not erased).
  const handleThemeChange = async (next) => {
    setTheme(next)
    try {
      const current = window.api && window.api.getConfig ? await window.api.getConfig() : null
      if (current && window.api.saveConfig) {
        await window.api.saveConfig({ ...current, theme: next })
      }
    } catch (err) {
      console.warn('[theme] falha ao persistir tema:', err)
    }
  }

  const isInputAudio = selectedFile
    ? AUDIO_FORMATS.includes(selectedFile.name.split('.').pop().toLowerCase())
    : false

  const isOutputAudio = AUDIO_FORMATS.includes(localFormat)
  const needsVideo = localBurnSubtitles || localGreenScreen

  useEffect(() => {
    WHISPER_MODELS.forEach(async (m) => {
      const installed = await window.api.checkModel(m.name)
      setModelInstalled((prev) => ({ ...prev, [m.name]: installed }))
    })
  }, [])

  useEffect(() => {
    const handler = (data) => {
      if (data.model === downloading) {
        setDownloadProgress(data.progress)
        if (data.progress >= 100) {
          setModelInstalled((prev) => ({ ...prev, [data.model]: true }))
          setDownloading(null)
          setDownloadProgress(0)
        }
      }
    }
    window.api.onModelDownloadProgress(handler)
    return () => window.api.onModelDownloadProgress(null)
  }, [downloading])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (resPopupRef.current && !resPopupRef.current.contains(e.target)) {
        setShowResPopup(false)
      }
    }
    if (showResPopup) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showResPopup])

  const handleSelectFolder = async () => {
    const d = await window.api.selectOutputDir()
    if (d) setLocalFolder(d)
  }

  const handleSave = async () => {
    await onSave({
      output_folder: localFolder,
      output_format: localFormat,
      output_resolution: localResolution,
      cut_immediate: localCutImmediate,
      subtitles: localSubtitles,
      subtitle_model: localSubtitleModel,
      subtitle_language: localSubtitleLanguage,
      green_screen: localGreenScreen,
      burn_subtitles: localBurnSubtitles,
      words_per_line: localWordsPerLine,
      lines_count: localLinesCount,
      subtitle_persistence: localPersistence,
      smart_subtitle: localSmartSubtitle,
      auto_line_wrap: localAutoLineWrap,
      subtitle_h_margin: localHMargin,
      advanced_tools: localAdvancedTools,
      ducking_enabled: localDucking,
      subtitle_position_mode: localPositionMode,
      subtitle_position_percent: localPositionPercent,
    })
    onClose()
  }

  const handleToggleBurnSubtitles = (checked) => {
    if (checked && isOutputAudio) {
      setConfirmDialog({
        message: t('settings.confirmBurn'),
        onConfirm: () => {
          setLocalBurnSubtitles(true)
          setLocalFormat('mp4')
          setConfirmDialog(null)
        },
        onCancel: () => setConfirmDialog(null),
      })
      return
    }
    setLocalBurnSubtitles(checked)
  }

  const handleToggleGreenScreen = (checked) => {
    if (checked && isOutputAudio) {
      setConfirmDialog({
        message: t('settings.confirmGreen'),
        onConfirm: () => {
          setLocalGreenScreen(true)
          setLocalFormat('mp4')
          setConfirmDialog(null)
        },
        onCancel: () => setConfirmDialog(null),
      })
      return
    }
    setLocalGreenScreen(checked)
  }

  const handleFormatChange = (newFormat) => {
    const wasAudio = isOutputAudio
    const willBeAudio = AUDIO_FORMATS.includes(newFormat)
    setLocalFormat(newFormat)

    if (wasAudio && !willBeAudio) return

    if (!wasAudio && willBeAudio && (localBurnSubtitles || localGreenScreen)) {
      setConfirmDialog({
        message: t('settings.confirmAudioFormat'),
        onConfirm: () => {
          setLocalBurnSubtitles(false)
          setLocalGreenScreen(false)
          setConfirmDialog(null)
        },
        onCancel: () => {
          setLocalFormat(outputFormat)
          setConfirmDialog(null)
        },
      })
    }
  }

  const handleToggleSubtitles = (checked) => {
    setLocalSubtitles(checked)
    if (checked && isOutputAudio) {
      setConfirmDialog({
        message: t('settings.confirmSubtitles'),
        onConfirm: () => {
          setLocalFormat('mp4')
          setConfirmDialog(null)
        },
        onCancel: () => setConfirmDialog(null),
      })
    }
  }

  const handleModelChange = async (newModel) => {
    setLocalSubtitleModel(newModel)
    const installed = await window.api.checkModel(newModel)
    setModelInstalled((prev) => ({ ...prev, [newModel]: installed }))
  }

  const handleDownloadModel = (modelName) => {
    const model = WHISPER_MODELS.find((m) => m.name === modelName)
    setConfirmDialog({
      message: t('settings.confirmDownloadModel', { label: model.label, size: model.size }),
      onConfirm: async () => {
        setConfirmDialog(null)
        setDownloading(modelName)
        setDownloadProgress(0)
        await window.api.downloadModel(modelName)
      },
      onCancel: () => setConfirmDialog(null),
    })
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
  <div
    className="bg-retro-box border-2 border-retro-black rounded-lg shadow-retro w-[24rem] h-[80vh] p-4 flex flex-col relative"
    onClick={(e) => e.stopPropagation()}
  >
    {confirmDialog && (
      <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10 rounded-lg">
        <div className="bg-retro-box border-2 border-retro-black rounded p-4 mx-4 shadow-retro">
          <p className="font-pixel text-[7px] text-retro-black mb-4 leading-relaxed">
            {confirmDialog.message}
          </p>
          <div className="flex gap-2">
            <button
              onClick={confirmDialog.onConfirm}
              className="btn-retro flex-1 h-8 bg-green-100 border-2 border-retro-black rounded shadow-retro-sm font-pixel text-[7px] hover:bg-green-200"
            >
              {t('common.yes')}
            </button>
            <button
              onClick={confirmDialog.onCancel}
              className="btn-retro flex-1 h-8 bg-retro-bg border-2 border-retro-black rounded shadow-retro-sm font-pixel text-[7px] hover:bg-gray-200"
            >
              {t('common.no')}
            </button>
          </div>
        </div>
      </div>
    )}

    <div className="flex gap-0 mb-4 shrink-0">
      <button
        onClick={() => setTab('sistema')}
        className={`flex-1 h-8 border-2 border-retro-black rounded-t font-pixel text-[8px] uppercase ${
          tab === 'sistema' ? 'bg-retro-bg text-retro-black z-10' : 'bg-retro-box text-retro-black/50'
        }`}
      >
        {t('tabs.system')}
      </button>
      <button
        onClick={() => setTab('geral')}
        className={`flex-1 h-8 border-2 border-retro-black rounded-t font-pixel text-[8px] uppercase ${
          tab === 'geral' ? 'bg-retro-bg text-retro-black z-10' : 'bg-retro-box text-retro-black/50'
        }`}
      >
        {t('tabs.general')}
      </button>
      <button
        onClick={() => setTab('saida')}
        className={`flex-1 h-8 border-2 border-retro-black rounded-t font-pixel text-[8px] uppercase ${
          tab === 'saida' ? 'bg-retro-bg text-retro-black z-10' : 'bg-retro-box text-retro-black/50'
        }`}
      >
        {t('tabs.output')}
      </button>
      <button
        onClick={() => setTab('legendas')}
        className={`flex-1 h-8 border-2 border-retro-black rounded-t font-pixel text-[8px] uppercase ${
          tab === 'legendas' ? 'bg-retro-bg text-retro-black z-10' : 'bg-retro-box text-retro-black/50'
        }`}
      >
        {t('tabs.subtitles')}
      </button>
      <button
        onClick={onClose}
        className="btn-retro w-6 h-6 bg-retro-bg border-2 border-retro-black rounded shadow-retro-sm flex items-center justify-center text-[10px] font-bold hover:bg-red-200 ml-2 shrink-0"
      >
        X
      </button>
    </div>


    <div className="flex-1 overflow-y-auto min-h-0 pr-1 mb-4">
      {tab === 'geral' && (
        <>
          <div className="mb-4">
            <label className="font-pixel text-[7px] text-retro-black uppercase block mb-2">{t('settings.folderLabel')}</label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={localFolder}
                placeholder={t('settings.folderPlaceholder')}
                className="flex-1 h-8 border-2 border-retro-black rounded bg-retro-bg shadow-retro-sm px-2 font-pixel text-[7px] text-retro-black placeholder-retro-black outline-none truncate"
              />
              <button
                onClick={handleSelectFolder}
                className="btn-retro h-8 px-3 bg-retro-bg border-2 border-retro-black rounded shadow-retro-sm font-pixel text-[7px] hover:bg-gray-200"
              >
                ...
              </button>
              <button
                onClick={() => setLocalFolder('')}
                className="btn-retro h-8 w-8 bg-retro-bg border-2 border-retro-black rounded shadow-retro-sm flex items-center justify-center text-[10px] font-bold hover:bg-red-200 shrink-0"
              >
                X
              </button>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center">
              <label className="font-pixel text-[7px] text-retro-black uppercase block mb-2">{t('settings.gpuLabel')}</label>
              <div className="mb-[10px]">
                <Tooltip text={t('settings.gpuTooltip')}>
                  <span className="font-pixel text-[7px] text-retro-black/50 cursor-help">[?]</span>
                </Tooltip>
              </div>
            </div>

            {cudaInstalled ? (
              <div className="flex items-center justify-between">
                <p className="font-pixel text-[6px] text-green-600">
                  {t('settings.gpuInstalled')}
                </p>
                <button
                  onClick={() => onRequestCudaDownload && onRequestCudaDownload()}
                  className="btn-retro h-6 px-2 bg-retro-bg border-2 border-retro-black rounded shadow-retro-sm font-pixel text-[6px] hover:bg-gray-200"
                >
                  {t('settings.reinstall')}
                </button>
              </div>
            ) : (
              <div>
                <p className="font-pixel text-[6px] text-red-600 mb-1">
                  {t('settings.gpuNotInstalled')}
                </p>
                <button
                  onClick={() => onRequestCudaDownload && onRequestCudaDownload()}
                  className="btn-retro w-full h-7 bg-yellow-100 border-2 border-retro-black rounded shadow-retro-sm font-pixel text-[7px] hover:bg-yellow-200"
                >
                  {t('settings.downloadGpu')}
                </button>
              </div>
            )}
          </div>

          <div className="mb-4">
            <button
              onClick={async () => {
                const dir = await window.api.getWhisperDir()
                window.api.openFolder(dir)
              }}
              className="btn-retro w-full h-7 bg-retro-bg border-2 border-retro-black rounded shadow-retro-sm font-pixel text-[6px] text-retro-black uppercase hover:bg-gray-200 flex items-center justify-center gap-2"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              {t('settings.openDriversFolder')}
            </button>
          </div>

          <div className="mb-4">
            <label className="font-pixel text-[7px] text-retro-black uppercase block mb-2">{t('settings.whisperModel')}</label>
            <div className="flex gap-2">
              <select
                value={localSubtitleModel}
                onChange={(e) => handleModelChange(e.target.value)}
                className="flex-1 h-8 border-2 border-retro-black rounded bg-retro-bg shadow-retro-sm px-2 font-pixel text-[8px] text-retro-black outline-none appearance-none cursor-pointer"
              >
                {WHISPER_MODELS.map((m) => (
                  <option key={m.id} value={m.name}>
                    {t('settings.modelOption', { label: m.label, size: m.size, vram: m.vram })}
                  </option>
                ))}
              </select>
            </div>

            {downloading && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-pixel text-[6px] text-retro-black">
                    {t('settings.downloading', { model: downloading })}
                  </span>
                  <span className="font-pixel text-[6px] text-retro-black">
                    {downloadProgress}%
                  </span>
                </div>
                <div className="w-full h-2 bg-retro-bg border border-retro-black rounded overflow-hidden">
                  <div
                    className="h-full bg-green-400 transition-all duration-300"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {!downloading && !modelInstalled[localSubtitleModel] && (
              <div className="mt-2">
                <p className="font-pixel text-[6px] text-red-600 mb-1">
                  {t('settings.modelNotDownloaded')}
                </p>
                <button
                  onClick={() => handleDownloadModel(localSubtitleModel)}
                  className="btn-retro w-full h-7 bg-yellow-100 border-2 border-retro-black rounded shadow-retro-sm font-pixel text-[7px] hover:bg-yellow-200"
                >
                  {t('settings.downloadModelBtn')}
                </button>
              </div>
            )}

            {!downloading && modelInstalled[localSubtitleModel] && (
              <p className="font-pixel text-[6px] text-green-600 mt-2">
                {t('settings.modelInstalled')}
              </p>
            )}

            <div className="mt-2">
              <p className="font-pixel text-[6px] text-retro-black/50">
                {WHISPER_MODELS.find((m) => m.name === localSubtitleModel) &&
                  t(WHISPER_MODELS.find((m) => m.name === localSubtitleModel).descKey)}
              </p>
            </div>
          </div>
        </>
      )}

      {tab === 'saida' && (
        <>
          <div className="mb-4">
            <label className="font-pixel text-[7px] text-retro-black uppercase block mb-2">{t('settings.formatLabel')}</label>
            <select
              value={localFormat}
              onChange={(e) => handleFormatChange(e.target.value)}
              className="w-full h-8 border-2 border-retro-black rounded bg-retro-bg shadow-retro-sm px-2 font-pixel text-[8px] text-retro-black outline-none appearance-none cursor-pointer"
            >
              {OUTPUT_FORMATS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>

          <div className={`mb-4 ${isOutputAudio ? 'opacity-30 pointer-events-none' : ''}`}>
            <label className="font-pixel text-[7px] text-retro-black uppercase block mb-2">{t('settings.resolutionLabel')}</label>
            <div className="relative" ref={resPopupRef}>
              <button
                onClick={() => !isOutputAudio && setShowResPopup(!showResPopup)}
                className="w-full h-8 border-2 border-retro-black rounded bg-retro-bg shadow-retro-sm px-2 font-pixel text-[8px] text-retro-black uppercase flex items-center justify-between hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isOutputAudio}
              >
                <span>
                  {localResolution === 'original' && t('settings.resOriginal')}
                  {localResolution === 'landscape' && t('settings.resLandscape')}
                  {localResolution === 'landscape720' && t('settings.res720p')}
                  {localResolution === 'portrait' && t('settings.resPortrait')}
                </span>
                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 5l3 3 3-3" />
                </svg>
              </button>

              {showResPopup && (
                // flex-col forces the Tooltip spans to become blocks: without
                // it the items were inline-block and ended up 2x1 (original next
                // to landscape, portrait below).
                <div className="absolute top-full left-0 right-0 mt-1 bg-retro-bg border-2 border-retro-black rounded shadow-retro z-50 flex flex-col">
                  {[
                    { id: 'original', icon: IconZoomScan, labelKey: 'settings.resOriginal', descKey: 'settings.resOriginalDesc', dims: t('settings.auto') },
                    { id: 'landscape', icon: IconRectangle, labelKey: 'settings.resLandscape', descKey: 'settings.resLandscapeDesc', dims: '1920x1080' },
                    { id: 'landscape720', icon: IconRectangle, labelKey: 'settings.res720p', descKey: 'settings.res720pDesc', dims: '1280x720' },
                    { id: 'portrait', icon: IconRectangleVertical, labelKey: 'settings.resPortrait', descKey: 'settings.resPortraitDesc', dims: '1080x1920' },
                  ].map((r) => (
                    <Tooltip key={r.id} text={t(r.descKey)}>
                      <button
                        onClick={() => {
                          setLocalResolution(r.id)
                          setShowResPopup(false)
                        }}
                        className={`w-full h-8 px-2 font-pixel text-[8px] flex items-center gap-2 transition-colors ${
                          localResolution === r.id
                            ? 'bg-retro-black text-retro-bg'
                            : 'hover:bg-gray-200 text-retro-black'
                        }`}
                      >
                        <r.icon size={14} stroke={2} />
                        <span>{t(r.labelKey)}</span>
                        <span className="ml-auto text-[6px] opacity-60">{r.dims}</span>
                      </button>
                    </Tooltip>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center">
              <label className="font-pixel text-[7px] text-retro-black uppercase block mb-2">{t('settings.subtitleLangLabel')}</label>
              <div className="mb-[10px]">
                <Tooltip text={t('settings.subtitleLangTooltip')}>
                  <span className="font-pixel text-[7px] text-retro-black/50 cursor-help">[?]</span>
                </Tooltip>
              </div>
            </div>
            <select
              value={localSubtitleLanguage}
              onChange={(e) => setLocalSubtitleLanguage(e.target.value)}
              className="w-full h-8 border-2 border-retro-black rounded bg-retro-bg shadow-retro-sm px-2 font-pixel text-[8px] text-retro-black outline-none appearance-none cursor-pointer"
            >
              <option value={SUBTITLE_LANG_AUTO}>{t('settings.subtitleLangAuto')}</option>
              {SUBTITLE_LANGS.filter((l) => l.id !== SUBTITLE_LANG_AUTO).map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
          </div>

          {/* Instant cut: when off, auto-editor runs only at export time
              (the master AUTO CUT toggle must stay on for that). */}
          <div className="mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={localCutImmediate}
                onChange={(e) => setLocalCutImmediate(e.target.checked)}
                className="w-4 h-4 accent-retro-black"
              />
              <span className="font-pixel text-[7px] text-retro-black uppercase">{t('cut.immediate')}</span>
              <Tooltip text={t('cut.immediateTip')}>
                <span className="font-pixel text-[7px] text-retro-black/50 cursor-help">[?]</span>
              </Tooltip>
            </label>
          </div>

          {needsVideo && isOutputAudio && (
            <p className="font-pixel text-[6px] text-red-600 mb-2">
              {t('settings.audioNoBurn', { format: localFormat.toUpperCase() })}
            </p>
          )}
        </>
      )}

      {tab === 'legendas' && (
        <>
          <div className="mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={localSubtitles}
                onChange={(e) => handleToggleSubtitles(e.target.checked)}
                className="w-4 h-4 accent-retro-black"
              />
              <span className="font-pixel text-[7px] text-retro-black uppercase">{t('settings.enableSubtitles')}</span>
            </label>
          </div>

          <div className={`mb-4 ${!localSubtitles ? 'opacity-40 pointer-events-none' : ''}`}>
            <label className="font-pixel text-[7px] text-retro-black uppercase block mb-2">{t('settings.positionModeLabel')}</label>
            <select
              value={localPositionMode}
              onChange={(e) => setLocalPositionMode(e.target.value)}
              disabled={!localSubtitles}
              className="w-full h-8 border-2 border-retro-black rounded bg-retro-bg shadow-retro-sm px-2 font-pixel text-[8px] text-retro-black outline-none appearance-none cursor-pointer disabled:opacity-50"
            >
              <option value="fixed">{t('settings.posFixed')}</option>
              <option value="percentage">{t('settings.posFree')}</option>
            </select>
          </div>

          <div className={`mb-4 ${!localSubtitles ? 'opacity-40 pointer-events-none' : ''}`}>
            <label className="font-pixel text-[7px] text-retro-black uppercase block mb-2">{t('settings.wordsPerLine')}</label>
            <select
              value={localWordsPerLine}
              onChange={(e) => setLocalWordsPerLine(Number(e.target.value))}
              disabled={!localSubtitles}
              className="w-full h-8 border-2 border-retro-black rounded bg-retro-bg shadow-retro-sm px-2 font-pixel text-[8px] text-retro-black outline-none appearance-none cursor-pointer disabled:opacity-50"
            >
              <option value={3}>3</option>
              <option value={4}>4</option>
              <option value={5}>5</option>
              <option value={6}>6</option>
            </select>
          </div>

          <div className={`mb-4 ${!localSubtitles ? 'opacity-40 pointer-events-none' : ''}`}>
            <label className="font-pixel text-[7px] text-retro-black uppercase block mb-2">{t('settings.linesCount')}</label>
            <select
              value={localLinesCount}
              onChange={(e) => setLocalLinesCount(Number(e.target.value))}
              disabled={!localSubtitles}
              className="w-full h-8 border-2 border-retro-black rounded bg-retro-bg shadow-retro-sm px-2 font-pixel text-[8px] text-retro-black outline-none appearance-none cursor-pointer disabled:opacity-50"
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </div>

          <div className={`mb-4 ${!localSubtitles ? 'opacity-40 pointer-events-none' : ''}`}>
            <label className="font-pixel text-[7px] text-retro-black uppercase block mb-2">
              {t('settings.persistence', { value: localPersistence.toFixed(1) })}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={localPersistence}
                onChange={(e) => setLocalPersistence(Number(e.target.value))}
                disabled={!localSubtitles}
                className="flex-1 h-2 accent-retro-black disabled:opacity-50"
              />
              <span className="font-pixel text-[7px] text-retro-black w-8 text-right">
                {localPersistence.toFixed(1)}s
              </span>
            </div>
            <p className="font-pixel text-[6px] text-retro-black/50 mt-1">
              {t('settings.persistenceHint')}
            </p>
          </div>

          <div className={`mb-4 ${!localSubtitles ? 'opacity-40 pointer-events-none' : ''}`}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={localSmartSubtitle}
                onChange={(e) => setLocalSmartSubtitle(e.target.checked)}
                disabled={!localSubtitles}
                className="w-4 h-4 accent-retro-black disabled:opacity-50"
              />
              <span className="font-pixel text-[7px] text-retro-black uppercase">
                {t('settings.smartSubtitle')}
              </span>
              <Tooltip text={t('settings.smartTooltip')}>
                <span className="font-pixel text-[7px] text-retro-black/50 cursor-help">[?]</span>
              </Tooltip>
            </label>
          </div>

          <div className={`mb-4 ${!localSubtitles ? 'opacity-40 pointer-events-none' : ''}`}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={localBurnSubtitles}
                onChange={(e) => handleToggleBurnSubtitles(e.target.checked)}
                disabled={!localSubtitles}
                className="w-4 h-4 accent-retro-black disabled:opacity-50"
              />
              <span className="font-pixel text-[7px] text-retro-black uppercase">
                {t('settings.burnSubtitles')}
              </span>
              <Tooltip text={t('settings.burnTooltip')}>
                <span className="font-pixel text-[7px] text-retro-black/50 cursor-help">[?]</span>
              </Tooltip>
            </label>
            {localSubtitles && !localBurnSubtitles && (
              <p className="font-pixel text-[6px] text-retro-black/50 mt-1">
                {t('settings.burnSrtOnly')}
              </p>
            )}
            {localSubtitles && localBurnSubtitles && isOutputAudio && (
              <p className="font-pixel text-[6px] text-red-600 mt-1">
                {t('settings.requiresVideo')}
              </p>
            )}
          </div>

          <div className={`mb-4 ${!localSubtitles ? 'opacity-40 pointer-events-none' : ''}`}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={localGreenScreen}
                onChange={(e) => handleToggleGreenScreen(e.target.checked)}
                disabled={!localSubtitles || !isInputAudio}
                className="w-4 h-4 accent-retro-black disabled:opacity-50"
              />
              <span className="font-pixel text-[7px] text-retro-black uppercase disabled:opacity-50">
                {t('settings.greenScreen')}
              </span>
              <Tooltip text={t('settings.greenScreenTooltip')}>
                <span className="font-pixel text-[7px] text-retro-black/50 cursor-help">[?]</span>
              </Tooltip>
            </label>
            {localSubtitles && localGreenScreen && isOutputAudio && (
              <p className="font-pixel text-[6px] text-red-600 mt-1">
                {t('settings.requiresVideo')}
              </p>
            )}
          </div>

          <div className={`mb-4 ${!localSubtitles ? 'opacity-40 pointer-events-none' : ''}`}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={localAutoLineWrap}
                onChange={(e) => setLocalAutoLineWrap(e.target.checked)}
                disabled={!localSubtitles}
                className="w-4 h-4 accent-retro-black disabled:opacity-50"
              />
              <span className="font-pixel text-[7px] text-retro-black uppercase">
                {t('settings.autoLineWrap')}
              </span>
              <Tooltip text={t('settings.autoLineWrapTooltip')}>
                <span className="font-pixel text-[7px] text-retro-black/50 cursor-help">[?]</span>
              </Tooltip>
            </label>
          </div>

          {/* Horizontal spacing: only makes sense with auto wrap
              turned on (without it the usable width changes nothing in the export). */}
          <div className={`mb-4 ${!localSubtitles || !localAutoLineWrap ? 'opacity-40 pointer-events-none' : ''}`}>
            <label className="flex items-center gap-2">
              <span className="font-pixel text-[7px] text-retro-black uppercase">
                {t('settings.hMargin', { value: localHMargin.toFixed(1) })}
              </span>
              <Tooltip text={t('settings.hMarginTooltip')}>
                <span className="font-pixel text-[7px] text-retro-black/50 cursor-help">[?]</span>
              </Tooltip>
            </label>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="range"
                min="0"
                max="20"
                step="0.5"
                value={localHMargin}
                onChange={(e) => setLocalHMargin(Number(e.target.value))}
                disabled={!localSubtitles || !localAutoLineWrap}
                className="flex-1 h-2 accent-retro-black disabled:opacity-50"
              />
              <span className="font-pixel text-[7px] text-retro-black w-8 text-right">
                {localHMargin.toFixed(1)}%
              </span>
            </div>
          </div>

          {isInputAudio && (
            <p className="font-pixel text-[6px] text-retro-black/40 mb-4">
              {t('settings.inputDetected', { bg: localGreenScreen ? t('settings.bgGreen') : t('settings.bgBlack') })}
            </p>
          )}
        </>
      )}

      {tab === 'sistema' && (
        <div>
          <div>
            <label className="font-pixel text-[7px] text-retro-black uppercase block mb-2">
              {t('system.language')}
            </label>
            <select
              value={lang}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="w-full h-8 border-2 border-retro-black rounded bg-retro-bg shadow-retro-sm px-2 font-pixel text-[8px] text-retro-black outline-none appearance-none cursor-pointer"
            >
              {LANGS.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
            <p className="font-pixel text-[6px] text-retro-black/50 mt-1">
              {t('system.languageHint')}
            </p>
          </div>

          <div className="mt-5">
            <label className="font-pixel text-[7px] text-retro-black uppercase block mb-2">
              {t('system.theme')}
            </label>
            <select
              value={theme}
              onChange={(e) => handleThemeChange(e.target.value)}
              className="w-full h-8 border-2 border-retro-black rounded bg-retro-bg shadow-retro-sm px-2 font-pixel text-[8px] text-retro-black outline-none appearance-none cursor-pointer"
            >
              <option value="retro">Retro</option>
              <option value="modern">Modern</option>
            </select>
            <p className="font-pixel text-[6px] text-retro-black/50 mt-1">
              {t('system.themeHint')}
            </p>
          </div>

          <div className="mt-5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={localAdvancedTools}
                onChange={(e) => setLocalAdvancedTools(e.target.checked)}
                className="w-4 h-4 accent-retro-black"
              />
              <span className="font-pixel text-[7px] text-retro-black uppercase">
                {t('settings.advancedTools')}
              </span>
              <Tooltip text={t('settings.advancedToolsTooltip')}>
                <span className="font-pixel text-[7px] text-retro-black/50 cursor-help">[?]</span>
              </Tooltip>
            </label>
            <p className="font-pixel text-[6px] text-retro-black/50 mt-1">
              {t('settings.advancedToolsHint')}
            </p>
          </div>

          <div className="mt-5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={localDucking}
                onChange={(e) => setLocalDucking(e.target.checked)}
                className="w-4 h-4 accent-retro-black"
              />
              <span className="font-pixel text-[7px] text-retro-black uppercase">
                {t('settings.ducking')}
              </span>
              <Tooltip text={t('settings.duckingTooltip')}>
                <span className="font-pixel text-[7px] text-retro-black/50 cursor-help">[?]</span>
              </Tooltip>
            </label>
            <p className="font-pixel text-[6px] text-retro-black/50 mt-1">
              {t('settings.duckingHint')}
            </p>
          </div>
        </div>
      )}
    </div>

    <button
      onClick={handleSave}
      className="btn-retro w-full h-9 bg-retro-bg border-2 border-retro-black rounded shadow-retro font-pixel text-[8px] text-retro-black uppercase hover:bg-green-100 shrink-0"
    >
      {t('common.save')}
    </button>
  </div>
</div>
  )
}

export default SettingsModal