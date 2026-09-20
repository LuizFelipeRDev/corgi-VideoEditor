import { useState, useEffect, useRef } from 'react'
import { IconZoomScan, IconRectangle, IconRectangleVertical } from '@tabler/icons-react'
import Tooltip from './Tooltip'

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
  { id: 'tiny', name: 'tiny', label: 'Tiny', size: '75 MB', vram: '~1 GB', desc: 'Rapido, qualidade basica' },
  { id: 'base', name: 'base', label: 'Base', size: '142 MB', vram: '~1 GB', desc: 'Melhor que tiny, ainda rapido' },
  { id: 'small', name: 'small', label: 'Small', size: '466 MB', vram: '~2 GB', desc: 'Bom equilibrio velocidade/qualidade' },
  { id: 'medium', name: 'medium', label: 'Medium', size: '1.5 GB', vram: '~5 GB', desc: 'Alta qualidade, mais lento' },
  { id: 'large-v3', name: 'large-v3', label: 'Large v3', size: '2.9 GB', vram: '~10 GB', desc: 'Maxima qualidade, bem lento' },
]

function SettingsModal({ outputFolder, outputFormat, outputResolution, subtitles, subtitleModel, greenScreen, burnSubtitles, selectedFile, wordsPerLine, linesCount, subtitlePersistence, positionMode, positionPercent, onClose, onSave, onRequestCudaDownload, whisperCliInstalled }) {
  const [tab, setTab] = useState('geral')
  const [localFolder, setLocalFolder] = useState(outputFolder)
  const [localFormat, setLocalFormat] = useState(outputFormat)
  const [localResolution, setLocalResolution] = useState(outputResolution || 'original')
  const [showResPopup, setShowResPopup] = useState(false)
  const resPopupRef = useRef(null)
  const [localSubtitles, setLocalSubtitles] = useState(subtitles)
  const [localSubtitleModel, setLocalSubtitleModel] = useState(subtitleModel || 'small')
  const [localGreenScreen, setLocalGreenScreen] = useState(greenScreen)
  const [localBurnSubtitles, setLocalBurnSubtitles] = useState(burnSubtitles)
  const [localWordsPerLine, setLocalWordsPerLine] = useState(wordsPerLine || 4)
  const [localLinesCount, setLocalLinesCount] = useState(linesCount || 2)
  const [localPersistence, setLocalPersistence] = useState(subtitlePersistence ?? 1)
  const [localPositionMode, setLocalPositionMode] = useState(positionMode || 'fixed')
  const [localPositionPercent, setLocalPositionPercent] = useState(positionPercent ?? 80)

  const [confirmDialog, setConfirmDialog] = useState(null)
  const [modelInstalled, setModelInstalled] = useState({})
  const [downloading, setDownloading] = useState(null)
  const [downloadProgress, setDownloadProgress] = useState(0)

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
      subtitles: localSubtitles,
      subtitle_model: localSubtitleModel,
      green_screen: localGreenScreen,
      burn_subtitles: localBurnSubtitles,
      words_per_line: localWordsPerLine,
      lines_count: localLinesCount,
      subtitle_persistence: localPersistence,
      subtitle_position_mode: localPositionMode,
      subtitle_position_percent: localPositionPercent,
    })
    onClose()
  }

  const handleToggleBurnSubtitles = (checked) => {
    if (checked && isOutputAudio) {
      setConfirmDialog({
        message: 'Imbutir legenda requer saida em video. Trocar automaticamente para MP4?',
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
        message: 'Video com fundo verde requer saida em video. Trocar automaticamente para MP4?',
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
        message: 'Formato de audio nao suporta legenda embarcada nem fundo verde. Desativar essas opcoes?',
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
        message: 'Legendas embarcadas requerem saida em video. Trocar automaticamente para MP4?',
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
      message: `Baixar modelo "${model.label}" (${model.size})?`,
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
        className="bg-retro-box border-2 border-retro-black rounded-lg shadow-retro w-80 max-h-[80vh] overflow-y-auto p-4"
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
                  SIM
                </button>
                <button
                  onClick={confirmDialog.onCancel}
                  className="btn-retro flex-1 h-8 bg-retro-bg border-2 border-retro-black rounded shadow-retro-sm font-pixel text-[7px] hover:bg-gray-200"
                >
                  NAO
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-0 mb-4">
          <button
            onClick={() => setTab('geral')}
            className={`flex-1 h-8 border-2 border-retro-black rounded-t font-pixel text-[8px] uppercase ${tab === 'geral'
              ? 'bg-retro-bg text-retro-black z-10'
              : 'bg-retro-box text-retro-black/50'
              }`}
          >
            Geral
          </button>
          <button
            onClick={() => setTab('saida')}
            className={`flex-1 h-8 border-2 border-retro-black rounded-t font-pixel text-[8px] uppercase ${tab === 'saida'
              ? 'bg-retro-bg text-retro-black z-10'
              : 'bg-retro-box text-retro-black/50'
              }`}
          >
            Saida
          </button>
          <button
            onClick={() => setTab('legendas')}
            className={`flex-1 h-8 border-2 border-retro-black rounded-t font-pixel text-[8px] uppercase ${tab === 'legendas'
              ? 'bg-retro-bg text-retro-black z-10'
              : 'bg-retro-box text-retro-black/50'
              }`}
          >
            Legendas
          </button>
          <button
            onClick={onClose}
            className="btn-retro w-6 h-6 bg-retro-bg border-2 border-retro-black rounded shadow-retro-sm flex items-center justify-center text-[10px] font-bold hover:bg-red-200 ml-2 shrink-0"
          >
            X
          </button>
        </div>

        {tab === 'geral' && (
          <div>
            <div className="mb-4">
              <label className="font-pixel text-[7px] text-retro-black uppercase block mb-2">PASTA DE DESTINO</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={localFolder}
                  placeholder="Mesma pasta do arquivo"
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
                <label className="font-pixel text-[7px] text-retro-black uppercase block mb-2">GPU (NVIDIA)</label>
                <div className="mb-[10px]">
                  <Tooltip text="Para placas de vídeo NVIDIA, a geração de legendas será mais rápida com CUDA instalado.">
                    <span className="font-pixel  text-[7px] text-retro-black/50 cursor-help">[?]</span>
                  </Tooltip>

                </div>


              </div>

              {whisperCliInstalled && (
                <div className="flex items-center justify-between">
                  <p className="font-pixel text-[6px] text-green-600">
                    GPU instalada
                  </p>
                  <button
                    onClick={() => onRequestCudaDownload && onRequestCudaDownload()}
                    className="btn-retro h-6 px-2 bg-retro-bg border-2 border-retro-black rounded shadow-retro-sm font-pixel text-[6px] hover:bg-gray-200"
                  >
                    REINSTALAR
                  </button>
                </div>
              )}
              {!whisperCliInstalled && (
                <div>
                  <p className="font-pixel text-[6px] text-red-600 mb-1">
                    Nao instalado
                  </p>
                  <button
                    onClick={() => onRequestCudaDownload && onRequestCudaDownload()}
                    className="btn-retro w-full h-7 bg-yellow-100 border-2 border-retro-black rounded shadow-retro-sm font-pixel text-[7px] hover:bg-yellow-200"
                  >
                    BAIXAR GPU (NVIDIA)
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
                ABRIR PASTA DRIVERS
              </button>
            </div>

            <div className="mb-4">
              <label className="font-pixel text-[7px] text-retro-black uppercase block mb-2">MODELO WHISPER</label>
              <div className="flex gap-2">
                <select
                  value={localSubtitleModel}
                  onChange={(e) => handleModelChange(e.target.value)}
                  className="flex-1 h-8 border-2 border-retro-black rounded bg-retro-bg shadow-retro-sm px-2 font-pixel text-[8px] text-retro-black outline-none appearance-none cursor-pointer"
                >
                  {WHISPER_MODELS.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.label} ({m.size}) - GPU: {m.vram}
                    </option>
                  ))}
                </select>
              </div>

              {downloading && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-pixel text-[6px] text-retro-black">
                      Baixando {downloading}...
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
                    Modelo nao baixado
                  </p>
                  <button
                    onClick={() => handleDownloadModel(localSubtitleModel)}
                    className="btn-retro w-full h-7 bg-yellow-100 border-2 border-retro-black rounded shadow-retro-sm font-pixel text-[7px] hover:bg-yellow-200"
                  >
                    BAIXAR MODELO
                  </button>
                </div>
              )}

              {!downloading && modelInstalled[localSubtitleModel] && (
                <p className="font-pixel text-[6px] text-green-600 mt-2">
                  Modelo instalado
                </p>
              )}

              <div className="mt-2">
                <p className="font-pixel text-[6px] text-retro-black/50">
                  {WHISPER_MODELS.find((m) => m.name === localSubtitleModel)?.desc}
                </p>
              </div>
            </div>

            <button
              onClick={handleSave}
              className="btn-retro w-full h-9 bg-retro-bg border-2 border-retro-black rounded shadow-retro font-pixel text-[8px] text-retro-black uppercase hover:bg-green-100"
            >
              SALVAR
            </button>
          </div>
        )}

        {tab === 'saida' && (
          <div>
            <div className="mb-4">
              <label className="font-pixel text-[7px] text-retro-black uppercase block mb-2">FORMATO DE SAIDA</label>
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
              <label className="font-pixel text-[7px] text-retro-black uppercase block mb-2">RESOLUCAO DE SAIDA</label>
              <div className="relative" ref={resPopupRef}>
                <button
                  onClick={() => !isOutputAudio && setShowResPopup(!showResPopup)}
                  className="w-full h-8 border-2 border-retro-black rounded bg-retro-bg shadow-retro-sm px-2 font-pixel text-[8px] text-retro-black uppercase flex items-center justify-between hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isOutputAudio}
                >
                  <span>
                    {localResolution === 'original' && 'Original'}
                    {localResolution === 'landscape' && 'Paisagem (16:9)'}
                    {localResolution === 'portrait' && 'Retrato (9:16)'}
                  </span>
                  <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 5l3 3 3-3" />
                  </svg>
                </button>

                {showResPopup && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-retro-bg border-2 border-retro-black rounded shadow-retro z-50">
                    {[
                      { id: 'original', icon: IconZoomScan, label: 'Original', desc: 'Mesma resolucao do video de entrada' },
                      { id: 'landscape', icon: IconRectangle, label: 'Paisagem', desc: '1920x1080 - Formato 16:9 padrao' },
                      { id: 'portrait', icon: IconRectangleVertical, label: 'Retrato', desc: '1080x1920 - Formato 9:16 para celular' },
                    ].map((r) => (
                      <Tooltip key={r.id} text={r.desc}>
                        <button
                          onClick={() => {
                            setLocalResolution(r.id)
                            setShowResPopup(false)
                          }}
                          className={`w-full h-8 px-2 font-pixel text-[8px] flex items-center gap-2 transition-colors ${localResolution === r.id
                            ? 'bg-retro-black text-retro-bg'
                            : 'hover:bg-gray-200 text-retro-black'
                            }`}
                        >
                          <r.icon size={14} stroke={2} />
                          <span>{r.label}</span>
                          <span className="ml-auto text-[6px] opacity-60">
                            {r.id === 'original' ? 'Auto' : r.id === 'landscape' ? '1920x1080' : '1080x1920'}
                          </span>
                        </button>
                      </Tooltip>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {needsVideo && isOutputAudio && (
              <p className="font-pixel text-[6px] text-red-600 mb-2">
                Formato atual ({localFormat.toUpperCase()}) nao suporta legenda embarcada
              </p>
            )}
            <button
              onClick={handleSave}
              className="btn-retro w-full h-9 bg-retro-bg border-2 border-retro-black rounded shadow-retro font-pixel text-[8px] text-retro-black uppercase hover:bg-green-100"
            >
              SALVAR
            </button>
          </div>
        )}

        {tab === 'legendas' && (
          <div>
            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSubtitles}
                  onChange={(e) => handleToggleSubtitles(e.target.checked)}
                  className="w-4 h-4 accent-retro-black"
                />
                <span className="font-pixel text-[7px] text-retro-black uppercase">Ativar legendas</span>
              </label>
            </div>

            <div className={`mb-4 ${!localSubtitles ? 'opacity-40 pointer-events-none' : ''}`}>
              <label className="font-pixel text-[7px] text-retro-black uppercase block mb-2">MODO DE POSICAO</label>
              <select
                value={localPositionMode}
                onChange={(e) => setLocalPositionMode(e.target.value)}
                disabled={!localSubtitles}
                className="w-full h-8 border-2 border-retro-black rounded bg-retro-bg shadow-retro-sm px-2 font-pixel text-[8px] text-retro-black outline-none appearance-none cursor-pointer disabled:opacity-50"
              >
                <option value="fixed">Posicao Pre-definida</option>
                <option value="percentage">Ajuste Livre</option>
              </select>
            </div>

            <div className={`mb-4 ${!localSubtitles ? 'opacity-40 pointer-events-none' : ''}`}>
              <label className="font-pixel text-[7px] text-retro-black uppercase block mb-2">PALAVRAS POR LINHA</label>
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
              <label className="font-pixel text-[7px] text-retro-black uppercase block mb-2">LINHAS NA LEGENDA</label>
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
                PERSISTENCIA DA LEGENDA — {localPersistence.toFixed(1)}s
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
                Tempo que a legenda fica visivel entre frases
              </p>
            </div>

            <div className={`mb-4 ${!localSubtitles ? 'opacity-40 pointer-events-none' : ''}`}>
              {/* <label className="font-pixel text-[7px] text-retro-black uppercase block mb-2">LEGENDA NO VIDEO</label> */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localBurnSubtitles}
                  onChange={(e) => handleToggleBurnSubtitles(e.target.checked)}
                  disabled={!localSubtitles}
                  className="w-4 h-4 accent-retro-black disabled:opacity-50"
                />
                <span className="font-pixel text-[7px] text-retro-black uppercase">
                  Imbutir legenda no arquivo
                </span>
                <Tooltip text="Anexa a legenda ao vídeo em vez de criar um arquivo SRT.">
                  <span className="font-pixel text-[7px] text-retro-black/50 cursor-help">[?]</span>
                </Tooltip>
              </label>
              {localSubtitles && !localBurnSubtitles && (
                <p className="font-pixel text-[6px] text-retro-black/50 mt-1">
                  Sera gerado apenas o arquivo .srt separado
                </p>
              )}
              {localSubtitles && localBurnSubtitles && isOutputAudio && (
                <p className="font-pixel text-[6px] text-red-600 mt-1">
                  Requer formato de video (MP4, MKV, etc)
                </p>
              )}
            </div>

            <div className={`mb-4 ${!localSubtitles ? 'opacity-40 pointer-events-none' : ''}`}>
              {/* <label className="font-pixel text-[7px] text-retro-black uppercase block mb-2">AUDIO - VIDEO</label> */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localGreenScreen}
                  onChange={(e) => handleToggleGreenScreen(e.target.checked)}
                  disabled={!localSubtitles || !isInputAudio}
                  className="w-4 h-4 accent-retro-black disabled:opacity-50"
                />
                <span className="font-pixel text-[7px] text-retro-black uppercase disabled:opacity-50">
                  Criar video com fundo verde
                </span>
                <Tooltip text="Opcao disponivel apenas para entrada de audio">
                  <span className="font-pixel text-[7px] text-retro-black/50 cursor-help">[?]</span>
                </Tooltip>
              </label>
              {localSubtitles && localGreenScreen && isOutputAudio && (
                <p className="font-pixel text-[6px] text-red-600 mt-1">
                  Requer formato de video (MP4, MKV, etc)
                </p>
              )}
            </div>

            {isInputAudio && (
              <p className="font-pixel text-[6px] text-retro-black/40 mb-4">
                Input detectado: audio - legendas serao criadas sobre fundo {localGreenScreen ? 'verde' : 'preto'}
              </p>
            )}

            <button
              onClick={handleSave}
              className="btn-retro w-full h-9 bg-retro-bg border-2 border-retro-black rounded shadow-retro font-pixel text-[8px] text-retro-black uppercase hover:bg-green-100"
            >
              SALVAR
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default SettingsModal