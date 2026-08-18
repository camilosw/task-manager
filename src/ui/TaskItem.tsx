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
}

/**
 * A single task row: read-only by default, switching to an inline
 * `TaskForm` while editing (see specs/task-management/spec.md, "Editing a
 * task"). Duration and priority are always pre-filled from the existing
 * task and can only be reassigned to another fixed option, never cleared,
 * so the only edit-time validation failure possible is a blank name — the
 * `duration`/`priority` branch below only guards against that being
 * impossible in practice.
 */
export function TaskItem({ task, onEdit, onDelete }: TaskItemProps) {
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

  return (
    <li>
      <span>{task.name}</span>
      <span>{formatDuration(task.duration)}</span>
      <span>{PRIORITY_LABELS[task.priority]}</span>
      <button type="button" onClick={() => setIsEditing(true)}>
        Edit
      </button>
      <button type="button" onClick={() => onDelete(task.id)}>
        Delete
      </button>
    </li>
  )
}
