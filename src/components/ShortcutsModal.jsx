import { useLang } from '../lib/i18n'

// KEYBOARD SHORTCUTS modal — button on the left sidebar (always the
// last one). Lists everything the App actually listens to: Ctrl+*, space/arrows,
// I/O/Delete (export markers) and F11 for fullscreen (Electron main).
function ShortcutsModal({ onClose }) {
  const { t } = useLang()
  const list = [
    { id: 'save', keys: ['Ctrl', 'S'], label: t('shortcuts.save') },
    { id: 'open', keys: ['Ctrl', 'O'], label: t('shortcuts.open') },
    { id: 'new', keys: ['Ctrl', 'N'], label: t('shortcuts.new') },
    { id: 'undo', keys: ['Ctrl', 'Z'], label: t('shortcuts.undo') },
    { id: 'play', keys: [t('shortcuts.keySpace')], label: t('shortcuts.playPause') },
    { id: 'back', keys: ['←'], label: t('shortcuts.back5') },
    { id: 'fwd', keys: ['→'], label: t('shortcuts.fwd5') },
    { id: 'markStart', keys: ['I'], label: t('shortcuts.markStart') },
    { id: 'markEnd', keys: ['O'], label: t('shortcuts.markEnd') },
    { id: 'delMarker', keys: ['Delete'], label: t('shortcuts.delMarker') },
    { id: 'fullscreen', keys: ['F11'], label: t('shortcuts.fullscreen') },
  ]

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-retro-box border-2 border-retro-black rounded-lg shadow-retro w-80 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-pixel text-[10px] text-retro-black">{t('shortcuts.title')}</h2>
          <button
            onClick={onClose}
            className="btn-retro w-6 h-6 bg-retro-bg border-2 border-retro-black rounded shadow-retro-sm flex items-center justify-center text-[10px] font-bold hover:bg-red-200"
          >
            ✕
          </button>
        </div>
        <ul className="space-y-1.5">
          {list.map(({ id, keys, label }) => (
            <li key={id} className="flex items-center justify-between gap-3">
              <span className="font-pixel text-[7px] text-retro-black/80 leading-relaxed">{label}</span>
              <span className="flex gap-1 shrink-0">
                {keys.map((k) => (
                  <kbd
                    key={k}
                    className="font-pixel text-[7px] text-retro-black bg-retro-bg border-2 border-retro-black rounded shadow-retro-sm px-1.5 py-0.5"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default ShortcutsModal
