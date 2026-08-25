import { describe, expect, it } from 'vitest'
import {
  formatRule,
  isCompleteRule,
  isDue,
  lastDueDate,
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

describe('lastDueDate', () => {
  it('returns the most recent occurrence on or before the given date', () => {
    const rule: RecurrenceRule = { kind: 'weekly', weekdays: [1] } // Monday
    // Mondays in Aug 2026: 3, 10, 17, 24, 31. Sun 16 Aug is between two.
    expect(lastDueDate(rule, '2026-08-01', '2026-08-16')).toBe('2026-08-10')
  })

  it('never returns a date earlier than the creation date', () => {
    const rule: RecurrenceRule = { kind: 'weekly', weekdays: [1] } // Monday
    // Created Sat 22 Aug 2026. The preceding Monday, 17 Aug, predates
    // creation and must not count, and no Monday falls between creation
    // and Sun 23 Aug.
    expect(lastDueDate(rule, '2026-08-22', '2026-08-23')).toBeNull()
  })

  it('returns null when no occurrence has happened since creation', () => {
    const rule: RecurrenceRule = { kind: 'weekly', weekdays: [3] } // Wednesday
    // Created Mon 24 Aug 2026; asked about Tue 25 Aug — no Wednesday yet.
    expect(lastDueDate(rule, '2026-08-24', '2026-08-25')).toBeNull()
  })

  it('terminates and returns null for a rule that cannot fire within its bounded search window', () => {
    // An incomplete weekly rule (no weekdays) never fires. Reachable only by
    // bypassing isCompleteRule, but the search still has to terminate
    // rather than walk day by day all the way back to a creation date
    // decades in the past (see design.md, Risks).
    const rule: RecurrenceRule = { kind: 'weekly', weekdays: [] }
    expect(lastDueDate(rule, '2000-01-01', '2026-08-25')).toBeNull()
  })
})

describe('isDue', () => {
  it('traces the due-ness cycle for a weekly Monday rule created on its own first occurrence', () => {
    // specs/recurring-tasks/spec.md, "Due-ness traced across a cycle":
    // "Weekly review", every Monday, created Mon 10 Aug 2026.
    const rule: RecurrenceRule = { kind: 'weekly', weekdays: [1] }
    const createdOn = '2026-08-10'

    expect(isDue(rule, createdOn, null, '2026-08-10')).toBe(true) // due
    expect(isDue(rule, createdOn, '2026-08-10', '2026-08-10')).toBe(false) // completed same day
    expect(isDue(rule, createdOn, '2026-08-10', '2026-08-11')).toBe(false) // Tue
    expect(isDue(rule, createdOn, '2026-08-10', '2026-08-16')).toBe(false) // Sun
    expect(isDue(rule, createdOn, '2026-08-10', '2026-08-17')).toBe(true) // Mon, due again
  })

  it('is not due on the days before its first occurrence after creation, and due once that occurrence arrives', () => {
    // specs/recurring-tasks/spec.md, "An occurrence before the task
    // existed does not make it due": created Sat 22 Aug 2026.
    const rule: RecurrenceRule = { kind: 'weekly', weekdays: [1] }
    const createdOn = '2026-08-22'

    expect(isDue(rule, createdOn, null, '2026-08-22')).toBe(false) // Sat
    expect(isDue(rule, createdOn, null, '2026-08-23')).toBe(false) // Sun
    expect(isDue(rule, createdOn, null, '2026-08-24')).toBe(true) // Mon
  })

  it('is due the same day when created on one of its own occurrence dates', () => {
    // specs/recurring-tasks/spec.md, "A task created on one of its own
    // occurrence dates is due at once".
    const rule: RecurrenceRule = { kind: 'weekly', weekdays: [1] }
    expect(isDue(rule, '2026-08-24', null, '2026-08-24')).toBe(true)
  })

  it('keeps a missed occurrence due on every later date until the task is completed', () => {
    // specs/recurring-tasks/spec.md, "The application was not opened on
    // the occurrence date": last completed 17 Aug, occurrence of 24 Aug
    // missed entirely.
    const rule: RecurrenceRule = { kind: 'weekly', weekdays: [1] }
    const createdOn = '2026-08-10'
    const lastCompletedOn = '2026-08-17'

    expect(isDue(rule, createdOn, lastCompletedOn, '2026-08-25')).toBe(true)
    expect(isDue(rule, createdOn, lastCompletedOn, '2026-08-26')).toBe(true)
  })

  it('is not due the day after a late completion, and becomes due again only at the next occurrence', () => {
    // specs/recurring-tasks/spec.md, "Completing late, then recalculating
    // the next day": completed Tue 25 Aug, the day after the missed 24 Aug
    // occurrence.
    const rule: RecurrenceRule = { kind: 'weekly', weekdays: [1] }
    const createdOn = '2026-08-10'
    const lastCompletedOn = '2026-08-25'

    expect(isDue(rule, createdOn, lastCompletedOn, '2026-08-26')).toBe(false) // Wed
    expect(isDue(rule, createdOn, lastCompletedOn, '2026-08-31')).toBe(true) // next Mon
  })

  it('presents three consecutive missed Mondays as exactly one due task', () => {
    // specs/recurring-tasks/spec.md, "Three missed Mondays are one pending
    // item": last completed 3 Aug, then 10, 17, and 24 Aug all missed.
    const rule: RecurrenceRule = { kind: 'weekly', weekdays: [1] }
    const createdOn = '2026-08-03'
    const lastCompletedOn = '2026-08-03'

    expect(isDue(rule, createdOn, lastCompletedOn, '2026-08-24')).toBe(true)
    // isDue answers a single boolean and lastDueDate a single date — there
    // is no list or count of the missed occurrences to expose.
    expect(lastDueDate(rule, createdOn, '2026-08-24')).toBe('2026-08-24')
  })

  it('clears every missed occurrence with a single completion, due again only at the next occurrence', () => {
    // specs/recurring-tasks/spec.md, "One completion clears every missed
    // occurrence": completing on 24 Aug clears 10, 17, and 24 Aug at once.
    const rule: RecurrenceRule = { kind: 'weekly', weekdays: [1] }
    const createdOn = '2026-08-03'
    const lastCompletedOn = '2026-08-24'

    expect(isDue(rule, createdOn, lastCompletedOn, '2026-08-30')).toBe(false)
    expect(isDue(rule, createdOn, lastCompletedOn, '2026-08-31')).toBe(true) // next Mon
  })
})
