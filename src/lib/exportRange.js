// ============================================
// Export range (waveform I/O marks)
// ============================================
//
// The user marks the START (key I) and the END (key O) of the stretch they
// want to export. This module holds the pure logic: validate the marks and shift
// the subtitles to the cut's timeline (the cut file starts at 0).

// "HH:MM:SS,mmm" (SRT) → milliseconds
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

// milliseconds → "HH:MM:SS,mmm" (SRT)
export function msToSrt(ms) {
  const total = Math.max(0, Math.round(ms))
  const h = Math.floor(total / 3600000)
  const m = Math.floor((total % 3600000) / 60000)
  const s = Math.floor((total % 60000) / 1000)
  const frac = total % 1000
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(frac).padStart(3, '0')}`
}

// Validates the export marks. Returns:
//   'unset'         → no mark → exports the whole file (no cut)
//   'ok'            → start and end marked → cuts the stretch
//   'missing-start' → only the END is marked → START is missing
//   'missing-end'   → only the START is marked → END is missing
//   'bad-order'     → start marked AFTER the end
export function validateExportRange({ start, end } = {}) {
  const hasStart = start != null
  const hasEnd = end != null
  if (!hasStart && !hasEnd) return 'unset'
  if (!hasStart) return 'missing-start'
  if (!hasEnd) return 'missing-end'
  if (start >= end) return 'bad-order'
  return 'ok'
}

// Prepares the subtitles for the cut stretch's timeline: everything
// outside [startMs, endMs] is dropped, and what remains is shifted to start
// at 0 (the cut becomes the exported file's "new zero"). Subtitles that
// cross the edge are trimmed at the in/out.
export function shiftSubtitlesForRange(subtitles, startMs, endMs) {
  const out = []
  for (const sub of subtitles || []) {
    const st = srtToMs(sub.start)
    const en = srtToMs(sub.end)
    if (en <= startMs) continue // ends before the start
    if (st >= endMs) continue // starts after the end
    out.push({
      ...sub,
      start: msToSrt(Math.max(0, st - startMs)),
      end: msToSrt(Math.min(endMs - startMs, en - startMs)),
    })
  }
  return out
}
