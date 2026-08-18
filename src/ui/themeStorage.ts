import type { SystemTheme } from './systemTheme'

/**
 * The `localStorage` key an explicit theme choice is stored under.
 *
 * This literal is duplicated in `index.html`'s inline anti-flash script,
 * which cannot import this module because it must run, synchronously,
 * before the app's JavaScript loads (see design.md, decision 4). If this
 * key ever changes, update the literal there too.
 */
export const THEME_STORAGE_KEY = 'task-manager:theme'

/** An explicit theme choice, as stored on the device. */
export type StoredTheme = SystemTheme

/**
 * Reads the user's explicit theme choice, if any. Returns `null` both when
 * nothing has been stored and when `localStorage` itself is inaccessible
 * (e.g. Safari private mode, storage disabled) — in either case the
 * caller falls back to the system preference (see design.md, decision 4
 * and its `localStorage`-can-throw risk).
 */
export function readStoredTheme(): StoredTheme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

/**
 * Persists an explicit theme choice. Failures are swallowed: a theme that
 * fails to persist must never prevent the app from working for the
 * session — it just won't survive a reload (see design.md, decision 4).
 */
export function storeTheme(theme: StoredTheme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // localStorage can throw (Safari private mode, storage disabled). The
    // toggle still works for this session.
  }
}
