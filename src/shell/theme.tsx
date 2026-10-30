import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type ThemeName = 'light' | 'dark'

const STORAGE_KEY = 'theme'

function readTheme(): ThemeName {
  const current = document.documentElement.getAttribute('data-theme')
  if (current === 'dark' || current === 'light') return current
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'dark' || stored === 'light') return stored
  } catch {
    // 無法讀取時用淺色。
  }
  return 'light'
}

type ThemeContextValue = {
  theme: ThemeName
  setTheme: (theme: ThemeName) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>(readTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    const surface = getComputedStyle(document.documentElement).getPropertyValue('--color-surface').trim()
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', surface)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // 隱私模式可能拒絕寫入。
    }
  }, [theme])

  const value: ThemeContextValue = {
    theme,
    setTheme,
    toggleTheme: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme 必須在 ThemeProvider 內使用')
  return value
}
