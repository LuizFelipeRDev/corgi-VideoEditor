function ErrorModal({ message, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-retro-box border-2 border-retro-black rounded-lg shadow-retro w-[480px] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-pixel text-[9px] text-red-600">ERRO</h2>
          <button
            onClick={onClose}
            className="btn-retro w-6 h-6 bg-retro-bg border-2 border-retro-black rounded shadow-retro-sm flex items-center justify-center text-[10px] font-bold hover:bg-red-200"
          >
            ✕
          </button>
        </div>
        <div className="bg-retro-bg border-2 border-retro-black rounded p-3 mb-3 max-h-[200px] overflow-y-auto">
          <p className="font-pixel text-[7px] text-retro-black whitespace-pre-wrap break-all">{message}</p>
        </div>
        <button
          onClick={onClose}
          className="btn-retro w-full h-9 bg-retro-bg border-2 border-retro-black rounded shadow-retro font-pixel text-[8px] text-retro-black uppercase hover:bg-gray-200"
        >
          FECHAR
        </button>
      </div>
    </div>
  )
}

export default ErrorModal
