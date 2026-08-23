import type { Duration } from './duration'
import type { Priority } from './priority'

/**
 * A single task. `createdAt` is fixed at creation and never changes;
 * `completedAt` is `null` while the task is pending and is set to the
 * moment of completion (see specs/task-management/spec.md).
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
  priority: Priority
  createdAt: Date
  place: number
  completedAt: Date | null
}

/**
 * The fields a task creation or edit can fail to provide. Returned as a
 * list so a caller can report every missing field at once rather than only
 * the first one found.
 */
export type TaskValidationField = 'name' | 'duration' | 'priority'

export type CreateTaskInput = {
  id: string
  name: string
  duration: Duration | undefined
  priority: Priority | undefined
  place: number
}

export type CreateTaskResult =
  { ok: true; task: Task } | { ok: false; errors: TaskValidationField[] }

/**
 * Creates a task, validating that the name is non-empty once trimmed and
 * that a duration and a priority were both selected. `now` is injected
 * rather than read from the system clock, so creation stays deterministic
 * (see design.md, decision 2) — it becomes the task's `createdAt`. `place`
 * is recorded as given, the same way `id` is: the caller is responsible for
 * computing it (typically via `nextPlace`) before calling `createTask`.
 */
export function createTask(
  input: CreateTaskInput,
  now: Date,
): CreateTaskResult {
  const name = input.name.trim()
  const errors: TaskValidationField[] = []

  if (name.length === 0) {
    errors.push('name')
  }
  if (input.duration === undefined) {
    errors.push('duration')
  }
  if (input.priority === undefined) {
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
      priority: input.priority as Priority,
      createdAt: now,
      place: input.place,
      completedAt: null,
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

export type EditTaskInput = {
  name: string
  duration: Duration
  priority: Priority
}

export type EditTaskResult =
  { ok: true; task: Task } | { ok: false; errors: TaskValidationField[] }

/**
 * Edits a task's name, duration, and priority. The creation timestamp and
 * the place in the order are both carried over from the existing task
 * untouched — even when the edit changes the priority, the task keeps the
 * place it held (see specs/task-management/spec.md, "A task keeps its
 * place when its priority changes") — and a name that would be empty once
 * trimmed is rejected, leaving the task unchanged.
 */
export function editTask(task: Task, input: EditTaskInput): EditTaskResult {
  const name = input.name.trim()

  if (name.length === 0) {
    return { ok: false, errors: ['name'] }
  }

  return {
    ok: true,
    task: {
      ...task,
      name,
      duration: input.duration,
      priority: input.priority,
    },
  }
}

/**
 * Marks a task as completed, recording `now` as its completion time. `now`
 * is injected rather than read from the system clock, in keeping with
 * `createTask` (see design.md, decision 2). The task's place in the order
 * is preserved, so a completed task keeps its position rather than moving.
 */
export function completeTask(task: Task, now: Date): Task {
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
