import { useEffect, useState } from 'react'
import { IconFile, IconDeviceFloppy, IconFolder, IconArrowsMaximize, IconArrowsMinimize } from '@tabler/icons-react'
import { useLang } from '../lib/i18n'
import logo from '../../assets/logo02.png'

function TitleBar({ onNew, onSave, onOpen, disabled }) {
  const { t } = useLang()
  const [isFullScreen, setIsFullScreen] = useState(false)
  // Estado do fullscreen vem do main (botão aqui + atalho F11 saem do mesmo IPC).
  useEffect(() => {
    if (window.api.onFullscreenChange) window.api.onFullscreenChange(setIsFullScreen)
  }, [])
  const btn = 'btn-retro w-6 h-6 bg-retro-bg border-2 border-retro-black rounded-full shadow-retro-sm flex items-center justify-center hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed'
  return (
    <div
      className="bg-retro-box border-b-2 border-retro-black px-3 py-1.5 flex items-center justify-between shrink-0 h-10"
      style={{ WebkitAppRegion: 'drag' }}
    >
      <div className="flex items-center  gap-2">
        <img src={logo} className="w-8 h-8" />
        <h1 className="font-pixel text-[14px] text-retro-black">CORGI-EDITOR</h1>
      </div>
      <div className="flex gap-1.5" style={{ WebkitAppRegion: 'no-drag' }}>
        <button onClick={onNew} disabled={disabled} className={btn} title={t('project.new')}>
          <IconFile size={13} />
        </button>
        <button onClick={onSave} disabled={disabled} className={btn} title={t('project.save')}>
          <IconDeviceFloppy size={13} />
        </button>
        <button onClick={onOpen} disabled={disabled} className={btn} title={t('project.open')}>
          <IconFolder size={13} />
        </button>
        <div className="w-px bg-retro-black/30 mx-1 self-center h-4" />
        <button
          onClick={() => window.api.toggleFullscreen()}
          title={isFullScreen ? t('project.exitFullscreen') : t('project.fullscreen')}
          className="btn-retro w-6 h-6 bg-retro-bg border-2 border-retro-black rounded shadow-retro-sm flex items-center justify-center hover:bg-gray-200"
        >
          {isFullScreen ? <IconArrowsMinimize size={13} /> : <IconArrowsMaximize size={13} />}
        </button>
        <button
          onClick={() => window.api.minimize()}
          className="btn-retro w-6 h-6 bg-retro-bg border-2 border-retro-black rounded shadow-retro-sm flex items-center justify-center text-[10px] font-bold hover:bg-gray-200"
        >
          —
        </button>
        <button
          onClick={() => window.api.close()}
          className="btn-retro w-6 h-6 bg-retro-bg border-2 border-retro-black rounded shadow-retro-sm flex items-center justify-center text-[10px] font-bold hover:bg-red-200"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

export default TitleBar
