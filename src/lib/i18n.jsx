import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { DICTS, DEFAULT_LANG, normalizeLang, checkLangParity } from '../global_config/languages'

// In dev, warn if the languages have misaligned keys.!!!
if (import.meta.env && import.meta.env.DEV) checkLangParity()
  
function translate(dict, lang, key, vars) {
  let text = dict ? dict[key] : undefined
  if (text === undefined) {
    text = DICTS[DEFAULT_LANG] ? DICTS[DEFAULT_LANG][key] : undefined
    if (text === undefined) {
      console.warn(`[i18n] chave ausente em todos os idiomas: ${key}`)
      return key
    }
    console.warn(`[i18n] chave sem traducao em "${lang}": ${key}`)
  }
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.split(`{${name}}`).join(String(value))
    }
  }
  return text
}

const LanguageContext = createContext({
  lang: DEFAULT_LANG,
  setLang: () => {},
  t: (key) => key,
})

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(DEFAULT_LANG)
  const langRef = useRef(lang)
  langRef.current = lang


  useEffect(() => {
    let alive = true
    const getConfig = typeof window !== 'undefined' && window.api ? window.api.getConfig : null
    if (getConfig) {
      getConfig()
        .then((c) => {
          if (alive) setLangState(normalizeLang(c && c.language))
        })
        .catch(() => {})
    }
    return () => { alive = false }
  }, [])

  const setLang = (next) => setLangState(normalizeLang(next))

  const t = (key, vars) => translate(DICTS[langRef.current], langRef.current, key, vars)

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLang() {
  return useContext(LanguageContext)
}
