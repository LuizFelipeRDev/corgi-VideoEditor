import { useLang } from '../lib/i18n'

// Modal of the BACKGROUND MUSIC (phase 1): picks/swaps/removes the music of
// the second track. Ducking strength and volume arrive in the following
// phases (preview with worklet / export with sidechaincompress).
function DuckingModal({ musicFile, onPick, onRemove, onClose }) {
  const { t } = useLang()
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-retro-box border-2 border-retro-black rounded-lg shadow-retro w-[480px] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-pixel text-[9px] text-retro-black uppercase">{t('ducking.title')}</h2>
          <button
            onClick={onClose}
            className="btn-retro w-6 h-6 bg-retro-bg border-2 border-retro-black rounded shadow-retro-sm flex items-center justify-center text-[10px] font-bold hover:bg-red-200"
          >
            ✕
          </button>
        </div>
        <p className="font-pixel text-[6px] text-retro-black/60 mb-3">{t('settings.duckingTooltip')}</p>
        <div className="bg-retro-bg border-2 border-retro-black rounded p-3 mb-3">
          <p className="font-pixel text-[7px] text-retro-black break-all" title={musicFile?.path || ''}>
            {musicFile ? musicFile.name : t('ducking.noFile')}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onPick}
            className="btn-retro flex-1 h-9 bg-retro-black text-retro-bg border-2 border-retro-black rounded shadow-retro font-pixel text-[7px] uppercase hover:bg-gray-800"
          >
            {musicFile ? t('ducking.change') : t('ducking.pick')}
          </button>
          {musicFile && (
            <button
              onClick={onRemove}
              className="btn-retro flex-1 h-9 bg-red-100 border-2 border-retro-black rounded shadow-retro font-pixel text-[7px] text-retro-black uppercase hover:bg-red-200"
            >
              {t('ducking.remove')}
            </button>
          )}
          <button
            onClick={onClose}
            className="btn-retro flex-1 h-9 bg-retro-bg border-2 border-retro-black rounded shadow-retro font-pixel text-[7px] text-retro-black uppercase hover:bg-gray-200"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default DuckingModal
