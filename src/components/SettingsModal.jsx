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

function SettingsModal({ outputFolder, outputFormat, onClose, onSave }) {
  const [tab, setTab] = useState('geral')
  const [localFolder, setLocalFolder] = useState(outputFolder)
  const [localFormat, setLocalFormat] = useState(outputFormat)

  const handleSelectFolder = async () => {
    const d = await window.api.selectOutputDir()
    if (d) setLocalFolder(d)
  }

  const handleSave = async () => {
    await onSave({
      output_folder: localFolder,
      output_format: localFormat,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-retro-box border-2 border-retro-black rounded-lg shadow-retro h-50 w-80 p-4"
        onClick={(e) => e.stopPropagation()}
      >
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
            Saída
          </button>
          <button
            onClick={onClose}
            className="btn-retro w-6 h-6 bg-retro-bg border-2 border-retro-black rounded shadow-retro-sm flex items-center justify-center text-[10px] font-bold hover:bg-red-200 ml-2 shrink-0"
          >
            ✕
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
                  ✕
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
              <label className="font-pixel text-[7px] text-retro-black uppercase block mb-2">FORMATO DE SAÍDA</label>
              <select
                value={localFormat}
                onChange={(e) => setLocalFormat(e.target.value)}
                className="w-full h-8 border-2 border-retro-black rounded bg-retro-bg shadow-retro-sm px-2 font-pixel text-[8px] text-retro-black outline-none appearance-none cursor-pointer"
              >
                {OUTPUT_FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
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
