import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { formatDuration } from '../domain/duration'
import type { Priority } from '../domain/priority'
import { formatRule } from '../domain/recurrence'
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
  /** A reordering control to render alongside the row's existing checkbox,
   * duration, priority, edit and delete elements — only ever supplied by
   * `SortableTaskItem`, which wires it up with dnd-kit's sortable listeners
   * (see specs/task-views/spec.md, "Tasks are reordered in the All tab
   * only"). `TaskItem` itself stays ignorant of dnd-kit: it only renders
   * whatever node it is given, which is how the Today and Completed tabs —
   * which never pass this prop — keep showing no reordering control at all
   * (see "The other tabs offer no reordering"). */
  dragHandle?: ReactNode
  /** The row's own DOM node ref and inline style, supplied by
   * `SortableTaskItem` so dnd-kit can measure and transform the row while
   * dragging. Both are `undefined`, and so no-ops, everywhere else. */
  rootRef?: (node: HTMLLIElement | null) => void
  rootStyle?: CSSProperties
}

/**
 * A single task row: read-only by default, switching to an inline
 * `TaskForm` while editing (see specs/task-management/spec.md, "Editing a
 * task"). Duration, and either priority or a repetition rule, are always
 * pre-filled from the existing task and can only be reassigned to another
 * fixed option, never cleared — the `duration` check in `handleEditSubmit`
 * below only guards against `values.duration` being `undefined` in
 * `TaskFormValues`'s type, which is impossible in practice here; the
 * priority/recurrence mutual exclusion, and a blank name, are left for
 * `editTask` (via `onEdit`) to validate, same as `TaskForm` leaves it there
 * on creation (see design.md, decision 1).
 *
 * Name, duration, and either an identifiable priority or — for a recurring
 * task — a text description of its repetition rule are always visible (see
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
 *
 * Deleting is gated behind a confirmation step: activating "Delete" sets
 * `isConfirmingDelete` rather than calling `onDelete` directly, mirroring
 * how `isEditing` already gates the edit form (design.md, decision 2). The
 * confirmation itself reuses `CreateTaskSheet`'s native-`<dialog>` pattern
 * (design.md, decision 1) - `showModal`/`close` driven from a ref and an
 * effect, Escape handled via an explicit `onKeyDown` rather than the native
 * `cancel` event, and a backdrop click detected via `event.target ===
 * deleteDialogRef.current` - for the same reason: this project's jsdom
 * shim (vitest.setup.ts) only toggles the `open` property, so the
 * behaviors the spec pins down (focus into the dialog on open, focus back
 * to "Delete" on close) are handled explicitly here rather than left to
 * the platform. The dialog's confirm control is named "Delete task" rather
 * than "Delete" because the row's own "Delete" trigger stays mounted while
 * the dialog is open (tasks.md, section 1 note). Focus lands on "Cancel"
 * when the dialog opens, favoring the non-destructive default the same way
 * a native confirm prompt would.
 */
export function TaskItem({
  task,
  onEdit,
  onDelete,
  onComplete,
  dragHandle,
  rootRef,
  rootStyle,
}: TaskItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const nameId = useId()
  const deleteButtonRef = useRef<HTMLButtonElement>(null)
  const deleteDialogRef = useRef<HTMLDialogElement>(null)
  const cancelDeleteRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isConfirmingDelete) {
      deleteDialogRef.current?.showModal()
      cancelDeleteRef.current?.focus()
    }
  }, [isConfirmingDelete])

  function openDeleteConfirmation() {
    setIsConfirmingDelete(true)
  }

  function closeDeleteConfirmation() {
    deleteDialogRef.current?.close()
    setIsConfirmingDelete(false)
    deleteButtonRef.current?.focus()
  }

  function handleConfirmDelete() {
    onDelete(task.id)
    closeDeleteConfirmation()
  }

  function handleDeleteDialogKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeDeleteConfirmation()
    }
  }

  function handleDeleteDialogBackdropClick(
    event: MouseEvent<HTMLDialogElement>,
  ) {
    // Same technique as CreateTaskSheet's own backdrop click: only a click
    // landing on the dialog element's own box - never reaching the message
    // or either button inside it - reports the dialog itself as the
    // target.
    if (event.target === deleteDialogRef.current) {
      closeDeleteConfirmation()
    }
  }

  async function handleEditSubmit(values: TaskFormValues) {
    if (values.duration === undefined) {
      return {
        ok: false as const,
        errors: ['duration'] as TaskValidationField[],
      }
    }

    const result = await onEdit(task.id, {
      name: values.name,
      duration: values.duration,
      priority: values.priority,
      recurrence: values.recurrence,
    })
    if (result.ok) {
      setIsEditing(false)
    }
    return result
  }

  if (isEditing) {
    return (
      <li
        className="task-row task-row--editing"
        ref={rootRef}
        style={rootStyle}
        data-task-id={task.id}
      >
        <TaskForm
          heading={`Edit "${task.name}"`}
          submitLabel="Save"
          initialValues={{
            name: task.name,
            duration: task.duration,
            // `task.priority`/`task.recurrence` are `Priority | null` /
            // `RecurrenceRule | null` (tasks.md section 3): exactly one is
            // set, mirroring `TaskFormValues`'s own mutual exclusion, so
            // `?? undefined` on both is a type-only coercion.
            priority: task.priority ?? undefined,
            recurrence: task.recurrence ?? undefined,
          }}
          onSubmit={handleEditSubmit}
          onCancel={() => setIsEditing(false)}
        />
      </li>
    )
  }

  const isCompleted = task.completedAt !== null

  return (
    <>
      <li
        className="task-row"
        ref={rootRef}
        style={rootStyle}
        data-task-id={task.id}
      >
        {dragHandle}
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
            {task.recurrence !== null ? (
              // A recurring task shows its rule in the same slot a one-off
              // task shows its priority, and no priority name at all — it
              // has none (see specs/task-views/spec.md, "Every task display
              // shows name, duration, and priority", and design.md,
              // decision 11).
              <span className="task-row__recurrence" data-recurring="true">
                {formatRule(task.recurrence, 'short')}
              </span>
            ) : (
              <span
                className="task-row__priority"
                data-priority={task.priority}
              >
                {PRIORITY_LABELS[task.priority as Priority]}
              </span>
            )}
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
            ref={deleteButtonRef}
            onClick={openDeleteConfirmation}
          >
            <TrashIcon />
          </button>
        </div>
      </li>
      {isConfirmingDelete && (
        <dialog
          ref={deleteDialogRef}
          className="delete-confirm-dialog"
          onKeyDown={handleDeleteDialogKeyDown}
          onClick={handleDeleteDialogBackdropClick}
        >
          <p className="delete-confirm-dialog__message">
            Delete &quot;{task.name}&quot;? This can&apos;t be undone.
          </p>
          <div className="delete-confirm-dialog__actions">
            <button
              type="button"
              className="delete-confirm-dialog__cancel"
              ref={cancelDeleteRef}
              onClick={closeDeleteConfirmation}
            >
              Cancel
            </button>
            <button
              type="button"
              className="delete-confirm-dialog__confirm"
              onClick={handleConfirmDelete}
            >
              Delete task
            </button>
          </div>
        </dialog>
      )}
    </>
  )
}
