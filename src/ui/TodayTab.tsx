import { PRIORITIES } from '../domain/priority'
import { resolveSnapshotTasks, type DaySnapshot } from '../domain/snapshot'
import type { EditTaskInput, EditTaskResult, Task } from '../domain/task'
import { EmptyState } from './EmptyState'
import { PRIORITY_LABELS } from './priorityLabels'
import { TaskList } from './TaskList'
import './TodayTab.css'

export type TodayTabProps = {
  tasks: Task[]
  snapshot: DaySnapshot | null
  onEdit: (id: string, input: EditTaskInput) => Promise<EditTaskResult>
  onDelete: (id: string) => Promise<void>
  onComplete: (id: string) => Promise<void>
}

/**
 * The Today tab's content: the union of admitted urgent tasks and the
 * frozen non-urgent selection (see specs/daily-plan/spec.md, "Composition
 * of the daily plan"), resolved via `resolveSnapshotTasks` and grouped
 * under priority headings in the fixed order — urgent, high, medium, low,
 * very low (see specs/task-views/spec.md, "The Today tab groups tasks by
 * priority"). A priority with no tasks in today's plan is omitted
 * entirely, heading included. Within a group, tasks are ordered oldest
 * first by creation timestamp.
 *
 * `resolveSnapshotTasks` does not filter by completion, so a task
 * completed from Today stays in its group — `TaskItem` renders it struck
 * through — until the plan is next recomputed (see
 * specs/task-views/spec.md, "Completing a task from the Today tab keeps it
 * visible").
 */
export function TodayTab({
  tasks,
  snapshot,
  onEdit,
  onDelete,
  onComplete,
}: TodayTabProps) {
  const planned = snapshot ? resolveSnapshotTasks(snapshot, tasks) : []

  const groups = PRIORITIES.map((priority) => ({
    priority,
    tasks: planned
      .filter((task) => task.priority === priority)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
  })).filter((group) => group.tasks.length > 0)

  if (groups.length === 0) {
    return <EmptyState />
  }

  return (
    <>
      {groups.map((group) => (
        <section
          key={group.priority}
          aria-label={PRIORITY_LABELS[group.priority]}
          className="today-group"
        >
          <div className="today-group__heading">
            {/* A sibling of the heading, not a child of it, so the <h3>'s
                own text is never anything but the plain level name (see
                specs/task-views/spec.md, "A heading names its level in
                text" - color reinforces, it never replaces the name). */}
            <span
              className="today-group__marker"
              data-priority={group.priority}
              aria-hidden="true"
            />
            <h3 className="today-group__title">
              {PRIORITY_LABELS[group.priority]}
            </h3>
          </div>
          <TaskList
            tasks={group.tasks}
            onEdit={onEdit}
            onDelete={onDelete}
            onComplete={onComplete}
          />
        </section>
      ))}
    </>
  )
}
