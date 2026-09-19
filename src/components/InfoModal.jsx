function InfoModal({ message, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-retro-box border-2 border-retro-black rounded-lg shadow-retro w-[320px] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-pixel text-[7px] text-retro-black text-center mb-4">{message}</p>
        <button
          onClick={onClose}
          className="btn-retro w-full h-8 bg-retro-bg border-2 border-retro-black rounded shadow-retro font-pixel text-[7px] text-retro-black uppercase hover:bg-gray-200"
        >
          OK
        </button>
      </div>
    </div>
  )
}

export default InfoModal
