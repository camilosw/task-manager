/**
 * The device's system color-scheme preference: light or dark. Every read of
 * `window.matchMedia` in the application goes through this module, which
 * feature-detects it and falls back to `'light'` when it is absent — this
 * project's jsdom does not implement `matchMedia` at all (see design.md,
 * decision 5) — so no component crashes under test.
 */
export type SystemTheme = 'light' | 'dark'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function matchMediaIsSupported(): boolean {
  return (
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  )
}

/**
 * Reads the device's current system color-scheme preference. Reports
 * `'light'` when `window.matchMedia` is unavailable, rather than throwing.
 */
export function readSystemTheme(): SystemTheme {
  if (!matchMediaIsSupported()) {
    return 'light'
  }
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

/**
 * Subscribes to changes in the device's system color-scheme preference,
 * calling `callback` with the new theme whenever it changes (see
 * specs/appearance/spec.md, "The system preference changes with no
 * explicit choice recorded"). Returns an unsubscribe function.
 *
 * When `window.matchMedia` is unavailable, subscribing is a no-op: the
 * callback is never called, and the returned unsubscribe function does
 * nothing.
 */
export function subscribeToSystemTheme(
  callback: (theme: SystemTheme) => void,
): () => void {
  if (!matchMediaIsSupported()) {
    return () => {}
  }

  const mediaQueryList = window.matchMedia(DARK_QUERY)
  const listener = (event: MediaQueryListEvent) => {
    callback(event.matches ? 'dark' : 'light')
  }

  mediaQueryList.addEventListener('change', listener)
  return () => {
    mediaQueryList.removeEventListener('change', listener)
  }
}
