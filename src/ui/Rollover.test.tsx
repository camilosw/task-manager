import { describe, expect, it, vi } from 'vitest'
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
import type { Task } from '../domain/task'
import type { DaySnapshot } from '../domain/snapshot'

function makeTask(overrides: Partial<Task> & { id: string }): Task {
  return {
    name: overrides.id,
    duration: 30,
    priority: 'medium',
    createdAt: new Date('2026-08-17T09:00:00.000Z'),
    completedAt: null,
    ...overrides,
  }
}

function renderApp(repository: Repository, now: () => Date) {
  return render(
    <AppStateProvider repository={repository} now={now}>
      <TaskManagerApp />
    </AppStateProvider>,
  )
}

/** Waits for the initial load to finish. The create form now lives behind
 * the add-task control rather than always on screen (see design.md,
 * decision 6), so this anchors on that control instead of the "Name"
 * field it used to resolve on. */
async function waitForLoaded() {
  await screen.findByRole('button', { name: 'Add a task' })
}

/** Opens the creation sheet and submits the form. Available regardless of
 * which tab is active, since the add-task control is rendered above the
 * tabs on every one of them. */
function createTaskViaForm(
  name: string,
  durationLabel: string,
  priorityLabel: string,
) {
  fireEvent.click(screen.getByRole('button', { name: 'Add a task' }))
  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: name },
  })
  fireEvent.click(
    within(screen.getByRole('group', { name: 'Duration' })).getByRole(
      'button',
      { name: durationLabel },
    ),
  )
  fireEvent.click(
    within(screen.getByRole('group', { name: 'Priority' })).getByRole(
      'button',
      { name: priorityLabel },
    ),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Add task' }))
}

describe('foreground rollover (10.1)', () => {
  it('recomputes on returning to the foreground when the stored date is earlier, and not when it is equal', async () => {
    let currentNow = new Date('2026-08-17T09:00:00.000Z')
    const now = () => currentNow

    const taskA = makeTask({ id: 'task-a', name: 'Task A', priority: 'medium' })
    const taskB = makeTask({ id: 'task-b', name: 'Task B', priority: 'medium' })

    const repository = createInMemoryRepository()
    await repository.saveTasks([taskA, taskB])
    await repository.saveSnapshot({
      date: '2026-08-17',
      plannedIds: [taskA.id],
      admittedIds: [],
    })

    renderApp(repository, now)
    await waitForLoaded()

    // Mounting with an equal (stored) date must not recompute: the frozen
    // plan from 2026-08-17 (Task A only) is shown unchanged, even though
    // Task B is pending and would be picked up by a fresh computation.
    const todaySection = screen.getByRole('region', { name: 'Today' })
    expect(within(todaySection).getByText('Task A')).toBeTruthy()
    expect(within(todaySection).queryByText('Task B')).toBeNull()

    // The device's local date advances, and the application returns to the
    // foreground.
    currentNow = new Date('2026-08-18T09:05:00.000Z')
    fireEvent(document, new Event('visibilitychange'))

    await waitFor(() => {
      expect(within(todaySection).queryByText('Task B')).toBeTruthy()
    })
    expect(within(todaySection).getByText('Task A')).toBeTruthy()

    const afterRecompute = await repository.loadAll()
    expect(afterRecompute.snapshot?.date).toBe('2026-08-18')

    // Returning to the foreground again on the same (now current) date must
    // not trigger another recompute.
    const saveSnapshotSpy = vi.spyOn(repository, 'saveSnapshot')
    fireEvent(document, new Event('visibilitychange'))
    await Promise.resolve()
    await Promise.resolve()
    expect(saveSnapshotSpy).not.toHaveBeenCalled()
  })
})

describe('reopening after several days away (10.2)', () => {
  it('produces a single plan for the current date, ignoring tasks completed on intervening days', async () => {
    const currentNow = new Date('2026-08-25T09:00:00.000Z')
    const now = () => currentNow

    const pending = makeTask({
      id: 'still-pending',
      name: 'Still pending',
      priority: 'medium',
    })
    const staleCompleted = makeTask({
      id: 'stale-completed',
      name: 'Completed days ago',
      priority: 'urgent',
      completedAt: new Date('2026-08-20T10:00:00.000Z'),
    })

    const repository = createInMemoryRepository()
    await repository.saveTasks([pending, staleCompleted])
    await repository.saveSnapshot({
      date: '2026-08-18',
      plannedIds: [],
      admittedIds: [],
    })
    const saveSnapshotSpy = vi.spyOn(repository, 'saveSnapshot')

    renderApp(repository, now)
    await waitForLoaded()

    // Exactly one recomputation happened, not one per intervening day.
    expect(saveSnapshotSpy).toHaveBeenCalledTimes(1)
    const persisted = await repository.loadAll()
    expect(persisted.snapshot?.date).toBe('2026-08-25')

    const todaySection = screen.getByRole('region', { name: 'Today' })
    expect(within(todaySection).getByText('Still pending')).toBeTruthy()
    expect(within(todaySection).queryByText('Completed days ago')).toBeNull()
  })
})

describe('the plan stays fixed while the app remains in the foreground (10.3)', () => {
  it('is not replaced by time passing, completing a task, or creating a new task', async () => {
    const currentNow = new Date('2026-08-18T09:00:00.000Z')
    const now = () => currentNow

    const planned = makeTask({
      id: 'planned',
      name: 'Planned task',
      priority: 'medium',
    })
    const repository = createInMemoryRepository()
    await repository.saveTasks([planned])
    await repository.saveSnapshot({
      date: '2026-08-18',
      plannedIds: [planned.id],
      admittedIds: [],
    })

    renderApp(repository, now)
    await waitForLoaded()
    const saveSnapshotSpy = vi.spyOn(repository, 'saveSnapshot')

    const todaySection = screen.getByRole('region', { name: 'Today' })
    const item = within(todaySection).getByText('Planned task').closest('li')
    if (!item) throw new Error('expected a list item')
    fireEvent.click(within(item).getByRole('button', { name: 'Complete' }))
    await waitFor(() => {
      expect(within(todaySection).getByText('Planned task').tagName).toBe('S')
    })

    createTaskViaForm('New non-urgent task', '15m', 'Low')
    await waitFor(async () => {
      // The creation sheet closes on a successful submission (see
      // specs/task-management/spec.md, "A successful creation closes the
      // form") - proof the task was created - while the plan stays put.
      const persisted = await repository.loadAll()
      expect(
        persisted.tasks.some((task) => task.name === 'New non-urgent task'),
      ).toBe(true)
    })

    expect(within(todaySection).queryByText('New non-urgent task')).toBeNull()
    expect(saveSnapshotSpy).not.toHaveBeenCalled()

    const persisted = await repository.loadAll()
    expect(persisted.snapshot).toEqual({
      date: '2026-08-18',
      plannedIds: [planned.id],
      admittedIds: [],
    })
  })
})

describe('manual recalculation (10.4)', () => {
  it('rebuilds the plan from scratch, admitting newly created tasks and dropping completed ones', async () => {
    const currentNow = new Date('2026-08-18T09:00:00.000Z')
    const now = () => currentNow

    const keep = makeTask({
      id: 'keep',
      name: 'Keep working',
      priority: 'medium',
    })
    const toComplete = makeTask({
      id: 'to-complete',
      name: 'Will be completed',
      priority: 'medium',
    })

    const repository = createInMemoryRepository()
    await repository.saveTasks([keep, toComplete])
    await repository.saveSnapshot({
      date: '2026-08-18',
      plannedIds: [keep.id, toComplete.id],
      admittedIds: [],
    })

    renderApp(repository, now)
    await waitForLoaded()

    const todaySection = screen.getByRole('region', { name: 'Today' })
    const item = within(todaySection)
      .getByText('Will be completed')
      .closest('li')
    if (!item) throw new Error('expected a list item')
    fireEvent.click(within(item).getByRole('button', { name: 'Complete' }))
    await waitFor(() => {
      expect(within(todaySection).getByText('Will be completed').tagName).toBe(
        'S',
      )
    })

    createTaskViaForm('Newly eligible', '15m', 'Low')
    await waitFor(async () => {
      const persisted = await repository.loadAll()
      expect(
        persisted.tasks.some((task) => task.name === 'Newly eligible'),
      ).toBe(true)
    })
    expect(within(todaySection).queryByText('Newly eligible')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Recalculate today' }))

    await waitFor(() => {
      expect(within(todaySection).queryByText('Will be completed')).toBeNull()
    })
    expect(within(todaySection).getByText('Keep working')).toBeTruthy()
    expect(within(todaySection).getByText('Newly eligible')).toBeTruthy()
  })
})

describe('urgent task admitted immediately (10.5)', () => {
  it('shows a newly created urgent task in Today immediately, and keeps it struck through after completion', async () => {
    const currentNow = new Date('2026-08-18T09:00:00.000Z')
    const now = () => currentNow

    const repository = createInMemoryRepository()
    await repository.saveSnapshot({
      date: '2026-08-18',
      plannedIds: [],
      admittedIds: [],
    })

    renderApp(repository, now)
    await waitForLoaded()

    createTaskViaForm('Fix production outage', '20m', 'Urgent')

    const todaySection = screen.getByRole('region', { name: 'Today' })
    expect(
      await within(todaySection).findByText('Fix production outage'),
    ).toBeTruthy()

    const item = within(todaySection)
      .getByText('Fix production outage')
      .closest('li')
    if (!item) throw new Error('expected a list item')
    fireEvent.click(within(item).getByRole('button', { name: 'Complete' }))

    const struck = await within(todaySection).findByText(
      'Fix production outage',
    )
    expect(struck.tagName).toBe('S')
  })
})

describe('reload persistence (10.6)', () => {
  it('shows a completed task still struck through after a reload, with the frozen selection unchanged', async () => {
    const currentNow = new Date('2026-08-18T09:00:00.000Z')
    const now = () => currentNow

    const task = makeTask({
      id: 'task-1',
      name: 'Ship the release',
      priority: 'high',
    })
    const other = makeTask({
      id: 'task-2',
      name: 'Other planned task',
      priority: 'medium',
    })
    const repository = createInMemoryRepository()
    await repository.saveTasks([task, other])
    const originalSnapshot: DaySnapshot = {
      date: '2026-08-18',
      plannedIds: [task.id, other.id],
      admittedIds: [],
    }
    await repository.saveSnapshot(originalSnapshot)

    const { unmount } = renderApp(repository, now)
    await waitForLoaded()

    const todaySection = screen.getByRole('region', { name: 'Today' })
    const item = within(todaySection)
      .getByText('Ship the release')
      .closest('li')
    if (!item) throw new Error('expected a list item')
    fireEvent.click(within(item).getByRole('button', { name: 'Complete' }))
    await waitFor(() => {
      expect(within(todaySection).getByText('Ship the release').tagName).toBe(
        'S',
      )
    })

    // Simulate a page reload: remount against the *same* repository
    // instance, so its in-memory data survives as it would in IndexedDB.
    unmount()
    renderApp(repository, now)
    await waitForLoaded()

    const reloadedToday = screen.getByRole('region', { name: 'Today' })
    const struck = await within(reloadedToday).findByText('Ship the release')
    expect(struck.tagName).toBe('S')
    expect(within(reloadedToday).getByText('Other planned task')).toBeTruthy()

    const reloadedData = await repository.loadAll()
    expect(reloadedData.snapshot).toEqual(originalSnapshot)
  })
})
