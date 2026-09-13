import { useState } from 'react'

function DropZone({ selectedFile, setSelectedFile, processing }) {
  const [isDragOver, setIsDragOver] = useState(false)

  const handleClick = async () => {
    if (selectedFile || processing) return
    const p = await window.api.selectFile()
    if (p) {
      setSelectedFile({ path: p, name: p.split(/[/\\]/).pop(), folder: p.replace(/[\\/][^\\/]+$/, '') })
    }
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    setIsDragOver(false)
    if (processing) return
    const f = e.dataTransfer.files
    if (f.length > 0 && f[0].path) {
      setSelectedFile({ path: f[0].path, name: f[0].name, folder: f[0].path.replace(/[\\/][^\\/]+$/, '') })
    } else {
      const p = await window.api.selectFile()
      if (p) {
        setSelectedFile({ path: p, name: p.split(/[/\\]/).pop(), folder: p.replace(/[\\/][^\\/]+$/, '') })
      }
    }
  }

  const clearFile = (e) => {
    e.stopPropagation()
    setSelectedFile(null)
  }

  return (
    <div className="w-1/2 p-4 border-r-2 border-retro-black flex flex-col">
      <div
        onClick={handleClick}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg shadow-retro p-4 flex flex-col items-center justify-center cursor-pointer transition-all flex-1 relative ${
          isDragOver
            ? 'drag-over'
            : selectedFile
              ? 'border-green-600 bg-green-50'
              : 'border-retro-black bg-retro-bg hover:bg-green-50'
        }`}
      >
        {selectedFile && (
          <button
            onClick={clearFile}
            className="absolute top-1 right-1 w-5 h-5 bg-red-500 border border-red-700 rounded text-white text-[10px] font-bold hover:bg-red-600 z-10"
            title="Limpar"
          >
            ✕
          </button>
        )}

        {!selectedFile ? (
          <div id="dropContent">
            <svg className="w-10 h-10 mx-auto mb-2 text-retro-black opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
            </svg>
            <p className="font-pixel text-[8px] text-retro-black text-center leading-loose">
              DROP AUDIO / VIDEO<br/>
              <span className="text-[7px] opacity-60">ou clique aqui</span>
            </p>
          </div>
        ) : (
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-1 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
            </svg>
            <p className="font-pixel text-[7px] text-green-700">{selectedFile.name}</p>
          </div>
        )}
      </div>

      <div className="mt-3 space-y-1.5 shrink-0">
        <div className="flex justify-between items-center border-b border-retro-black/20 pb-1">
          <span className="font-pixel text-[7px] text-retro-black/60">NOME:</span>
          <span className="font-pixel text-[7px] text-retro-black">{selectedFile?.name || '—'}</span>
        </div>
        <div className="flex justify-between items-center border-b border-retro-black/20 pb-1">
          <span className="font-pixel text-[7px] text-retro-black/60">DURAÇÃO:</span>
          <span className="font-pixel text-[7px] text-retro-black">—</span>
        </div>
      </div>
    </div>
  )
}

export default DropZone
