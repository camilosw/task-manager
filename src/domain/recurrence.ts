/**
 * A day of the week, matching `Date#getDay`'s numbering: `0` is Sunday
 * through `6` Saturday (see design.md, decision 5). `occursOn` compares
 * directly against `date.getDay()`, so there is no conversion layer to get
 * backwards.
 */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

/**
 * A position within the month for the "Nth weekday" rule: the first through
 * fourth occurrence, or `-1` for the last — whichever weekday it falls on
 * and whether the month holds four or five of them (see
 * specs/recurring-tasks/spec.md, "A monthly rule on the last weekday of the
 * month"). `-1` is the standard encoding (iCalendar spells it `BYDAY=-1MO`)
 * and avoids a separate "monthly-last-weekday" rule kind (see design.md,
 * decision 5).
 */
export type Nth = 1 | 2 | 3 | 4 | -1

/**
 * A repetition rule, exactly one of two kinds (see
 * specs/recurring-tasks/spec.md, "The repetition rules that can be
 * expressed"):
 *
 * - `weekly` fires on every named day of the week, every week. `weekdays`
 *   is a list, not a single day, so "every Monday and Wednesday" costs
 *   nothing beyond naming two days.
 * - `monthly-weekday` fires once a month, on the `nth` occurrence of
 *   `weekday` within that month.
 *
 * No other kind — repetition by day of the month, other intervals, start or
 * end dates, occurrence counts — is expressible (see design.md, decision 5,
 * and Non-Goals).
 */
export type RecurrenceRule =
  | { kind: 'weekly'; weekdays: Weekday[] }
  | { kind: 'monthly-weekday'; nth: Nth; weekday: Weekday }

/**
 * A repetition rule as it exists mid-build — in the rule builder before the
 * user has finished choosing, or wherever a rule needs to be checked for
 * completeness before it is trusted as a `RecurrenceRule`. The `weekly`
 * shape is identical to `RecurrenceRule`'s (an empty `weekdays` list is
 * already a valid, if incomplete, value); the `monthly-weekday` shape
 * additionally allows `nth` and `weekday` to be unset (see
 * specs/recurring-tasks/spec.md, "An incomplete rule is rejected").
 */
export type RecurrenceRuleDraft =
  | { kind: 'weekly'; weekdays: Weekday[] }
  | {
      kind: 'monthly-weekday'
      nth: Nth | undefined
      weekday: Weekday | undefined
    }

/**
 * Whether `draft` is complete enough to be a valid `RecurrenceRule`: a
 * weekly rule naming at least one day of the week, or a monthly rule naming
 * both its position and its weekday (see specs/recurring-tasks/spec.md,
 * "The repetition rules that can be expressed" — "A rule of the first kind
 * naming no day of the week SHALL be rejected, as SHALL a rule of the
 * second kind missing either its position or its weekday").
 */
export function isCompleteRule(
  draft: RecurrenceRuleDraft,
): draft is RecurrenceRule {
  if (draft.kind === 'weekly') {
    return draft.weekdays.length > 0
  }

  return draft.nth !== undefined && draft.weekday !== undefined
}

/**
 * Returns `true` when `rule` produces an occurrence on `date`'s local
 * calendar date. A pure function of a rule and a date — nothing is
 * generated, queued, or written when an occurrence arrives (see design.md,
 * decision 1). Uses `Date`'s local getters, never UTC, in keeping with
 * `toLocalDateString` and the local-time-zone day boundary the daily-plan
 * capability already defines.
 */
export function occursOn(rule: RecurrenceRule, date: Date): boolean {
  const weekday = date.getDay() as Weekday

  if (rule.kind === 'weekly') {
    return rule.weekdays.includes(weekday)
  }

  if (weekday !== rule.weekday) {
    return false
  }

  return rule.nth === -1
    ? isLastOccurrenceInMonth(date)
    : occurrenceIndexInMonth(date) === rule.nth
}

/**
 * Which occurrence of its weekday `date` is within its month: `1` for the
 * first, `2` for the second, and so on.
 */
function occurrenceIndexInMonth(date: Date): number {
  return Math.floor((date.getDate() - 1) / 7) + 1
}

/**
 * Whether `date` is the last occurrence of its weekday within its month —
 * true whether the month holds four or five of them (see
 * specs/recurring-tasks/spec.md, "A monthly rule on the last weekday of the
 * month").
 */
function isLastOccurrenceInMonth(date: Date): boolean {
  const daysInMonth = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
  ).getDate()
  return date.getDate() + 7 > daysInMonth
}

const WEEKDAY_NAMES: Record<Weekday, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
}

const WEEKDAY_SHORT_NAMES: Record<Weekday, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
}

function nthName(nth: Nth): string {
  switch (nth) {
    case 1:
      return 'first'
    case 2:
      return 'second'
    case 3:
      return 'third'
    case 4:
      return 'fourth'
    case -1:
      return 'last'
  }
}

function nthShortName(nth: Nth): string {
  switch (nth) {
    case 1:
      return '1st'
    case 2:
      return '2nd'
    case 3:
      return '3rd'
    case 4:
      return '4th'
    case -1:
      return 'last'
  }
}

/**
 * Joins a list of names the way ordinary English prose does: "Monday" for
 * one, "Monday and Wednesday" for two, "Monday, Wednesday and Friday" for
 * three or more.
 */
function joinNames(names: string[]): string {
  if (names.length === 1) {
    return names[0]
  }
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/**
 * Renders a plain-language description of `rule`: the `'long'` form is a
 * full sentence fragment for the confirmation echo below the rule builder
 * ("Repeats every Monday and Wednesday", "Repeats the first Monday of every
 * month"), and the `'short'` form is a compact badge for a task row
 * ("Every Mon", "1st Mon") (see design.md, decision 11, and
 * specs/task-views/spec.md).
 */
export function formatRule(
  rule: RecurrenceRule,
  style: 'long' | 'short',
): string {
  if (style === 'long') {
    if (rule.kind === 'weekly') {
      const days = joinNames(rule.weekdays.map((day) => WEEKDAY_NAMES[day]))
      return `Repeats every ${days}`
    }
    return `Repeats the ${nthName(rule.nth)} ${WEEKDAY_NAMES[rule.weekday]} of every month`
  }

  if (rule.kind === 'weekly') {
    const days = joinNames(rule.weekdays.map((day) => WEEKDAY_SHORT_NAMES[day]))
    return `Every ${days}`
  }
  return `${nthShortName(rule.nth)} ${WEEKDAY_SHORT_NAMES[rule.weekday]}`
}
