/**
 * Formats `now` as its local calendar date, `YYYY-MM-DD` — the device's
 * local time zone, not UTC (see specs/daily-plan/spec.md, "The plan is
 * recomputed when the day changes"). Uses `Date`'s local getters
 * (`getFullYear`/`getMonth`/`getDate`) rather than `toISOString`, which is
 * UTC-based and would shift the date near a time-zone boundary.
 */
export function toLocalDateString(now: Date): string {
  const year = String(now.getFullYear()).padStart(4, '0')
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Decides whether the daily plan should be recomputed: `true` when
 * `storedDate` is strictly earlier than `now`'s local calendar date, `false`
 * when it is equal or later (see design.md, decision 4).
 *
 * Strict less-than, never inequality: if the device's local date moves
 * backward — for example after a time-zone change — and becomes earlier
 * than the stored plan's date, the plan SHALL be kept rather than
 * recomputed (see specs/daily-plan/spec.md, "Moving to a time zone where it
 * is still the previous day").
 */
export function needsRecompute(storedDate: string, now: Date): boolean {
  return storedDate < toLocalDateString(now)
}
