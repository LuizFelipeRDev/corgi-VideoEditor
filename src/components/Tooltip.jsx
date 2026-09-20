import { useState } from 'react'

function Tooltip({ children, text }) {
  const [show, setShow] = useState(false)

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && text && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
          <div className="bg-retro-black text-retro-bg font-pixel
           text-[6px] leading-relaxed px-2 py-1.5 rounded border
            border-retro-black shadow-retro-sm whitespace-normal" style={{ minWidth: '200px',maxWidth:'300px' }}>
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-retro-black" />
          </div>
        </div>
      )}
    </div>
  )
}

export default Tooltip
