// AudioWorklet da prévia em TEMPO REAL (v1.8.0 — "A/B instantâneo").
// Importado como TEXTO (?raw) e servido via Blob URL: assim funciona igual em
// dev (http://localhost) e no build (file://), sem depender de addModule(file).
//
// Aproxima na AUDIÇÃO o que o ffmpeg faz no export e que o Web Audio puro não
// tem — dois processadores, um por instância (via `mode`):
//   'gate' ≈ afftdn  — reduz o leito de RUÍDO quando o sinal cai (silêncios)
//   'agc'  ≈ loudnorm — segura o loudness perto do alvo (volume uniforme)
// O EXPORT continua usando o ffmpeg exato; isto aqui é só pra decidir rápido.

const dbToLin = (db) => Math.pow(10, db / 20)
// Abaixo de -60 dBFS nao existe "conteudo pra normalizar" — e silencio (ou o
// ruido ja cortado pelo gate). Com env no silencio o alvo (targetRms/env)
// explodiria e inflaria o ganho; melhor congelar.
const AGC_FLOOR = dbToLin(-60)

class CorgiApproxProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.mode = 'gate'
    this.on = true
    this.threshold = dbToLin(-35) // gate: abre quando o sinal passa disto
    this.targetRms = 0.2           // agc: alvo de RMS (~ lufs + 2 dBFS)
    this.env = 0                   // envelope do sinal (gate) / loudness (agc)
    this.gain = 1                  // ganho suavizado aplicado
    this.warmed = false            // agc: primeiro bloco ainda nao mediu nada
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

  // ≈ afftdn: abre rápido quando a voz entra (sem "tick"), fecha devagar e de
  // forma CONSERVADORA (~ -34 dB) — aproxima o corte espectral do ffmpeg.
  processGate(input, output, n) {
    const atk = 1 - Math.exp(-1 / (sampleRate * 0.003))
    const rel = 1 - Math.exp(-1 / (sampleRate * 0.12))
    const gOpen = 0.02    // ganho sobe em ~3 ms
    const gClose = 0.0006 // ganho desce em ~35 ms (release sem clique)
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

  // ≈ loudnorm: RMS lento (por bloco) → ganho na direção do alvo — sobe
  // devagar, desce rápido nos picos — interpolado entre blocos (sem zipper).
  processAgc(input, output, n) {
    let sum = 0
    for (let i = 0; i < n; i++) sum += input[0][i] * input[0][i]
    const rms = Math.sqrt(sum / n)
    const block = n / sampleRate
    if (this.warmed) {
      this.env += (rms - this.env) * (rms > this.env ? 1 - Math.exp(-block / 0.4) : 1 - Math.exp(-block / 1.5))
    } else {
      // 1º bloco mede de verdade. Partir de env=0 faria targetRms/1e-4 =
      // teto de ×16 e o ganho corria pra lá (τ≈1 s) => o "primeiro segundo
      // muito alto" na primeira ativação de um ajuste de áudio (o env só
      // existe enquanto áudio flui pelo worklet; antes do primeiro play ele
      // ainda está congelado no zero).
      this.env = rms
      this.warmed = true
    }
    const target = !this.on
      ? 1
      : // Silêncio: alvo calculado de um env≈0 estouraria no teto e inflaria
        // o ganho — a voz entraria multiplicada. Congela no valor atual.
        this.env < AGC_FLOOR
        ? this.gain
        : Math.min(16, Math.max(0.05, this.targetRms / this.env))
    const from = this.gain
    this.gain += (target - this.gain) * (target > this.gain ? 1 - Math.exp(-block / 1.0) : 1 - Math.exp(-block / 0.15))
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
