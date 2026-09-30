// Prévia em TEMPO REAL — "A/B instantâneo" (v1.8.0)
// ---------------------------------------------------------------------------
// A cadeia de tratamento montada com Web Audio DENTRO do AudioContext do
// próprio wavesurfer (backend WebAudio → WebAudioPlayer.getGainNode()).
// A troca original × tratado é um crossfade de ganho: sem render ffmpeg, sem
// recarregar a fonte — clique e ouve na hora, de onde a playhead estiver.
//
// Fidelidade: highpass/lowpass/EQ/compressor/limiter/eco/velocidade batem
// muito perto do ffmpeg; denoise (afftdn) e loudnorm (loudnorm) são
// APROXIMADOS pelo AudioWorklet 'corgi-approx'. O EXPORT continua sendo o
// ffmpeg exato — a prévia é pra decidir rápido, o arquivo final não muda.
//
// Ponto de inserção: o wavesurfer constrói o áudio como
//   bufferNode → gainNode → destination (WebAudioPlayer)
// então damos disconnect() no gainNode e o religamos NA MINHA cadeia:
//   tap → dry ──────────────────────────→ destination   (ORIGINAL)
//   tap → [gate] → hp → lp → eq → comp → [agc] → lim → eco → wet → destination
// O ganho/volume/mute do próprio player segue fluindo pelo tap ✓
//
// A FORMA da onda também acompanha o tratamento: renderEnvelope() repassa a
// MESMA cadeia num OfflineAudioContext e devolve o envelope (máximo por
// janela) por canal — o wavesurfer redesenha os picos sem tocar no player.

import approxWorkletSrc from './approx.processor.js?raw'

const WORKLET = 'corgi-approx'
const clamp = (v, min, max) => Math.min(max, Math.max(min, v))
const dbToLin = (db) => Math.pow(10, db / 20)

// AudioParam suavizado (evita clique quando a cfg ou o lado do A/B muda).
// Em contexto OFFLINE (redesenho da forma da onda) o valor é direto, sem
// rampa: tem que estar certo já no primeiro sample do render.
const setParam = (param, value, ctx, tc = 0.02) => {
  if (ctx && typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext) {
    try {
      param.value = value
    } catch {
      // param inacessível — ignorar
    }
    return
  }
  try {
    param.setTargetAtTime(value, ctx.currentTime, tc)
  } catch {
    // contexto fechado/encerrado — ignorar
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

// addModule via Blob: funciona em dev e no build file://. Uma única vez por
// AudioContext; falha ⇒ segue sem os dois approx (gate/agc).
// loadWorklet: SEM cache — cada ctx (inclusive os offline da forma da onda)
// precisa do próprio addModule.
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

// Cache pro AudioContext do player (só o attach usa)
const ensureWorklet = (ctx) => {
  if (!ctx.audioWorklet) return Promise.resolve(false)
  // Mesmo ctx: devolve a promise pendente (ou o resultado já resolvido)
  if (chain.workletForCtx === ctx) return chain.workletPromise || Promise.resolve(chain.workletOk)
  chain.workletForCtx = ctx
  chain.workletOk = false
  chain.workletPromise = loadWorklet(ctx).then((ok) => {
    chain.workletOk = ok
    return ok
  })
  return chain.workletPromise
}

// Monta o grafo de tratamento num ctx (prévia realtime OU render offline) —
// NÃO toca em tap/destination/estado global: quem conecta é o chamador.
// dry/wet nascem neutros (original); apply()/o chamador definem os ganhos.
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
    b.Q.value = 1 // mesmo Q do equalizer do ffmpeg (w=1)
    return b
  }
  const eqLow = mkBand(110)
  const eqMid = mkBand(1000)
  const eqHigh = mkBand(8000)
  const comp = ctx.createDynamicsCompressor()
  const lim = ctx.createDynamicsCompressor()

  // eco paralelo: dry + delay com realimentação (≈ aecho)
  const echoDry = ctx.createGain()
  echoDry.gain.value = 1
  const delay = ctx.createDelay(2)
  const fb = ctx.createGain()
  const echoWet = ctx.createGain()

  // approximations (só com o worklet carregado)
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

  // montagem interna da cadeia (entrada → ... → wet). dry/destination são
  // ligados pelo CHAMADOR: prévia realtime (tap) ou render offline (source).
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

// Cfg → parâmetros. Mesma semântica do buildSoundChain (só o que o Web Audio
// consegue representar; denoise/loudnorm vão pelos approximations do worklet).
const applyParams = (n, cfg) => {
  const { ctx } = n
  const noise = cfg.noise || {}
  const dyn = cfg.dynamics || {}
  const eq = cfg.eq || {}
  const fx = cfg.fx || {}

  // highpass/lowpass — o tom "rádio" estreita a banda ainda mais
  const radio = eq.on === true && eq.tone === 'radio'
  let hpHz = noise.highpassOn ? clamp(Math.round(Number(noise.highpassHz) || 80), 20, 500) : 10
  let lpHz = noise.lowpassOn ? clamp(Math.round(Number(noise.lowpassHz) || 8000), 1000, 20000) : ctx.sampleRate / 2 - 100
  if (radio) {
    hpHz = Math.max(hpHz, 300)
    lpHz = Math.min(lpHz, 3400)
  }
  setParam(n.hp.frequency, hpHz, ctx)
  setParam(n.lp.frequency, lpHz, ctx)

  // EQ por banda (0 = fora, igual a não empurrar o equalizer no ffmpeg)
  setParam(n.eqLow.gain, eq.on ? clamp(Number(eq.low) || 0, -12, 12) : 0, ctx)
  setParam(n.eqMid.gain, eq.on ? clamp(Number(eq.mid) || 0, -12, 12) : 0, ctx)
  setParam(n.eqHigh.gain, eq.on ? clamp(Number(eq.high) || 0, -12, 12) : 0, ctx)

  // compressor (acompressor do ffmpeg: release fixo 250 ms)
  const compOn = dyn.compOn === true
  setParam(n.comp.threshold, compOn ? clamp(Number(dyn.threshold ?? -18), -50, 0) : 0, ctx)
  setParam(n.comp.ratio, compOn ? clamp(Number(dyn.ratio ?? 3), 1, 20) : 1, ctx)
  setParam(n.comp.attack, compOn ? clamp(Number(dyn.attack ?? 5), 1, 200) / 1000 : 0.003, ctx)
  setParam(n.comp.release, 0.25, ctx)
  setParam(n.comp.knee, compOn ? 6 : 0, ctx)

  // limiter (alimiter): segura no pico máximo; ratio 1 = transparente
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
      on: noise.denoiseOn === true, // neural (arnndn) também aproxima pelo gate
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

  // eco (aecho: in 0.7 / out 0.9 → aproximação 0.85)
  const echoOn = fx.echoOn === true
  setParam(n.echoWet.gain, echoOn ? 0.85 : 0, ctx)
  setParam(n.delay.delayTime, echoOn ? clamp(Math.round(Number(fx.echoDelay ?? 300)), 10, 1000) / 1000 : 0.3, ctx)
  setParam(n.fb.gain, echoOn ? clamp(Number(fx.echoDecay ?? 0.4), 0.05, 0.9) : 0, ctx)
}

// Aplica o estado GUARDADO (cfg + lado do A/B) no grafo montado.
const apply = () => {
  const n = chain.nodes
  if (!n) return
  const active = !chain.bypassed
  setParam(n.dry.gain, active ? 0 : 1, n.ctx, 0.015)
  setParam(n.wet.gain, active ? 1 : 0, n.ctx, 0.015)
  try {
    n.player.playbackRate = active ? speedOf(chain.cfg) : 1
  } catch {
    // player destruído
  }
  if (chain.cfg) {
    try {
      applyParams(n, chain.cfg)
    } catch (e) {
      console.warn('[realtime] falha ao aplicar parâmetros:', e)
    }
  }
}

// --- FORMA DA ONDA: render OFFLINE -------------------------------------------
// Redesenha os picos da onda conforme o tratamento, sem arquivo novo e sem
// tocar no player: a MESMA cadeia da prévia roda num OfflineAudioContext e o
// envelope (máximo por janela) de cada canal vai pro wavesurfer. Processa em
// blocos de CHUNK_SEC com pré-roll (ROLL_SEC/rollFor) — memória limitada em
// arquivo longo e o estado das cadeias com memória (compressor/AGC/eco)
// continua de um bloco pro próximo graças ao trecho de arrancada.
const CHUNK_SEC = 15
const ROLL_SEC = 5 // cobre AGC (τ≈1 s) e a rampa do compressor a cada bloco

// O eco tem memória LONGA (cauda fb^k · delay^k): o pré-roll de cada bloco
// precisa conter a cauda, senão o começo do bloco "fura" (<3% de erro).
// Caso extremo (delay 1 s / fb 0.9) ≈ 33 s — só quem liga eco paga isso.
const rollFor = (cfg) => {
  const fx = cfg?.fx || {}
  if (fx.echoOn !== true) return ROLL_SEC
  const d = clamp(Math.round(Number(fx.echoDelay ?? 300)), 10, 1000) / 1000
  const fbv = clamp(Number(fx.echoDecay ?? 0.4), 0.05, 0.9)
  const need = (d * Math.log(0.03)) / Math.log(fbv) // logs negativos → positivo
  return Math.max(ROLL_SEC, Math.min(34, Math.ceil(need)))
}

// ~120 pontos/s (a onda desenha ~0,5 s/barra = 2 barras por ponto)
const envelopePoints = (duration) => clamp(Math.ceil(duration * 120), 4096, 131072)

const renderChunk = async (buffer, start, len, cfg) => {
  const off = new OfflineAudioContext(buffer.numberOfChannels, len, buffer.sampleRate)
  const ok = await loadWorklet(off)
  const nodes = build(off, ok)
  applyParams(nodes, cfg)
  nodes.dry.gain.value = 0
  nodes.wet.gain.value = 1 // prévia tratada por inteiro
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
    // OfflineAudioContext não expõe close() em toda versão — guardado
    if (typeof off.close === 'function') {
      const closed = off.close()
      if (closed && closed.catch) closed.catch(() => {})
    }
  } catch {
    // sem close disponível / contexto já encerrado — ok
  }
  return out
}

// Devolve Array<Float32Array> (máx. por janela, ≤2 canais) ou null em
// falha/cancelamento — o chamador mantém a forma anterior nesse caso.
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
    let done = 0 // amostras do arquivo já envelopadas
    let donePts = 0
    while (done < total) {
      if (isCancelled && isCancelled()) return null
      const len = Math.min(chunk, total - done)
      const pre = Math.min(roll, done)
      // pré-roll puro: tudo é causal, não precisa de pós-roll
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
  // Liga a cadeia ao player atual (WebAudioPlayer do wavesurfer). Chamar a
  // cada criação de player (onPlayer) — build assíncrono só pro worklet.
  attach(player) {
    if (!player) {
      chain.player = null
      chain.nodes = null
      return
    }
    if (player === chain.player) return
    if (typeof player.getGainNode !== 'function') return // backend sem WebAudioPlayer (futuro)
    // Player novo: solta o grafo antigo (o player anterior morre junto)
    if (chain.nodes && chain.nodes.player !== player) {
      try {
        chain.nodes.tap.disconnect()
      } catch {
        // já solto
      }
    }
    const tap = player.getGainNode()
    const ctx = tap.context
    chain.player = player
    chain.nodes = null
    ensureWorklet(ctx).then((ok) => {
      if (chain.player !== player) return // player trocou durante a espera
      const nodes = build(ctx, ok)
      // religa o gainNode do player NA cadeia (dry = original, wet = tratado)
      try {
        tap.disconnect()
      } catch {
        // sem conexões antigas — ok
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

  // Envelope (máx./janela por canal) do áudio TRATADO — pra redesenhar a
  // FORMA da onda. Array<Float32Array> ou null (falha/cancelado).
  renderEnvelope,
}

export default realtimeChain
