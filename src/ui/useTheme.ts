import { useContext } from 'react'
import { ThemeContext, type ThemeContextValue } from './themeContext'

/**
 * Reads the resolved theme and the `toggleTheme` action from the nearest
 * `ThemeProvider`. Throws when used outside one, since there is no
 * sensible fallback theme to report (mirrors `useAppState`'s contract for
 * `AppStateProvider`).
 */
export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext)
  if (value === null) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return value
}
