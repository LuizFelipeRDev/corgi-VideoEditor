import { useState, useEffect, useRef } from 'react'

// Every toast closes on its own: after `duration` it fades out and calls onClose
// (400ms later). The progress bar at the bottom runs on the SAME duration, so
// the time left is always visible. 3s keeps the message on screen long enough to
// be read without piling up when several actions fire in a row.
const TOAST_DURATION_MS = 3000

function Toast({ message, linkLabel, onLinkClick, duration = TOAST_DURATION_MS, onClose }) {
  const [visible, setVisible] = useState(false)
  const [closing, setClosing] = useState(false)
  // onClose arrives as a NEW arrow function on every App render (the App
  // re-renders ~60x/s while media plays). Listing it in the effect deps below
  // cleared and re-armed the auto-dismiss timer on every one of those renders,
  // so the toast never closed during playback. Holding it in a ref keeps the
  // timer running while still calling the freshest callback when it fires.
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!visible || closing) return
    const t = setTimeout(() => {
      setClosing(true)
      setTimeout(() => onCloseRef.current?.(), 400)
    }, duration)
    return () => clearTimeout(t)
  }, [visible, closing, duration])

  const handleClose = () => {
    setClosing(true)
    setTimeout(() => onCloseRef.current?.(), 400)
  }

  return (
    <div
      className="fixed bottom-10 right-4 z-50 transition-all duration-400 ease-out"
      style={{
        opacity: closing ? 0 : visible ? 1 : 0,
        transform: closing
          ? 'translateX(20px)'
          : visible
            ? 'translateX(0)'
            : 'translateX(20px)',
      }}
    >
      <div className="bg-retro-box border-2 border-retro-black rounded shadow-retro-sm w-[280px] p-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="font-pixel text-[7px] text-retro-black leading-relaxed">
            {message}
          </p>
          <button
            onClick={handleClose}
            className="btn-retro w-5 h-5 shrink-0 bg-retro-bg border-2 border-retro-black rounded shadow-retro-sm flex items-center justify-center text-[8px] font-bold hover:bg-red-200"
          >
            ✕
          </button>
        </div>
        {linkLabel && (
          <button
            onClick={onLinkClick}
            className="btn-retro w-full h-7 bg-retro-bg border-2 border-retro-black rounded shadow-retro-sm font-pixel text-[6px] text-retro-black hover:bg-green-100"
          >
            {linkLabel}
          </button>
        )}
        <div className="mt-2 h-1 bg-retro-bg border border-retro-black/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-retro-accent/40"
            style={{
              width: '100%',
              animation: `toast-progress ${duration}ms linear forwards`,
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default Toast
