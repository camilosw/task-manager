import type { Task } from '../domain/task'

/**
 * The minimal shape this module needs from dnd-kit's `DragEndEvent` — just
 * the two ids, never dnd-kit's own types. Keeping this module's own
 * boundary narrow means its logic can be exercised with a hand-built event
 * shape, with no need to render a `DndContext` or perform a pointer/touch
 * gesture jsdom cannot produce (see design.md, decision 10: "The pointer and
 * touch drag gestures themselves | Manual").
 */
export type TaskDragEndEvent = {
  active: { id: string }
  over: { id: string } | null
}

/**
 * Translates a completed drag (or an abandoned one) into a `reorderTasks`
 * call, or into nothing at all (see specs/task-management/spec.md,
 * "Reordering a task within its priority level", and
 * specs/task-views/spec.md, "Tasks are reordered in the All tab only").
 *
 * `over === null` is an abandoned drag — the user started dragging and let
 * go without dropping on anything — and leaves every place unchanged (see
 * "An abandoned drag changes nothing").
 *
 * A drop over a task of a different priority is rejected here too, as
 * defence in depth alongside `reorderWithinPriority`'s own guard: dnd-kit
 * has no notion of the priority-group boundary between `SortableContext`s,
 * so it will still report a cross-group `over`, and nothing else stops
 * `onDragEnd` from acting on it (see design.md, decision 7, and "A drop
 * outside the group is rejected"). `reorderWithinPriority` would itself
 * refuse the same case, but the check is repeated here so the guard does
 * not depend on `tasks` happening to contain both ids — it is what makes
 * this handler a thin, self-contained translation from `{active, over}` to
 * a domain call rather than a pass-through that trusts dnd-kit's report.
 */
export function handleTaskDragEnd(
  event: TaskDragEndEvent,
  tasks: Task[],
  reorderTasks: (activeId: string, overId: string) => void,
): void {
  const { active, over } = event
  if (over === null) {
    return
  }

  const activeTask = tasks.find((task) => task.id === active.id)
  const overTask = tasks.find((task) => task.id === over.id)

  if (
    activeTask === undefined ||
    overTask === undefined ||
    activeTask.priority !== overTask.priority
  ) {
    return
  }

  reorderTasks(active.id, over.id)
}
