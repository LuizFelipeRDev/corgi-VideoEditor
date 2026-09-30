// ============================================
// Faixa de exportação (marcas I/O da onda)
// ============================================
//
// O usuário marca o INÍCIO (tecla I) e o FIM (tecla O) do trecho que quer
// exportar. Este módulo tem a lógica pura: validar as marcas e deslocar as
// legendas para a timeline do recorte (o arquivo cortado começa em 0).

// "HH:MM:SS,mmm" (SRT) → milissegundos
export function srtToMs(str) {
  if (typeof str !== 'string') return 0
  const m = str.match(/(\d+):(\d{2}):(\d{2})[,.](\d{1,3})/)
  if (!m) return 0
  return (
    Number(m[1]) * 3600000 +
    Number(m[2]) * 60000 +
    Number(m[3]) * 1000 +
    Number(m[4].padEnd(3, '0'))
  )
}

// milissegundos → "HH:MM:SS,mmm" (SRT)
export function msToSrt(ms) {
  const total = Math.max(0, Math.round(ms))
  const h = Math.floor(total / 3600000)
  const m = Math.floor((total % 3600000) / 60000)
  const s = Math.floor((total % 60000) / 1000)
  const frac = total % 1000
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(frac).padStart(3, '0')}`
}

// Valida as marcas do export. Retorna:
//   'unset'         → nenhuma marca → exporta o arquivo inteiro (sem recorte)
//   'ok'            → início e fim marcados → recorta o trecho
//   'missing-start' → só o FIM está marcado → falta o INÍCIO
//   'missing-end'   → só o INÍCIO está marcado → falta o FIM
//   'bad-order'     → início marcado DEPOIS do fim
export function validateExportRange({ start, end } = {}) {
  const hasStart = start != null
  const hasEnd = end != null
  if (!hasStart && !hasEnd) return 'unset'
  if (!hasStart) return 'missing-start'
  if (!hasEnd) return 'missing-end'
  if (start >= end) return 'bad-order'
  return 'ok'
}

// Prepara as legendas para a timeline do trecho recortado: tudo que estiver
// fora de [startMs, endMs] sai, e o que sobra é deslocado para começar em 0
// (o recorte vira o "novo zero" do arquivo exportado). Legendas que cruzam a
// borda são aparadas na entrada/saída.
export function shiftSubtitlesForRange(subtitles, startMs, endMs) {
  const out = []
  for (const sub of subtitles || []) {
    const st = srtToMs(sub.start)
    const en = srtToMs(sub.end)
    if (en <= startMs) continue // termina antes do início
    if (st >= endMs) continue // começa depois do fim
    out.push({
      ...sub,
      start: msToSrt(Math.max(0, st - startMs)),
      end: msToSrt(Math.min(endMs - startMs, en - startMs)),
    })
  }
  return out
}
