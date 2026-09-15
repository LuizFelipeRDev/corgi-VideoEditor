import { useState } from 'react'

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

const SUBTITLE_MODELS = [
  { value: 'tiny', label: 'Tiny (Rapido)' },
  { value: 'base', label: 'Base' },
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large (Lento)' },
]

const SUBTITLE_STYLES = [
  { value: 'hormozi', label: 'Hormozi' },
  { value: 'mrbeast', label: 'MrBeast' },
  { value: 'karaoke', label: 'Karaoke' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'bounce', label: 'Bounce' },
  { value: 'classic', label: 'Classic' },
]

const SUBTITLE_POSITIONS = [
  { value: 'top', label: 'TOPO' },
  { value: 'middle', label: 'MEIO' },
  { value: 'bottom', label: 'BAIXO' },
]

function SettingsModal({ outputFolder, outputFormat, subtitles, subtitleModel, subtitlePosition, subtitleStyle, greenScreen, burnSubtitles, selectedFile, onClose, onSave }) {
  const [tab, setTab] = useState('geral')
  const [localFolder, setLocalFolder] = useState(outputFolder)
  const [localFormat, setLocalFormat] = useState(outputFormat)
  const [localSubtitles, setLocalSubtitles] = useState(subtitles)
  const [localModel, setLocalModel] = useState(subtitleModel)
  const [localPosition, setLocalPosition] = useState(subtitlePosition)
  const [localStyle, setLocalStyle] = useState(subtitleStyle)
  const [localGreenScreen, setLocalGreenScreen] = useState(greenScreen)
  const [localBurnSubtitles, setLocalBurnSubtitles] = useState(burnSubtitles)

  const [confirmDialog, setConfirmDialog] = useState(null)

  const isInputAudio = selectedFile
    ? AUDIO_FORMATS.includes(selectedFile.name.split('.').pop().toLowerCase())
    : false

  const isOutputAudio = AUDIO_FORMATS.includes(localFormat)
  const needsVideo = localBurnSubtitles || localGreenScreen

  const handleSelectFolder = async () => {
    const d = await window.api.selectOutputDir()
    if (d) setLocalFolder(d)
  }

  const handleSave = async () => {
    await onSave({
      output_folder: localFolder,
      output_format: localFormat,
      subtitles: localSubtitles,
      subtitle_model: localModel,
      subtitle_position: localPosition,
      subtitle_style: localStyle,
      green_screen: localGreenScreen,
      burn_subtitles: localBurnSubtitles,
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
              <label className="font-pixel text-[7px] text-retro-black uppercase block mb-2">MODELO</label>
              <select
                value={localModel}
                onChange={(e) => setLocalModel(e.target.value)}
                disabled={!localSubtitles}
                className="w-full h-8 border-2 border-retro-black rounded bg-retro-bg shadow-retro-sm px-2 font-pixel text-[8px] text-retro-black outline-none appearance-none cursor-pointer disabled:cursor-not-allowed"
              >
                {SUBTITLE_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div className={`mb-4 ${!localSubtitles ? 'opacity-40 pointer-events-none' : ''}`}>
              <label className="font-pixel text-[7px] text-retro-black uppercase block mb-2">ESTILO</label>
              <select
                value={localStyle}
                onChange={(e) => setLocalStyle(e.target.value)}
                disabled={!localSubtitles}
                className="w-full h-8 border-2 border-retro-black rounded bg-retro-bg shadow-retro-sm px-2 font-pixel text-[8px] text-retro-black outline-none appearance-none cursor-pointer disabled:cursor-not-allowed"
              >
                {SUBTITLE_STYLES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className={`mb-4 ${!localSubtitles ? 'opacity-40 pointer-events-none' : ''}`}>
              <label className="font-pixel text-[7px] text-retro-black uppercase block mb-2">POSAICAO</label>
              <div className="flex gap-2">
                {SUBTITLE_POSITIONS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setLocalPosition(p.value)}
                    disabled={!localSubtitles}
                    className={`flex-1 h-8 border-2 border-retro-black rounded font-pixel text-[7px] ${
                      localPosition === p.value
                        ? 'bg-retro-black text-retro-bg'
                        : 'bg-retro-bg text-retro-black hover:bg-gray-200'
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
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
