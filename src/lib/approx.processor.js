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
// Teto de SEGURANÇA: a prévia nunca entrega acima de AGC_HEADROOM× o alvo.
// O alvo sai de um env que pode estar DEFASADO do que toca agora (silêncio→
// voz, ou env/gain congelados de uma parada/grafo recriado = o "primeiro
// segundo estourado" da prévia: o ganho corria pra lá com τ≈1 s). No
// estacionário level≈env e o teto fica 1.5× acima do alvo — nunca limita o
// que é normal.
const AGC_HEADROOM = 1.5
// Trava DURA por bloco (RMS instantâneo): cobre a janela em que o `level`
// ainda não pegou o salto do sinal (1º bloco de um salto) ou o ganho veio
// enorme de uma sessão anterior. Só engata acima de ~4× o alvo — picos
// normais de fala passam livres.
const AGC_HARD = 4

class CorgiApproxProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.mode = 'gate'
    this.on = true
    this.threshold = dbToLin(-35) // gate: abre quando o sinal passa disto
    this.targetRms = 0.2           // agc: alvo de RMS (~ lufs + 2 dBFS)
    this.env = 0                   // envelope do sinal (gate) / loudness (agc)
    this.level = 0                 // agc: nível RÁPIDO do sinal (só o teto)
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
    // Nível do sinal AGORA (ataque 5 ms / release 100 ms) — só alimenta o
    // teto de segurança abaixo; não entra no cálculo do alvo normal.
    this.level += (rms - this.level) * (rms > this.level ? 1 - Math.exp(-block / 0.005) : 1 - Math.exp(-block / 0.1))
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
    let target = !this.on
      ? 1
      : // Silêncio: alvo calculado de um env≈0 estouraria no teto e inflaria
        // o ganho — a voz entraria multiplicada. Congela no valor atual.
        this.env < AGC_FLOOR
        ? this.gain
        : Math.min(16, Math.max(0.05, this.targetRms / this.env))
    // Teto de segurança (só com o AGC ligado): o alvo sai de um env que pode
    // estar DEFASADO do que toca agora — silêncio→voz, ou env/gain congelados
    // de uma parada (depois de "algum tempo" parado) => o ganho corria pra lá
    // com τ≈1 s e o primeiro segundo saía estourado. No estacionário
    // level≈env e o teto fica ~1.5× acima do alvo — nunca limita o normal.
    let cap = Infinity
    if (this.on) {
      cap = (this.targetRms * AGC_HEADROOM) / Math.max(this.level, AGC_FLOOR)
      if (target > cap) target = cap
    }
    let from = this.gain
    // sobe τ=1 s (normal); desce τ=150 ms — e τ=30 ms enquanto estiver ACIMA
    // do teto: lá o env ainda não pegou o nível real e deixar correr a
    // τ=1 s é exatamente o "primeiro segundo estourado".
    const overCap = this.gain > cap
    const tau = target > this.gain ? 1.0 : overCap ? 0.03 : 0.15
    this.gain += (target - this.gain) * (1 - Math.exp(-block / tau))
    // Trava DURA no ganho do bloco: RMS instantâneo, vale mesmo no primeiro
    // bloco do salto (o level ainda não alcançou) e com ganho herdado de uma
    // sessão anterior (ex.: ×16 de um trecho calmo). `from` também: a
    // interpolação do bloco inteiro tem que nascer já travada.
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
