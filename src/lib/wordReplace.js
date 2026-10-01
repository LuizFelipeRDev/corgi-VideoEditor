// Whole-token word replacement shared by the subtitle panel (live count in
// the confirm modal) and App (apply). Tokens keep their surrounding
// punctuation ("voce," -> "voce nova,"), matching can ignore case, and the
// typed replacement mirrors the original capitalization (the user fixing
// "voce" also fixes "Voce" at sentence start; "VOCE" stays shouting).

// Splits a token into leading punctuation + core word + trailing punctuation.
const TOKEN_RE = /^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u

const hasCasedLetter = (s) => s.toLowerCase() !== s.toUpperCase()

export const matchesWord = (core, before, ignoreCase) => {
  if (!core || !before) return false
  return ignoreCase ? core.toLowerCase() === before.toLowerCase() : core === before
}

// Mirrors the original token's capitalization onto the typed replacement:
// SHOUTING -> uppercase, Capitalized -> capitalize, otherwise as typed.
const matchCase = (core, after) => {
  if (!hasCasedLetter(core)) return after
  if (core.length > 1 && core === core.toUpperCase()) return after.toUpperCase()
  if (/^\p{Lu}/u.test(core)) return after.charAt(0).toUpperCase() + after.slice(1)
  return after
}

// Replaces every whole-token match of `before` in a single string.
export const replaceInText = (text, before, after, ignoreCase) => {
  if (!text || !before || !after || before === after) return text
  return text
    .split(/(\s+)/)
    .map((part) => {
      if (!part || /^\s+$/.test(part)) return part
      const m = part.match(TOKEN_RE)
      if (!m) return part
      const [, pre, core, post] = m
      if (!matchesWord(core, before, ignoreCase)) return part
      return pre + matchCase(core, after) + post
    })
    .join('')
}

const countInText = (text, before, ignoreCase) => {
  if (!text) return 0
  let count = 0
  for (const part of text.split(/\s+/)) {
    const m = part.match(TOKEN_RE)
    if (m && matchesWord(m[2], before, ignoreCase)) count++
  }
  return count
}

// Counts occurrences over what the panel displays: the word list when it
// exists (the animation source), otherwise the plain text — so the modal
// never double counts entries that hold both.
export const countInSubtitles = (subtitles, before, ignoreCase) => {
  if (!before) return 0
  let count = 0
  for (const sub of subtitles) {
    if (sub.words && sub.words.length > 0) {
      for (const w of sub.words) count += countInText(w.text, before, ignoreCase)
    } else {
      count += countInText(sub.text, before, ignoreCase)
    }
  }
  return count
}

// Pure map over the track: `text` and every `words[].text` change while the
// word timings stay untouched (only the strings move). Returns the new array
// plus the occurrence count so callers can take one undo snapshot per replace.
export const replaceInSubtitles = (subtitles, before, after, ignoreCase) => {
  const count = countInSubtitles(subtitles, before, ignoreCase)
  const next = subtitles.map((sub) => {
    const out = { ...sub }
    if (out.text) out.text = replaceInText(out.text, before, after, ignoreCase)
    if (out.words && out.words.length > 0) {
      out.words = out.words.map((w) => {
        const nt = replaceInText(w.text, before, after, ignoreCase)
        return nt === w.text ? w : { ...w, text: nt }
      })
    }
    return out
  })
  return { next, count }
}
