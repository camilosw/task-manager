import { useId, useState, type FormEvent } from 'react'
import { DURATIONS, formatDuration, type Duration } from '../domain/duration'
import { PRIORITIES, type Priority } from '../domain/priority'
import type { TaskValidationField } from '../domain/task'
import { PRIORITY_LABELS } from './priorityLabels'

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
}: TaskFormProps) {
  const nameId = useId()
  const [name, setName] = useState(initialValues?.name ?? '')
  const [duration, setDuration] = useState<Duration | undefined>(
    initialValues?.duration,
  )
  const [priority, setPriority] = useState<Priority | undefined>(
    initialValues?.priority,
  )
  const [errors, setErrors] = useState<TaskValidationField[]>([])

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
    <form onSubmit={handleSubmit}>
      <h2>{heading}</h2>

      <label htmlFor={nameId}>Name</label>
      <input
        id={nameId}
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />

      <fieldset>
        <legend>Duration</legend>
        {DURATIONS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={duration === option}
            onClick={() => setDuration(option)}
          >
            {formatDuration(option)}
          </button>
        ))}
      </fieldset>

      <fieldset>
        <legend>Priority</legend>
        {PRIORITIES.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={priority === option}
            onClick={() => setPriority(option)}
          >
            {PRIORITY_LABELS[option]}
          </button>
        ))}
      </fieldset>

      {errors.length > 0 && (
        <div role="alert">
          {errors.map((field) => (
            <p key={field}>{FIELD_MESSAGES[field]}</p>
          ))}
        </div>
      )}

      <button type="submit">{submitLabel}</button>
      {onCancel && (
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      )}
    </form>
  )
}
