import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { EditTaskInput, EditTaskResult, Task } from '../domain/task'
import { GripIcon } from './icons'
import { TaskItem } from './TaskItem'
import './SortableTaskItem.css'

export type SortableTaskItemProps = {
  task: Task
  onEdit: (id: string, input: EditTaskInput) => Promise<EditTaskResult>
  onDelete: (id: string) => Promise<void>
  onComplete: (id: string) => Promise<void>
}

/**
 * The All tab's variant of `TaskItem`: identical row, plus a dedicated drag
 * handle wired to dnd-kit (see specs/task-views/spec.md, "Tasks are
 * reordered in the All tab only", and design.md, decision 7). This is the
 * only place `@dnd-kit` is imported outside `TaskManagerApp.tsx` — `TaskItem`
 * itself, and every other tab, stay ignorant of the drag library.
 *
 * `setNodeRef` (the node dnd-kit measures and transforms while dragging) is
 * given to the row itself via `TaskItem`'s `rootRef`/`rootStyle`.
 * `setActivatorNodeRef` — the node dnd-kit's sensors actually listen on — is
 * given only to the handle button, along with `attributes` and `listeners`,
 * so a pointer, touch or keyboard drag can start only from the handle and
 * never from the checkbox, name, or edit/delete controls (see tasks.md,
 * 8.1 and 10.2). The handle's `aria-label` is what makes it "a reordering
 * control carrying an accessible name" (specs/task-views/spec.md, "The
 * reordering control is named").
 */
export function SortableTaskItem({
  task,
  onEdit,
  onDelete,
  onComplete,
}: SortableTaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <TaskItem
      task={task}
      onEdit={onEdit}
      onDelete={onDelete}
      onComplete={onComplete}
      rootRef={setNodeRef}
      rootStyle={style}
      dragHandle={
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="task-row__icon-button task-row__handle"
          aria-label="Reorder"
          {...attributes}
          {...listeners}
        >
          <GripIcon />
        </button>
      }
    />
  )
}
