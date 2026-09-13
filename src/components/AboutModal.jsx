import logo from '../../assets/logo.png'

function AboutModal({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-retro-box border-2 border-retro-black rounded-lg shadow-retro w-72 p-4 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end mb-2">
          <button
            onClick={onClose}
            className="btn-retro w-6 h-6 bg-retro-bg border-2 border-retro-black rounded shadow-retro-sm flex items-center justify-center text-[10px] font-bold hover:bg-red-200"
          >
            ✕
          </button>
        </div>
        <img src={logo} alt="Logo" className="w-16 h-16 mx-auto mb-3" />
        <h2 className="font-pixel text-[10px] text-retro-black mb-1">A Lue Project</h2>
        <p className="font-pixel text-[7px] text-retro-black/60">CORGI-EDITOR v0.2.0</p>
      </div>
    </div>
  )
}

export default AboutModal
