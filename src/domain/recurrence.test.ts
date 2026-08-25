import { describe, expect, it } from 'vitest'
import {
  formatRule,
  isCompleteRule,
  occursOn,
  type RecurrenceRule,
  type RecurrenceRuleDraft,
  type Weekday,
} from './recurrence'

const ALL_WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6]

describe('occursOn', () => {
  it('is true for a weekly rule on its named weekday, and false on the other six', () => {
    const rule: RecurrenceRule = { kind: 'weekly', weekdays: [1] } // Monday

    for (const weekday of ALL_WEEKDAYS) {
      // Aug 2026: 2=Sun, 3=Mon, 4=Tue, 5=Wed, 6=Thu, 7=Fri, 8=Sat
      const date = new Date(2026, 7, 2 + weekday)
      expect(occursOn(rule, date)).toBe(weekday === 1)
    }
  })

  it('fires on every named day of a multi-day weekly rule, and on nothing else', () => {
    const rule: RecurrenceRule = { kind: 'weekly', weekdays: [1, 3] } // Mon & Wed

    for (const weekday of ALL_WEEKDAYS) {
      const date = new Date(2026, 7, 2 + weekday)
      expect(occursOn(rule, date)).toBe(weekday === 1 || weekday === 3)
    }
  })

  it('fires on the first Monday of the month, traced against Aug and Sep 2026', () => {
    const rule: RecurrenceRule = {
      kind: 'monthly-weekday',
      nth: 1,
      weekday: 1,
    }

    expect(occursOn(rule, new Date(2026, 7, 3))).toBe(true) // 3 Aug
    expect(occursOn(rule, new Date(2026, 8, 7))).toBe(true) // 7 Sep

    // The other Mondays in August are not the first Monday.
    for (const day of [10, 17, 24, 31]) {
      expect(occursOn(rule, new Date(2026, 7, day))).toBe(false)
    }
  })

  it('resolves nth: -1 to the last Monday, in a five-Monday month and a four-Monday month', () => {
    const rule: RecurrenceRule = {
      kind: 'monthly-weekday',
      nth: -1,
      weekday: 1,
    }

    // August 2026 has five Mondays: 3, 10, 17, 24, 31.
    expect(occursOn(rule, new Date(2026, 7, 31))).toBe(true)
    for (const day of [3, 10, 17, 24]) {
      expect(occursOn(rule, new Date(2026, 7, day))).toBe(false)
    }

    // September 2026 has four Mondays: 7, 14, 21, 28.
    expect(occursOn(rule, new Date(2026, 8, 28))).toBe(true)
    for (const day of [7, 14, 21]) {
      expect(occursOn(rule, new Date(2026, 8, day))).toBe(false)
    }
  })
})

describe('isCompleteRule', () => {
  it('rejects a weekly rule with no weekday selected', () => {
    const draft: RecurrenceRuleDraft = { kind: 'weekly', weekdays: [] }

    expect(isCompleteRule(draft)).toBe(false)
  })

  it('accepts a weekly rule with at least one weekday selected', () => {
    const draft: RecurrenceRuleDraft = { kind: 'weekly', weekdays: [1] }

    expect(isCompleteRule(draft)).toBe(true)
  })

  it('rejects a monthly rule missing its position', () => {
    const draft: RecurrenceRuleDraft = {
      kind: 'monthly-weekday',
      nth: undefined,
      weekday: 1,
    }

    expect(isCompleteRule(draft)).toBe(false)
  })

  it('rejects a monthly rule missing its weekday', () => {
    const draft: RecurrenceRuleDraft = {
      kind: 'monthly-weekday',
      nth: 1,
      weekday: undefined,
    }

    expect(isCompleteRule(draft)).toBe(false)
  })

  it('accepts a monthly rule with both its position and its weekday', () => {
    const draft: RecurrenceRuleDraft = {
      kind: 'monthly-weekday',
      nth: 1,
      weekday: 1,
    }

    expect(isCompleteRule(draft)).toBe(true)
  })
})

describe('formatRule', () => {
  it('renders the long form of a multi-day weekly rule', () => {
    const rule: RecurrenceRule = { kind: 'weekly', weekdays: [1, 3] } // Mon & Wed

    expect(formatRule(rule, 'long')).toBe('Repeats every Monday and Wednesday')
  })

  it('renders the long form of a monthly rule', () => {
    const rule: RecurrenceRule = {
      kind: 'monthly-weekday',
      nth: 1,
      weekday: 1,
    }

    expect(formatRule(rule, 'long')).toBe(
      'Repeats the first Monday of every month',
    )
  })

  it('renders the short form of a single-day weekly rule', () => {
    const rule: RecurrenceRule = { kind: 'weekly', weekdays: [1] }

    expect(formatRule(rule, 'short')).toBe('Every Mon')
  })

  it('renders the short form of a monthly rule', () => {
    const rule: RecurrenceRule = {
      kind: 'monthly-weekday',
      nth: 1,
      weekday: 1,
    }

    expect(formatRule(rule, 'short')).toBe('1st Mon')
  })
})
