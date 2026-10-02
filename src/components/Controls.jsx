import { useLang } from '../lib/i18n'
import { IconVolume3, IconMicrophone, IconScissors, IconPower } from '@tabler/icons-react'

function Controls({ processing, generatingSubtitles, onExport, progress, soundEnabled, onOpenSound, onToggleSound, hasFile, cutEnabled, cutBusy, onOpenCut, onToggleCut }) {
  const { t } = useLang()
  const micTitle = !hasFile
    ? t('sound.micTipNoFile')
    : soundEnabled
      ? t('sound.micTipOn')
      : t('sound.micTipOff')
  const cutTitle = cutEnabled ? t('cut.tipOn') : t('cut.tipOff')
  // Fixed-width column (260px): window.js keeps the window widths in sync
  // (+60 -> 700/960), so the preview keeps its space at the minimum size.
  return (
    <div className="w-[260px] shrink-0 p-4 flex flex-col justify-center  border-retro-black">
      {/* AUTO CUT (modal) + ⏻ master toggle (v1.10.1) — mirrors the
          advanced sound row: one button configures (MIN VOLUME + MARGIN
          in the modal), the other switches on/off. OFF = preview and export
          as they were (silences intact); ON = generates the cut and the
          preview plays/shows the final result. */}
      <div className="flex flex-row gap-2 mb-4">
        <button
          onClick={onOpenCut}
          disabled={processing || generatingSubtitles || cutBusy}
          className="btn-retro flex-1 min-w-0 h-10 border-2 border-retro-black rounded shadow-retro bg-retro-bg font-pixel text-[9px] text-retro-black uppercase tracking-wider hover:bg-yellow-50 flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <IconScissors size={15} stroke={2} />
          <span className="truncate">{cutBusy ? t('cut.generating') : t('cut.configBtn')}</span>
        </button>
        <button
          onClick={onToggleCut}
          disabled={!hasFile || processing || generatingSubtitles || cutBusy}
          title={cutTitle}
          className={`btn-retro w-11 h-10 border-2 border-retro-black rounded shadow-retro flex items-center justify-center shrink-0 transition-colors ${
            cutEnabled
              ? 'bg-green-500 hover:bg-green-400 text-black'
              : 'bg-retro-bg text-retro-black hover:bg-yellow-50'
          } disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          <IconPower size={17} stroke={2.2} />
        </button>
      </div>

      {/* ADVANCED SOUND (modal) + 🎤 master switch (v1.7.0)
          🎤 off → the modal button becomes opaque and UNCLICKABLE and no
          sound goes to the export, even with a preset selected. */}
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
        disabled={processing || generatingSubtitles || cutBusy}
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
