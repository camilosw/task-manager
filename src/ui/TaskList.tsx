import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { EditTaskInput, EditTaskResult, Task } from '../domain/task'
import { EmptyState } from './EmptyState'
import { SortableTaskItem } from './SortableTaskItem'
import { TaskItem } from './TaskItem'
import './TaskList.css'

export type TaskListProps = {
  tasks: Task[]
  onEdit: (id: string, input: EditTaskInput) => Promise<EditTaskResult>
  onDelete: (id: string) => Promise<void>
  onComplete: (id: string) => Promise<void>
  /** When true, renders each task through `SortableTaskItem` instead of the
   * plain `TaskItem`, inside a `SortableContext` scoped to exactly this
   * list's ids (see specs/task-views/spec.md, "Tasks are reordered in the
   * All tab only", and design.md, decision 7: one `SortableContext` per
   * priority group). Only the All tab passes this — Today and Completed
   * omit it and so render exactly as before, with no dnd-kit involvement at
   * all and no reordering control (see "The other tabs offer no
   * reordering"). Left `undefined` by default so every existing caller is
   * unaffected. */
  reorderable?: boolean
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
  reorderable,
}: TaskListProps) {
  if (tasks.length === 0) {
    return <EmptyState />
  }

  if (reorderable) {
    return (
      <SortableContext
        items={tasks.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="task-list">
          {tasks.map((task) => (
            <SortableTaskItem
              key={task.id}
              task={task}
              onEdit={onEdit}
              onDelete={onDelete}
              onComplete={onComplete}
            />
          ))}
        </ul>
      </SortableContext>
    )
  }

  return (
    <ul className="task-list">
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
