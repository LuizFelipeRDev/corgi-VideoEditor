import logo from '../../assets/novaLogo.png'

function TitleBar() {
  return (
    <div
      className="bg-retro-box border-b-2 border-retro-black px-3 py-1.5 flex items-center justify-between shrink-0"
      style={{ WebkitAppRegion: 'drag' }}
    >
      <div className="flex items-center gap-2">
        {/* <img src={logo} className="w-8 h-8" /> */}
        <h1 className="font-pixel text-[10px] text-retro-black">CORGI-EDITOR</h1>
      </div>
      <div className="flex gap-1.5" style={{ WebkitAppRegion: 'no-drag' }}>
        <button
          onClick={() => window.api.minimize()}
          className="btn-retro w-6 h-6 bg-retro-bg border-2 border-retro-black rounded shadow-retro-sm flex items-center justify-center text-[10px] font-bold hover:bg-gray-200"
        >
          —
        </button>
        <button
          onClick={() => window.api.close()}
          className="btn-retro w-6 h-6 bg-retro-bg border-2 border-retro-black rounded shadow-retro-sm flex items-center justify-center text-[10px] font-bold hover:bg-red-200"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

export default TitleBar
