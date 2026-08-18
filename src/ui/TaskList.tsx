import type { EditTaskInput, EditTaskResult, Task } from '../domain/task'
import { TaskItem } from './TaskItem'

export type TaskListProps = {
  tasks: Task[]
  onEdit: (id: string, input: EditTaskInput) => Promise<EditTaskResult>
  onDelete: (id: string) => Promise<void>
}

/**
 * Renders a list of tasks, or the single-word empty state design.md pins
 * for every tab (see design.md, decision 10: "Every empty state uses the
 * single word 'empty'").
 */
export function TaskList({ tasks, onEdit, onDelete }: TaskListProps) {
  if (tasks.length === 0) {
    return <p>empty</p>
  }

  return (
    <ul>
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </ul>
  )
}
