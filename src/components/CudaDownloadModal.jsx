import { useState, useEffect } from 'react'

export default function CudaDownloadModal({ open, onClose, onComplete }) {
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!open) {
      setDownloading(false)
      setProgress(0)
    }
  }, [open])

  useEffect(() => {
    const handler = (data) => {
      setProgress(data.progress)
      if (data.progress >= 100) {
        setDownloading(false)
        setProgress(0)
        onComplete()
        onClose()
      }
    }
    window.api.onCudaDownloadProgress(handler)
    return () => window.api.onCudaDownloadProgress(null)
  }, [])

  const handleDownload = () => {
    setDownloading(true)
    setProgress(0)
    window.api.downloadCuda()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className="bg-retro-bg border-2 border-retro-black rounded shadow-retro p-4 w-80">
        <h3 className="font-pixel text-[9px] text-retro-black uppercase mb-3">
          Download GPU (NVIDIA)
        </h3>

        {downloading ? (
          <div>
            <p className="font-pixel text-[7px] text-retro-black mb-3">
              Baixando arquivos GPU...
            </p>
            <div className="flex items-center justify-between mb-1">
              <span className="font-pixel text-[6px] text-retro-black">
                Progresso
              </span>
              <span className="font-pixel text-[6px] text-retro-black">
                {progress}%
              </span>
            </div>
            <div className="w-full h-3 bg-retro-bg border border-retro-black rounded overflow-hidden mb-3">
              <div
                className="h-full bg-green-400 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="font-pixel text-[6px] text-retro-black/50">
              Nao feche o programa
            </p>
          </div>
        ) : (
          <div>
            <p className="font-pixel text-[7px] text-retro-black mb-4 leading-relaxed">
              Isso baixa os arquivos necessarios para usar a GPU NVIDIA na geracao de legendas. Sem isso, o processamento usa o processador e pode ser lento para modelos acima de tiny.
            </p>
            <p className="font-pixel text-[6px] text-retro-black/50 mb-4">
              Tamanho: ~420 MB
            </p>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="btn-retro flex-1 h-8 bg-retro-bg border-2 border-retro-black rounded shadow-retro-sm font-pixel text-[7px] hover:bg-gray-200"
              >
                CANCELAR
              </button>
              <button
                onClick={handleDownload}
                className="btn-retro flex-1 h-8 bg-yellow-100 border-2 border-retro-black rounded shadow-retro-sm font-pixel text-[7px] hover:bg-yellow-200"
              >
                BAIXAR
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
