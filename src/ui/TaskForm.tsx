import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { DURATIONS, formatDuration, type Duration } from '../domain/duration'
import { PRIORITIES, type Priority } from '../domain/priority'
import type { TaskValidationField } from '../domain/task'
import { PRIORITY_LABELS } from './priorityLabels'
import './TaskForm.css'

const FIELD_MESSAGES: Record<TaskValidationField, string> = {
  name: 'Name is required.',
  duration: 'Duration is required.',
  priority: 'Priority is required.',
}

/** The values a `TaskForm` submits: a raw name plus whichever duration and
 * priority buttons (if any) have been selected. */
export type TaskFormValues = {
  name: string
  duration?: Duration
  priority?: Priority
}

export type TaskFormSubmitResult =
  { ok: true } | { ok: false; errors: TaskValidationField[] }

export type TaskFormProps = {
  heading: string
  submitLabel: string
  /** Pre-fills the form for editing. Omitted for a fresh creation form,
   * which starts with an empty name and no duration/priority selected. */
  initialValues?: TaskFormValues
  onSubmit: (values: TaskFormValues) => Promise<TaskFormSubmitResult>
  onCancel?: () => void
  /** Moves keyboard focus onto the name field once, on mount. Used by
   * `CreateTaskSheet` (see design.md, decision 6): the creation form is
   * unmounted and remounted fresh each time the sheet opens, so "focus
   * moves into the form on open" falls out of an effect that runs on
   * mount, rather than needing to be driven from outside. Left `undefined`
   * for the in-place edit form in `TaskItem`, which has no such
   * requirement. */
  autoFocus?: boolean
}

/**
 * The task name/duration/priority form shared by task creation and inline
 * editing (see specs/task-management/spec.md, "Creating a task" and
 * "Editing a task"). Duration and priority are chosen from exactly nine and
 * five fixed buttons respectively, never free text (see
 * specs/task-management/spec.md, "Duration is chosen from a fixed set").
 *
 * Validation is not decided here: `onSubmit` reports which fields (if any)
 * were missing, and this component only renders the resulting messages,
 * keeping validation itself in the domain layer (see design.md, decision 1).
 */
export function TaskForm({
  heading,
  submitLabel,
  initialValues,
  onSubmit,
  onCancel,
  autoFocus,
}: TaskFormProps) {
  const nameId = useId()
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(initialValues?.name ?? '')
  const [duration, setDuration] = useState<Duration | undefined>(
    initialValues?.duration,
  )
  const [priority, setPriority] = useState<Priority | undefined>(
    initialValues?.priority,
  )
  const [errors, setErrors] = useState<TaskValidationField[]>([])

  useEffect(() => {
    if (autoFocus) {
      nameInputRef.current?.focus()
    }
    // Intentionally runs once, on mount only: a fresh mount is exactly the
    // "opened" moment this exists to catch (see the `autoFocus` prop doc
    // above), and re-focusing on every keystroke would fight the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const result = await onSubmit({ name, duration, priority })

    if (result.ok) {
      setErrors([])
      // Only the creation form clears itself after a success; an edit form
      // is unmounted by its caller once the edit is saved.
      if (!initialValues) {
        setName('')
        setDuration(undefined)
        setPriority(undefined)
      }
    } else {
      setErrors(result.errors)
    }
  }

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <h2 className="task-form__heading">{heading}</h2>

      <div className="task-form__field">
        <label htmlFor={nameId} className="task-form__label">
          Name
        </label>
        <input
          ref={nameInputRef}
          id={nameId}
          type="text"
          className="task-form__input"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <fieldset className="task-form__fieldset">
        <legend className="task-form__label">Duration</legend>
        <div className="task-form__chips">
          {DURATIONS.map((option) => (
            <button
              key={option}
              type="button"
              className="task-form__chip"
              aria-pressed={duration === option}
              onClick={() => setDuration(option)}
            >
              {formatDuration(option)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="task-form__fieldset">
        <legend className="task-form__label">Priority</legend>
        <div className="task-form__chips">
          {PRIORITIES.map((option) => (
            <button
              key={option}
              type="button"
              className="task-form__chip task-form__chip--priority"
              data-priority={option}
              aria-pressed={priority === option}
              onClick={() => setPriority(option)}
            >
              {PRIORITY_LABELS[option]}
            </button>
          ))}
        </div>
      </fieldset>

      {errors.length > 0 && (
        <div role="alert" className="task-form__errors">
          {errors.map((field) => (
            <p key={field} className="task-form__error">
              {FIELD_MESSAGES[field]}
            </p>
          ))}
        </div>
      )}

      <div className="task-form__actions">
        <button type="submit" className="task-form__submit">
          {submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            className="task-form__cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
