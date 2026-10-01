import { IconX } from '@tabler/icons-react'
import { useLang } from '../lib/i18n'

// Word replacement modal (v1.11.x): the user selects a word inside the
// subtitle text editor, the floating chip opens this form, and OK replaces
// every whole-token match across the whole track. Controlled from the panel
// (it owns before/after/ignoreCase so the occurrence count re-renders live);
// the confirm button stays disabled while nothing matches or `after` is empty.
function ReplaceWordModal({ before, after, ignoreCase, count, onChange, onConfirm, onClose }) {
  const { t } = useLang()
  const canConfirm = count > 0 && after.trim().length > 0 && after !== before

  const field =
    'w-full h-8 border-2 border-retro-black rounded bg-retro-bg shadow-retro-sm px-2 font-pixel text-[9px] text-retro-black outline-none'

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-retro-box border-2 border-retro-black rounded-lg shadow-retro w-[24rem] max-w-[94vw] p-4 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-pixel text-[8px] text-retro-black uppercase">{t('replace.title')}</h3>
          <button
            onClick={onClose}
            className="w-6 h-6 border-2 border-retro-black rounded bg-retro-bg shadow-retro-sm flex items-center justify-center hover:bg-red-200 shrink-0"
          >
            <IconX size={12} stroke={2.5} />
          </button>
        </div>

        {/* BEFORE (prefilled with the selection, still editable) + AFTER */}
        <div className="flex gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <label className="font-pixel text-[7px] text-retro-black uppercase block mb-1.5">{t('replace.before')}</label>
            <input
              type="text"
              value={before}
              onChange={(e) => onChange('before', e.target.value)}
              className={field}
              autoFocus
            />
          </div>
          <div className="flex-1 min-w-0">
            <label className="font-pixel text-[7px] text-retro-black uppercase block mb-1.5">{t('replace.after')}</label>
            <input
              type="text"
              value={after}
              onChange={(e) => onChange('after', e.target.value)}
              className={field}
            />
          </div>
        </div>

        {/* Case-insensitive matching: smart-case keeps the original capitalization */}
        <label className="flex items-center gap-2 cursor-pointer mb-3 select-none">
          <input
            type="checkbox"
            checked={ignoreCase}
            onChange={(e) => onChange('ignoreCase', e.target.checked)}
            className="w-4 h-4 accent-retro-black shrink-0"
          />
          <span className="font-pixel text-[7px] text-retro-black uppercase">{t('replace.ignoreCase')}</span>
        </label>

        {/* Live occurrence count over the whole track */}
        <p className={`font-pixel text-[6px] leading-relaxed mb-4 ${count > 0 ? 'text-retro-black/70' : 'text-red-600'}`}>
          {count > 0
            ? count === 1
              ? t('replace.count1')
              : t('replace.countN', { n: count })
            : t('replace.none')}
        </p>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 h-8 border-2 border-retro-black rounded bg-retro-bg shadow-retro-sm font-pixel text-[7px] uppercase text-retro-black hover:bg-gray-200"
          >
            {t('replace.cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className={`flex-1 h-8 border-2 border-retro-black rounded shadow-retro-sm font-pixel text-[7px] uppercase ${
              canConfirm
                ? 'bg-retro-black text-retro-bg hover:bg-gray-800'
                : 'bg-retro-bg text-retro-black/30 opacity-40 cursor-not-allowed'
            }`}
          >
            {t('replace.ok')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ReplaceWordModal
