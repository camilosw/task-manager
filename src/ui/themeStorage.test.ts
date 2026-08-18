import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readStoredTheme, storeTheme } from './themeStorage'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('readStoredTheme', () => {
  it('returns null when nothing is stored', () => {
    expect(readStoredTheme()).toBeNull()
  })

  it('returns null, rather than throwing, when localStorage access throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })

    expect(() => readStoredTheme()).not.toThrow()
    expect(readStoredTheme()).toBeNull()
  })
})

describe('storeTheme', () => {
  it('round-trips "dark" through readStoredTheme', () => {
    storeTheme('dark')
    expect(readStoredTheme()).toBe('dark')
  })

  it('round-trips "light" through readStoredTheme', () => {
    storeTheme('light')
    expect(readStoredTheme()).toBe('light')
  })

  it('does not throw when localStorage access throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })

    expect(() => storeTheme('dark')).not.toThrow()
  })
})
