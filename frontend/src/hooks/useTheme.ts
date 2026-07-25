import { useState, useEffect } from 'react'

export type Theme = 'dark' | 'light'

export function useTheme() {
  const [theme] = useState<Theme>('light')

  useEffect(() => {
    document.documentElement.dataset.theme = 'light'
    localStorage.setItem('qontint-theme', 'light')
  }, [])

  const toggleTheme = () => {
    // Disabled
  }

  const setTheme = (_newTheme: Theme) => {
    // Disabled
  }

  return { theme, toggleTheme, setTheme }
}
