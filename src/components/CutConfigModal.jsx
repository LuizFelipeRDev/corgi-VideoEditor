import { useState } from 'react'
import { useLang } from '../lib/i18n'
import { IconLink, IconLinkOff, IconX } from '@tabler/icons-react'

// AUTO CUT modal (v1.10.1). The cut fields moved out of the right column
// into here — that column now only holds the pair
// [AUTO CUT → this modal] [toggle], same shape as the advanced sound row
// (one button configures, the other switches on/off).
// v1.10.1: ASYMMETRIC margin (before/after, auto-editor --margin A,B) and
// smoothness (--smooth mincut) — the same parameters go to preview AND export.
// Chain between the margins: CLOSED keeps the proportion (before/after scale
// together — with equal values the proportion is 1:1, i.e. both move together);
// OPEN makes each field free (0.2 / 0.5). The chain is not persisted: on
// reopen, equal pair → closed, different → open.
function CutConfigModal({ threshold, marginVal, marginAfter, smooth, onClose, onSave }) {
  const { t } = useLang()
  const [thr, setThr] = useState(threshold)
  const [mar, setMar] = useState(marginVal)
  const [marA, setMarA] = useState(marginAfter)
  const [sm, setSm] = useState(smooth)
  const [linked, setLinked] = useState(() => String(marginVal) === String(marginAfter))
  // Frozen proportion (after / before) while the chain is closed.
  const [ratio, setRatio] = useState(() => {
    const b = parseFloat(marginVal)
    const a = parseFloat(marginAfter)
    return Number.isFinite(b) && b !== 0 && Number.isFinite(a) ? a / b : 1
  })

  const fmtRatio = (v) => String(Math.round(v * 1000) / 1000)

  const onBefore = (v) => {
    setMar(v)
    const n = parseFloat(v)
    // Typing partial junk ("", "-") must not drag the other field.
    if (linked && Number.isFinite(n)) setMarA(fmtRatio(n * ratio))
  }

  const onAfter = (v) => {
    setMarA(v)
    const n = parseFloat(v)
    if (linked && Number.isFinite(n)) setMar(fmtRatio(ratio ? n / ratio : n))
  }

  const toggleLink = () => {
    if (!linked) {
      // CLOSING the chain: freeze the pair's current proportion
      // (equal → 1:1, i.e. "both move together").
      const b = parseFloat(mar)
      const a = parseFloat(marA)
      setRatio(Number.isFinite(b) && b !== 0 && Number.isFinite(a) ? a / b : 1)
    }
    setLinked(!linked)
  }

  const save = () => {
    onSave({ threshold: thr, margin: mar, marginAfter: marA, smooth: sm })
    onClose()
  }

  const field =
    'w-full h-8 border-2 border-retro-black rounded bg-retro-bg shadow-retro-sm px-2 font-pixel text-[9px] text-retro-black outline-none'

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-retro-box border-2 border-retro-black rounded-lg shadow-retro w-[26rem] max-w-[94vw] p-4 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-pixel text-[8px] text-retro-black uppercase">{t('cut.modalTitle')}</h3>
          <button
            onClick={onClose}
            className="w-6 h-6 border-2 border-retro-black rounded bg-retro-bg shadow-retro-sm flex items-center justify-center hover:bg-red-200 shrink-0"
          >
            <IconX size={12} stroke={2.5} />
          </button>
        </div>

        {/* MIN VOLUME + MARGIN BEFORE/AFTER (same fields as before, plus the
            margin side that was missing — the auto-editor accepts "before,after") */}
        <div className="flex gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <label className="font-pixel text-[7px] text-retro-black uppercase block mb-1.5">{t('controls.minVolume')}</label>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                inputMode="decimal"
                value={thr}
                onChange={(e) => setThr(e.target.value)}
                className={field}
              />
              <span className="font-pixel text-[8px] text-retro-black shrink-0">dB</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <label className="font-pixel text-[7px] text-retro-black uppercase block mb-1.5">{t('cut.marginBefore')}</label>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                inputMode="decimal"
                value={mar}
                onChange={(e) => onBefore(e.target.value)}
                className={field}
              />
              <span className="font-pixel text-[8px] text-retro-black shrink-0">sec</span>
            </div>
          </div>
          {/* Chain: closed = keeps the proportion; open = free values */}
          <button
            type="button"
            onClick={toggleLink}
            aria-pressed={linked}
            title={linked ? t('cut.linkOn') : t('cut.linkOff')}
            className={`self-end shrink-0 w-7 h-8 border-2 border-retro-black rounded shadow-retro-sm flex items-center justify-center ${
              linked ? 'bg-retro-black text-retro-bg' : 'bg-retro-bg text-retro-black/50'
            }`}
          >
            {linked ? <IconLink size={13} stroke={2.5} /> : <IconLinkOff size={13} stroke={2.5} />}
          </button>
          <div className="flex-1 min-w-0">
            <label className="font-pixel text-[7px] text-retro-black uppercase block mb-1.5">{t('cut.marginAfter')}</label>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                inputMode="decimal"
                value={marA}
                onChange={(e) => onAfter(e.target.value)}
                className={field}
              />
              <span className="font-pixel text-[8px] text-retro-black shrink-0">sec</span>
            </div>
          </div>
        </div>

        {/* SMOOTHNESS (--smooth): mincut in seconds — silence stretches
            shorter than this get undone (avoids staccato micro-cuts) */}
        <div className="mb-3">
          <label className="font-pixel text-[7px] text-retro-black uppercase block mb-1.5">
            {t('cut.smooth')} <span className="text-retro-black/60">({sm}s)</span>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={sm}
            onChange={(e) => setSm(e.target.value)}
            className="w-full accent-retro-black cursor-pointer"
          />
          <p className="font-pixel text-[6px] text-retro-black/50 mt-1 leading-relaxed">{t('cut.smoothHint')}</p>
        </div>

        <p className="font-pixel text-[6px] text-retro-black/60 leading-relaxed mb-4">{t('cut.modalHint')}</p>

        <button
          onClick={save}
          className="h-8 border-2 border-retro-black rounded bg-retro-black text-retro-bg shadow-retro-sm font-pixel text-[7px] uppercase hover:bg-gray-800"
        >
          {t('common.save')}
        </button>
      </div>
    </div>
  )
}

export default CutConfigModal
