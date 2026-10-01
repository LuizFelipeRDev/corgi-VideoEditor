import en from './en'
import pt from './pt'

/*
  Language registry.
  - DEFAULT_LANG: system default (English), defined in a single place.
  - DICTS: id -> key dictionary.
  - normalizeLang: accepts 'pt', 'pt-BR', 'EN', etc; unknown falls back to the default.
  - checkLangParity: guarantees every language has the same keys.
*/

export const DEFAULT_LANG = 'en'

export const DICTS = {
  en,
  pt,
}

export const LANGS = [
  { id: 'en', label: 'English' },
  { id: 'pt', label: 'Português' },
]

export function normalizeLang(value) {
  if (!value) return DEFAULT_LANG
  const v = String(value).trim().toLowerCase()
  if (DICTS[v]) return v
  if (v.startsWith('pt')) return 'pt'
  if (v.startsWith('en')) return 'en'
  return DEFAULT_LANG
}

export function checkLangParity() {
  const baseKeys = Object.keys(DICTS[DEFAULT_LANG] || {})
  const problems = []
  for (const { id } of LANGS) {
    const keys = Object.keys(DICTS[id] || {})
    const missing = baseKeys.filter((k) => !keys.includes(k))
    const extra = keys.filter((k) => !baseKeys.includes(k))
    if (missing.length) problems.push(`[${id}] faltando: ${missing.join(', ')}`)
    if (extra.length) problems.push(`[${id}] sobrando: ${extra.join(', ')}`)
  }
  if (problems.length) console.warn('[i18n] paridade de chaves quebrada —', problems.join(' | '))
  return problems
}
