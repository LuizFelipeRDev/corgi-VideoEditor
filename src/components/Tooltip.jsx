import { useState, useRef, useEffect } from 'react'

function Tooltip({ children, text }) {
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const triggerRef = useRef(null)

  useEffect(() => {
    if (show && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPos({
        x: rect.left + rect.width / 2,
        y: rect.top - 8,
      })
    }
  }, [show])

  return (
    <span
      ref={triggerRef}
      className="inline-block"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && text && (
        <div
          className="fixed z-[100] pointer-events-none -translate-x-1/2"
          style={{ left: pos.x, top: pos.y }}
        >
          <div className="bg-retro-black text-retro-bg font-pixel text-[6px] leading-relaxed px-2 py-1.5 rounded border border-retro-black shadow-retro-sm whitespace-normal" style={{ minWidth: '120px', maxWidth: '260px' }}>
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-retro-black" />
          </div>
        </div>
      )}
    </span>
  )
}

export default Tooltip
