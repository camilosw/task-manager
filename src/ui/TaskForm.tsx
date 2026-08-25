import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { DURATIONS, formatDuration, type Duration } from '../domain/duration'
import { PRIORITIES, type Priority } from '../domain/priority'
import {
  formatRule,
  isCompleteRule,
  type Nth,
  type RecurrenceRuleDraft,
  type Weekday,
} from '../domain/recurrence'
import type { TaskValidationField } from '../domain/task'
import { PRIORITY_LABELS } from './priorityLabels'
import './TaskForm.css'

const FIELD_MESSAGES: Record<TaskValidationField, string> = {
  name: 'Name is required.',
  duration: 'Duration is required.',
  priority: 'Priority is required.',
  rule: 'A repetition rule is required.',
}

/** The task type choice above `Duration` (see design.md, decision 11): which
 * one is selected decides whether the `Priority` chips or the repetition
 * rule builder is shown, and which of `priority`/`recurrence` `TaskForm`
 * submits. */
type TaskType = 'one-off' | 'recurring'

/** Every day of the week, in `Weekday`'s `Date#getDay` numbering
 * (`0` = Sunday), so the weekday buttons below are generated from one list
 * rather than seven repeated literals. */
const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6]

const WEEKDAY_LABELS: Record<Weekday, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
}

/** The five positions a monthly rule's `nth` can take, in the order the
 * position buttons are offered — matching `formatRule`'s own ordering and
 * `Nth`'s "first through fourth, or last" vocabulary (see design.md,
 * decision 5). */
const NTH_OPTIONS: { value: Nth; label: string }[] = [
  { value: 1, label: 'First' },
  { value: 2, label: 'Second' },
  { value: 3, label: 'Third' },
  { value: 4, label: 'Fourth' },
  { value: -1, label: 'Last' },
]

const EMPTY_WEEKLY_DRAFT: RecurrenceRuleDraft = { kind: 'weekly', weekdays: [] }
const EMPTY_MONTHLY_DRAFT: RecurrenceRuleDraft = {
  kind: 'monthly-weekday',
  nth: undefined,
  weekday: undefined,
}

/** The values a `TaskForm` submits: a raw name plus whichever duration,
 * priority and repetition-rule controls (if any) have been selected.
 * `priority` and `recurrence` are mutually exclusive, mirroring
 * `CreateTaskInput`/`EditTaskInput` (see `src/domain/task.ts`): exactly one
 * is given, selected by the form's `Type` choice, never both. */
export type TaskFormValues = {
  name: string
  duration?: Duration
  priority?: Priority
  recurrence?: RecurrenceRuleDraft
}

export type TaskFormSubmitResult =
  { ok: true } | { ok: false; errors: TaskValidationField[] }

export type TaskFormProps = {
  heading: string
  submitLabel: string
  /** Pre-fills the form for editing. Omitted for a fresh creation form,
   * which starts with an empty name, no duration/priority selected, the
   * type defaulting to one-off, and no repetition rule built (see
   * specs/task-management/spec.md, "The form starts empty every time it is
   * opened"). */
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
 * The task name/duration/type/priority-or-rule form shared by task creation
 * and inline editing (see specs/task-management/spec.md, "Creating a task",
 * "Editing a task", and "The creation and edit form offers a task type and
 * a rule builder"). Duration is chosen from exactly nine fixed buttons,
 * never free text (see specs/task-management/spec.md, "Duration is chosen
 * from a fixed set").
 *
 * The `Type` choice (`One-off` / `Recurring`, defaulting to one-off) decides
 * whether the five `Priority` chips or the repetition rule builder is shown
 * — never both at once, so the priority/rule exclusion is visible in the
 * form and not just enforced on submission (see design.md, decision 11).
 * The rule builder itself is two levels: a `Frequency` choice, then either
 * a multi-select `Days of the week` row (`Weekly`) or a single-select
 * `Position` plus `Day of the week` row (`Monthly`); a plain-language echo
 * of the rule being built renders below it once it is complete
 * (`formatRule`, `'long'` form), in an always-mounted `role="status"`
 * region so assistive technology picks up its updates.
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
  const [taskType, setTaskType] = useState<TaskType>(
    initialValues?.recurrence !== undefined ? 'recurring' : 'one-off',
  )
  const [ruleDraft, setRuleDraft] = useState<RecurrenceRuleDraft>(
    initialValues?.recurrence ?? EMPTY_WEEKLY_DRAFT,
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

    const isRecurring = taskType === 'recurring'
    const result = await onSubmit({
      name,
      duration,
      priority: isRecurring ? undefined : priority,
      recurrence: isRecurring ? ruleDraft : undefined,
    })

    if (result.ok) {
      setErrors([])
      // Only the creation form clears itself after a success; an edit form
      // is unmounted by its caller once the edit is saved. A rejection
      // (the `else` branch) must leave the type choice and the built rule
      // exactly as they were (specs/task-management/spec.md, "A rejected
      // recurring creation keeps the rule that was built") — so nothing
      // here runs on that branch.
      if (!initialValues) {
        setName('')
        setDuration(undefined)
        setPriority(undefined)
        setTaskType('one-off')
        setRuleDraft(EMPTY_WEEKLY_DRAFT)
      }
    } else {
      setErrors(result.errors)
    }
  }

  function handleFrequencyChange(kind: RecurrenceRuleDraft['kind']) {
    setRuleDraft((current) =>
      current.kind === kind
        ? current
        : kind === 'weekly'
          ? EMPTY_WEEKLY_DRAFT
          : EMPTY_MONTHLY_DRAFT,
    )
  }

  function toggleWeeklyDay(day: Weekday) {
    setRuleDraft((current) => {
      if (current.kind !== 'weekly') {
        return current
      }
      const weekdays = current.weekdays.includes(day)
        ? current.weekdays.filter((existing) => existing !== day)
        : [...current.weekdays, day].sort((a, b) => a - b)
      return { kind: 'weekly', weekdays }
    })
  }

  function setMonthlyNth(nth: Nth) {
    setRuleDraft((current) =>
      current.kind === 'monthly-weekday' ? { ...current, nth } : current,
    )
  }

  function setMonthlyWeekday(weekday: Weekday) {
    setRuleDraft((current) =>
      current.kind === 'monthly-weekday' ? { ...current, weekday } : current,
    )
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
        <legend className="task-form__label">Type</legend>
        <div className="task-form__chips">
          <button
            type="button"
            className="task-form__chip"
            aria-pressed={taskType === 'one-off'}
            onClick={() => setTaskType('one-off')}
          >
            One-off
          </button>
          <button
            type="button"
            className="task-form__chip"
            aria-pressed={taskType === 'recurring'}
            onClick={() => setTaskType('recurring')}
          >
            Recurring
          </button>
        </div>
      </fieldset>

      {taskType === 'one-off' ? (
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
      ) : (
        <>
          <fieldset className="task-form__fieldset">
            <legend className="task-form__label">Frequency</legend>
            <div className="task-form__chips">
              <button
                type="button"
                className="task-form__chip"
                aria-pressed={ruleDraft.kind === 'weekly'}
                onClick={() => handleFrequencyChange('weekly')}
              >
                Weekly
              </button>
              <button
                type="button"
                className="task-form__chip"
                aria-pressed={ruleDraft.kind === 'monthly-weekday'}
                onClick={() => handleFrequencyChange('monthly-weekday')}
              >
                Monthly
              </button>
            </div>
          </fieldset>

          {ruleDraft.kind === 'weekly' ? (
            <fieldset className="task-form__fieldset">
              <legend className="task-form__label">Days of the week</legend>
              <div className="task-form__chips">
                {WEEKDAYS.map((day) => (
                  <button
                    key={day}
                    type="button"
                    className="task-form__chip"
                    aria-pressed={ruleDraft.weekdays.includes(day)}
                    onClick={() => toggleWeeklyDay(day)}
                  >
                    {WEEKDAY_LABELS[day]}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : (
            <>
              <fieldset className="task-form__fieldset">
                <legend className="task-form__label">Position</legend>
                <div className="task-form__chips">
                  {NTH_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className="task-form__chip"
                      aria-pressed={ruleDraft.nth === option.value}
                      onClick={() => setMonthlyNth(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="task-form__fieldset">
                <legend className="task-form__label">Day of the week</legend>
                <div className="task-form__chips">
                  {WEEKDAYS.map((day) => (
                    <button
                      key={day}
                      type="button"
                      className="task-form__chip"
                      aria-pressed={ruleDraft.weekday === day}
                      onClick={() => setMonthlyWeekday(day)}
                    >
                      {WEEKDAY_LABELS[day]}
                    </button>
                  ))}
                </div>
              </fieldset>
            </>
          )}

          <p role="status" aria-live="polite" className="task-form__echo">
            {isCompleteRule(ruleDraft) ? formatRule(ruleDraft, 'long') : ''}
          </p>
        </>
      )}

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
