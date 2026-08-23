import { resolveSnapshotTasks, type DaySnapshot } from '../domain/snapshot'
import type { EditTaskInput, EditTaskResult, Task } from '../domain/task'
import { PriorityGroups } from './PriorityGroups'

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
 * very low — through the shared `PriorityGroups` component (see
 * specs/task-views/spec.md, "The Today tab groups tasks by priority"). A
 * priority with no tasks in today's plan is omitted entirely, heading
 * included. Within a group, tasks are ordered by the user-arranged `place`
 * (see specs/task-views/spec.md, "Ordering within a Today group", and
 * design.md, decision 4) rather than by creation timestamp — sorting the
 * flat, resolved list by `place` before handing it to `PriorityGroups`
 * produces the same per-group order as sorting each group independently
 * would, since filtering a globally-sorted list preserves that order within
 * every subset.
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
  // Ordered by the user-arranged `place`, not creation timestamp (see
  // specs/task-views/spec.md, "Ordering within a Today group", and
  // design.md, decision 4). A task completed today keeps whatever place it
  // already held, so it stays at that position, struck through, rather than
  // moving.
  const sorted = [...planned].sort((a, b) => a.place - b.place)

  return (
    <PriorityGroups
      tasks={sorted}
      onEdit={onEdit}
      onDelete={onDelete}
      onComplete={onComplete}
    />
  )
}
