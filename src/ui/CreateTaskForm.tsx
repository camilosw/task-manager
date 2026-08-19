import type { CreateTaskResult } from '../domain/task'
import type { CreateTaskFormInput } from './appStateContext'
import { TaskForm, type TaskFormValues } from './TaskForm'

export type CreateTaskFormProps = {
  createTask: (input: CreateTaskFormInput) => Promise<CreateTaskResult>
  onCancel?: () => void
  autoFocus?: boolean
}

/**
 * The task creation form, rendered inside `CreateTaskSheet`'s dialog (see
 * specs/task-management/spec.md, "Creating a task" and "Task creation is
 * opened on demand from a persistent control"). Wires `TaskForm` straight
 * to the store's `createTask` action, which performs the actual
 * validation; `onCancel` and `autoFocus` are forwarded straight through to
 * `TaskForm` for the sheet to drive.
 */
export function CreateTaskForm({
  createTask,
  onCancel,
  autoFocus,
}: CreateTaskFormProps) {
  function handleSubmit(values: TaskFormValues) {
    return createTask(values)
  }

  return (
    <TaskForm
      heading="Add a task"
      submitLabel="Add task"
      onSubmit={handleSubmit}
      onCancel={onCancel}
      autoFocus={autoFocus}
    />
  )
}
