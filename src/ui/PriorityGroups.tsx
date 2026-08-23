import { PRIORITIES } from '../domain/priority'
import type { EditTaskInput, EditTaskResult, Task } from '../domain/task'
import { EmptyState } from './EmptyState'
import { PRIORITY_LABELS } from './priorityLabels'
import { TaskList } from './TaskList'
import './PriorityGroups.css'

export type PriorityGroupsProps = {
  tasks: Task[]
  onEdit: (id: string, input: EditTaskInput) => Promise<EditTaskResult>
  onDelete: (id: string) => Promise<void>
  onComplete: (id: string) => Promise<void>
}

/**
 * Groups `tasks` under priority headings, in the fixed order urgent, high,
 * medium, low, very low, and renders each group's tasks through `TaskList`
 * (see specs/task-views/spec.md, "The Today tab groups tasks by priority"
 * and "The All tab groups tasks by priority"). Shared by `TodayTab` and the
 * All tab so the two surfaces present a group the same way rather than
 * carrying two implementations of the same structure (see design.md,
 * decision 5 and the proposal's Impact section: "a candidate for shared
 * rendering rather than a second implementation").
 *
 * `tasks` is rendered in the order it is given — filtering by priority
 * (via `Array#filter`, which preserves relative order) is this component's
 * job, but *sorting* within a group is the caller's, since Today and All
 * order their groups by different keys (creation time and place,
 * respectively, as of this section; see TodayTab.tsx and
 * TaskManagerApp.tsx).
 *
 * A priority level with no tasks is omitted entirely, heading included —
 * neither the heading nor an empty placeholder is shown (see
 * specs/task-views/spec.md, "Empty priority groups are hidden"). When no
 * group has any tasks, a single empty state is shown in their place, with
 * no priority headings at all (see specs/task-views/spec.md, "The All tab
 * is empty").
 */
export function PriorityGroups({
  tasks,
  onEdit,
  onDelete,
  onComplete,
}: PriorityGroupsProps) {
  const groups = PRIORITIES.map((priority) => ({
    priority,
    tasks: tasks.filter((task) => task.priority === priority),
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
          className="priority-group"
        >
          <div className="priority-group__heading">
            {/* A sibling of the heading, not a child of it, so the <h3>'s
                own text is never anything but the plain level name (see
                specs/task-views/spec.md, "A heading names its level in
                text" - color reinforces, it never replaces the name). */}
            <span
              className="priority-group__marker"
              data-priority={group.priority}
              aria-hidden="true"
            />
            <h3 className="priority-group__title">
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
