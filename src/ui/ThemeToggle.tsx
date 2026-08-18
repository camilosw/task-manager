import { useContext } from 'react'
import { ThemeContext } from './themeContext'

/**
 * The header's theme override control (see specs/appearance/spec.md, "The
 * user can override the theme"). Its accessible name states plainly that
 * it toggles between light and dark — not "switch to dark", which would
 * change with the current theme — so it is identifiable without sight of
 * the icon section 8 gives it later.
 *
 * Reads `ThemeContext` directly rather than through the throwing
 * `useTheme` hook, so it renders nothing — rather than crashing the shell
 * — wherever `TaskManagerApp` is exercised without a `ThemeProvider`
 * ancestor. `App.tsx` always supplies one, so this only matters for the
 * older view-suite tests (sections 5-7) that render `TaskManagerApp`
 * directly against `AppStateProvider` alone; nothing about those suites
 * changes here.
 */
export function ThemeToggle() {
  const value = useContext(ThemeContext)
  if (value === null) {
    return null
  }

  return (
    <button
      type="button"
      onClick={value.toggleTheme}
      aria-label="Toggle theme between light and dark"
    >
      {value.theme === 'dark' ? 'Dark' : 'Light'}
    </button>
  )
}
