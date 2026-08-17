/**
 * The nine allowed task durations, in minutes. A task's duration SHALL be
 * one of exactly these values (see specs/task-management/spec.md) — no
 * free-text entry, no other value.
 */
export const DURATIONS = [5, 10, 15, 20, 30, 45, 60, 90, 120] as const

export type Duration = (typeof DURATIONS)[number]

/**
 * Narrows a plain number to a `Duration`, guarding against any value outside
 * the nine allowed options.
 */
export function isDuration(value: number): value is Duration {
  return (DURATIONS as readonly number[]).includes(value)
}

/**
 * Formats a duration for display: minutes below an hour as "Xm", and an
 * hour or more as "Xh", with a fractional hour (e.g. 90 minutes) rendered
 * as its decimal value ("1.5h").
 */
export function formatDuration(duration: Duration): string {
  if (duration < 60) {
    return `${duration}m`
  }
  return `${duration / 60}h`
}
