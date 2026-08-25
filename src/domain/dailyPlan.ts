import { comparePriority } from './priority'
import type { Priority } from './priority'
import type { Task } from './task'
import { isDue } from './recurrence'
import { toLocalDateString } from './dayBoundary'

/**
 * The fixed daily time budget, in minutes, against which the non-urgent
 * selection is made (see specs/daily-plan/spec.md, "Daily plan selection
 * algorithm"). A threshold that is crossed once, not a ceiling: the task
 * that carries the running total to or past this value is still included.
 */
export const DAILY_BUDGET_MINUTES = 60

/**
 * Whether `task` carries a repetition rule. Checked as "not null and not
 * undefined" rather than `task.recurrence !== null` alone: persistence's
 * version-2-to-3 upgrade (tasks.md section 7, not yet implemented) is what
 * backfills `recurrence` explicitly to `null` on every task stored by an
 * older version, but a task loaded before that upgrade has run carries no
 * `recurrence` property at all — reading as `undefined` here despite the
 * type saying otherwise. Tolerating that gap is intentional, not a
 * workaround: design.md, decision 12 says exactly this — "undefined and
 * null would both be falsy at every use site, so tolerating the gap would
 * work" — of the version-3 upgrade not having landed yet.
 */
function hasRecurrence(
  task: Task,
): task is Task & { recurrence: NonNullable<Task['recurrence']> } {
  return task.recurrence !== null && task.recurrence !== undefined
}

/**
 * Orders tasks the way the daily plan selection considers them: due
 * recurring tasks ahead of every one-off task regardless of priority, then
 * one-off tasks by priority (most important first) (see design.md, decision
 * 6, and specs/daily-plan/spec.md, "Ordering within the selection"). Within
 * either group — two recurring tasks, or two one-off tasks of the same
 * priority — ties are broken by the user-arranged `place` ascending.
 * Duration plays no part in the ordering, so two same-group tasks are never
 * reordered relative to each other by how long they take, and `createdAt`
 * plays no part either — a task that has never been reordered holds a place
 * matching its creation order, but once reordered, the arranged place
 * overrides age.
 *
 * Recurring tasks are partitioned out by `hasRecurrence` before any
 * priority comparison, never sorted within the priority axis — giving
 * `comparePriority` a "recurring sorts as X" branch would put recurring
 * tasks back on the importance axis they were deliberately removed from
 * (see design.md, decision 4's Risks note). The `as Priority` assertions
 * below are therefore only reached once both tasks are known to be
 * one-off, where `priority` is guaranteed non-null by the
 * exactly-one-of-priority-or-rule invariant `createTask`/`editTask` enforce.
 */
export function compareForSelection(a: Task, b: Task): number {
  const aRecurring = hasRecurrence(a)
  const bRecurring = hasRecurrence(b)

  if (aRecurring !== bRecurring) {
    return aRecurring ? -1 : 1
  }

  if (aRecurring) {
    return a.place - b.place
  }

  const byPriority = comparePriority(
    a.priority as Priority,
    b.priority as Priority,
  )
  if (byPriority !== 0) {
    return byPriority
  }
  return a.place - b.place
}

/**
 * Whether `task` is currently a due recurring task: `false` for every
 * one-off task, and otherwise `isDue` evaluated against `task`'s own
 * `createdAt` and `lastCompletedOn` at `now`'s local calendar date (see
 * design.md, decision 2). Not exported — callers outside this module should
 * go through `isUnconditional`, which is the concept the daily-plan spec and
 * design.md actually name.
 */
function isTaskDue(task: Task, now: Date): boolean {
  return (
    hasRecurrence(task) &&
    isDue(
      task.recurrence,
      toLocalDateString(task.createdAt),
      task.lastCompletedOn,
      toLocalDateString(now),
    )
  )
}

/**
 * Whether `task` is an unconditional member of the daily plan: urgent, or a
 * due recurring task (see design.md, decision 6, and
 * specs/daily-plan/spec.md, "A task that becomes urgent enters the plan
 * immediately", which extends the same "unconditional member" wording to a
 * due recurring task). Both classes are included in the plan regardless of
 * the running total and both still add their duration to it — see
 * `selectDailyPlan`.
 *
 * Exported so the generalisation of `admitIfUrgent`/`removeIfNoLongerUrgent`
 * to `admitIfUnconditional`/`removeIfNoLongerUnconditional` (tasks.md
 * section 6) can share this exact definition instead of re-deriving it.
 */
export function isUnconditional(task: Task, now: Date): boolean {
  return task.priority === 'urgent' || isTaskDue(task, now)
}

/**
 * Selects the tasks that make up a freshly computed daily plan, from all
 * currently pending tasks (see specs/daily-plan/spec.md, "Daily plan
 * selection algorithm"). `now` is injected rather than read from the system
 * clock, in keeping with `createTask`, `completeTask`, and `reawaken` (see
 * design.md, decision 2) — it decides which recurring tasks are due.
 *
 * A recurring task that is at rest is excluded before anything else: it is
 * not considered at all, and contributes nothing to the running total (see
 * specs/daily-plan/spec.md, "A recurring task at rest reserves nothing").
 * The remaining tasks are considered in `compareForSelection` order —
 * every due recurring task first, then one-off tasks by priority —
 * accumulating a running total of included durations, starting at zero:
 *
 * - Every unconditional task (urgent, or a due recurring task) is included
 *   regardless of the running total, and still adds its duration to it —
 *   so a due recurring task's duration is reserved from the front, before
 *   any one-off task is considered (see specs/daily-plan/spec.md, "Due
 *   recurring tasks reserve their duration before the budget is spent").
 * - A non-unconditional task is included if and only if the running total
 *   of the tasks already considered is strictly less than
 *   `DAILY_BUDGET_MINUTES`.
 *
 * Because the running total never decreases, this is a threshold crossed
 * once rather than a ceiling: the task that carries the total to or past
 * the budget is included, and nothing after it is — no shorter, later task
 * is substituted in to fit more work into the remaining time.
 *
 * Completed tasks are never selected. An empty or all-completed input
 * yields an empty plan.
 */
export function selectDailyPlan(tasks: Task[], now: Date): Task[] {
  const pending = tasks.filter(
    (task) =>
      task.completedAt === null &&
      (!hasRecurrence(task) || isTaskDue(task, now)),
  )
  const ordered = [...pending].sort(compareForSelection)

  const selected: Task[] = []
  let total = 0

  for (const task of ordered) {
    const include = isUnconditional(task, now) || total < DAILY_BUDGET_MINUTES
    if (include) {
      selected.push(task)
      total += task.duration
    }
  }

  return selected
}
