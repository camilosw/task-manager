import { useState } from 'react'
import { formatDuration } from '../domain/duration'
import type {
  EditTaskInput,
  EditTaskResult,
  Task,
  TaskValidationField,
} from '../domain/task'
import { PRIORITY_LABELS } from './priorityLabels'
import { TaskForm, type TaskFormValues } from './TaskForm'

export type TaskItemProps = {
  task: Task
  onEdit: (id: string, input: EditTaskInput) => Promise<EditTaskResult>
  onDelete: (id: string) => Promise<void>
  onComplete: (id: string) => Promise<void>
}

/**
 * A single task row: read-only by default, switching to an inline
 * `TaskForm` while editing (see specs/task-management/spec.md, "Editing a
 * task"). Duration and priority are always pre-filled from the existing
 * task and can only be reassigned to another fixed option, never cleared,
 * so the only edit-time validation failure possible is a blank name — the
 * `duration`/`priority` branch below only guards against that being
 * impossible in practice.
 *
 * Name, duration and an identifiable priority are always visible (see
 * specs/task-views/spec.md, "Every task display shows name, duration, and
 * priority"). Once completed, the name renders inside `<s>` and the
 * "Complete" action disappears, but the row otherwise stays in place — this
 * is what lets a task completed from the Today tab remain visible there,
 * struck through, until the plan is next recomputed (see
 * specs/task-views/spec.md, "Completing a task from the Today tab keeps it
 * visible").
 */
export function TaskItem({
  task,
  onEdit,
  onDelete,
  onComplete,
}: TaskItemProps) {
  const [isEditing, setIsEditing] = useState(false)

  async function handleEditSubmit(values: TaskFormValues) {
    if (values.duration === undefined || values.priority === undefined) {
      const errors: TaskValidationField[] = []
      if (values.duration === undefined) errors.push('duration')
      if (values.priority === undefined) errors.push('priority')
      return { ok: false as const, errors }
    }

    const result = await onEdit(task.id, {
      name: values.name,
      duration: values.duration,
      priority: values.priority,
    })
    if (result.ok) {
      setIsEditing(false)
    }
    return result
  }

  if (isEditing) {
    return (
      <li>
        <TaskForm
          heading={`Edit "${task.name}"`}
          submitLabel="Save"
          initialValues={{
            name: task.name,
            duration: task.duration,
            priority: task.priority,
          }}
          onSubmit={handleEditSubmit}
          onCancel={() => setIsEditing(false)}
        />
      </li>
    )
  }

  const isCompleted = task.completedAt !== null

  return (
    <li>
      <span>{isCompleted ? <s>{task.name}</s> : task.name}</span>
      <span>{formatDuration(task.duration)}</span>
      <span data-priority={task.priority}>
        {PRIORITY_LABELS[task.priority]}
      </span>
      {!isCompleted && (
        <button type="button" onClick={() => onComplete(task.id)}>
          Complete
        </button>
      )}
      <button type="button" onClick={() => setIsEditing(true)}>
        Edit
      </button>
      <button type="button" onClick={() => onDelete(task.id)}>
        Delete
      </button>
    </li>
  )
}
