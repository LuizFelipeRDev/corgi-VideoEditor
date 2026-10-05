import { IconStethoscope, IconBrain, IconKeyboard, IconMusic } from '@tabler/icons-react'
import { useMemo } from 'react'
import { useLang } from '../lib/i18n'

// Class of the sidebar buttons, hoisted out of the component: it was rebuilt as
// a template string on every render, and the sidebar re-renders with the App.
const BTN =
  'btn-retro w-7 h-7 bg-retro-bg border-2 border-retro-black rounded-full shadow-retro-sm flex items-center justify-center hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed'

// Vertical sidebar (left side, under the TitleBar). Hosts the backlog
// modules as they arrive (ANALYZE AND SUGGEST, Ducking, arnndn...).
// The gate is advancedTools (ADVANCED OPTIONS) — when enabled, the bar
// shows at ANY width. (It used hidden md:flex, hiding it below 768px:
// with subtitles off the window shrank to 700 and the bar disappeared
// even with advanced options enabled.)
function Sidebar({ onSelect, disabled }) {
  const { t } = useLang()
  // Modules land here as they get implemented (Ducking...).
  // Memoized on the language: only the labels change with t.
  const modules = useMemo(() => [
    { id: 'analyze', Icon: IconStethoscope, label: t('sidebar.analyze') },
    { id: 'rnnoise', Icon: IconBrain, label: t('sidebar.rnnoise') },
    // Ducking: backlog module that arrived (phase 1 — UI/track).
    { id: 'ducking', Icon: IconMusic, label: t('sidebar.ducking') },
    // SHORTCUTS always goes at the END (push) — it is not a backlog module.
    { id: 'shortcuts', Icon: IconKeyboard, label: t('sidebar.shortcuts') },
  ], [t])

  return (
    <div className="flex flex-col items-center gap-2 py-2 shrink-0 w-11 border-r-2 border-retro-black bg-retro-box">
      {modules.map(({ id, Icon, label }) => (
        <button key={id} onClick={() => onSelect(id)} disabled={disabled} title={label} className={BTN}>
          <Icon size={15} />
        </button>
      ))}
    </div>
  )
}

export default Sidebar
