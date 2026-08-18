import { useEffect, useState, type ReactNode } from 'react'
import {
  readSystemTheme,
  subscribeToSystemTheme,
  type SystemTheme,
} from './systemTheme'
import { readStoredTheme, storeTheme } from './themeStorage'
import { ThemeContext } from './themeContext'

const THEME_COLOR_META_SELECTOR = 'meta[name="theme-color"]'

// Mirrors the `--bg` token that `src/styles/tokens.css` (section 8) will
// declare (design.md, decision 2's palette table). Duplicated here as a
// literal because that stylesheet doesn't exist yet and this provider
// can't read a CSS custom property before it does; if `--bg` ever changes,
// update these two values too.
const THEME_COLOR: Record<SystemTheme, string> = {
  light: 'oklch(0.985 0.003 250)',
  dark: 'oklch(0.19 0.012 260)',
}

export type ThemeProviderProps = {
  children: ReactNode
}

/**
 * Resolves and owns the application's theme (see design.md, decision 2):
 * three states — no explicit choice (follow the system), an explicit
 * `'light'`, and an explicit `'dark'` — expressed as the presence or
 * absence of a `data-theme` attribute on `<html>`. That attribute is the
 * whole hand-off to CSS: `src/styles/tokens.css` (section 8) resolves the
 * right palette from it, and from the system `prefers-color-scheme` media
 * query, purely through the cascade.
 *
 * - **No explicit choice stored**: `data-theme` is absent, the resolved
 *   theme tracks `readSystemTheme()`, and a `subscribeToSystemTheme`
 *   listener keeps it live for as long as no explicit choice is made (see
 *   specs/appearance/spec.md, "The system preference changes with no
 *   explicit choice recorded").
 * - **An explicit choice stored, or made via `toggleTheme`**: `data-theme`
 *   is set to that value and the live system preference is ignored until
 *   the choice changes again (see "An explicit choice outranks a later
 *   system change" and "The override survives a reload" — the latter
 *   falls out of `readStoredTheme()` being read fresh on every mount).
 *
 * Also keeps the single `<meta name="theme-color">` tag's `content` in
 * sync with the resolved theme (design.md, decision 12: one meta tag, not
 * two media-scoped ones, so an explicit choice can disagree with the
 * system preference and still control the browser chrome). The tag is
 * created if the document doesn't already have one, which lets this
 * provider be exercised on its own under test; once section 9 adds the
 * static tag to `index.html`, this finds and reuses it instead of
 * appending a duplicate.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const [explicitTheme, setExplicitTheme] = useState<SystemTheme | null>(() =>
    readStoredTheme(),
  )
  const [systemTheme, setSystemTheme] = useState<SystemTheme>(() =>
    readSystemTheme(),
  )

  const theme = explicitTheme ?? systemTheme

  // Only follow the live system preference while there is no explicit
  // choice: an explicit choice must outrank every later system change,
  // not just the value read at mount.
  useEffect(() => {
    if (explicitTheme !== null) {
      return
    }
    return subscribeToSystemTheme(setSystemTheme)
  }, [explicitTheme])

  // The only effect that writes `data-theme`, and it depends only on
  // `explicitTheme` — not on `theme` — so a live system-preference change
  // (handled by the effect above, and by the cascade in tokens.css) never
  // triggers a write here. That is what keeps the "no explicit choice"
  // state attribute-free end to end.
  useEffect(() => {
    const root = document.documentElement
    if (explicitTheme === null) {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', explicitTheme)
    }
  }, [explicitTheme])

  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>(
      THEME_COLOR_META_SELECTOR,
    )
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'theme-color')
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', THEME_COLOR[theme])
  }, [theme])

  function toggleTheme() {
    const next: SystemTheme = theme === 'dark' ? 'light' : 'dark'
    storeTheme(next)
    setExplicitTheme(next)
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
