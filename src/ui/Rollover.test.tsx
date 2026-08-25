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
import type { RecurrenceRule } from '../domain/recurrence'

/** A rule of every Monday, matching the dates
 * specs/recurring-tasks/spec.md and specs/daily-plan/spec.md trace
 * throughout (Monday 17/24/31 August 2026). */
const weeklyMonday: RecurrenceRule = { kind: 'weekly', weekdays: [1] }

function makeTask(overrides: Partial<Task> & { id: string }): Task {
  return {
    name: overrides.id,
    duration: 30,
    priority: 'medium',
    recurrence: null,
    createdAt: new Date('2026-08-17T09:00:00.000Z'),
    completedAt: null,
    place: 0,
    lastCompletedOn: null,
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
    fireEvent.click(within(item).getByRole('checkbox'))
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
    fireEvent.click(within(item).getByRole('checkbox'))
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
    fireEvent.click(within(item).getByRole('checkbox'))

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
    fireEvent.click(within(item).getByRole('checkbox'))
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

describe('a recurring task becomes due again at rollover (8.2)', () => {
  it('appears pending, not struck through, after a rollover to the following Monday', async () => {
    let currentNow = new Date('2026-08-17T09:00:00.000Z') // Monday, matches the stored snapshot's date
    const now = () => currentNow

    const weeklyReview = makeTask({
      id: 'weekly-review',
      name: 'Weekly review',
      priority: null,
      recurrence: weeklyMonday,
      createdAt: new Date('2026-08-03T09:00:00.000Z'),
      completedAt: new Date('2026-08-17T10:00:00.000Z'),
      lastCompletedOn: '2026-08-17',
    })

    const repository = createInMemoryRepository()
    await repository.saveTasks([weeklyReview])
    await repository.saveSnapshot({
      date: '2026-08-17',
      plannedIds: [weeklyReview.id],
      admittedIds: [],
    })

    renderApp(repository, now)
    await waitForLoaded()

    // Mounting with a stored date equal to `now` must not recompute (see the
    // "foreground rollover (10.1)" test above), so the task is still exactly
    // as stored: struck through and completed.
    const beforeRollover = await repository.loadAll()
    expect(beforeRollover.tasks[0].completedAt).not.toBeNull()

    // The Recurring group's own rendering is tasks.md section 10's job, not
    // yet built (`PriorityGroups` only groups the five priority levels, so
    // it does not display a null-priority task at all yet). What section 8
    // owns, and what this test pins, is the *pipeline* section 10 will read
    // from: "pending, not struck through" is exactly `completedAt === null`
    // on the persisted task, and "appears" is membership in the persisted
    // snapshot's `plannedIds` (see design.md, decisions 3, 8 and 9).
    currentNow = new Date('2026-08-24T09:05:00.000Z') // the following Monday
    fireEvent(document, new Event('visibilitychange'))

    await waitFor(async () => {
      const persisted = await repository.loadAll()
      expect(persisted.snapshot?.date).toBe('2026-08-24')
    })

    const afterRollover = await repository.loadAll()
    const reawakened = afterRollover.tasks.find(
      (task) => task.id === weeklyReview.id,
    )
    // Pending, not struck through.
    expect(reawakened?.completedAt).toBeNull()
    // The durable memory of the last completion survives the reset (see
    // design.md, decision 3).
    expect(reawakened?.lastCompletedOn).toBe('2026-08-17')
    // Appears — is a member of the freshly computed plan.
    expect(afterRollover.snapshot?.plannedIds).toContain(weeklyReview.id)
  })
})

describe('a recurring task completed off-cycle is not brought back by Recalculate today (8.3)', () => {
  it('stays at rest across "Recalculate today" the next day', async () => {
    const currentNow = new Date('2026-08-26T15:00:00.000Z') // Wednesday afternoon
    const now = () => currentNow

    // Matches specs/recurring-tasks/spec.md, "Completing late, then
    // recalculating the next day": a Monday-only rule, missed on 24 August,
    // completed a day late on Tuesday 25 August. Its most recent occurrence
    // is still 24 August, so a completion recorded on 25 August clears it —
    // the task stays at rest until 31 August, not merely until tomorrow.
    const weeklyReview = makeTask({
      id: 'weekly-review',
      name: 'Weekly review',
      priority: null,
      recurrence: weeklyMonday,
      createdAt: new Date('2026-08-03T09:00:00.000Z'),
      completedAt: new Date('2026-08-25T11:00:00.000Z'),
      lastCompletedOn: '2026-08-25',
    })

    const repository = createInMemoryRepository()
    await repository.saveTasks([weeklyReview])
    // Already recomputed for today (Wednesday), correctly excluding the
    // at-rest task. Storing it pre-recomputed isolates "Recalculate today"
    // from the load path's own recomputation, so the assertions below are
    // about the manual action alone.
    await repository.saveSnapshot({
      date: '2026-08-26',
      plannedIds: [],
      admittedIds: [],
    })

    renderApp(repository, now)
    await waitForLoaded()
    const saveSnapshotSpy = vi.spyOn(repository, 'saveSnapshot')
    const saveTasksSpy = vi.spyOn(repository, 'saveTasks')

    fireEvent.click(screen.getByRole('button', { name: 'Recalculate today' }))

    await waitFor(() => {
      expect(saveSnapshotSpy).toHaveBeenCalledTimes(1)
    })

    // Reawaken is a safe no-op here: the task's most recent occurrence is
    // still 24 August, and its completion on 25 August is on or after that,
    // so it is not due. Nothing needed to change, so nothing was written.
    expect(saveTasksSpy).not.toHaveBeenCalled()

    const persisted = await repository.loadAll()
    const task = persisted.tasks.find((t) => t.id === weeklyReview.id)
    // Not brought back: still at rest, and never entered the plan.
    expect(task?.completedAt).not.toBeNull()
    expect(persisted.snapshot?.plannedIds).not.toContain(weeklyReview.id)
  })

  it('does surface a genuinely due recurring task, proving "not brought back" above is not merely vacuous', async () => {
    // The companion case to the one above: design.md, decision 8 lists
    // "Recalculate today" as one of the three triggers that must reawaken a
    // due recurring task before recomputing (alongside load and foreground
    // return) — this matters when the application stays open, visible, and
    // foregrounded across a day boundary with no `visibilitychange` event to
    // catch it, so a manual recalculation is the first chance to notice the
    // rollover. Without that step, `selectDailyPlan`'s unconditional
    // `completedAt === null` filter would keep excluding a task that is
    // genuinely due again, since only `reawaken` clears it.
    const currentNow = new Date('2026-08-24T15:00:00.000Z') // Monday afternoon
    const now = () => currentNow

    const weeklyReview = makeTask({
      id: 'weekly-review',
      name: 'Weekly review',
      priority: null,
      recurrence: weeklyMonday,
      createdAt: new Date('2026-08-03T09:00:00.000Z'),
      completedAt: new Date('2026-08-17T10:00:00.000Z'), // last Monday
      lastCompletedOn: '2026-08-17',
    })

    const repository = createInMemoryRepository()
    await repository.saveTasks([weeklyReview])
    // Dated as if the date had already rolled over to today without the
    // rollover having reawakened this task — the scenario a stuck-open,
    // never-backgrounded session can produce.
    await repository.saveSnapshot({
      date: '2026-08-24',
      plannedIds: [],
      admittedIds: [],
    })

    renderApp(repository, now)
    await waitForLoaded()
    const saveTasksSpy = vi.spyOn(repository, 'saveTasks')

    fireEvent.click(screen.getByRole('button', { name: 'Recalculate today' }))

    await waitFor(async () => {
      const persisted = await repository.loadAll()
      expect(persisted.snapshot?.plannedIds).toContain(weeklyReview.id)
    })

    expect(saveTasksSpy).toHaveBeenCalledWith([
      { ...weeklyReview, completedAt: null },
    ])
    const persisted = await repository.loadAll()
    const task = persisted.tasks.find((t) => t.id === weeklyReview.id)
    expect(task?.completedAt).toBeNull()
  })
})

describe('reopening after several days away with a missed occurrence (8.4)', () => {
  it('produces one plan containing exactly one instance of the recurring task', async () => {
    const currentNow = new Date('2026-08-26T09:00:00.000Z') // Wednesday
    const now = () => currentNow

    // Matches specs/recurring-tasks/spec.md, "The application was not
    // opened on the occurrence date": a Monday-only rule, last completed 17
    // August, not opened at all on 24 August, next opened Wednesday 26
    // August.
    const weeklyReview = makeTask({
      id: 'weekly-review',
      name: 'Weekly review',
      priority: null,
      recurrence: weeklyMonday,
      createdAt: new Date('2026-08-03T09:00:00.000Z'),
      completedAt: new Date('2026-08-17T10:00:00.000Z'),
      lastCompletedOn: '2026-08-17',
    })

    const repository = createInMemoryRepository()
    await repository.saveTasks([weeklyReview])
    await repository.saveSnapshot({
      date: '2026-08-17',
      plannedIds: [weeklyReview.id],
      admittedIds: [],
    })
    const saveSnapshotSpy = vi.spyOn(repository, 'saveSnapshot')

    renderApp(repository, now)
    await waitForLoaded()

    // Exactly one recomputation happened — not one per intervening day, and
    // not one per missed occurrence (see specs/recurring-tasks/spec.md,
    // "Missed occurrences never accumulate").
    expect(saveSnapshotSpy).toHaveBeenCalledTimes(1)

    const persisted = await repository.loadAll()
    expect(persisted.snapshot?.date).toBe('2026-08-26')
    // No duplicate or phantom task was created for the missed occurrence.
    expect(persisted.tasks).toHaveLength(1)

    const plannedOccurrences = persisted.snapshot?.plannedIds.filter(
      (id) => id === weeklyReview.id,
    )
    expect(plannedOccurrences).toHaveLength(1)

    const task = persisted.tasks.find((t) => t.id === weeklyReview.id)
    expect(task?.completedAt).toBeNull()
  })
})
