/**
 * The five priority levels a task may carry, ordered from most to least
 * important. This order is authoritative wherever tasks are sorted or
 * selected by priority (see specs/task-management/spec.md).
 */
export const PRIORITIES = [
  'urgent',
  'high',
  'medium',
  'low',
  'very-low',
] as const

export type Priority = (typeof PRIORITIES)[number]

/**
 * Compares two priorities by importance, for use as an `Array#sort`
 * comparator: negative when `a` is more important than `b`, positive when
 * `a` is less important, zero when they are the same level.
 */
export function comparePriority(a: Priority, b: Priority): number {
  return PRIORITIES.indexOf(a) - PRIORITIES.indexOf(b)
}
