import { createContext, useContext, useState } from 'react'

// Available themes. 'modern' is the first-installation default.
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
  // The initial value comes SYNCHRONOUSLY from the preload (electron/main.cjs
  // passes --corgi-theme via additionalArguments), and data-theme is applied
  // inside the initializer — that is, before the first paint. No "flash" of the
  // old theme when opening the app. In the browser (without window.api): 'modern'.
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
