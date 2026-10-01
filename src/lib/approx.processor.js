// AudioWorklet of the REAL-TIME preview (v1.8.0 — "instant A/B").
// Imported as TEXT (?raw) and served via Blob URL: this way it works the same in
// dev (http://localhost) and in the build (file://), without depending on addModule(file).
//
// Approximates at LISTENING time what ffmpeg does on export and what pure Web Audio does not
// have — two processors, one per instance (via `mode`):
//   'gate' ≈ afftdn  — reduces the NOISE floor when the signal drops (silences)
//   'agc'  ≈ loudnorm — holds loudness near the target (uniform volume)
// The EXPORT keeps using exact ffmpeg; this here is just to decide quickly.

const dbToLin = (db) => Math.pow(10, db / 20)
// Below -60 dBFS there is no "content to normalize" — it's silence (or
// noise already cut by the gate). With env on silence the target (targetRms/env)
// would explode and inflate the gain; better to freeze.
const AGC_FLOOR = dbToLin(-60)
// SAFETY ceiling: the preview never delivers above AGC_HEADROOM× the target.
// The target comes from an env that can be OUT OF SYNC with what plays now (silence→
// voice, or env/gain frozen from a stop/recreated graph = the "blown
// first second" of the preview: the gain was running there with τ≈1 s). In
// steady state level≈env and the ceiling stays 1.5× above the target — never limits
// what is normal.
const AGC_HEADROOM = 1.5
// HARD lock per block (instantaneous RMS): covers the window where `level`
// has not caught the signal jump yet (1st block of a jump) or the gain came
// huge from a previous session. Only engages above ~4× the target — normal
// speech peaks pass free.
const AGC_HARD = 4

class CorgiApproxProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.mode = 'gate'
    this.on = true
    this.threshold = dbToLin(-35) // gate: opens when the signal passes this
    this.targetRms = 0.2           // agc: RMS target (~ lufs + 2 dBFS)
    this.env = 0                   // signal envelope (gate) / loudness (agc)
    this.level = 0                 // agc: FAST level of the signal (only the ceiling)
    this.gain = 1                  // smoothed gain applied
    this.warmed = false            // agc: first block has not measured anything yet
    this.port.onmessage = (e) => {
      const d = e.data || {}
      if (d.mode) this.mode = d.mode
      if (typeof d.on === 'boolean') this.on = d.on
      if (typeof d.threshold === 'number') this.threshold = d.threshold
      if (typeof d.targetRms === 'number') this.targetRms = d.targetRms
    }
  }

  process(inputs, outputs) {
    const input = inputs[0]
    const output = outputs[0]
    if (!input || !input[0] || !output || !output[0]) return true
    const n = output[0].length
    if (this.mode === 'gate') return this.processGate(input, output, n)
    return this.processAgc(input, output, n)
  }

  // ≈ afftdn: opens fast when the voice enters (no "tick"), closes slowly and
  // CONSERVATIVELY (~ -34 dB) — approximates the ffmpeg spectral cut.
  processGate(input, output, n) {
    const atk = 1 - Math.exp(-1 / (sampleRate * 0.003))
    const rel = 1 - Math.exp(-1 / (sampleRate * 0.12))
    const gOpen = 0.02    // gain rises in ~3 ms
    const gClose = 0.0006 // gain falls in ~35 ms (release without click)
    const active = this.on
    const th = this.threshold
    let env = this.env
    let gain = this.gain
    for (let i = 0; i < n; i++) {
      const x = Math.abs(input[0][i])
      env += (x - env) * (x > env ? atk : rel)
      const target = !active ? 1 : (env >= th ? 1 : 0.02)
      gain += (target - gain) * (target > gain ? gOpen : gClose)
      for (let ch = 0; ch < output.length; ch++) {
        const src = input[ch] || input[0]
        output[ch][i] = src[i] * gain
      }
    }
    this.env = env
    this.gain = gain
    return true
  }

  // ≈ loudnorm: slow RMS (per block) → gain toward the target — rises
  // slowly, falls fast on peaks — interpolated between blocks (no zipper).
  processAgc(input, output, n) {
    let sum = 0
    for (let i = 0; i < n; i++) sum += input[0][i] * input[0][i]
    const rms = Math.sqrt(sum / n)
    const block = n / sampleRate
    // Signal level NOW (attack 5 ms / release 100 ms) — only feeds the
    // safety ceiling below; it does not enter the normal target calculation.
    this.level += (rms - this.level) * (rms > this.level ? 1 - Math.exp(-block / 0.005) : 1 - Math.exp(-block / 0.1))
    if (this.warmed) {
      this.env += (rms - this.env) * (rms > this.env ? 1 - Math.exp(-block / 0.4) : 1 - Math.exp(-block / 1.5))
    } else {
      // 1st block measures for real. Starting from env=0 would make targetRms/1e-4 =
      // a ×16 ceiling and the gain would run there (τ≈1 s) => the "first second
      // too loud" on the first activation of an audio adjustment (the env only
      // exists while audio flows through the worklet; before the first play it
      // is still frozen at zero).
      this.env = rms
      this.warmed = true
    }
    let target = !this.on
      ? 1
      : // Silence: a target computed from an env≈0 would blow past the ceiling and inflate
        // the gain — the voice would come in multiplied. Freezes at the current value.
        this.env < AGC_FLOOR
        ? this.gain
        : Math.min(16, Math.max(0.05, this.targetRms / this.env))
    // Safety ceiling (only with AGC on): the target comes from an env that can
    // be OUT OF SYNC with what plays now — silence→voice, or env/gain frozen
    // from a stop (after being stopped "for a while") => the gain would run there
    // with τ≈1 s and the first second came out blown. In steady state
    // level≈env and the ceiling stays ~1.5× above the target — never limits the normal.
    let cap = Infinity
    if (this.on) {
      cap = (this.targetRms * AGC_HEADROOM) / Math.max(this.level, AGC_FLOOR)
      if (target > cap) target = cap
    }
    let from = this.gain
    // rises τ=1 s (normal); falls τ=150 ms — and τ=30 ms while it stays ABOVE
    // the ceiling: there the env has not caught the real level yet and letting it run at
    // τ=1 s is exactly the "blown first second".
    const overCap = this.gain > cap
    const tau = target > this.gain ? 1.0 : overCap ? 0.03 : 0.15
    this.gain += (target - this.gain) * (1 - Math.exp(-block / tau))
    // HARD lock on the block's gain: instantaneous RMS, applies even on the first
    // block of the jump (the level has not caught up yet) and with gain inherited from a
    // previous session (e.g. ×16 from a quiet stretch). `from` too: the
    // interpolation of the whole block must start out already locked.
    if (this.on) {
      const hard = (this.targetRms * AGC_HARD) / Math.max(rms, AGC_FLOOR)
      if (this.gain > hard) this.gain = hard
      if (from > hard) from = hard
    }
    const step = (this.gain - from) / n
    for (let i = 0; i < n; i++) {
      const g = from + step * i
      for (let ch = 0; ch < output.length; ch++) {
        const src = input[ch] || input[0]
        output[ch][i] = src[i] * g
      }
    }
    return true
  }
}

registerProcessor('corgi-approx', CorgiApproxProcessor)
