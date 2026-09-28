import { useState, useEffect } from 'react'
import { useLang } from '../lib/i18n'

export default function CudaDownloadModal({ open, onClose, onComplete }) {
  const { t } = useLang()
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) {
      setDownloading(false)
      setProgress(0)
      setError('')
    }
  }, [open])

  useEffect(() => {
    const handler = (data) => {
      setProgress(data.progress)
    }
    window.api.onCudaDownloadProgress(handler)
    return () => window.api.onCudaDownloadProgress(null)
  }, [])

  const handleDownload = async () => {
    setDownloading(true)
    setProgress(0)
    setError('')
    const res = await window.api.downloadCuda()
    setDownloading(false)
    setProgress(0)
    if (res && res.success) {
      onComplete()
      onClose()
    } else {
      setError((res && res.error) || 'unknown error')
    }
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
              {t('cuda.downloading')}
            </p>
            <div className="flex items-center justify-between mb-1">
              <span className="font-pixel text-[6px] text-retro-black">
                {t('cuda.progress')}
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
              {t('cuda.dontClose')}
            </p>
          </div>
        ) : (
          <div>
            <p className="font-pixel text-[7px] text-retro-black mb-4 leading-relaxed">
              {t('cuda.desc')}
            </p>
            <p className="font-pixel text-[6px] text-retro-black/50 mb-4">
              {t('cuda.size')}
            </p>
            {error && (
              <p className="font-pixel text-[6px] text-red-600 mb-4 leading-relaxed break-words">
                {t('cuda.error')}: {error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="btn-retro flex-1 h-8 bg-retro-bg border-2 border-retro-black rounded shadow-retro-sm font-pixel text-[7px] hover:bg-gray-200"
              >
                {t('cuda.cancel')}
              </button>
              <button
                onClick={handleDownload}
                className="btn-retro flex-1 h-8 bg-yellow-100 border-2 border-retro-black rounded shadow-retro-sm font-pixel text-[7px] hover:bg-yellow-200"
              >
                {t('cuda.download')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
