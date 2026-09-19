import { useState, useEffect } from 'react'

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

function SettingsModal({ outputFolder, outputFormat, subtitles, subtitleModel, greenScreen, burnSubtitles, selectedFile, wordsPerLine, linesCount, onClose, onSave, onRequestCudaDownload, whisperCliInstalled }) {
  const [tab, setTab] = useState('geral')
  const [localFolder, setLocalFolder] = useState(outputFolder)
  const [localFormat, setLocalFormat] = useState(outputFormat)
  const [localSubtitles, setLocalSubtitles] = useState(subtitles)
  const [localSubtitleModel, setLocalSubtitleModel] = useState(subtitleModel || 'small')
  const [localGreenScreen, setLocalGreenScreen] = useState(greenScreen)
  const [localBurnSubtitles, setLocalBurnSubtitles] = useState(burnSubtitles)
  const [localWordsPerLine, setLocalWordsPerLine] = useState(wordsPerLine || 4)
  const [localLinesCount, setLocalLinesCount] = useState(linesCount || 2)

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

  const handleSelectFolder = async () => {
    const d = await window.api.selectOutputDir()
    if (d) setLocalFolder(d)
  }

  const handleSave = async () => {
    await onSave({
      output_folder: localFolder,
      output_format: localFormat,
      subtitles: localSubtitles,
      subtitle_model: localSubtitleModel,
      green_screen: localGreenScreen,
      burn_subtitles: localBurnSubtitles,
      words_per_line: localWordsPerLine,
      lines_count: localLinesCount,
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
        className="bg-retro-box border-2 border-retro-black rounded-lg shadow-retro h-50 w-80 p-4"
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
            className={`flex-1 h-8 border-2 border-retro-black rounded-t font-pixel text-[8px] uppercase ${
              tab === 'geral'
                ? 'bg-retro-bg text-retro-black z-10'
                : 'bg-retro-box text-retro-black/50'
            }`}
          >
            Geral
          </button>
          <button
            onClick={() => setTab('saida')}
            className={`flex-1 h-8 border-2 border-retro-black rounded-t font-pixel text-[8px] uppercase ${
              tab === 'saida'
                ? 'bg-retro-bg text-retro-black z-10'
                : 'bg-retro-box text-retro-black/50'
            }`}
          >
            Saida
          </button>
          <button
            onClick={() => setTab('legendas')}
            className={`flex-1 h-8 border-2 border-retro-black rounded-t font-pixel text-[8px] uppercase ${
              tab === 'legendas'
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
              <label className="font-pixel text-[7px] text-retro-black uppercase block mb-2">GPU (NVIDIA)</label>
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
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
              <label className="font-pixel text-[7px] text-retro-black uppercase block mb-2">LEGENDA NO VIDEO</label>
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
              <label className="font-pixel text-[7px] text-retro-black uppercase block mb-2">AUDIO - VIDEO</label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localGreenScreen}
                  onChange={(e) => handleToggleGreenScreen(e.target.checked)}
                  disabled={!localSubtitles}
                  className="w-4 h-4 accent-retro-black disabled:opacity-50"
                />
                <span className="font-pixel text-[7px] text-retro-black uppercase disabled:opacity-50">
                  Criar video com fundo verde
                </span>
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