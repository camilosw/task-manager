import { useId, useState } from 'react'
import { formatDuration } from '../domain/duration'
import type {
  EditTaskInput,
  EditTaskResult,
  Task,
  TaskValidationField,
} from '../domain/task'
import { PRIORITY_LABELS } from './priorityLabels'
import { TaskForm, type TaskFormValues } from './TaskForm'
import { EditIcon, TrashIcon } from './icons'
import './TaskItem.css'

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
 * priority"). Completion is driven by a checkbox that persists across the
 * pending -> completed transition rather than a button that disappears:
 * unchecked and interactive while pending, checked and `disabled` once
 * completed, so completion cannot be undone by unchecking it (see
 * specs/task-management/spec.md, "A pending task is completed through a
 * checkbox on its row", and design.md, decision 8). The checkbox's
 * accessible name comes from `aria-labelledby` pointing at this row's own
 * name element, rather than a second copy of the name string that could
 * drift after an edit. Once completed, the name renders inside `<s>`, but
 * the row otherwise stays in place — this is what lets a task completed
 * from the Today tab remain visible there, struck through, until the plan
 * is next recomputed (see specs/task-views/spec.md, "Completing a task from
 * the Today tab keeps it visible").
 */
export function TaskItem({
  task,
  onEdit,
  onDelete,
  onComplete,
}: TaskItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const nameId = useId()

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
      <li className="task-row task-row--editing">
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
    <li className="task-row">
      <input
        type="checkbox"
        className="task-row__checkbox"
        aria-labelledby={nameId}
        checked={isCompleted}
        disabled={isCompleted}
        onChange={() => onComplete(task.id)}
      />
      <div className="task-row__main">
        <span id={nameId} className="task-row__name">
          {isCompleted ? <s>{task.name}</s> : task.name}
        </span>
        <div className="task-row__meta">
          <span className="task-row__duration">
            {formatDuration(task.duration)}
          </span>
          <span className="task-row__priority" data-priority={task.priority}>
            {PRIORITY_LABELS[task.priority]}
          </span>
        </div>
      </div>
      <div className="task-row__actions">
        <button
          type="button"
          className="task-row__icon-button task-row__edit"
          aria-label="Edit"
          onClick={() => setIsEditing(true)}
        >
          <EditIcon />
        </button>
        <button
          type="button"
          className="task-row__icon-button task-row__delete"
          aria-label="Delete"
          onClick={() => onDelete(task.id)}
        >
          <TrashIcon />
        </button>
      </div>
    </li>
  )
}
