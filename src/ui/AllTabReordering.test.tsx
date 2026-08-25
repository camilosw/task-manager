import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { AppStateProvider } from './AppStateProvider'
import { TaskManagerApp } from './TaskManagerApp'
import { createInMemoryRepository } from '../persistence/inMemoryRepository'
import type { Repository } from '../persistence/repository'
import { reorderWithinPriority, type Task } from '../domain/task'

const FIXED_NOW = new Date('2026-08-18T09:00:00.000Z')

function makeTask(overrides: Partial<Task> & { id: string }): Task {
  return {
    name: overrides.id,
    duration: 30,
    priority: 'medium',
    recurrence: null,
    createdAt: new Date('2026-08-17T09:00:00.000Z'),
    place: 0,
    completedAt: null,
    lastCompletedOn: null,
    ...overrides,
  }
}

function renderApp(repository: Repository = createInMemoryRepository()) {
  return render(
    <AppStateProvider repository={repository} now={() => FIXED_NOW}>
      <TaskManagerApp />
    </AppStateProvider>,
  )
}

async function waitForLoaded() {
  await screen.findByRole('button', { name: 'Add a task' })
}

function switchTab(name: 'Today' | 'All' | 'Completed') {
  fireEvent.click(screen.getByRole('button', { name }))
}

describe('the reordering control is named (8.1)', () => {
  it('every pending row in the All tab exposes a reordering control carrying an accessible name', async () => {
    const taskA = makeTask({
      id: 'a',
      name: 'Task A',
      priority: 'medium',
      place: 0,
    })
    const taskB = makeTask({
      id: 'b',
      name: 'Task B',
      priority: 'high',
      place: 1,
    })

    const repository = createInMemoryRepository()
    await repository.saveTasks([taskA, taskB])
    await repository.saveSnapshot({
      date: '2026-08-18',
      plannedIds: [],
      admittedIds: [],
    })

    renderApp(repository)
    await waitForLoaded()
    switchTab('All')

    const allSection = screen.getByRole('region', { name: 'All tasks' })
    const items = within(allSection).getAllByRole('listitem')
    expect(items.length).toBe(2)

    items.forEach((item) => {
      const handle = within(item).getByRole('button', { name: 'Reorder' })
      expect(handle).toBeTruthy()
    })
  })

  it('does not offer a reordering control in the Today or Completed tabs', async () => {
    const planned = makeTask({ id: 'a', name: 'Task A', priority: 'medium' })
    const completedTask = makeTask({
      id: 'c',
      name: 'Completed task',
      completedAt: new Date('2026-08-18T07:00:00.000Z'),
    })
    const repository = createInMemoryRepository()
    await repository.saveTasks([planned, completedTask])
    await repository.saveSnapshot({
      date: '2026-08-18',
      plannedIds: [planned.id],
      admittedIds: [],
    })

    renderApp(repository)
    await waitForLoaded()

    const todaySection = screen.getByRole('region', { name: 'Today' })
    expect(
      within(todaySection).queryByRole('button', { name: 'Reorder' }),
    ).toBeNull()

    switchTab('Completed')
    const completedSection = screen.getByRole('region', {
      name: 'Completed tasks',
    })
    expect(
      within(completedSection).queryByRole('button', { name: 'Reorder' }),
    ).toBeNull()
  })
})

/**
 * jsdom never computes real layout, so every element's `getBoundingClientRect`
 * is a flat `{0,0,0,0}` rect by default — indistinguishable from any other
 * element's. dnd-kit's `KeyboardSensor` (via `sortableKeyboardCoordinates`)
 * needs *distinct* rects to tell "the next row down" from "the row itself",
 * since it picks a direction by comparing rect edges (see
 * @dnd-kit/sortable's `sortableKeyboardCoordinates`, which filters candidate
 * droppables by `collisionRect.top < rect.top` for `ArrowDown`). This mock
 * stacks every task row (`<li data-task-id>`, the node `SortableTaskItem`
 * gives to `useSortable`'s `setNodeRef`) in document order, one `ROW_HEIGHT`
 * apart — exactly the vertical list a real layout would produce, and enough
 * for the library's own direction/collision logic to run for real rather
 * than being stubbed out. Every other element keeps a `{0,0,0,0}` rect,
 * matching jsdom's real default.
 */
const ROW_HEIGHT = 60

function zeroRect(): DOMRect {
  return {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    toJSON() {
      return this
    },
  } as DOMRect
}

function mockTaskRowLayout() {
  beforeEach(() => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: Element) {
        const row = this.closest('li[data-task-id]')
        if (row === null) {
          return zeroRect()
        }
        const rows = Array.from(document.querySelectorAll('li[data-task-id]'))
        const index = rows.indexOf(row)
        const top = index * ROW_HEIGHT
        return {
          x: 0,
          y: top,
          top,
          left: 0,
          right: 300,
          bottom: top + ROW_HEIGHT,
          width: 300,
          height: ROW_HEIGHT,
          toJSON() {
            return this
          },
        } as DOMRect
      },
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })
}

/** Yields one real macrotask tick. `KeyboardSensor.attach()` schedules the
 * `document`-level listener that handles every key after the pickup one
 * (arrow keys, the drop key, Escape) via `setTimeout(fn, 0)` rather than
 * synchronously — a real dnd-kit implementation detail, not a test
 * convenience — so firing the follow-up keys in the same tick as the
 * pickup key would dispatch them before that listener exists. */
function nextTick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

/** Picks up `handle` (Space), presses `code` once to move, then drops
 * (Space) — the same three-step sequence `KeyboardSensor` documents for
 * moving a sortable item one position. */
async function moveByKeyboard(handle: HTMLElement, code: string) {
  handle.focus()
  fireEvent.keyDown(handle, { code: 'Space' })
  await nextTick()
  fireEvent.keyDown(handle, { code })
  await nextTick()
  fireEvent.keyDown(handle, { code: 'Space' })
  await nextTick()
}

function mediumTask(id: string, name: string, place: number): Task {
  return {
    id,
    name,
    duration: 30,
    priority: 'medium',
    recurrence: null,
    createdAt: new Date('2026-08-17T09:00:00.000Z'),
    place,
    completedAt: null,
    lastCompletedOn: null,
  }
}

describe('a task is moved by keyboard (8.5)', () => {
  mockTaskRowLayout()

  it('produces the same order a drag to that position would', async () => {
    const m1 = mediumTask('m1', 'Medium first', 0)
    const m2 = mediumTask('m2', 'Medium second', 1)
    const m3 = mediumTask('m3', 'Medium third', 2)

    const repository = createInMemoryRepository()
    await repository.saveTasks([m1, m2, m3])
    await repository.saveSnapshot({
      date: '2026-08-18',
      plannedIds: [],
      admittedIds: [],
    })

    renderApp(repository)
    await waitForLoaded()
    switchTab('All')

    const mediumGroup = screen.getByRole('region', { name: 'Medium' })
    const firstItem = within(mediumGroup)
      .getByText('Medium first')
      .closest('li')
    if (!firstItem) throw new Error('expected a list item')
    const handle = within(firstItem).getByRole('button', { name: 'Reorder' })

    // Moving "Medium first" one position down, by keyboard, targets
    // "Medium second" — the same `over` a pointer drag to that spot would
    // report — so the resulting *display* order must match
    // `reorderWithinPriority` applied to that same pair directly (the
    // domain function a drag end resolves through, per 8.2), sorted by the
    // `place` it assigns — `reorderWithinPriority` itself returns tasks in
    // their original array order with only `place` changed (ordering stays
    // derived, never stored as a list; see design.md, decision 2), so the
    // display order a caller would actually render is this sort, not the
    // returned array's own order.
    const expectedOrder = reorderWithinPriority([m1, m2, m3], 'm1', 'm2')
      .sort((a, b) => a.place - b.place)
      .map((task) => task.id)

    await moveByKeyboard(handle, 'ArrowDown')

    await waitFor(() => {
      const items = within(
        screen.getByRole('region', { name: 'Medium' }),
      ).getAllByRole('listitem')
      expect(items.map((item) => item.getAttribute('data-task-id'))).toEqual(
        expectedOrder,
      )
    })
  })
})

describe('the keyboard path cannot leave the group (8.6)', () => {
  mockTaskRowLayout()

  it('leaves a task at the last position of its group, with its priority unchanged, when moved past it', async () => {
    const m1 = mediumTask('m1', 'Medium first', 0)
    const m2 = mediumTask('m2', 'Medium second', 1)
    const low: Task = {
      id: 'low1',
      name: 'Low task',
      duration: 30,
      priority: 'low',
      recurrence: null,
      createdAt: new Date('2026-08-17T09:00:00.000Z'),
      place: 2,
      completedAt: null,
      lastCompletedOn: null,
    }

    const repository = createInMemoryRepository()
    await repository.saveTasks([m1, m2, low])
    await repository.saveSnapshot({
      date: '2026-08-18',
      plannedIds: [],
      admittedIds: [],
    })

    renderApp(repository)
    await waitForLoaded()
    switchTab('All')

    const mediumGroup = screen.getByRole('region', { name: 'Medium' })
    const lastItem = within(mediumGroup)
      .getByText('Medium second')
      .closest('li')
    if (!lastItem) throw new Error('expected a list item')
    const handle = within(lastItem).getByRole('button', { name: 'Reorder' })

    function dndLiveRegion(): HTMLElement {
      const region = screen
        .getAllByRole('status')
        .find((element) => element.getAttribute('aria-live') === 'assertive')
      if (!region) throw new Error('expected the dnd-kit live region')
      return region
    }

    // "Medium second" is already the last task in its group; the row
    // immediately below it in the document belongs to the low group, so an
    // attempted move past it must be rejected — the guard in dragReorder.ts
    // that keeps a drop from crossing priority groups applies identically
    // whether the drop was reported by a pointer or, as here, the keyboard.
    await moveByKeyboard(handle, 'ArrowDown')

    // The drop really did reach "Low task" — proof this is a rejection, not
    // a move that silently never happened (dnd-kit announces every
    // completed drag end regardless of what the app's own onDragEnd handler
    // decides to do with it).
    await waitFor(() => {
      expect(dndLiveRegion().textContent).toContain('Low task')
    })

    await waitFor(() => {
      const items = within(
        screen.getByRole('region', { name: 'Medium' }),
      ).getAllByRole('listitem')
      expect(items.map((item) => item.getAttribute('data-task-id'))).toEqual([
        'm1',
        'm2',
      ])
    })
    // Still under its original heading — its priority did not change.
    expect(
      within(screen.getByRole('region', { name: 'Low' })).queryByText(
        'Medium second',
      ),
    ).toBeNull()
  })
})

describe('a completed move is announced through the live region (8.7)', () => {
  mockTaskRowLayout()

  it('conveys the outcome of a completed keyboard move to assistive technology', async () => {
    const m1 = mediumTask('m1', 'Medium first', 0)
    const m2 = mediumTask('m2', 'Medium second', 1)

    const repository = createInMemoryRepository()
    await repository.saveTasks([m1, m2])
    await repository.saveSnapshot({
      date: '2026-08-18',
      plannedIds: [],
      admittedIds: [],
    })

    renderApp(repository)
    await waitForLoaded()
    switchTab('All')

    // dnd-kit's own live region, distinct from the app's action-feedback
    // region (see TaskManagerApp.test.tsx's `getFeedbackRegion` for the
    // same disambiguation): `aria-live="assertive"` is what dnd-kit's
    // `Accessibility` component always renders its announcements into,
    // regardless of which app mounts `DndContext`.
    function dndLiveRegion(): HTMLElement {
      const region = screen
        .getAllByRole('status')
        .find((element) => element.getAttribute('aria-live') === 'assertive')
      if (!region) throw new Error('expected the dnd-kit live region')
      return region
    }

    expect(dndLiveRegion().textContent).toBe('')

    const firstItem = within(screen.getByRole('region', { name: 'Medium' }))
      .getByText('Medium first')
      .closest('li')
    if (!firstItem) throw new Error('expected a list item')
    const handle = within(firstItem).getByRole('button', { name: 'Reorder' })

    await moveByKeyboard(handle, 'ArrowDown')

    // Names both the moved task and the neighbor it landed next to, rather
    // than a generic, un-actionable message (see reorderAnnouncements.ts) —
    // and specifically the *completed-move* wording, not merely the "picked
    // up" one every drag start already produces, which is what proves this
    // is announcing a real, finished reordering rather than only the start
    // of one.
    await waitFor(() => {
      expect(dndLiveRegion().textContent).toBe(
        'Medium first was moved to the position held by Medium second.',
      )
    })
  })
})

/** The app's own confirmation region (design.md, decision 7), disambiguated
 * from dnd-kit's own `role="status"` live region by `aria-live`: this app's
 * region is `polite`; dnd-kit's is `assertive` (see the `dndLiveRegion`
 * helpers above, and TaskManagerApp.test.tsx's `getFeedbackRegion`). */
function getFeedbackRegion(): HTMLElement {
  const region = screen
    .getAllByRole('status')
    .find((element) => element.getAttribute('aria-live') === 'polite')
  if (!region) throw new Error('expected the app feedback region')
  return region
}

describe('a completed reordering confirms nothing (9.6)', () => {
  mockTaskRowLayout()

  it('does not show or replace a confirmation when a keyboard reordering completes', async () => {
    const urgentTask = makeTask({
      id: 'urgent-1',
      name: 'Urgent one',
      priority: 'urgent',
      place: 0,
    })
    const m1 = mediumTask('m1', 'Medium first', 1)
    const m2 = mediumTask('m2', 'Medium second', 2)

    const repository = createInMemoryRepository()
    await repository.saveTasks([urgentTask, m1, m2])
    await repository.saveSnapshot({
      date: '2026-08-18',
      plannedIds: [urgentTask.id],
      admittedIds: [],
    })

    renderApp(repository)
    await waitForLoaded()

    // Puts a confirmation on screen from an earlier, unrelated action, so
    // the reordering below can be shown not to replace it (see
    // specs/action-feedback/spec.md, "Reordering a task confirms nothing" —
    // "a confirmation already on screen from an earlier action is not
    // replaced by the reordering").
    const urgentItem = within(screen.getByRole('region', { name: 'Urgent' }))
      .getByText('Urgent one')
      .closest('li')
    if (!urgentItem) throw new Error('expected a list item')
    fireEvent.click(within(urgentItem).getByRole('checkbox'))
    expect(await screen.findByText('Task completed')).toBeTruthy()

    switchTab('All')
    const mediumGroup = screen.getByRole('region', { name: 'Medium' })
    const firstItem = within(mediumGroup)
      .getByText('Medium first')
      .closest('li')
    if (!firstItem) throw new Error('expected a list item')
    const handle = within(firstItem).getByRole('button', { name: 'Reorder' })

    await moveByKeyboard(handle, 'ArrowDown')

    // The reordering really completed - proof this isn't merely "nothing
    // happened yet".
    await waitFor(() => {
      const items = within(
        screen.getByRole('region', { name: 'Medium' }),
      ).getAllByRole('listitem')
      expect(items.map((item) => item.getAttribute('data-task-id'))).toEqual([
        'm2',
        'm1',
      ])
    })
    // Yet the app's confirmation region still shows the earlier action's
    // message, unchanged - no "Task moved" or similar appeared, and the
    // prior confirmation was not cleared either.
    expect(getFeedbackRegion().textContent).toBe('Task completed')
  })
})

describe('a rejected or abandoned drag confirms nothing (9.6)', () => {
  mockTaskRowLayout()

  it('shows no confirmation and no validation message after a drop rejected for crossing priority groups', async () => {
    const m1 = mediumTask('m1', 'Medium first', 0)
    const m2 = mediumTask('m2', 'Medium second', 1)
    const low: Task = {
      id: 'low1',
      name: 'Low task',
      duration: 30,
      priority: 'low',
      recurrence: null,
      createdAt: new Date('2026-08-17T09:00:00.000Z'),
      place: 2,
      completedAt: null,
      lastCompletedOn: null,
    }

    const repository = createInMemoryRepository()
    await repository.saveTasks([m1, m2, low])
    await repository.saveSnapshot({
      date: '2026-08-18',
      plannedIds: [],
      admittedIds: [],
    })

    renderApp(repository)
    await waitForLoaded()
    switchTab('All')

    const mediumGroup = screen.getByRole('region', { name: 'Medium' })
    const lastItem = within(mediumGroup)
      .getByText('Medium second')
      .closest('li')
    if (!lastItem) throw new Error('expected a list item')
    const handle = within(lastItem).getByRole('button', { name: 'Reorder' })

    function dndLiveRegion(): HTMLElement {
      const region = screen
        .getAllByRole('status')
        .find((element) => element.getAttribute('aria-live') === 'assertive')
      if (!region) throw new Error('expected the dnd-kit live region')
      return region
    }

    // A drop that lands in a different priority group — rejected, per 8.3
    // and 8.6.
    await moveByKeyboard(handle, 'ArrowDown')

    // The drop really reached "Low task" - proof this is a rejection dnd-kit
    // itself completed, not a move that never happened.
    await waitFor(() => {
      expect(dndLiveRegion().textContent).toContain('Low task')
    })

    expect(getFeedbackRegion().textContent).toBe('')
    expect(screen.queryByText(/required/i)).toBeNull()
  })

  it('shows no confirmation and no validation message after an abandoned (escaped) keyboard drag', async () => {
    const m1 = mediumTask('m1', 'Medium first', 0)
    const m2 = mediumTask('m2', 'Medium second', 1)

    const repository = createInMemoryRepository()
    await repository.saveTasks([m1, m2])
    await repository.saveSnapshot({
      date: '2026-08-18',
      plannedIds: [],
      admittedIds: [],
    })

    renderApp(repository)
    await waitForLoaded()
    switchTab('All')

    const mediumGroup = screen.getByRole('region', { name: 'Medium' })
    const firstItem = within(mediumGroup)
      .getByText('Medium first')
      .closest('li')
    if (!firstItem) throw new Error('expected a list item')
    const handle = within(firstItem).getByRole('button', { name: 'Reorder' })

    handle.focus()
    fireEvent.keyDown(handle, { code: 'Space' })
    await nextTick()
    // Escape cancels the drag rather than dropping it (dnd-kit's
    // KeyboardSensor default `cancel` code) - this is the keyboard
    // equivalent of "abandons the drag without dropping it".
    fireEvent.keyDown(handle, { code: 'Escape' })
    await nextTick()

    // The places are untouched - proof the drag was really abandoned rather
    // than silently completed.
    const items = within(
      screen.getByRole('region', { name: 'Medium' }),
    ).getAllByRole('listitem')
    expect(items.map((item) => item.getAttribute('data-task-id'))).toEqual([
      'm1',
      'm2',
    ])
    expect(getFeedbackRegion().textContent).toBe('')
    expect(screen.queryByText(/required/i)).toBeNull()
  })
})
