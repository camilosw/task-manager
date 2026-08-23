import type { Announcements } from '@dnd-kit/core'
import type { Task } from '../domain/task'

/**
 * Builds dnd-kit's screen-reader announcements for a reordering in the All
 * tab, naming tasks instead of dnd-kit's raw ids (see
 * specs/task-views/spec.md, "Reordering is operable without a drag
 * gesture" — "the outcome of a completed move is conveyed to assistive
 * technology rather than only shown visually").
 *
 * `DndContext` announces through its own live region by default as soon as
 * it is used at all, with generic wording ("Draggable item x was dropped
 * over droppable area y"); this replaces that wording with one that names
 * the task and, for a completed move, the neighbor it landed next to,
 * which is what makes the announcement meaningful rather than merely
 * present (see design.md, decision 7).
 */
export function reorderAnnouncements(tasks: Task[]): Announcements {
  function nameOf(id: string): string {
    return tasks.find((task) => task.id === id)?.name ?? id
  }

  return {
    onDragStart({ active }) {
      return `Picked up ${nameOf(String(active.id))}.`
    },
    onDragOver({ active, over }) {
      if (!over) {
        return `${nameOf(String(active.id))} is no longer over a position it can be moved to.`
      }
      return `${nameOf(String(active.id))} was moved near ${nameOf(String(over.id))}.`
    },
    onDragEnd({ active, over }) {
      if (!over) {
        return `${nameOf(String(active.id))} was dropped.`
      }
      return `${nameOf(String(active.id))} was moved to the position held by ${nameOf(String(over.id))}.`
    },
    onDragCancel({ active }) {
      return `Reordering was cancelled. ${nameOf(String(active.id))} was returned to its original position.`
    },
  }
}
