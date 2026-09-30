import { IconStethoscope, IconBrain } from '@tabler/icons-react'
import { useLang } from '../lib/i18n'

// Barra lateral vertical (lado esquerdo, sob o TitleBar). Hospeda os módulos
// do backlog que vao chegando (ANALISAR E SUGERIR, Ducking, arnndn...).
// Escondida na janela estreita (640, sem legendas) - apenas md:flex (>=768).
function Sidebar({ onSelect, disabled }) {
  const { t } = useLang()
  // Modulos vao chegando aqui ao serem implementados (Ducking...).
  const modules = [
    { id: 'analyze', Icon: IconStethoscope, label: t('sidebar.analyze') },
    { id: 'rnnoise', Icon: IconBrain, label: t('sidebar.rnnoise') },
  ]
  const btn =
    'btn-retro w-7 h-7 bg-retro-bg border-2 border-retro-black rounded-full shadow-retro-sm flex items-center justify-center hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <div className="hidden md:flex flex-col items-center gap-2 py-2 shrink-0 w-11 border-r-2 border-retro-black bg-retro-box">
      {modules.map(({ id, Icon, label }) => (
        <button key={id} onClick={() => onSelect(id)} disabled={disabled} title={label} className={btn}>
          <Icon size={15} />
        </button>
      ))}
    </div>
  )
}

export default Sidebar
