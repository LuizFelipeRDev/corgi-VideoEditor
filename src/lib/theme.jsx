import { createContext, useContext, useState } from 'react'

// Temas disponiveis. 'modern' e o padrao da primeira instalacao.
const THEMES = ['retro', 'modern']

export const normalizeTheme = (value) => (THEMES.includes(value) ? value : 'modern')

const ThemeContext = createContext({
  theme: 'modern',
  setTheme: () => {},
})

function applyTheme(theme) {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = theme
  }
}

export function ThemeProvider({ children }) {
  // O valor inicial vem SINCRONO do preload (electron/main.cjs passa
  // --corgi-theme via additionalArguments), e o data-theme e aplicado dentro
  // do initializer — ou seja, antes do primeiro paint. Sem "flash" do tema
  // antigo ao abrir o app. No navegador (sem window.api) cai em 'modern'.
  const [theme, setThemeState] = useState(() => {
    const initial = normalizeTheme(
      typeof window !== 'undefined' && window.api ? window.api.initialTheme : null,
    )
    applyTheme(initial)
    return initial
  })

  const setTheme = (next) => {
    const normalized = normalizeTheme(next)
    applyTheme(normalized)
    setThemeState(normalized)
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
