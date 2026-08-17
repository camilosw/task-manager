import { comparePriority } from './priority'
import type { Task } from './task'

/**
 * The fixed daily time budget, in minutes, against which the non-urgent
 * selection is made (see specs/daily-plan/spec.md, "Daily plan selection
 * algorithm"). A threshold that is crossed once, not a ceiling: the task
 * that carries the running total to or past this value is still included.
 */
export const DAILY_BUDGET_MINUTES = 60

/**
 * Orders tasks the way the daily plan selection considers them: by priority
 * first (most important first), then by creation timestamp ascending
 * (oldest first) within the same priority level. Duration plays no part in
 * the ordering, so two same-priority tasks are never reordered relative to
 * each other by how long they take (see specs/daily-plan/spec.md,
 * "Ordering within the selection").
 */
export function compareForSelection(a: Task, b: Task): number {
  const byPriority = comparePriority(a.priority, b.priority)
  if (byPriority !== 0) {
    return byPriority
  }
  return a.createdAt.getTime() - b.createdAt.getTime()
}

/**
 * Selects the tasks that make up a freshly computed daily plan, from all
 * currently pending tasks (see specs/daily-plan/spec.md, "Daily plan
 * selection algorithm").
 *
 * Tasks are considered in `compareForSelection` order, accumulating a
 * running total of included durations, starting at zero:
 *
 * - Every urgent task is included unconditionally, regardless of the
 *   running total, and still adds its duration to it.
 * - A non-urgent task is included if and only if the running total of the
 *   tasks already considered is strictly less than `DAILY_BUDGET_MINUTES`.
 *
 * Because the running total never decreases, this is a threshold crossed
 * once rather than a ceiling: the task that carries the total to or past
 * the budget is included, and nothing after it is — no shorter, later task
 * is substituted in to fit more work into the remaining time.
 *
 * Completed tasks are never selected. An empty or all-completed input
 * yields an empty plan.
 */
export function selectDailyPlan(tasks: Task[]): Task[] {
  const pending = tasks.filter((task) => task.completedAt === null)
  const ordered = [...pending].sort(compareForSelection)

  const selected: Task[] = []
  let total = 0

  for (const task of ordered) {
    const include = task.priority === 'urgent' || total < DAILY_BUDGET_MINUTES
    if (include) {
      selected.push(task)
      total += task.duration
    }
  }

  return selected
}
