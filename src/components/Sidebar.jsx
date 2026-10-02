import { IconStethoscope, IconBrain, IconKeyboard } from '@tabler/icons-react'
import { useLang } from '../lib/i18n'

// Vertical sidebar (left side, under the TitleBar). Hosts the backlog
// modules as they arrive (ANALYZE AND SUGGEST, Ducking, arnndn...).
// The gate is advancedTools (ADVANCED OPTIONS) — when enabled, the bar
// shows at ANY width. (It used hidden md:flex, hiding it below 768px:
// with subtitles off the window shrank to 700 and the bar disappeared
// even with advanced options enabled.)
function Sidebar({ onSelect, disabled }) {
  const { t } = useLang()
  // Modules land here as they get implemented (Ducking...).
  const modules = [
    { id: 'analyze', Icon: IconStethoscope, label: t('sidebar.analyze') },
    { id: 'rnnoise', Icon: IconBrain, label: t('sidebar.rnnoise') },
    // SHORTCUTS always goes at the END (push) — it is not a backlog module.
    { id: 'shortcuts', Icon: IconKeyboard, label: t('sidebar.shortcuts') },
  ]
  const btn =
    'btn-retro w-7 h-7 bg-retro-bg border-2 border-retro-black rounded-full shadow-retro-sm flex items-center justify-center hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <div className="flex flex-col items-center gap-2 py-2 shrink-0 w-11 border-r-2 border-retro-black bg-retro-box">
      {modules.map(({ id, Icon, label }) => (
        <button key={id} onClick={() => onSelect(id)} disabled={disabled} title={label} className={btn}>
          <Icon size={15} />
        </button>
      ))}
    </div>
  )
}

export default Sidebar
