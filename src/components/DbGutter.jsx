// dB strip (gutter) of each track — wireframe 1.11.0: "dB" label, current
// value and vertical slider. Range -40..+10 dB (the export's post-mix
// limiter holds the boosts; +20 would blow up easily).
// The VOICE slider already counts in preview and export (post-chain gain).
// The MUSIC one stores the value from now on; the mix effect arrives in
// phases 2/3 (preview with duck / export with sidechaincompress).
const DB_MIN = -40
const DB_MAX = 10

function DbGutter({ db, onChange, label, disabled, className = '' }) {
  const value = Math.min(DB_MAX, Math.max(DB_MIN, Number(db) || 0))
  return (
    <div
      className={`w-9 shrink-0 flex flex-col items-center gap-1 py-1 border-r-2 border-retro-black bg-retro-bg select-none ${className}`}
    >
      <span className="font-pixel text-[6px] leading-none text-retro-black/70">dB</span>
      <span className="font-pixel text-[7px] leading-none tabular-nums text-retro-black">
        {value > 0 ? '+' : ''}
        {value}
      </span>
      <input
        type="range"
        min={DB_MIN}
        max={DB_MAX}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        title={label}
        aria-label={label}
        className="db-range flex-1"
      />
    </div>
  )
}

export { DB_MIN, DB_MAX }
export default DbGutter
