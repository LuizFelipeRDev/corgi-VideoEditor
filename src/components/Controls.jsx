import { useLang } from '../lib/i18n'
import { IconVolume3, IconMicrophone } from '@tabler/icons-react'

function Controls({ threshold, setThreshold, marginVal, setMarginVal, processing, generatingSubtitles, onExport, progress, onSaveConfig, soundEnabled, onOpenSound, onToggleSound, hasFile }) {
  const { t } = useLang()
  const handleBlur = () => {
    onSaveConfig({ threshold, margin: marginVal })
  }
  const micTitle = !hasFile
    ? t('sound.micTipNoFile')
    : soundEnabled
      ? t('sound.micTipOn')
      : t('sound.micTipOff')
  return (
    <div className="w-[45%] min-w-[180px] p-4 flex flex-col justify-center  border-retro-black">
      {/* VOLUME MÍNIMO + MARGEM lado a lado (v1.7.0: flex row) */}
      <div className="flex flex-row gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <label className="font-pixel text-[7px] text-retro-black uppercase block mb-2">{t('controls.minVolume')}</label>
          <div className="flex items-center gap-2">
            <div className="w-20 h-9 border-2 border-retro-black rounded bg-retro-bg shadow-retro-sm flex items-center overflow-hidden">
              <input
                type="text"
                inputMode="decimal"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                onBlur={handleBlur}
                className="w-full px-2 font-pixel text-[9px] text-retro-black outline-none bg-transparent translate-y-[2px]"
              />
            </div>
            <span className="font-pixel text-[8px] text-retro-black">dB</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <label className="font-pixel text-[7px] text-retro-black uppercase block mb-2">{t('controls.margin')}</label>
          <div className="flex items-center gap-2">
            <div className="w-20 h-9 border-2 border-retro-black rounded bg-retro-bg shadow-retro-sm flex items-center overflow-hidden">
              <input
                type="text"
                inputMode="decimal"
                value={marginVal}
                onChange={(e) => setMarginVal(e.target.value)}
                onBlur={handleBlur}
                className="w-full px-2 font-pixel text-[9px] text-retro-black outline-none bg-transparent translate-y-[2px]"
              />
            </div>
            <span className="font-pixel text-[8px] text-retro-black">sec</span>
          </div>
        </div>
      </div>

      {/* SOM AVANÇADO (modal) + 🎤 interruptor mestre (v1.7.0)
          🎤 desligado → o botão do modal fica opaco e INCLICÁVEL e nada
          de som vai para o export, mesmo com preset selecionado. */}
      <div className="flex flex-row gap-2 mb-4">
        <button
          onClick={onOpenSound}
          disabled={!soundEnabled || processing || generatingSubtitles}
          className="btn-retro flex-1 min-w-0 h-10 border-2 border-retro-black rounded shadow-retro bg-retro-bg font-pixel text-[9px] text-retro-black uppercase tracking-wider hover:bg-yellow-50 flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <IconVolume3 size={15} stroke={2} />
          <span className="truncate">{t('sound.advBtn')}</span>
        </button>
        <button
          onClick={onToggleSound}
          disabled={!hasFile || processing || generatingSubtitles}
          title={micTitle}
          className={`btn-retro w-11 h-10 border-2 border-retro-black rounded shadow-retro flex items-center justify-center shrink-0 transition-colors ${
            soundEnabled
              ? 'bg-green-500 hover:bg-green-400 text-black'
              : 'bg-retro-bg text-retro-black hover:bg-yellow-50'
          } disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          <IconMicrophone size={17} stroke={2.2} />
        </button>
      </div>

      <button
        onClick={onExport}
        disabled={processing || generatingSubtitles}
        className="btn-retro w-full h-10 bg-retro-bg border-2 border-retro-black rounded shadow-retro font-pixel text-[9px] text-retro-black uppercase tracking-wider hover:bg-yellow-50 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {processing ? t('controls.processing') : t('controls.exportBtn')}
      </button>

      <div className="w-full h-10 mt-3 bg-retro-bg border-2 border-retro-black rounded shadow-retro overflow-hidden relative">
        <div
          className="progress-fill h-full bg-green-500/80"
          style={{ width: `${progress.pct}%` }}
        />
        <span className="absolute inset-0 flex items-center justify-center font-pixel text-[7px] text-retro-black">
          {progress.text}
        </span>
      </div>
    </div>
  )
}

export default Controls
