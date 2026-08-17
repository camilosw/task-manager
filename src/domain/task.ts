import type { Duration } from './duration'
import type { Priority } from './priority'

/**
 * A single task. `createdAt` is fixed at creation and never changes;
 * `completedAt` is `null` while the task is pending and is set to the
 * moment of completion (see specs/task-management/spec.md).
 */
export type Task = {
  id: string
  name: string
  duration: Duration
  priority: Priority
  createdAt: Date
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
}

export type CreateTaskResult =
  { ok: true; task: Task } | { ok: false; errors: TaskValidationField[] }

/**
 * Creates a task, validating that the name is non-empty once trimmed and
 * that a duration and a priority were both selected. `now` is injected
 * rather than read from the system clock, so creation stays deterministic
 * (see design.md, decision 2) — it becomes the task's `createdAt`.
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
      completedAt: null,
    },
  }
}

export type EditTaskInput = {
  name: string
  duration: Duration
  priority: Priority
}

export type EditTaskResult =
  { ok: true; task: Task } | { ok: false; errors: TaskValidationField[] }

/**
 * Edits a task's name, duration, and priority. The creation timestamp is
 * carried over from the existing task untouched, and a name that would be
 * empty once trimmed is rejected, leaving the task unchanged.
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
 * `createTask` (see design.md, decision 2).
 */
export function completeTask(task: Task, now: Date): Task {
  return {
    ...task,
    completedAt: now,
  }
}
