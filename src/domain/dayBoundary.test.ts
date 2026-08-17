import { describe, expect, it } from 'vitest'
import { needsRecompute, toLocalDateString } from './dayBoundary'

describe('toLocalDateString', () => {
  it('formats a date as its local calendar date, YYYY-MM-DD', () => {
    const now = new Date(2026, 7, 17, 9, 0, 0)

    expect(toLocalDateString(now)).toBe('2026-08-17')
  })

  it('zero-pads a single-digit month and day', () => {
    const now = new Date(2026, 0, 5, 23, 59, 0)

    expect(toLocalDateString(now)).toBe('2026-01-05')
  })

  it('uses the local calendar date at year end', () => {
    const now = new Date(2026, 11, 31, 0, 0, 0)

    expect(toLocalDateString(now)).toBe('2026-12-31')
  })
})

describe('needsRecompute', () => {
  const now = new Date(2026, 7, 17, 9, 0, 0)

  it('recomputes when the stored date is earlier than the current date', () => {
    expect(needsRecompute('2026-08-16', now)).toBe(true)
  })

  it('does not recompute when the stored date equals the current date', () => {
    expect(needsRecompute('2026-08-17', now)).toBe(false)
  })

  it('does not recompute when the stored date is later than the current date', () => {
    expect(needsRecompute('2026-08-18', now)).toBe(false)
  })
})
