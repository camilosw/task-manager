import { toLocalDateString } from './dayBoundary'
import { isUnconditional, selectDailyPlan } from './dailyPlan'
import type { Task } from './task'

/**
 * The persisted record of a single day's plan (see design.md, decision 3).
 * `plannedIds` is the non-urgent selection chosen by `selectDailyPlan` when
 * the plan was last computed, and stays frozen until the next computation.
 * `admittedIds` holds tasks added later because they became urgent —
 * whether created urgent or edited to urgent — after that computation.
 *
 * Today's membership is `plannedIds ∪ admittedIds`, resolved against the
 * tasks that currently exist (see `resolveSnapshotTasks`).
 */
export type DaySnapshot = {
  date: string
  plannedIds: string[]
  admittedIds: string[]
}

/**
 * Resolves a snapshot's membership — `plannedIds ∪ admittedIds` — to actual
 * `Task` objects, in `plannedIds` order followed by `admittedIds` order.
 *
 * An id that no longer resolves to an existing task is silently skipped
 * rather than raising an error. This is the correctness guarantee for
 * membership (see design.md, decision 3): writing the task list and writing
 * the snapshot are two separate operations, so a crash between them — or a
 * deletion that has not yet been pruned from the snapshot — can leave a
 * stale id behind. This filter is mandatory regardless of whether pruning
 * has run; it SHALL NOT be removed on the grounds that pruning exists.
 */
export function resolveSnapshotTasks(
  snapshot: DaySnapshot,
  tasks: Task[],
): Task[] {
  const byId = new Map(tasks.map((task) => [task.id, task]))
  const ids = [...snapshot.plannedIds, ...snapshot.admittedIds]

  const resolved: Task[] = []
  for (const id of ids) {
    const task = byId.get(id)
    if (task) {
      resolved.push(task)
    }
  }
  return resolved
}

function isSnapshotMember(snapshot: DaySnapshot, taskId: string): boolean {
  return (
    snapshot.plannedIds.includes(taskId) ||
    snapshot.admittedIds.includes(taskId)
  )
}

/**
 * Admits a task into the snapshot when it has just become an unconditional
 * member of the plan — urgent, or a due recurring task, whether created
 * that way or edited/converted into it — and is not already part of the
 * snapshot (see specs/daily-plan/spec.md, "A task that becomes urgent
 * enters the plan immediately", which extends this to "or when it becomes a
 * due recurring task, whether created as one on a date its rule fires or
 * converted into one"). Appends the task's id to `admittedIds`.
 *
 * Generalizes what was `admitIfUrgent` (see design.md, decision 7) by
 * delegating to `isUnconditional` from `./dailyPlan` — the same "urgent OR
 * due recurring" predicate `selectDailyPlan` and `compareForSelection`
 * already use — rather than re-deriving the condition here. `now` is taken
 * so `isUnconditional` can evaluate whether a recurring task is due; a task
 * created mid-day on a date its rule fires is due immediately by the
 * `createdOn` floor (design.md, decision 2), which is what makes mid-day
 * admission of a recurring task work the same way it already does for
 * urgent.
 *
 * Never evicts anything already in `plannedIds` or `admittedIds` to make
 * room — the spec explicitly allows the planned total to grow beyond the
 * budget as a result. Has no effect, returning an equivalent snapshot, when
 * the task is not currently unconditional or is already a member of either
 * list.
 */
export function admitIfUnconditional(
  snapshot: DaySnapshot,
  task: Task,
  now: Date,
): DaySnapshot {
  if (!isUnconditional(task, now) || isSnapshotMember(snapshot, task.id)) {
    return snapshot
  }

  return {
    ...snapshot,
    admittedIds: [...snapshot.admittedIds, task.id],
  }
}

/**
 * Removes a task from `admittedIds` once it stops being an unconditional
 * member of the plan — no longer urgent, or no longer a due recurring task,
 * for instance converted to a non-urgent one-off while due (see
 * specs/daily-plan/spec.md, "A task that stops being urgent leaves the
 * plan" and "A task that stops being a due recurring task leaves the
 * plan"). Only `admittedIds` is ever touched here — `plannedIds`, the
 * frozen daily selection, is never modified by an edit. This is the
 * asymmetry design.md calls out: a task admitted only because it was
 * unconditional loses its place the moment it no longer is, while a task
 * that was part of the frozen selection stays there even if it passes
 * through unconditional and back (see "A frozen task edited to urgent and
 * back stays in the plan").
 *
 * Generalizes what was `removeIfNoLongerUrgent` (see design.md, decision 7)
 * by delegating to `isUnconditional` from `./dailyPlan`, taking `now` for
 * the same reason `admitIfUnconditional` does.
 *
 * Has no effect, returning an equivalent snapshot, when the task is still
 * unconditional or is not present in `admittedIds`.
 */
export function removeIfNoLongerUnconditional(
  snapshot: DaySnapshot,
  task: Task,
  now: Date,
): DaySnapshot {
  if (isUnconditional(task, now) || !snapshot.admittedIds.includes(task.id)) {
    return snapshot
  }

  return {
    ...snapshot,
    admittedIds: snapshot.admittedIds.filter((id) => id !== task.id),
  }
}

/**
 * Removes a deleted task's id from both `plannedIds` and `admittedIds`.
 *
 * This is hygiene, not the correctness mechanism (see design.md, decision
 * 3): `resolveSnapshotTasks` independently filters unresolved ids on every
 * read, since writing the task list and writing the snapshot are separate
 * operations and a crash between them — or simply not having pruned yet —
 * can leave a stale id behind regardless of whether this function has run.
 */
export function pruneTaskId(
  snapshot: DaySnapshot,
  taskId: string,
): DaySnapshot {
  return {
    ...snapshot,
    plannedIds: snapshot.plannedIds.filter((id) => id !== taskId),
    admittedIds: snapshot.admittedIds.filter((id) => id !== taskId),
  }
}

/**
 * Computes a fresh snapshot for `now`'s local calendar date from `tasks`,
 * replacing both lists wholesale rather than extending a previous snapshot
 * — this function takes no previous snapshot, so there is nothing to
 * extend (see specs/daily-plan/spec.md, "Recalculating reconsiders every
 * pending task", and design.md, decision 3's `plannedIds` comment: "chosen
 * by the algorithm when the plan was computed").
 *
 * `plannedIds` becomes the full output of `selectDailyPlan` — the frozen
 * selection, which already includes every currently pending urgent task
 * unconditionally alongside the non-urgent tasks the budget admits.
 * `admittedIds` starts empty: it exists to record tasks that become urgent
 * *after* this computation, not tasks that were already urgent when it ran.
 */
export function recomputeSnapshot(tasks: Task[], now: Date): DaySnapshot {
  const planned = selectDailyPlan(tasks, now)
  return {
    date: toLocalDateString(now),
    plannedIds: planned.map((task) => task.id),
    admittedIds: [],
  }
}
