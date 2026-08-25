import type { Duration } from './duration'
import type { Priority } from './priority'
import {
  isCompleteRule,
  type RecurrenceRule,
  type RecurrenceRuleDraft,
} from './recurrence'
import { toLocalDateString } from './dayBoundary'

/**
 * A single task. `createdAt` is fixed at creation and never changes;
 * `completedAt` is `null` while the task is pending and is set to the
 * moment of completion (see specs/task-management/spec.md).
 *
 * `priority` and `recurrence` are mutually exclusive: exactly one is
 * non-null (see design.md, decision 4, and
 * specs/recurring-tasks/spec.md, "A recurring task carries a repetition
 * rule instead of a priority"). The invariant is enforced by `createTask`
 * and `editTask`'s validation, not by the type itself — see design.md,
 * decision 4's rejected discriminated-union alternative for why.
 *
 * `lastCompletedOn` is the durable memory of a recurring task's most recent
 * completion, as a local calendar date string (`YYYY-MM-DD`, matching
 * `toLocalDateString`). It is `null` until the task has been completed at
 * least once, and — unlike `completedAt` — survives being cleared by
 * `reawaken` (see design.md, decision 3). It has no meaning for a one-off
 * task, which never sets it.
 *
 * `place` is the task's position in the user-arranged order: a single
 * sequence spanning every task, regardless of priority, that is only ever
 * compared, never interpreted (see design.md, decision 2). It is assigned
 * at creation and changes only when the user reorders tasks — editing or
 * completing a task leaves it untouched (see specs/task-management/spec.md,
 * "Task attributes").
 */
export type Task = {
  id: string
  name: string
  duration: Duration
  priority: Priority | null
  recurrence: RecurrenceRule | null
  createdAt: Date
  place: number
  completedAt: Date | null
  lastCompletedOn: string | null
}

/**
 * The fields a task creation or edit can fail to provide. Returned as a
 * list so a caller can report every missing field at once rather than only
 * the first one found. `'rule'` covers both an entirely absent rule and one
 * that is present but incomplete (see specs/recurring-tasks/spec.md, "An
 * incomplete rule is rejected").
 */
export type TaskValidationField = 'name' | 'duration' | 'priority' | 'rule'

/**
 * `recurrence` distinguishes a one-off creation attempt from a recurring
 * one the same way `priority` already distinguishes "not yet selected"
 * from "selected": its mere presence — even an incomplete draft, such as a
 * weekly rule naming no day yet — signals recurring intent, the way the
 * form's `Type` control will (see design.md, decision 11). `undefined`
 * means the caller never touched the recurring branch at all, which is
 * exactly what every current one-off caller does, so this field is
 * optional rather than forcing `recurrence: undefined` onto every existing
 * call site.
 */
export type CreateTaskInput = {
  id: string
  name: string
  duration: Duration | undefined
  priority: Priority | undefined
  recurrence?: RecurrenceRuleDraft
  place: number
}

export type CreateTaskResult =
  { ok: true; task: Task } | { ok: false; errors: TaskValidationField[] }

/**
 * Creates a task, validating that the name is non-empty once trimmed, that
 * a duration was selected, and that exactly one of a priority or a
 * complete repetition rule was given (see
 * specs/task-management/spec.md, "Creating a task", and
 * specs/recurring-tasks/spec.md, "A task cannot carry both a priority and a
 * rule"). `now` is injected rather than read from the system clock, so
 * creation stays deterministic (see design.md, decision 2) — it becomes the
 * task's `createdAt`. `place` is recorded as given, the same way `id` is:
 * the caller is responsible for computing it (typically via `nextPlace`)
 * before calling `createTask`.
 */
export function createTask(
  input: CreateTaskInput,
  now: Date,
): CreateTaskResult {
  const name = input.name.trim()
  const errors: TaskValidationField[] = []
  const isRecurring = input.recurrence !== undefined

  if (name.length === 0) {
    errors.push('name')
  }
  if (input.duration === undefined) {
    errors.push('duration')
  }

  if (isRecurring) {
    if (input.priority !== undefined) {
      errors.push('priority')
    }
    if (!isCompleteRule(input.recurrence as RecurrenceRuleDraft)) {
      errors.push('rule')
    }
  } else if (input.priority === undefined) {
    errors.push('priority')
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    task: {
      id: input.id,
      name,
      duration: input.duration as Duration,
      priority: isRecurring ? null : (input.priority as Priority),
      recurrence: isRecurring ? (input.recurrence as RecurrenceRule) : null,
      createdAt: now,
      place: input.place,
      completedAt: null,
      lastCompletedOn: null,
    },
  }
}

/**
 * The place a newly created task should take: one past the highest place
 * currently held by any task, or the first place (`0`) when there are no
 * tasks yet. Because `place` is a single sequence spanning every priority
 * level (see design.md, decision 2), a task assigned this place is greater
 * than every existing task's place and so sorts last among the tasks of its
 * own priority level, regardless of how the existing tasks have been
 * arranged (see specs/task-management/spec.md, "A new task takes the last
 * place in the order").
 */
export function nextPlace(tasks: Task[]): number {
  if (tasks.length === 0) {
    return 0
  }
  return Math.max(...tasks.map((task) => task.place)) + 1
}

/**
 * `priority` and `recurrence` are both optional for the same reason
 * `CreateTaskInput.recurrence` is (see its comment above): which one is
 * given selects the resulting task's type, including converting between
 * them (see specs/task-management/spec.md, "Converting a task between
 * one-off and recurring"). Supplying neither, or both, is rejected by
 * `editTask` the same way `createTask` rejects it.
 */
export type EditTaskInput = {
  name: string
  duration: Duration
  priority?: Priority
  recurrence?: RecurrenceRuleDraft
}

export type EditTaskResult =
  { ok: true; task: Task } | { ok: false; errors: TaskValidationField[] }

/**
 * Edits a task's name, duration, and either its priority or its repetition
 * rule — including converting between the two (see
 * specs/task-management/spec.md, "Converting a task between one-off and
 * recurring"). The creation timestamp, the place in the order, and the
 * date the task was last completed are all carried over from the existing
 * task untouched — even when the edit changes the priority or converts the
 * task, it keeps the place it held and the completion history it had (see
 * specs/task-management/spec.md, "A task keeps its place when its priority
 * changes", and "Converting back does not re-open a completed occurrence")
 * — and a name that would be empty once trimmed, or an edit that would
 * leave neither a priority nor a complete rule, is rejected, leaving the
 * task unchanged.
 */
export function editTask(task: Task, input: EditTaskInput): EditTaskResult {
  const name = input.name.trim()
  const errors: TaskValidationField[] = []
  const isRecurring = input.recurrence !== undefined

  if (name.length === 0) {
    errors.push('name')
  }

  if (isRecurring) {
    if (input.priority !== undefined) {
      errors.push('priority')
    }
    if (!isCompleteRule(input.recurrence as RecurrenceRuleDraft)) {
      errors.push('rule')
    }
  } else if (input.priority === undefined) {
    errors.push('priority')
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    task: {
      ...task,
      name,
      duration: input.duration,
      priority: isRecurring ? null : (input.priority as Priority),
      recurrence: isRecurring ? (input.recurrence as RecurrenceRule) : null,
    },
  }
}

/**
 * Marks a task as completed, recording `now` as its completion time. `now`
 * is injected rather than read from the system clock, in keeping with
 * `createTask` (see design.md, decision 2). The task's place in the order
 * is preserved, so a completed task keeps its position rather than moving.
 *
 * For a recurring task, this also records `now`'s local calendar date as
 * `lastCompletedOn` — the durable memory `isDue` reads — alongside
 * `completedAt`; for a one-off task only `completedAt` is set, exactly as
 * before (see design.md, decision 3, and
 * specs/recurring-tasks/spec.md, "Completing a recurring task puts it to
 * rest, it does not end it").
 */
export function completeTask(task: Task, now: Date): Task {
  if (task.recurrence !== null) {
    return {
      ...task,
      completedAt: now,
      lastCompletedOn: toLocalDateString(now),
    }
  }

  return {
    ...task,
    completedAt: now,
  }
}

/**
 * Removes the item at `from` and reinserts it at `to`, leaving every other
 * item's relative order unchanged. A local helper rather than `@dnd-kit`'s
 * `arrayMove`: the domain layer must not import the drag library (see
 * design.md, decision 1, and the import-boundary lint rule).
 */
function arrayMove<T>(items: T[], from: number, to: number): T[] {
  const copy = [...items]
  const [moved] = copy.splice(from, 1)
  copy.splice(to, 0, moved)
  return copy
}

/**
 * Moves `activeId`'s task to the position `overId`'s task currently holds,
 * among the tasks of their shared priority level (see
 * specs/task-management/spec.md, "Reordering a task within its priority
 * level").
 *
 * A reordering permutes the places already held by that level's tasks; it
 * does not renumber globally, so every other level's places are untouched
 * (see design.md, decision 2).
 *
 * Returns `tasks` unchanged — a no-op — when `activeId` and `overId` are
 * the same, when either id does not identify a task in `tasks`, or when the
 * two tasks belong to different priority levels. That last case is what
 * makes a rejected cross-group drop a domain guarantee rather than a UI
 * courtesy (see design.md, decision 3).
 */
export function reorderWithinPriority(
  tasks: Task[],
  activeId: string,
  overId: string,
): Task[] {
  if (activeId === overId) {
    return tasks
  }

  const activeTask = tasks.find((task) => task.id === activeId)
  const overTask = tasks.find((task) => task.id === overId)

  if (
    activeTask === undefined ||
    overTask === undefined ||
    activeTask.priority !== overTask.priority
  ) {
    return tasks
  }

  const group = tasks
    .filter((task) => task.priority === activeTask.priority)
    .sort((a, b) => a.place - b.place)
  const places = group.map((task) => task.place)

  const fromIndex = group.findIndex((task) => task.id === activeId)
  const toIndex = group.findIndex((task) => task.id === overId)
  const reordered = arrayMove(group, fromIndex, toIndex)

  const placeById = new Map(
    reordered.map((task, index) => [task.id, places[index]]),
  )

  return tasks.map((task) => {
    const newPlace = placeById.get(task.id)
    return newPlace === undefined || newPlace === task.place
      ? task
      : { ...task, place: newPlace }
  })
}
