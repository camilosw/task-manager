/**
 * A day of the week, matching `Date#getDay`'s numbering: `0` is Sunday
 * through `6` Saturday (see design.md, decision 5). `occursOn` compares
 * directly against `date.getDay()`, so there is no conversion layer to get
 * backwards.
 */
import type { Task } from './task'

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
 * Parses a local calendar date string (`YYYY-MM-DD`, as produced by
 * `toLocalDateString`) into a `Date` at local midnight. Splits and
 * reconstructs via `Date`'s local constructor rather than
 * `new Date(dateString)`, which parses a bare `YYYY-MM-DD` string as UTC
 * midnight and can shift the calendar date near a time-zone boundary — the
 * same reason `toLocalDateString` (see `./dayBoundary`) avoids
 * `toISOString`.
 */
function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/**
 * Formats `date` as `YYYY-MM-DD` in local time. Duplicates
 * `./dayBoundary`'s `toLocalDateString` rather than importing it, keeping
 * the domain's recurrence math free of a cross-file dependency for a
 * three-line date format; both are kept in sync by
 * `src/domain/dayBoundary.test.ts` and the scenarios below.
 */
function formatLocalDate(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * How many days `lastDueDate` walks backward from `today` before giving up.
 * Every valid `RecurrenceRule` produces an occurrence at least this often —
 * at most a week for `weekly`, at most about five weeks for
 * `monthly-weekday` (the "fourth"/"last" positions, which can land up to
 * roughly five weeks apart across a month boundary) — so this window never
 * clips a real occurrence. It exists to keep the walk bounded even when the
 * task's creation date is far in the past, or when a rule that cannot fire
 * at all (an incomplete `weekly` draft with no weekdays, reachable only by
 * bypassing `isCompleteRule`) is passed in: the walk must stop and answer
 * "no occurrence" rather than loop until it reaches the creation date or
 * hang the render (see design.md, Risks — "the walk must be bounded
 * explicitly rather than looping until it finds a match").
 */
const SEARCH_WINDOW_DAYS = 60

/**
 * The most recent date on or before `today`, and on or after `createdOn`,
 * on which `rule` produces an occurrence — or `null` when no such date
 * exists. Dates are local calendar-date strings (`YYYY-MM-DD`), matching
 * `toLocalDateString`'s format, so the whole feature shares the daily
 * plan's local-time-zone day boundary with no second notion of "what day it
 * is" (see design.md, decision 2).
 *
 * The `createdOn` floor is load-bearing: occurrences are counted only from
 * the task's creation date onward, because the task did not exist before
 * then (see specs/recurring-tasks/spec.md, "When a recurring task is due").
 * The walk additionally never looks back further than
 * `SEARCH_WINDOW_DAYS`, whichever of the two floors is later — see that
 * constant's comment for why the bound is safe for every valid rule.
 */
export function lastDueDate(
  rule: RecurrenceRule,
  createdOn: string,
  today: string,
): string | null {
  const createdOnDate = parseLocalDate(createdOn)
  const cursor = parseLocalDate(today)

  const windowFloor = parseLocalDate(today)
  windowFloor.setDate(windowFloor.getDate() - SEARCH_WINDOW_DAYS)

  const floor = createdOnDate > windowFloor ? createdOnDate : windowFloor

  while (cursor >= floor) {
    if (occursOn(rule, cursor)) {
      return formatLocalDate(cursor)
    }
    cursor.setDate(cursor.getDate() - 1)
  }

  return null
}

/**
 * Whether a recurring task is due: `rule` has produced an occurrence on or
 * before `today`, at or after `createdOn`, that `lastCompletedOn` has not
 * cleared. A completion clears an occurrence when it was recorded on or
 * after that occurrence's date; a completion recorded before the occurrence
 * date does not clear it (see specs/recurring-tasks/spec.md, "When a
 * recurring task is due").
 *
 * Takes the task's constituent fields rather than a `Task`, because `Task`
 * does not yet carry `recurrence` or `lastCompletedOn` — that widening is
 * tasks.md section 3's work, out of scope here. Mirrors design.md decision
 * 2's formula, `isDue(task, now)`, which composes this the same way once
 * `Task` carries those fields: `lastDueDate` first, then compared against
 * the last completion.
 *
 * Answers a plain boolean, with no count of how many occurrences were
 * missed: three missed Mondays and one missed Monday compare identically
 * here, which is what keeps missed occurrences from accumulating (see
 * specs/recurring-tasks/spec.md, "Missed occurrences never accumulate").
 */
export function isDue(
  rule: RecurrenceRule,
  createdOn: string,
  lastCompletedOn: string | null,
  today: string,
): boolean {
  const due = lastDueDate(rule, createdOn, today)
  return due !== null && (lastCompletedOn === null || lastCompletedOn < due)
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

/**
 * Clears `completedAt` on every recurring task that `isDue` again, leaving
 * `lastCompletedOn` — and every one-off task — untouched (see
 * specs/recurring-tasks/spec.md, "Completing a recurring task puts it to
 * rest, it does not end it", and design.md, decision 8).
 *
 * `completedAt` keeps meaning "completed and not yet cleared by a
 * recomputation" (see decision 3); this is the one place that clears it for
 * a reason other than the completion itself. `lastCompletedOn` is untouched
 * — it is the durable memory `isDue` reads, and must survive the reset for
 * `isDue` to still answer correctly afterwards.
 *
 * Pure and, in the common case, a no-op: it returns the very same array
 * reference when no task needed to change, so recomputation (design.md,
 * decision 8's pipeline) can skip persisting the task list when nothing was
 * reawakened. A task is left alone — without even evaluating `isDue` — when
 * it is one-off, or when it is recurring but already shows as pending
 * (`completedAt === null`), since there is nothing to clear either way.
 */
export function reawaken(tasks: Task[], now: Date): Task[] {
  const today = formatLocalDate(now)
  let changed = false

  const result = tasks.map((task) => {
    if (task.recurrence === null || task.completedAt === null) {
      return task
    }

    const due = isDue(
      task.recurrence,
      formatLocalDate(task.createdAt),
      task.lastCompletedOn,
      today,
    )

    if (!due) {
      return task
    }

    changed = true
    return { ...task, completedAt: null }
  })

  return changed ? result : tasks
}
