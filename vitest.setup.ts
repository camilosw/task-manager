import { beforeEach } from 'vitest'

// Test-environment shims for two browser APIs this project's jsdom
// (jsdom@^29.1.1) does not implement: `window.matchMedia` is `undefined`,
// and `HTMLDialogElement.prototype.showModal`/`close` are `undefined`. See
// design.md, decisions 5 and 6.

// --- window.matchMedia --------------------------------------------------
//
// A controllable stub that tracks one "system theme" and answers queries
// against `(prefers-color-scheme: dark)` / `(prefers-color-scheme: light)`.
// Tests drive it with `setSystemTheme('light' | 'dark')`, which notifies
// any listener registered via `addEventListener('change', ...)` (and the
// deprecated `addListener`), the same way a real `MediaQueryList` would
// when the OS preference changes.

export type SystemTheme = 'light' | 'dark'

type ChangeListener = (event: MediaQueryListEvent) => void

let currentSystemTheme: SystemTheme = 'light'
const listenersByQuery = new Map<string, Set<ChangeListener>>()

function matchesQuery(query: string): boolean {
  if (query === '(prefers-color-scheme: dark)') {
    return currentSystemTheme === 'dark'
  }
  if (query === '(prefers-color-scheme: light)') {
    return currentSystemTheme === 'light'
  }
  return false
}

function createMediaQueryList(query: string): MediaQueryList {
  const listeners = listenersByQuery.get(query) ?? new Set<ChangeListener>()
  listenersByQuery.set(query, listeners)

  const mediaQueryList: MediaQueryList = {
    get matches() {
      return matchesQuery(query)
    },
    media: query,
    onchange: null,
    addEventListener: (
      type: string,
      listener: EventListenerOrEventListenerObject,
    ) => {
      if (type === 'change') {
        listeners.add(listener as ChangeListener)
      }
    },
    removeEventListener: (
      type: string,
      listener: EventListenerOrEventListenerObject,
    ) => {
      if (type === 'change') {
        listeners.delete(listener as ChangeListener)
      }
    },
    // Deprecated but still probed for by some feature-detection code.
    addListener: (listener) => {
      if (listener) listeners.add(listener as unknown as ChangeListener)
    },
    removeListener: (listener) => {
      if (listener) listeners.delete(listener as unknown as ChangeListener)
    },
    dispatchEvent: () => true,
  }

  return mediaQueryList
}

/**
 * Drives the `window.matchMedia` stub installed for every test. Notifies
 * every query listening for `change` so a component's own
 * `addEventListener('change', ...)` subscription fires, mirroring how the
 * OS notifies a real `MediaQueryList` when the color-scheme preference
 * changes.
 */
export function setSystemTheme(theme: SystemTheme): void {
  currentSystemTheme = theme
  for (const [query, listeners] of listenersByQuery) {
    const event = {
      matches: matchesQuery(query),
      media: query,
    } as MediaQueryListEvent
    for (const listener of listeners) {
      listener(event)
    }
  }
}

beforeEach(() => {
  currentSystemTheme = 'light'
  listenersByQuery.clear()
  window.matchMedia = ((query: string) =>
    createMediaQueryList(query)) as typeof window.matchMedia
})

// --- HTMLDialogElement.showModal / close --------------------------------
//
// Deliberately dumb: it only toggles the `open` property. The behaviors the
// specs actually pin down — focus moving into the sheet on open, focus
// returning to the trigger on close, Escape dismissing it — are implemented
// in React (not left to the browser) precisely because this shim cannot be
// trusted to do more than that. See design.md, decision 6.

if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.open = false
  }
}
