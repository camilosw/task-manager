import type { CreateTaskResult } from '../domain/task'
import type { CreateTaskFormInput } from './appStateContext'
import { TaskForm, type TaskFormValues } from './TaskForm'

export type CreateTaskFormProps = {
  createTask: (input: CreateTaskFormInput) => Promise<CreateTaskResult>
}

/**
 * The task creation form shown above the task list (see
 * specs/task-management/spec.md, "Creating a task"). Wires `TaskForm`
 * straight to the store's `createTask` action, which performs the actual
 * validation.
 */
export function CreateTaskForm({ createTask }: CreateTaskFormProps) {
  function handleSubmit(values: TaskFormValues) {
    return createTask(values)
  }

  return (
    <TaskForm
      heading="Add a task"
      submitLabel="Add task"
      onSubmit={handleSubmit}
    />
  )
}
