import { useState } from 'react'
import { IconMusic } from '@tabler/icons-react'
import { useLang } from '../lib/i18n'
import DbGutter from './DbGutter'

// Box 2 — Music track (wireframe 1.11.0): BROTHER box of the main waveform
// (not a child container) — dB gutter + waveform area + name chip. The wave
// itself is mounted by the Waveform (it controls px/s scale, scroll locked
// to the voice track and the shared playhead); here stay only the row's
// visuals, the drag & drop (same webUtils.getPathForFile path as DropZone)
// and the chip. Chip: CHANGE swaps the file; ✕ REMOVE takes the music off
// the track (easy removal — the row goes back to the drop state).
// Disabling ducking while keeping the saved music is the switch
// (sidebar/checkbox), which hides the whole row.
function MusicTrack({
  musicFile,
  musicDb,
  onMusicDbChange,
  onPick,
  onRemove,
  waveContainerRef,
  playheadRef,
  disabled,
  gutterLabel,
  fadeOut,
  onFadeOutChange,
}) {
  const { t } = useLang()
  const [dragOver, setDragOver] = useState(false)

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    if (disabled) return
    const f = e.dataTransfer?.files?.[0]
    if (!f) return
    try {
      const path = window.api.getPathForFile(f)
      if (path) onPick(path)
    } catch { /* file without a usable path */ }
  }

  const btn =
    'btn-retro h-6 px-2 bg-retro-bg border-2 border-retro-black rounded shadow-retro-sm font-pixel text-[7px] text-retro-black uppercase hover:bg-gray-200 disabled:opacity-40'

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      title={musicFile?.path || t('ducking.dropHint')}
      className={`flex w-full border-2 border-retro-black rounded shadow-retro p-2 ${dragOver ? 'bg-gray-100' : 'bg-retro-bg'}`}
    >
      <DbGutter
        db={musicDb}
        onChange={onMusicDbChange}
        label={gutterLabel}
        disabled={disabled}
      />
      <div className="relative flex-1 min-w-0 min-h-[96px]">
        {/* Music waveform container WITHOUT React children (wavesurfer is the
            firstElementChild — the Waveform's Shadow DOM queries depend on
            it) + SIBLING shared playhead line: the Waveform moves both tracks
            to the same position (same scale, same scroll) */}
        <div ref={waveContainerRef} className="absolute inset-0 overflow-hidden" />
        <div
          ref={playheadRef}
          className="absolute top-0 bottom-0 left-0 w-[2px] bg-retro-black/80 pointer-events-none z-20"
          style={{ opacity: 0 }}
        />

        {musicFile ? (
          // Name chip-label (top-left over the wave) + actions
          <div className="absolute top-1 left-1 z-10 flex items-center gap-1 max-w-[calc(100%-64px)] bg-retro-bg/95 border border-retro-black rounded px-1 py-[1px] shadow-retro-sm">
            <IconMusic size={10} className="shrink-0 text-retro-black" />
            <span className="font-pixel text-[7px] leading-none text-retro-black truncate" title={musicFile.name}>
              {musicFile.name}
            </span>
            <button
              className="btn-retro font-pixel text-[6px] leading-none text-retro-black/70 hover:text-retro-black uppercase px-[2px]"
              disabled={disabled}
              onClick={() => onPick()}
              title={t('ducking.change')}
            >
              {t('ducking.change')}
            </button>
            <button
              className="btn-retro font-pixel text-[8px] leading-none text-retro-black hover:text-red-700 px-[2px]"
              disabled={disabled}
              onClick={() => onRemove()}
              title={t('ducking.remove')}
            >
              ✕
            </button>
          </div>
        ) : (
          // Empty state: drop + PICK button (the wave only exists with music)
          <div className="absolute inset-0 flex items-center gap-2 px-3 border border-dashed border-retro-black/40">
            <IconMusic size={14} className="shrink-0 text-retro-black/50" />
            <span className="font-pixel text-[7px] flex-1 truncate text-retro-black/50">
              {t('ducking.dropHint')}
            </span>
            <button className={btn} disabled={disabled} onClick={() => onPick()}>
              {t('ducking.pick')}
            </button>
          </div>
        )}

        {/* Final fade (bed only): an OVERLAY, never a new row — the box keeps
            its 96px floor (the window height math depends on it) */}
        {musicFile && (
          <label
            className="absolute top-1 right-1 z-10 flex items-center gap-1 bg-retro-bg/95 border border-retro-black rounded px-1 py-[1px] shadow-retro-sm cursor-pointer"
            title={t('ducking.fadeOutHint')}
          >
            <input
              type="checkbox"
              checked={!!fadeOut}
              disabled={disabled}
              onChange={(e) => onFadeOutChange && onFadeOutChange(e.target.checked)}
              className="w-[9px] h-[9px] m-0 accent-retro-black"
            />
            <span className="font-pixel text-[6px] leading-none text-retro-black uppercase">
              {t('ducking.fadeOut')}
            </span>
          </label>
        )}
      </div>
    </div>
  )
}

export default MusicTrack
