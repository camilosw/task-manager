import { describe, expect, it, vi } from 'vitest'
import { setSystemTheme } from '../../vitest.setup'
import { readSystemTheme, subscribeToSystemTheme } from './systemTheme'

describe('readSystemTheme', () => {
  it('returns "dark" when the system reports dark', () => {
    setSystemTheme('dark')
    expect(readSystemTheme()).toBe('dark')
  })

  it('returns "light" when the system reports light', () => {
    setSystemTheme('light')
    expect(readSystemTheme()).toBe('light')
  })

  it('returns "light" when window.matchMedia is absent', () => {
    const original = window.matchMedia
    // @ts-expect-error simulating a jsdom build without matchMedia support
    delete window.matchMedia
    try {
      expect(readSystemTheme()).toBe('light')
    } finally {
      window.matchMedia = original
    }
  })
})

describe('subscribeToSystemTheme', () => {
  it('calls the callback with the new theme when the system theme changes', () => {
    setSystemTheme('light')
    const callback = vi.fn()
    subscribeToSystemTheme(callback)

    setSystemTheme('dark')

    expect(callback).toHaveBeenCalledWith('dark')
  })

  it('returns an unsubscribe function that stops further notifications', () => {
    setSystemTheme('light')
    const callback = vi.fn()
    const unsubscribe = subscribeToSystemTheme(callback)

    unsubscribe()
    setSystemTheme('dark')

    expect(callback).not.toHaveBeenCalled()
  })

  it('is a no-op returning a no-op when window.matchMedia is absent', () => {
    const original = window.matchMedia
    // @ts-expect-error simulating a jsdom build without matchMedia support
    delete window.matchMedia
    try {
      const callback = vi.fn()
      const unsubscribe = subscribeToSystemTheme(callback)

      expect(typeof unsubscribe).toBe('function')
      expect(() => unsubscribe()).not.toThrow()
      expect(callback).not.toHaveBeenCalled()
    } finally {
      window.matchMedia = original
    }
  })
})
