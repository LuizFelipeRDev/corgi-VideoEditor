function Controls({ threshold, setThreshold, marginVal, setMarginVal, processing, onExport, progress, onSaveConfig }) {
  const handleBlur = () => {
    onSaveConfig({ threshold, margin: marginVal })
  }
  return (
    <div className="w-1/2 p-4 flex flex-col justify-center">
      <div className="mb-4">
        <label className="font-pixel text-[7px] text-retro-black uppercase block mb-2">VOLUME MÍNIMO</label>
        <div className="flex items-center gap-2">
          <div className="w-20 h-9 border-2 border-retro-black rounded bg-retro-bg shadow-retro-sm flex items-center overflow-hidden">
            <input
              type="text"
              inputMode="decimal"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              onBlur={handleBlur}
              className="w-full px-2 font-pixel text-[9px] text-retro-black outline-none bg-transparent translate-y-[2px]"
            />
          </div>
          <span className="font-pixel text-[8px] text-retro-black">dB</span>
        </div>
      </div>

      <div className="mb-4">
        <label className="font-pixel text-[7px] text-retro-black uppercase block mb-2">MARGEM</label>
        <div className="flex items-center gap-2">
          <div className="w-20 h-9 border-2 border-retro-black rounded bg-retro-bg shadow-retro-sm flex items-center overflow-hidden">
            <input
              type="text"
              inputMode="decimal"
              value={marginVal}
              onChange={(e) => setMarginVal(e.target.value)}
              onBlur={handleBlur}
              className="w-full px-2 font-pixel text-[9px] text-retro-black outline-none bg-transparent translate-y-[2px]"
            />
          </div>
          <span className="font-pixel text-[8px] text-retro-black">sec</span>
        </div>
      </div>

      <button
        onClick={onExport}
        disabled={processing}
        className="btn-retro w-full h-10 bg-retro-bg border-2 border-retro-black rounded shadow-retro font-pixel text-[9px] text-retro-black uppercase tracking-wider hover:bg-yellow-50 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {processing ? 'PROCESSANDO...' : 'EXPORTAR'}
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
