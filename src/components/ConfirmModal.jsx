import { useLang } from '../lib/i18n'

// NEW PROJECT confirmation (v1.8.0): save and clear / clear / cancel.
function ConfirmModal({ message, primaryLabel, secondaryLabel, cancelLabel, onPrimary, onSecondary, onCancel }) {
  const { t } = useLang()
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onCancel}>
      <div
        className="bg-retro-box border-2 border-retro-black rounded-lg shadow-retro w-[480px] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-pixel text-[9px] text-retro-black uppercase">{t('project.confirmNewTitle')}</h2>
          <button
            onClick={onCancel}
            className="btn-retro w-6 h-6 bg-retro-bg border-2 border-retro-black rounded shadow-retro-sm flex items-center justify-center text-[10px] font-bold hover:bg-red-200"
          >
            ✕
          </button>
        </div>
        <div className="bg-retro-bg border-2 border-retro-black rounded p-3 mb-3">
          <p className="font-pixel text-[7px] text-retro-black whitespace-pre-wrap break-all">{message}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onPrimary}
            className="btn-retro flex-1 h-9 bg-retro-black text-retro-bg border-2 border-retro-black rounded shadow-retro font-pixel text-[7px] uppercase hover:bg-gray-800"
          >
            {primaryLabel}
          </button>
          <button
            onClick={onSecondary}
            className="btn-retro flex-1 h-9 bg-red-100 border-2 border-retro-black rounded shadow-retro font-pixel text-[7px] text-retro-black uppercase hover:bg-red-200"
          >
            {secondaryLabel}
          </button>
          <button
            onClick={onCancel}
            className="btn-retro flex-1 h-9 bg-retro-bg border-2 border-retro-black rounded shadow-retro font-pixel text-[7px] text-retro-black uppercase hover:bg-gray-200"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmModal
