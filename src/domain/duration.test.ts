import { describe, expect, it } from 'vitest'
import { DURATIONS, formatDuration, isDuration } from './duration'

describe('DURATIONS', () => {
  it('pins the nine allowed duration values, in minutes', () => {
    expect(DURATIONS).toEqual([5, 10, 15, 20, 30, 45, 60, 90, 120])
  })
})

describe('isDuration', () => {
  it('accepts every one of the nine allowed values', () => {
    for (const value of DURATIONS) {
      expect(isDuration(value)).toBe(true)
    }
  })

  it('rejects values outside the allowed set', () => {
    for (const value of [0, 1, 25, 40, 50, 59, 61, 100, 121, 180, -5]) {
      expect(isDuration(value)).toBe(false)
    }
  })
})

describe('formatDuration', () => {
  it('formats minute-scale durations as "Xm"', () => {
    expect(formatDuration(5)).toBe('5m')
    expect(formatDuration(10)).toBe('10m')
    expect(formatDuration(15)).toBe('15m')
    expect(formatDuration(20)).toBe('20m')
    expect(formatDuration(30)).toBe('30m')
    expect(formatDuration(45)).toBe('45m')
  })

  it('formats whole-hour durations as "Xh"', () => {
    expect(formatDuration(60)).toBe('1h')
    expect(formatDuration(120)).toBe('2h')
  })

  it('formats a fractional hour as "X.Yh"', () => {
    expect(formatDuration(90)).toBe('1.5h')
  })
})
