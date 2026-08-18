import type { EditTaskInput, EditTaskResult, Task } from '../domain/task'
import { EmptyState } from './EmptyState'
import { TaskItem } from './TaskItem'

export type TaskListProps = {
  tasks: Task[]
  onEdit: (id: string, input: EditTaskInput) => Promise<EditTaskResult>
  onDelete: (id: string) => Promise<void>
  onComplete: (id: string) => Promise<void>
}

/**
 * Renders a list of tasks, already in the order the caller wants them
 * displayed — this component does no sorting or filtering of its own, so
 * it is reusable across the Today, All and Completed tabs (see
 * specs/task-views/spec.md) — or the single-word empty state design.md
 * pins for every tab (see design.md, decision 10: "Every empty state uses
 * the single word 'empty'").
 */
export function TaskList({
  tasks,
  onEdit,
  onDelete,
  onComplete,
}: TaskListProps) {
  if (tasks.length === 0) {
    return <EmptyState />
  }

  return (
    <ul>
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          onEdit={onEdit}
          onDelete={onDelete}
          onComplete={onComplete}
        />
      ))}
    </ul>
  )
}
