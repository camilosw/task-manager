import { createContext } from 'react'
import type { SystemTheme } from './systemTheme'

/**
 * The value `ThemeProvider` publishes and `useTheme`/`ThemeToggle` read.
 * `theme` is the *resolved* theme — always `'light'` or `'dark'`, never a
 * third "system" value — and `toggleTheme` makes (and persists) an
 * explicit choice for the opposite of whatever is currently resolved (see
 * design.md, decision 2 and decision 4).
 */
export type ThemeContextValue = {
  theme: SystemTheme
  toggleTheme: () => void
}

/**
 * The context `ThemeProvider` populates and `useTheme` reads. `null` only
 * when there is no provider above in the tree.
 */
export const ThemeContext = createContext<ThemeContextValue | null>(null)
