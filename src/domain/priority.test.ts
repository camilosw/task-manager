import { describe, expect, it } from 'vitest'
import { PRIORITIES, comparePriority } from './priority'

describe('PRIORITIES', () => {
  it('pins the five priority levels, most to least important', () => {
    expect(PRIORITIES).toEqual(['urgent', 'high', 'medium', 'low', 'very-low'])
  })
})

describe('comparePriority', () => {
  it('orders urgent, high, medium, low, very-low when used as a sort comparator', () => {
    const shuffled = ['low', 'urgent', 'very-low', 'medium', 'high'] as const
    const sorted = [...shuffled].sort(comparePriority)

    expect(sorted).toEqual(['urgent', 'high', 'medium', 'low', 'very-low'])
  })

  it('returns a negative number when the first priority is more important', () => {
    expect(comparePriority('urgent', 'low')).toBeLessThan(0)
  })

  it('returns a positive number when the first priority is less important', () => {
    expect(comparePriority('low', 'urgent')).toBeGreaterThan(0)
  })

  it('returns zero for two equal priorities, and no two distinct levels compare equal', () => {
    expect(comparePriority('medium', 'medium')).toBe(0)

    for (const a of PRIORITIES) {
      for (const b of PRIORITIES) {
        if (a !== b) {
          expect(comparePriority(a, b)).not.toBe(0)
        }
      }
    }
  })
})
