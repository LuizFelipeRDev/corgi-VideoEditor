// REAL-TIME preview — "instant A/B" (v1.8.0)
// ---------------------------------------------------------------------------
// The treatment chain built with Web Audio INSIDE wavesurfer's own
// AudioContext (WebAudio backend → WebAudioPlayer.getGainNode()).
// The original × treated switch is a gain crossfade: no ffmpeg render, no
// reloading the source — click and hear it instantly, wherever the playhead is.
//
// Fidelity: highpass/lowpass/EQ/compressor/limiter/echo/speed come
// very close to ffmpeg; denoise (afftdn) and loudnorm (loudnorm) are
// APPROXIMATED by the AudioWorklet 'corgi-approx'. The EXPORT is still the
// exact ffmpeg — the preview is for deciding fast, the final file doesn't change.
//
// Insertion point: wavesurfer builds the audio as
//   bufferNode → gainNode → destination (WebAudioPlayer)
// so we disconnect() the gainNode and reconnect it INTO MY chain:
//   tap → dry ──────────────────────────→ destination   (ORIGINAL)
//   tap → [gate] → hp → lp → eq → comp → [agc] → lim → echo → wet → destination
// The player's own gain/volume/mute keeps flowing through the tap ✓
//
// The SHAPE of the waveform also follows the treatment: renderEnvelope() runs the
// SAME chain in an OfflineAudioContext and returns the envelope (max per
// window) per channel — wavesurfer redraws the peaks without touching the player.

import approxWorkletSrc from './approx.processor.js?raw'

const WORKLET = 'corgi-approx'
const clamp = (v, min, max) => Math.min(max, Math.max(min, v))
const dbToLin = (db) => Math.pow(10, db / 20)

// Smoothed AudioParam (avoids clicks when the cfg or the A/B side changes).
// In OFFLINE context (waveform shape redraw) the value is set directly, no
// ramp: it must be right on the render's first sample already.
const setParam = (param, value, ctx, tc = 0.02) => {
  if (ctx && typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext) {
    try {
      param.value = value
    } catch {
      // inaccessible param — ignore
    }
    return
  }
  try {
    param.setTargetAtTime(value, ctx.currentTime, tc)
  } catch {
    // closed/terminated context — ignore
  }
}

const speedOf = (cfg) => {
  const fx = cfg?.fx || {}
  return fx.speedOn ? clamp(Number(fx.speed ?? 1), 0.5, 2) : 1
}

const chain = {
  player: null,
  nodes: null,
  cfg: null,
  bypassed: true,
  workletForCtx: null,
  workletPromise: null,
  workletOk: false,
}

// addModule via Blob: works in dev and in the file:// build. Once per
// AudioContext; failure ⇒ continues without the two approx (gate/agc).
// loadWorklet: NO cache — each ctx (including the waveform shape's offline ones)
// needs its own addModule.
const loadWorklet = (ctx) => {
  if (!ctx.audioWorklet) return Promise.resolve(false)
  const url = URL.createObjectURL(new Blob([approxWorkletSrc], { type: 'application/javascript' }))
  return ctx.audioWorklet
    .addModule(url)
    .then(() => {
      URL.revokeObjectURL(url)
      return true
    })
    .catch(() => {
      URL.revokeObjectURL(url)
      return false
    })
}

// Cache for the player's AudioContext (only attach uses it)
const ensureWorklet = (ctx) => {
  if (!ctx.audioWorklet) return Promise.resolve(false)
  // Same ctx: returns the pending promise (or the already resolved result)
  if (chain.workletForCtx === ctx) return chain.workletPromise || Promise.resolve(chain.workletOk)
  chain.workletForCtx = ctx
  chain.workletOk = false
  chain.workletPromise = loadWorklet(ctx).then((ok) => {
    chain.workletOk = ok
    return ok
  })
  return chain.workletPromise
}

// Builds the treatment graph on a ctx (realtime preview OR offline render) —
// does NOT touch tap/destination/global state: the caller is the one connecting.
// dry/wet start neutral (original); apply()/the caller set the gains.
const build = (ctx, workletOk) => {
  const dry = ctx.createGain()
  const wet = ctx.createGain()
  dry.gain.value = 1
  wet.gain.value = 0

  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  const mkBand = (freq) => {
    const b = ctx.createBiquadFilter()
    b.type = 'peaking'
    b.frequency.value = freq
    b.Q.value = 1 // same Q as ffmpeg's equalizer (w=1)
    return b
  }
  const eqLow = mkBand(110)
  const eqMid = mkBand(1000)
  const eqHigh = mkBand(8000)
  const comp = ctx.createDynamicsCompressor()
  const lim = ctx.createDynamicsCompressor()

  // parallel echo: dry + delay with feedback (≈ aecho)
  const echoDry = ctx.createGain()
  echoDry.gain.value = 1
  const delay = ctx.createDelay(2)
  const fb = ctx.createGain()
  const echoWet = ctx.createGain()

  // approximations (only with the worklet loaded)
  let gate = null
  let agc = null
  if (workletOk) {
    try {
      gate = new AudioWorkletNode(ctx, WORKLET)
      gate.port.postMessage({ mode: 'gate' })
      agc = new AudioWorkletNode(ctx, WORKLET)
      agc.port.postMessage({ mode: 'agc' })
    } catch {
      gate = null
      agc = null
    }
  }

  // internal assembly of the chain (input → ... → wet). dry/destination are
  // connected by the CALLER: realtime preview (tap) or offline render (source).
  const entry = gate || hp
  if (gate) gate.connect(hp)
  hp.connect(lp)
  lp.connect(eqLow)
  eqLow.connect(eqMid)
  eqMid.connect(eqHigh)
  eqHigh.connect(comp)
  let dyn = comp
  if (agc) {
    dyn.connect(agc)
    dyn = agc
  }
  dyn.connect(lim)
  lim.connect(echoDry)
  echoDry.connect(wet)
  lim.connect(delay)
  delay.connect(echoWet)
  echoWet.connect(wet)
  delay.connect(fb)
  fb.connect(delay)

  return { ctx, dry, wet, hp, lp, eqLow, eqMid, eqHigh, comp, lim, echoDry, delay, fb, echoWet, gate, agc, entry }
}

// Cfg → parameters. Same semantics as buildSoundChain (only what Web Audio
// can represent; denoise/loudnorm go through the worklet's approximations).
const applyParams = (n, cfg) => {
  const { ctx } = n
  const noise = cfg.noise || {}
  const dyn = cfg.dynamics || {}
  const eq = cfg.eq || {}
  const fx = cfg.fx || {}

  // highpass/lowpass — the "radio" tone narrows the band even further
  const radio = eq.on === true && eq.tone === 'radio'
  let hpHz = noise.highpassOn ? clamp(Math.round(Number(noise.highpassHz) || 80), 20, 500) : 10
  let lpHz = noise.lowpassOn ? clamp(Math.round(Number(noise.lowpassHz) || 8000), 1000, 20000) : ctx.sampleRate / 2 - 100
  if (radio) {
    hpHz = Math.max(hpHz, 300)
    lpHz = Math.min(lpHz, 3400)
  }
  setParam(n.hp.frequency, hpHz, ctx)
  setParam(n.lp.frequency, lpHz, ctx)

  // per-band EQ (0 = off, same as not pushing the equalizer in ffmpeg)
  setParam(n.eqLow.gain, eq.on ? clamp(Number(eq.low) || 0, -12, 12) : 0, ctx)
  setParam(n.eqMid.gain, eq.on ? clamp(Number(eq.mid) || 0, -12, 12) : 0, ctx)
  setParam(n.eqHigh.gain, eq.on ? clamp(Number(eq.high) || 0, -12, 12) : 0, ctx)

  // compressor (ffmpeg's acompressor: fixed 250 ms release)
  const compOn = dyn.compOn === true
  setParam(n.comp.threshold, compOn ? clamp(Number(dyn.threshold ?? -18), -50, 0) : 0, ctx)
  setParam(n.comp.ratio, compOn ? clamp(Number(dyn.ratio ?? 3), 1, 20) : 1, ctx)
  setParam(n.comp.attack, compOn ? clamp(Number(dyn.attack ?? 5), 1, 200) / 1000 : 0.003, ctx)
  setParam(n.comp.release, 0.25, ctx)
  setParam(n.comp.knee, compOn ? 6 : 0, ctx)

  // limiter (alimiter): holds at the maximum peak; ratio 1 = transparent
  const limOn = dyn.limiterOn === true
  setParam(n.lim.threshold, limOn ? clamp(Number(dyn.ceiling ?? -1), -6, -0.1) : 0, ctx)
  setParam(n.lim.ratio, limOn ? 20 : 1, ctx)
  setParam(n.lim.attack, 0.003, ctx)
  setParam(n.lim.release, 0.1, ctx)
  setParam(n.lim.knee, 0, ctx)

  // approximations: gate ≈ afftdn / agc ≈ loudnorm
  if (n.gate) {
    n.gate.port.postMessage({
      mode: 'gate',
      on: noise.denoiseOn === true, // neural (arnndn) is also approximated by the gate
      threshold: dbToLin(clamp(Number(noise.denoiseDb ?? -25), -80, -20) - 10),
    })
  }
  if (n.agc) {
    n.agc.port.postMessage({
      mode: 'agc',
      on: dyn.normalizeOn === true,
      targetRms: dbToLin(clamp(Number(dyn.lufs ?? -16), -30, -5) + 2),
    })
  }

  // echo (aecho: in 0.7 / out 0.9 → approximation 0.85)
  const echoOn = fx.echoOn === true
  setParam(n.echoWet.gain, echoOn ? 0.85 : 0, ctx)
  setParam(n.delay.delayTime, echoOn ? clamp(Math.round(Number(fx.echoDelay ?? 300)), 10, 1000) / 1000 : 0.3, ctx)
  setParam(n.fb.gain, echoOn ? clamp(Number(fx.echoDecay ?? 0.4), 0.05, 0.9) : 0, ctx)
}

// Applies the SAVED state (cfg + A/B side) to the built graph.
const apply = () => {
  const n = chain.nodes
  if (!n) return
  const active = !chain.bypassed
  setParam(n.dry.gain, active ? 0 : 1, n.ctx, 0.015)
  setParam(n.wet.gain, active ? 1 : 0, n.ctx, 0.015)
  try {
    n.player.playbackRate = active ? speedOf(chain.cfg) : 1
  } catch {
    // player destroyed
  }
  if (chain.cfg) {
    try {
      applyParams(n, chain.cfg)
    } catch (e) {
      console.warn('[realtime] falha ao aplicar parâmetros:', e)
    }
  }
}

// --- WAVEFORM SHAPE: OFFLINE render -------------------------------------------
// Redraws the waveform peaks according to the treatment, with no new file and
// without touching the player: the SAME preview chain runs in an
// OfflineAudioContext and the envelope (max per window) of each channel goes
// to wavesurfer. Processes in CHUNK_SEC blocks with pre-roll (ROLL_SEC/rollFor)
// — bounded memory on long files, and the state of the stateful chains
// (compressor/AGC/echo) carries from one block to the next thanks to the
// run-up segment.
const CHUNK_SEC = 15
const ROLL_SEC = 5 // covers AGC (τ≈1 s) and the compressor ramp on every block

// The echo has LONG memory (tail fb^k · delay^k): each block's pre-roll
// must contain the tail, otherwise the start of the block "breaks" (<3% error).
// Extreme case (delay 1 s / fb 0.9) ≈ 33 s — only whoever enables echo pays for that.
const rollFor = (cfg) => {
  const fx = cfg?.fx || {}
  if (fx.echoOn !== true) return ROLL_SEC
  const d = clamp(Math.round(Number(fx.echoDelay ?? 300)), 10, 1000) / 1000
  const fbv = clamp(Number(fx.echoDecay ?? 0.4), 0.05, 0.9)
  const need = (d * Math.log(0.03)) / Math.log(fbv) // negative logs → positive
  return Math.max(ROLL_SEC, Math.min(34, Math.ceil(need)))
}

// ~120 points/s (the waveform draws ~0.5 s/bar = 2 bars per point)
const envelopePoints = (duration) => clamp(Math.ceil(duration * 120), 4096, 131072)

const renderChunk = async (buffer, start, len, cfg) => {
  const off = new OfflineAudioContext(buffer.numberOfChannels, len, buffer.sampleRate)
  const ok = await loadWorklet(off)
  const nodes = build(off, ok)
  applyParams(nodes, cfg)
  nodes.dry.gain.value = 0
  nodes.wet.gain.value = 1 // fully treated preview
  const sub = off.createBuffer(buffer.numberOfChannels, len, buffer.sampleRate)
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    sub.getChannelData(c).set(buffer.getChannelData(c).subarray(start, start + len))
  }
  const src = off.createBufferSource()
  src.buffer = sub
  src.connect(nodes.entry)
  nodes.wet.connect(off.destination)
  src.start(0)
  const out = await off.startRendering()
  try {
    // OfflineAudioContext doesn't expose close() in every version — guarded
    if (typeof off.close === 'function') {
      const closed = off.close()
      if (closed && closed.catch) closed.catch(() => {})
    }
  } catch {
    // no close available / context already terminated — ok
  }
  return out
}

// Returns Array<Float32Array> (max per window, ≤2 channels) or null on
// failure/cancellation — the caller keeps the previous shape in that case.
const renderEnvelope = async (buffer, cfg, isCancelled) => {
  if (!buffer || !buffer.length || !cfg) return null
  try {
    const total = buffer.length
    const sr = buffer.sampleRate
    const ch = Math.min(2, buffer.numberOfChannels)
    const points = envelopePoints(total / sr)
    const env = Array.from({ length: ch }, () => new Float32Array(points))
    const chunk = Math.max(1, Math.floor(CHUNK_SEC * sr))
    const roll = Math.floor(rollFor(cfg) * sr)
    let done = 0 // file samples already enveloped
    let donePts = 0
    while (done < total) {
      if (isCancelled && isCancelled()) return null
      const len = Math.min(chunk, total - done)
      const pre = Math.min(roll, done)
      // pure pre-roll: everything is causal, no post-roll needed
      const out = await renderChunk(buffer, done - pre, pre + len, cfg)
      const take =
        done + len >= total ? points - donePts : Math.min(points - donePts, Math.round((len / total) * points))
      if (take > 0) {
        const stride = len / take
        for (let c = 0; c < ch; c++) {
          const data = out.getChannelData(c)
          const dst = env[c]
          for (let i = 0; i < take; i++) {
            const s = pre + Math.floor(i * stride)
            const e = Math.max(s + 1, pre + Math.floor((i + 1) * stride))
            let m = 0
            for (let j = s; j < e && j < pre + len; j++) {
              const v = data[j] < 0 ? -data[j] : data[j]
              if (v > m) m = v
            }
            dst[donePts + i] = m
          }
        }
        donePts += take
      }
      done += len
    }
    return env
  } catch (e) {
    console.warn('[forma] render offline falhou:', e)
    return null
  }
}

const realtimeChain = {
  // Connects the chain to the current player (wavesurfer's WebAudioPlayer).
  // Call it on every player creation (onPlayer) — async build only for the worklet.
  attach(player) {
    if (!player) {
      chain.player = null
      chain.nodes = null
      return
    }
    if (player === chain.player) return
    if (typeof player.getGainNode !== 'function') return // backend without WebAudioPlayer (future)
    // New player: releases the old graph (the previous player dies with it)
    if (chain.nodes && chain.nodes.player !== player) {
      try {
        chain.nodes.tap.disconnect()
      } catch {
        // already released
      }
    }
    const tap = player.getGainNode()
    const ctx = tap.context
    chain.player = player
    chain.nodes = null
    ensureWorklet(ctx).then((ok) => {
      if (chain.player !== player) return // player changed while waiting
      const nodes = build(ctx, ok)
      // reconnects the player's gainNode INTO the chain (dry = original, wet = treated)
      try {
        tap.disconnect()
      } catch {
        // no old connections — ok
      }
      tap.connect(nodes.dry)
      nodes.dry.connect(ctx.destination)
      tap.connect(nodes.entry)
      nodes.wet.connect(ctx.destination)
      chain.nodes = { ...nodes, tap, player }
      apply()
    })
  },

  setConfig(cfg) {
    chain.cfg = cfg
    apply()
  },

  setBypass(b) {
    chain.bypassed = !!b
    apply()
  },

  // Envelope (max/window per channel) of the TREATED audio — to redraw the
  // waveform SHAPE. Array<Float32Array> or null (failure/cancelled).
  renderEnvelope,
}

export default realtimeChain
