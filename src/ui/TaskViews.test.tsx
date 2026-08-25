import { describe, expect, it } from 'vitest'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { AppStateProvider } from './AppStateProvider'
import { TaskManagerApp } from './TaskManagerApp'
import { useAppState } from './useAppState'
import { createInMemoryRepository } from '../persistence/inMemoryRepository'
import type { Repository } from '../persistence/repository'
import type { Task } from '../domain/task'
import type { DaySnapshot } from '../domain/snapshot'

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

/** Waits for the initial load to finish. The create form now lives behind
 * the add-task control rather than always on screen (see design.md,
 * decision 6), so this anchors on that control instead of the "Name"
 * field it used to resolve on. */
async function waitForLoaded() {
  await screen.findByRole('button', { name: 'Add a task' })
}

function switchTab(name: 'Today' | 'All' | 'Completed') {
  fireEvent.click(screen.getByRole('button', { name }))
}

describe('three tabs (9.1)', () => {
  it('shows Today, All and Completed tabs, with Today displayed on open', async () => {
    renderApp()
    await waitForLoaded()

    expect(
      screen.getByRole('button', { name: 'Today', pressed: true }),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'All', pressed: false }),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Completed', pressed: false }),
    ).toBeTruthy()

    expect(screen.getByRole('region', { name: 'Today' })).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'All tasks' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Completed tasks' })).toBeNull()
  })

  it('switches panels when a different tab is selected', async () => {
    renderApp()
    await waitForLoaded()

    switchTab('All')
    expect(screen.getByRole('region', { name: 'All tasks' })).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Today' })).toBeNull()

    switchTab('Completed')
    expect(screen.getByRole('region', { name: 'Completed tasks' })).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'All tasks' })).toBeNull()
  })
})

describe('Today tab grouping (9.2)', () => {
  it('groups tasks under priority headings, in priority order, hiding empty groups', async () => {
    const urgent1 = makeTask({
      id: 'urgent-older',
      name: 'Urgent older',
      priority: 'urgent',
      createdAt: new Date('2026-08-18T07:00:00.000Z'),
    })
    const urgent2 = makeTask({
      id: 'urgent-newer',
      name: 'Urgent newer',
      priority: 'urgent',
      createdAt: new Date('2026-08-18T08:00:00.000Z'),
    })
    const high = makeTask({
      id: 'high-1',
      name: 'High task',
      priority: 'high',
      createdAt: new Date('2026-08-18T06:00:00.000Z'),
    })

    const repository = createInMemoryRepository()
    await repository.saveTasks([urgent1, urgent2, high])
    const snapshot: DaySnapshot = {
      date: '2026-08-18',
      plannedIds: [urgent1.id, urgent2.id, high.id],
      admittedIds: [],
    }
    await repository.saveSnapshot(snapshot)

    renderApp(repository)
    await waitForLoaded()

    const headings = screen.getAllByRole('heading', { level: 3 })
    expect(headings.map((heading) => heading.textContent)).toEqual([
      'Urgent',
      'High',
    ])
    expect(screen.queryByRole('heading', { name: 'Medium' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Low' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Very low' })).toBeNull()

    const urgentGroup = screen.getByRole('region', { name: 'Urgent' })
    expect(within(urgentGroup).getByText('Urgent older')).toBeTruthy()
    expect(within(urgentGroup).getByText('Urgent newer')).toBeTruthy()

    const highGroup = screen.getByRole('region', { name: 'High' })
    expect(within(highGroup).getByText('High task')).toBeTruthy()
  })

  it('orders tasks within a group oldest first', async () => {
    // Neither ever reordered, so each holds a place matching its creation
    // order (see specs/task-views/spec.md, "Ordering within a list" —
    // "a task that has never been reordered holds a place matching its
    // creation order"); this is what the Today tab actually sorts by (see
    // tasks.md, 9.1), and it happens to reproduce the age order pinned here.
    const older = makeTask({
      id: 'older',
      name: 'Older task',
      priority: 'medium',
      createdAt: new Date('2026-08-18T05:00:00.000Z'),
      place: 0,
    })
    const newer = makeTask({
      id: 'newer',
      name: 'Newer task',
      priority: 'medium',
      createdAt: new Date('2026-08-18T09:00:00.000Z'),
      place: 1,
    })

    const repository = createInMemoryRepository()
    // Save in reverse creation (and place) order to prove display order is
    // not just insertion order.
    await repository.saveTasks([newer, older])
    await repository.saveSnapshot({
      date: '2026-08-18',
      plannedIds: [newer.id, older.id],
      admittedIds: [],
    })

    renderApp(repository)
    await waitForLoaded()

    const mediumGroup = screen.getByRole('region', { name: 'Medium' })
    const items = within(mediumGroup).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Older task'),
      expect.stringContaining('Newer task'),
    ])
  })
})

describe('Today groups order tasks by place, not creation time (9.1)', () => {
  it('orders a Today group by place even when that disagrees with creation order', async () => {
    // createdAt would put "Older, held back" first; place puts it last.
    // Only a fix that sorts by `place` — the point of tasks.md, 9.1 — can
    // produce the expected order below.
    const olderHeldBack = makeTask({
      id: 'older-held-back',
      name: 'Older, held back',
      priority: 'medium',
      createdAt: new Date('2026-08-18T05:00:00.000Z'),
      place: 5,
    })
    const newerMovedUp = makeTask({
      id: 'newer-moved-up',
      name: 'Newer, moved up',
      priority: 'medium',
      createdAt: new Date('2026-08-18T09:00:00.000Z'),
      place: 1,
    })

    const repository = createInMemoryRepository()
    await repository.saveTasks([olderHeldBack, newerMovedUp])
    await repository.saveSnapshot({
      date: '2026-08-18',
      plannedIds: [olderHeldBack.id, newerMovedUp.id],
      admittedIds: [],
    })

    renderApp(repository)
    await waitForLoaded()

    const mediumGroup = screen.getByRole('region', { name: 'Medium' })
    const items = within(mediumGroup).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Newer, moved up'),
      expect.stringContaining('Older, held back'),
    ])
  })
})

describe('the Recurring group is presented ahead of the priority groups (10.3)', () => {
  it('renders a "Recurring" heading ahead of the Urgent heading', async () => {
    const recurring = makeTask({
      id: 'recurring-1',
      name: 'Weekly review',
      priority: null,
      recurrence: { kind: 'weekly', weekdays: [1] },
      createdAt: new Date('2026-08-18T06:00:00.000Z'),
    })
    const urgent = makeTask({
      id: 'urgent-1',
      name: 'Urgent task',
      priority: 'urgent',
      createdAt: new Date('2026-08-18T07:00:00.000Z'),
    })

    const repository = createInMemoryRepository()
    await repository.saveTasks([recurring, urgent])
    await repository.saveSnapshot({
      date: '2026-08-18',
      plannedIds: [recurring.id, urgent.id],
      admittedIds: [],
    })

    renderApp(repository)
    await waitForLoaded()

    const headings = screen.getAllByRole('heading', { level: 3 })
    expect(headings.map((heading) => heading.textContent)).toEqual([
      'Recurring',
      'Urgent',
    ])

    const recurringGroup = screen.getByRole('region', { name: 'Recurring' })
    expect(within(recurringGroup).getByText('Weekly review')).toBeTruthy()
  })

  it('omits the "Recurring" heading entirely when no recurring task is present', async () => {
    const urgent = makeTask({
      id: 'urgent-1',
      name: 'Urgent task',
      priority: 'urgent',
    })
    const medium = makeTask({
      id: 'medium-1',
      name: 'Medium task',
      priority: 'medium',
    })

    const repository = createInMemoryRepository()
    await repository.saveTasks([urgent, medium])
    await repository.saveSnapshot({
      date: '2026-08-18',
      plannedIds: [urgent.id, medium.id],
      admittedIds: [],
    })

    renderApp(repository)
    await waitForLoaded()

    expect(screen.queryByRole('heading', { name: 'Recurring' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Recurring' })).toBeNull()

    const headings = screen.getAllByRole('heading', { level: 3 })
    expect(headings.map((heading) => heading.textContent)).toEqual([
      'Urgent',
      'Medium',
    ])
  })
})

describe('the Today tab places a due recurring task under Recurring only (10.4)', () => {
  it('never shows a recurring task under a priority heading', async () => {
    const recurring = makeTask({
      id: 'recurring-1',
      name: 'Weekly review',
      priority: null,
      recurrence: { kind: 'weekly', weekdays: [1] },
      createdAt: new Date('2026-08-18T06:00:00.000Z'),
    })
    const urgent = makeTask({
      id: 'urgent-1',
      name: 'Urgent task',
      priority: 'urgent',
      createdAt: new Date('2026-08-18T07:00:00.000Z'),
    })
    const medium = makeTask({
      id: 'medium-1',
      name: 'Medium task',
      priority: 'medium',
      createdAt: new Date('2026-08-18T08:00:00.000Z'),
    })

    const repository = createInMemoryRepository()
    await repository.saveTasks([recurring, urgent, medium])
    // `plannedIds` stands in for a due recurring task's membership in
    // today's plan (see design.md, decision 9 — a due recurring task enters
    // `plannedIds` through the ordinary `recomputeSnapshot` path); this
    // section only needs to prove the grouping/rendering side, not
    // re-derive due-ness, which sections 5/6/8 already pin.
    await repository.saveSnapshot({
      date: '2026-08-18',
      plannedIds: [recurring.id, urgent.id, medium.id],
      admittedIds: [],
    })

    renderApp(repository)
    await waitForLoaded()

    const todaySection = screen.getByRole('region', { name: 'Today' })
    const headings = within(todaySection).getAllByRole('heading', {
      level: 3,
    })
    expect(headings.map((heading) => heading.textContent)).toEqual([
      'Recurring',
      'Urgent',
      'Medium',
    ])

    const recurringGroup = within(todaySection).getByRole('region', {
      name: 'Recurring',
    })
    expect(within(recurringGroup).getByText('Weekly review')).toBeTruthy()

    const urgentGroup = within(todaySection).getByRole('region', {
      name: 'Urgent',
    })
    const mediumGroup = within(todaySection).getByRole('region', {
      name: 'Medium',
    })
    expect(within(urgentGroup).queryByText('Weekly review')).toBeNull()
    expect(within(mediumGroup).queryByText('Weekly review')).toBeNull()
  })
})

describe('the All tab groups recurring tasks under Recurring, ordered by place (10.5)', () => {
  it('places the Recurring group ahead of every priority group, ordered by place within it', async () => {
    // The worked example from specs/task-views/spec.md, "The All tab orders
    // the Recurring group ahead of every priority".
    const m1 = makeTask({
      id: 'm1',
      name: 'M1',
      priority: 'medium',
      createdAt: new Date('2026-08-18T08:00:00.000Z'),
      place: 1,
    })
    const r1 = makeTask({
      id: 'r1',
      name: 'R1',
      priority: null,
      recurrence: { kind: 'weekly', weekdays: [1] },
      createdAt: new Date('2026-08-18T09:00:00.000Z'),
      place: 2,
    })
    const u1 = makeTask({
      id: 'u1',
      name: 'U1',
      priority: 'urgent',
      createdAt: new Date('2026-08-18T10:00:00.000Z'),
      place: 3,
    })
    const r2 = makeTask({
      id: 'r2',
      name: 'R2',
      priority: null,
      recurrence: { kind: 'monthly-weekday', nth: 1, weekday: 1 },
      createdAt: new Date('2026-08-18T11:00:00.000Z'),
      place: 4,
    })

    const repository = createInMemoryRepository()
    await repository.saveTasks([m1, r1, u1, r2])
    await repository.saveSnapshot({
      date: '2026-08-18',
      plannedIds: [],
      admittedIds: [],
    })

    renderApp(repository)
    await waitForLoaded()
    switchTab('All')

    const allSection = screen.getByRole('region', { name: 'All tasks' })
    const headings = within(allSection).getAllByRole('heading', { level: 3 })
    expect(headings.map((heading) => heading.textContent)).toEqual([
      'Recurring',
      'Urgent',
      'Medium',
    ])

    const items = within(allSection).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('R1'),
      expect.stringContaining('R2'),
      expect.stringContaining('U1'),
      expect.stringContaining('M1'),
    ])

    const recurringGroup = within(allSection).getByRole('region', {
      name: 'Recurring',
    })
    expect(
      within(recurringGroup)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([expect.stringContaining('R1'), expect.stringContaining('R2')])
  })
})

describe('shared priority-group rendering (7.1)', () => {
  it("pins the Today tab's grouped output — headings, markers, and hidden empty groups — across the extraction into a shared component", async () => {
    const urgent = makeTask({
      id: 'urgent-1',
      name: 'Urgent task',
      priority: 'urgent',
      createdAt: new Date('2026-08-18T07:00:00.000Z'),
    })
    const mediumOlder = makeTask({
      id: 'medium-older',
      name: 'Medium older',
      priority: 'medium',
      createdAt: new Date('2026-08-18T06:00:00.000Z'),
      place: 0,
    })
    const mediumNewer = makeTask({
      id: 'medium-newer',
      name: 'Medium newer',
      priority: 'medium',
      createdAt: new Date('2026-08-18T08:00:00.000Z'),
      place: 1,
    })

    const repository = createInMemoryRepository()
    await repository.saveTasks([urgent, mediumOlder, mediumNewer])
    await repository.saveSnapshot({
      date: '2026-08-18',
      plannedIds: [urgent.id, mediumOlder.id, mediumNewer.id],
      admittedIds: [],
    })

    renderApp(repository)
    await waitForLoaded()

    const todaySection = screen.getByRole('region', { name: 'Today' })

    // Only urgent and medium headings appear, in priority order — high, low
    // and very low have no tasks in the plan and are hidden entirely,
    // heading included.
    const headings = within(todaySection).getAllByRole('heading', {
      level: 3,
    })
    expect(headings.map((heading) => heading.textContent)).toEqual([
      'Urgent',
      'Medium',
    ])
    expect(
      within(todaySection).queryByRole('heading', { name: 'High' }),
    ).toBeNull()
    expect(
      within(todaySection).queryByRole('heading', { name: 'Low' }),
    ).toBeNull()
    expect(
      within(todaySection).queryByRole('heading', { name: 'Very low' }),
    ).toBeNull()

    // Each heading is paired with a colour marker carrying the group's
    // priority as data, a sibling of the heading rather than nested inside
    // its text.
    const urgentGroup = screen.getByRole('region', { name: 'Urgent' })
    const urgentMarker = urgentGroup.querySelector('[aria-hidden="true"]')
    expect(urgentMarker?.getAttribute('data-priority')).toBe('urgent')

    const mediumGroup = screen.getByRole('region', { name: 'Medium' })
    const mediumMarker = mediumGroup.querySelector('[aria-hidden="true"]')
    expect(mediumMarker?.getAttribute('data-priority')).toBe('medium')

    // Ordering within a group is unaffected by the extraction: oldest first.
    const mediumItems = within(mediumGroup).getAllByRole('listitem')
    expect(mediumItems.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Medium older'),
      expect.stringContaining('Medium newer'),
    ])
  })
})

describe('All tab ordering (9.3)', () => {
  it('orders every pending task by priority then age, excluding completed tasks', async () => {
    // The worked example from specs/task-views/spec.md, "The All tab orders
    // by priority then age" — places assigned matching creation order, so
    // this pins that a user who has never reordered anything sees exactly
    // what they saw before `place` existed (see tasks.md, 3.2).
    const taskA = makeTask({
      id: 'A',
      name: 'A',
      priority: 'medium',
      createdAt: new Date('2026-08-18T09:00:00.000Z'),
      place: 3,
    })
    const taskB = makeTask({
      id: 'B',
      name: 'B',
      priority: 'urgent',
      createdAt: new Date('2026-08-18T11:00:00.000Z'),
      place: 4,
    })
    const taskC = makeTask({
      id: 'C',
      name: 'C',
      priority: 'medium',
      createdAt: new Date('2026-08-18T08:00:00.000Z'),
      place: 2,
    })
    const taskD = makeTask({
      id: 'D',
      name: 'D',
      priority: 'very-low',
      createdAt: new Date('2026-08-18T07:00:00.000Z'),
      place: 1,
    })
    const taskE = makeTask({
      id: 'E',
      name: 'E',
      priority: 'high',
      createdAt: new Date('2026-08-18T12:00:00.000Z'),
      place: 5,
    })
    const completed = makeTask({
      id: 'done',
      name: 'Already done',
      priority: 'urgent',
      createdAt: new Date('2026-08-18T06:00:00.000Z'),
      place: 0,
      completedAt: new Date('2026-08-18T07:30:00.000Z'),
    })

    const repository = createInMemoryRepository()
    await repository.saveTasks([taskA, taskB, taskC, taskD, taskE, completed])
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
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('B'),
      expect.stringContaining('E'),
      expect.stringContaining('C'),
      expect.stringContaining('A'),
      expect.stringContaining('D'),
    ])
    expect(within(allSection).queryByText('Already done')).toBeNull()
  })
})

describe('the All tab groups tasks by priority (7.2)', () => {
  it('renders pending tasks under priority headings in the fixed order, omitting a heading for a level with no pending tasks', async () => {
    const urgent = makeTask({
      id: 'urgent-1',
      name: 'Urgent task',
      priority: 'urgent',
      place: 0,
    })
    const mediumOne = makeTask({
      id: 'medium-1',
      name: 'Medium one',
      priority: 'medium',
      place: 1,
    })
    const mediumTwo = makeTask({
      id: 'medium-2',
      name: 'Medium two',
      priority: 'medium',
      place: 2,
    })
    const low = makeTask({
      id: 'low-1',
      name: 'Low task',
      priority: 'low',
      place: 3,
    })

    const repository = createInMemoryRepository()
    await repository.saveTasks([urgent, mediumOne, mediumTwo, low])
    await repository.saveSnapshot({
      date: '2026-08-18',
      plannedIds: [],
      admittedIds: [],
    })

    renderApp(repository)
    await waitForLoaded()
    switchTab('All')

    const allSection = screen.getByRole('region', { name: 'All tasks' })
    const headings = within(allSection).getAllByRole('heading', { level: 3 })
    expect(headings.map((heading) => heading.textContent)).toEqual([
      'Urgent',
      'Medium',
      'Low',
    ])
    expect(
      within(allSection).queryByRole('heading', { name: 'High' }),
    ).toBeNull()
    expect(
      within(allSection).queryByRole('heading', { name: 'Very low' }),
    ).toBeNull()

    const urgentGroup = within(allSection).getByRole('region', {
      name: 'Urgent',
    })
    expect(within(urgentGroup).getByText('Urgent task')).toBeTruthy()

    const mediumGroup = within(allSection).getByRole('region', {
      name: 'Medium',
    })
    expect(within(mediumGroup).getByText('Medium one')).toBeTruthy()
    expect(within(mediumGroup).getByText('Medium two')).toBeTruthy()

    const lowGroup = within(allSection).getByRole('region', { name: 'Low' })
    expect(within(lowGroup).getByText('Low task')).toBeTruthy()
  })

  it('shows the empty state with no priority headings when nothing is pending', async () => {
    renderApp()
    await waitForLoaded()
    switchTab('All')

    const allSection = screen.getByRole('region', { name: 'All tasks' })
    expect(within(allSection).getByText('empty')).toBeTruthy()
    expect(within(allSection).queryAllByRole('heading', { level: 3 })).toEqual(
      [],
    )
  })
})

describe('tasks within an All tab group are ordered by place (7.3)', () => {
  /** Calls `reorderTasks` directly against the shared `AppStateProvider`,
   * without any drag interaction — the drag gesture and its keyboard
   * equivalent are section 8's job. This only needs to prove that once a
   * reordering has happened, the All tab's grouped rendering (7.2) reflects
   * the new places. */
  function ReorderTrigger({
    activeId,
    overId,
  }: {
    activeId: string
    overId: string
  }) {
    const state = useAppState()
    if (state.status !== 'loaded') return null
    return (
      <button
        type="button"
        onClick={() => {
          void state.reorderTasks(activeId, overId)
        }}
      >
        Test reorder
      </button>
    )
  }

  it('orders tasks within a group by place, and reflects a reordering', async () => {
    const mediumFirst = makeTask({
      id: 'medium-first',
      name: 'Medium first',
      priority: 'medium',
      place: 0,
    })
    const mediumSecond = makeTask({
      id: 'medium-second',
      name: 'Medium second',
      priority: 'medium',
      place: 1,
    })
    const mediumThird = makeTask({
      id: 'medium-third',
      name: 'Medium third',
      priority: 'medium',
      place: 2,
    })

    const repository = createInMemoryRepository()
    await repository.saveTasks([mediumFirst, mediumSecond, mediumThird])
    await repository.saveSnapshot({
      date: '2026-08-18',
      plannedIds: [],
      admittedIds: [],
    })

    render(
      <AppStateProvider repository={repository} now={() => FIXED_NOW}>
        <TaskManagerApp />
        <ReorderTrigger activeId="medium-third" overId="medium-first" />
      </AppStateProvider>,
    )
    await waitForLoaded()
    switchTab('All')

    const mediumGroupBefore = screen.getByRole('region', { name: 'Medium' })
    expect(
      within(mediumGroupBefore)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      expect.stringContaining('Medium first'),
      expect.stringContaining('Medium second'),
      expect.stringContaining('Medium third'),
    ])

    // Moves medium-third to the position medium-first currently holds.
    fireEvent.click(screen.getByRole('button', { name: 'Test reorder' }))

    await waitFor(() => {
      const mediumGroupAfter = screen.getByRole('region', { name: 'Medium' })
      expect(
        within(mediumGroupAfter)
          .getAllByRole('listitem')
          .map((item) => item.textContent),
      ).toEqual([
        expect.stringContaining('Medium third'),
        expect.stringContaining('Medium first'),
        expect.stringContaining('Medium second'),
      ])
    })
  })
})

describe('a reordering in the All tab re-sequences Today without changing membership (9.2)', () => {
  /** Same pattern as the 7.3 suite above: calls `reorderTasks` directly, with
   * no drag interaction, since this only needs to prove the cross-tab
   * consequence of a reordering that has already happened. */
  function ReorderTrigger({
    activeId,
    overId,
  }: {
    activeId: string
    overId: string
  }) {
    const state = useAppState()
    if (state.status !== 'loaded') return null
    return (
      <button
        type="button"
        onClick={() => {
          void state.reorderTasks(activeId, overId)
        }}
      >
        Test reorder
      </button>
    )
  }

  it('shows H1, M2, M1 in Today after moving M2 above M1 in the All tab, while M3 stays out and nothing is removed', async () => {
    // The worked example from specs/task-views/spec.md, "Reordering does not
    // change what the Today tab contains" — "A reordering re-sequences
    // Today without changing its membership". `createdAt` is left in its
    // natural creation order (M1 before M2) so that, before the fix for
    // tasks.md 9.1, the Today tab would still show M1 before M2 after the
    // reorder below — proving this test actually exercises place-based
    // ordering rather than an order that would hold either way.
    const h1 = makeTask({
      id: 'h1',
      name: 'H1',
      priority: 'high',
      createdAt: new Date('2026-08-18T06:00:00.000Z'),
      place: 0,
    })
    const m1 = makeTask({
      id: 'm1',
      name: 'M1',
      priority: 'medium',
      createdAt: new Date('2026-08-18T07:00:00.000Z'),
      place: 1,
    })
    const m2 = makeTask({
      id: 'm2',
      name: 'M2',
      priority: 'medium',
      createdAt: new Date('2026-08-18T08:00:00.000Z'),
      place: 2,
    })
    const m3 = makeTask({
      id: 'm3',
      name: 'M3',
      priority: 'medium',
      createdAt: new Date('2026-08-18T09:00:00.000Z'),
      place: 3,
    })

    const repository = createInMemoryRepository()
    await repository.saveTasks([h1, m1, m2, m3])
    await repository.saveSnapshot({
      date: '2026-08-18',
      // M3 is pending but outside today's frozen plan.
      plannedIds: [h1.id, m1.id, m2.id],
      admittedIds: [],
    })

    render(
      <AppStateProvider repository={repository} now={() => FIXED_NOW}>
        <TaskManagerApp />
        <ReorderTrigger activeId="m2" overId="m1" />
      </AppStateProvider>,
    )
    await waitForLoaded()

    const todayBefore = screen.getByRole('region', { name: 'Today' })
    expect(
      within(todayBefore)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      expect.stringContaining('H1'),
      expect.stringContaining('M1'),
      expect.stringContaining('M2'),
    ])
    expect(within(todayBefore).queryByText('M3')).toBeNull()

    // Moves M2 above M1, per the All tab's place order.
    fireEvent.click(screen.getByRole('button', { name: 'Test reorder' }))

    await waitFor(() => {
      const items = within(screen.getByRole('region', { name: 'Today' }))
        .getAllByRole('listitem')
        .map((item) => item.textContent)
      expect(items).toEqual([
        expect.stringContaining('H1'),
        expect.stringContaining('M2'),
        expect.stringContaining('M1'),
      ])
    })
    expect(
      within(screen.getByRole('region', { name: 'Today' })).queryByText('M3'),
    ).toBeNull()
  })
})

describe('a reordering cannot pull a task into Today (9.3)', () => {
  function ReorderTrigger({
    activeId,
    overId,
  }: {
    activeId: string
    overId: string
  }) {
    const state = useAppState()
    if (state.status !== 'loaded') return null
    return (
      <button
        type="button"
        onClick={() => {
          void state.reorderTasks(activeId, overId)
        }}
      >
        Test reorder
      </button>
    )
  }

  it('leaves a task moved to the first position of its group absent from Today, though it appears first in All', async () => {
    const planned = makeTask({
      id: 'planned',
      name: 'Planned medium',
      priority: 'medium',
      place: 0,
    })
    const notPlanned = makeTask({
      id: 'not-planned',
      name: 'Not planned medium',
      priority: 'medium',
      place: 1,
    })

    const repository = createInMemoryRepository()
    await repository.saveTasks([planned, notPlanned])
    await repository.saveSnapshot({
      date: '2026-08-18',
      plannedIds: [planned.id],
      admittedIds: [],
    })

    render(
      <AppStateProvider repository={repository} now={() => FIXED_NOW}>
        <TaskManagerApp />
        <ReorderTrigger activeId="not-planned" overId="planned" />
      </AppStateProvider>,
    )
    await waitForLoaded()

    fireEvent.click(screen.getByRole('button', { name: 'Test reorder' }))

    switchTab('All')
    await waitFor(() => {
      const items = within(screen.getByRole('region', { name: 'Medium' }))
        .getAllByRole('listitem')
        .map((item) => item.textContent)
      expect(items[0]).toEqual(expect.stringContaining('Not planned medium'))
    })

    switchTab('Today')
    expect(
      within(screen.getByRole('region', { name: 'Today' })).queryByText(
        'Not planned medium',
      ),
    ).toBeNull()
  })
})

describe('a task completed today keeps its place in the Today order (9.4)', () => {
  it('stays struck through at its arranged position rather than moving to the top or bottom', async () => {
    // `createdAt` is deliberately not in place order (M2 is oldest but
    // arranged in the middle), so that a comparator that still consulted
    // age — rather than only `place` — would put the completed task first
    // instead of in the middle asserted below.
    const m1 = makeTask({
      id: 'm1',
      name: 'M1 pending',
      priority: 'medium',
      createdAt: new Date('2026-08-18T10:00:00.000Z'),
      place: 0,
    })
    const m2 = makeTask({
      id: 'm2',
      name: 'M2 completed',
      priority: 'medium',
      createdAt: new Date('2026-08-18T09:00:00.000Z'),
      place: 1,
      completedAt: new Date('2026-08-18T09:30:00.000Z'),
    })
    const m3 = makeTask({
      id: 'm3',
      name: 'M3 pending',
      priority: 'medium',
      createdAt: new Date('2026-08-18T11:00:00.000Z'),
      place: 2,
    })

    const repository = createInMemoryRepository()
    await repository.saveTasks([m1, m2, m3])
    await repository.saveSnapshot({
      date: '2026-08-18',
      plannedIds: [m1.id, m2.id, m3.id],
      admittedIds: [],
    })

    renderApp(repository)
    await waitForLoaded()

    const mediumGroup = screen.getByRole('region', { name: 'Medium' })
    const items = within(mediumGroup).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('M1 pending'),
      expect.stringContaining('M2 completed'),
      expect.stringContaining('M3 pending'),
    ])

    const completedName = within(mediumGroup).getByText('M2 completed')
    expect(completedName.tagName).toBe('S')
  })
})

describe('Today and Completed offer no reordering, and Completed ignores place (9.5)', () => {
  it('shows no reordering control in Today or Completed, and keeps Completed ordered by recency even when place values disagree', async () => {
    const completedRecent = makeTask({
      id: 'completed-recent',
      name: 'Completed recent',
      completedAt: new Date('2026-08-18T09:00:00.000Z'),
      // A higher place than the earlier-completed task below, to prove
      // Completed does not consult `place` even though every task now
      // carries one.
      place: 9,
    })
    const completedEarlier = makeTask({
      id: 'completed-earlier',
      name: 'Completed earlier',
      completedAt: new Date('2026-08-18T07:00:00.000Z'),
      place: 0,
    })
    const pending = makeTask({
      id: 'pending',
      name: 'Pending medium',
      priority: 'medium',
      place: 1,
    })

    const repository = createInMemoryRepository()
    await repository.saveTasks([completedRecent, completedEarlier, pending])
    await repository.saveSnapshot({
      date: '2026-08-18',
      plannedIds: [pending.id],
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

    const items = within(completedSection).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Completed recent'),
      expect.stringContaining('Completed earlier'),
    ])
  })
})

describe('Completed tab ordering (9.4)', () => {
  it('lists completed tasks, most recently completed first', async () => {
    const first = makeTask({
      id: 'first',
      name: 'Completed first',
      completedAt: new Date('2026-08-18T07:00:00.000Z'),
    })
    const second = makeTask({
      id: 'second',
      name: 'Completed second',
      completedAt: new Date('2026-08-18T09:00:00.000Z'),
    })
    const pending = makeTask({ id: 'pending', name: 'Still pending' })

    const repository = createInMemoryRepository()
    await repository.saveTasks([first, second, pending])
    await repository.saveSnapshot({
      date: '2026-08-18',
      plannedIds: [],
      admittedIds: [],
    })

    renderApp(repository)
    await waitForLoaded()
    switchTab('Completed')

    const completedSection = screen.getByRole('region', {
      name: 'Completed tasks',
    })
    const items = within(completedSection).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Completed second'),
      expect.stringContaining('Completed first'),
    ])
    expect(within(completedSection).queryByText('Still pending')).toBeNull()
  })
})

describe('completing a task (9.5, 9.6)', () => {
  it('completing from Today leaves it struck through in place and removes it from All', async () => {
    const task = makeTask({
      id: 'task-1',
      name: 'Finish the report',
      priority: 'high',
    })
    const repository = createInMemoryRepository()
    await repository.saveTasks([task])
    await repository.saveSnapshot({
      date: '2026-08-18',
      plannedIds: [task.id],
      admittedIds: [],
    })

    renderApp(repository)
    await waitForLoaded()

    const todaySection = screen.getByRole('region', { name: 'Today' })
    const item = within(todaySection)
      .getByText('Finish the report')
      .closest('li')
    if (!item) throw new Error('expected a list item')
    fireEvent.click(within(item).getByRole('checkbox'))

    const struck = await within(todaySection).findByText('Finish the report')
    expect(struck.tagName).toBe('S')
    expect(within(todaySection).getByText('Finish the report')).toBeTruthy()

    switchTab('All')
    const allSection = screen.getByRole('region', { name: 'All tasks' })
    expect(within(allSection).queryByText('Finish the report')).toBeNull()
  })

  it('completing from All that is not part of the plan removes it from All and leaves Today unaffected', async () => {
    const notPlanned = makeTask({
      id: 'not-planned',
      name: 'Not planned task',
    })
    const repository = createInMemoryRepository()
    await repository.saveTasks([notPlanned])
    await repository.saveSnapshot({
      date: '2026-08-18',
      plannedIds: [],
      admittedIds: [],
    })

    renderApp(repository)
    await waitForLoaded()
    switchTab('All')

    const allSection = screen.getByRole('region', { name: 'All tasks' })
    const item = within(allSection).getByText('Not planned task').closest('li')
    if (!item) throw new Error('expected a list item')
    fireEvent.click(within(item).getByRole('checkbox'))

    await within(allSection).findByText('empty')
    expect(within(allSection).queryByText('Not planned task')).toBeNull()

    switchTab('Today')
    const todaySection = screen.getByRole('region', { name: 'Today' })
    expect(within(todaySection).queryByText('Not planned task')).toBeNull()
  })

  it('completing from All that is part of the plan removes it from All and strikes it through in Today', async () => {
    const planned = makeTask({
      id: 'planned',
      name: 'Planned task',
      priority: 'low',
    })
    const repository = createInMemoryRepository()
    await repository.saveTasks([planned])
    await repository.saveSnapshot({
      date: '2026-08-18',
      plannedIds: [planned.id],
      admittedIds: [],
    })

    renderApp(repository)
    await waitForLoaded()
    switchTab('All')

    const allSection = screen.getByRole('region', { name: 'All tasks' })
    const item = within(allSection).getByText('Planned task').closest('li')
    if (!item) throw new Error('expected a list item')
    fireEvent.click(within(item).getByRole('checkbox'))

    await within(allSection).findByText('empty')
    expect(within(allSection).queryByText('Planned task')).toBeNull()

    switchTab('Today')
    const todaySection = screen.getByRole('region', { name: 'Today' })
    const struck = await within(todaySection).findByText('Planned task')
    expect(struck.tagName).toBe('S')
  })
})

describe('every listed task shows name, duration and priority (9.7)', () => {
  it('shows name, formatted duration, and an identifiable priority in Today, All and Completed', async () => {
    const todayTask = makeTask({
      id: 'today-task',
      name: 'Today task',
      duration: 90,
      priority: 'urgent',
    })
    const allTask = makeTask({
      id: 'all-task',
      name: 'All-only task',
      duration: 45,
      priority: 'low',
    })
    const completedTask = makeTask({
      id: 'completed-task',
      name: 'Completed task',
      duration: 5,
      priority: 'medium',
      completedAt: new Date('2026-08-18T08:00:00.000Z'),
    })

    const repository = createInMemoryRepository()
    await repository.saveTasks([todayTask, allTask, completedTask])
    await repository.saveSnapshot({
      date: '2026-08-18',
      plannedIds: [todayTask.id],
      admittedIds: [],
    })

    renderApp(repository)
    await waitForLoaded()

    const todaySection = screen.getByRole('region', { name: 'Today' })
    const todayItem = within(todaySection).getByText('Today task').closest('li')
    if (!todayItem) throw new Error('expected a list item')
    expect(within(todayItem).getByText('1.5h')).toBeTruthy()
    expect(within(todayItem).getByText('Urgent')).toBeTruthy()

    switchTab('All')
    const allSection = screen.getByRole('region', { name: 'All tasks' })
    const allItem = within(allSection).getByText('All-only task').closest('li')
    if (!allItem) throw new Error('expected a list item')
    expect(within(allItem).getByText('45m')).toBeTruthy()
    expect(within(allItem).getByText('Low')).toBeTruthy()

    switchTab('Completed')
    const completedSection = screen.getByRole('region', {
      name: 'Completed tasks',
    })
    const completedItem = within(completedSection)
      .getByText('Completed task')
      .closest('li')
    if (!completedItem) throw new Error('expected a list item')
    expect(within(completedItem).getByText('5m')).toBeTruthy()
    expect(within(completedItem).getByText('Medium')).toBeTruthy()
  })
})

describe('empty states (9.8)', () => {
  it('shows an empty indicator in each tab when it has nothing to list', async () => {
    renderApp()
    await waitForLoaded()

    const todaySection = screen.getByRole('region', { name: 'Today' })
    expect(within(todaySection).getByText('empty')).toBeTruthy()

    switchTab('All')
    const allSection = screen.getByRole('region', { name: 'All tasks' })
    expect(within(allSection).getByText('empty')).toBeTruthy()

    switchTab('Completed')
    const completedSection = screen.getByRole('region', {
      name: 'Completed tasks',
    })
    expect(within(completedSection).getByText('empty')).toBeTruthy()
  })
})

describe('the checkbox in each tab (6.2)', () => {
  it('shows a pending and a completed row side by side in Today, and the right state in every row of All and Completed', async () => {
    const pendingPlanned = makeTask({
      id: 'pending-planned',
      name: 'Pending planned',
      priority: 'medium',
    })
    const completedPlanned = makeTask({
      id: 'completed-planned',
      name: 'Completed today',
      priority: 'medium',
      completedAt: new Date('2026-08-18T07:00:00.000Z'),
    })
    const pendingNotPlanned = makeTask({
      id: 'pending-not-planned',
      name: 'Pending not planned',
      priority: 'high',
    })
    const completedElsewhere = makeTask({
      id: 'completed-elsewhere',
      name: 'Completed elsewhere',
      priority: 'low',
      completedAt: new Date('2026-08-17T12:00:00.000Z'),
    })

    const repository = createInMemoryRepository()
    await repository.saveTasks([
      pendingPlanned,
      completedPlanned,
      pendingNotPlanned,
      completedElsewhere,
    ])
    // Both `pendingPlanned` and `completedPlanned` are frozen into today's
    // plan, so completing the latter kept it visible there (see
    // specs/task-views/spec.md, "Completing a task from the Today tab keeps
    // it visible") - this is what puts a pending and a completed row side
    // by side in Today.
    await repository.saveSnapshot({
      date: '2026-08-18',
      plannedIds: [pendingPlanned.id, completedPlanned.id],
      admittedIds: [],
    })

    renderApp(repository)
    await waitForLoaded()

    const todaySection = screen.getByRole('region', { name: 'Today' })
    const pendingCheckbox = within(todaySection).getByRole('checkbox', {
      name: 'Pending planned',
    }) as HTMLInputElement
    const completedCheckbox = within(todaySection).getByRole('checkbox', {
      name: 'Completed today',
    }) as HTMLInputElement
    expect(pendingCheckbox.checked).toBe(false)
    expect(pendingCheckbox.disabled).toBe(false)
    expect(completedCheckbox.checked).toBe(true)
    expect(completedCheckbox.disabled).toBe(true)

    switchTab('All')
    // The All tab lists only pending tasks, so every checkbox there is
    // unchecked and interactive.
    const allSection = screen.getByRole('region', { name: 'All tasks' })
    const allCheckboxes = within(allSection).getAllByRole(
      'checkbox',
    ) as HTMLInputElement[]
    expect(allCheckboxes).toHaveLength(2)
    allCheckboxes.forEach((checkbox) => {
      expect(checkbox.checked).toBe(false)
      expect(checkbox.disabled).toBe(false)
    })

    switchTab('Completed')
    // The Completed tab lists only completed tasks, so every checkbox
    // there is checked and not interactive.
    const completedSection = screen.getByRole('region', {
      name: 'Completed tasks',
    })
    const completedCheckboxes = within(completedSection).getAllByRole(
      'checkbox',
    ) as HTMLInputElement[]
    expect(completedCheckboxes).toHaveLength(2)
    completedCheckboxes.forEach((checkbox) => {
      expect(checkbox.checked).toBe(true)
      expect(checkbox.disabled).toBe(true)
    })
  })
})

describe('duration and priority are separately identifiable (7.1)', () => {
  it('shows "45m" and "Urgent" as elements separate from the name, in Today, All and Completed, and still visible - unstruck - on a completed task', async () => {
    const todayPending = makeTask({
      id: 'today-pending',
      name: 'Today pending urgent',
      duration: 45,
      priority: 'urgent',
    })
    const todayCompleted = makeTask({
      id: 'today-completed',
      name: 'Today completed urgent',
      duration: 45,
      priority: 'urgent',
      completedAt: new Date('2026-08-18T08:00:00.000Z'),
    })
    const allOnly = makeTask({
      id: 'all-only',
      name: 'All only urgent',
      duration: 45,
      priority: 'urgent',
    })

    const repository = createInMemoryRepository()
    await repository.saveTasks([todayPending, todayCompleted, allOnly])
    await repository.saveSnapshot({
      date: '2026-08-18',
      plannedIds: [todayPending.id, todayCompleted.id],
      admittedIds: [],
    })

    renderApp(repository)
    await waitForLoaded()

    const todaySection = screen.getByRole('region', { name: 'Today' })

    const pendingItem = within(todaySection)
      .getByText('Today pending urgent')
      .closest('li')
    if (!pendingItem) throw new Error('expected a list item')
    const pendingName = within(pendingItem).getByText('Today pending urgent')
    const pendingDuration = within(pendingItem).getByText('45m')
    const pendingPriority = within(pendingItem).getByText('Urgent')
    // Each is its own element: the name element carries none of the other
    // two strings, and duration/priority are independently queryable.
    expect(pendingName).not.toBe(pendingDuration)
    expect(pendingName).not.toBe(pendingPriority)
    expect(pendingName.textContent).toBe('Today pending urgent')
    expect(pendingDuration.textContent).toBe('45m')
    expect(pendingPriority.textContent).toBe('Urgent')

    const completedItem = within(todaySection)
      .getByText('Today completed urgent')
      .closest('li')
    if (!completedItem) throw new Error('expected a list item')
    const struckName = within(completedItem).getByText('Today completed urgent')
    expect(struckName.tagName).toBe('S')
    const completedDuration = within(completedItem).getByText('45m')
    const completedPriority = within(completedItem).getByText('Urgent')
    // The strike-through applies to the name only - duration and priority
    // stay outside it and legible (specs/task-views/spec.md, "A completed
    // task still shows its duration and priority").
    expect(completedDuration.closest('s')).toBeNull()
    expect(completedPriority.closest('s')).toBeNull()

    switchTab('All')
    const allSection = screen.getByRole('region', { name: 'All tasks' })
    const allItem = within(allSection)
      .getByText('All only urgent')
      .closest('li')
    if (!allItem) throw new Error('expected a list item')
    expect(within(allItem).getByText('45m')).toBeTruthy()
    expect(within(allItem).getByText('Urgent')).toBeTruthy()

    switchTab('Completed')
    const completedSection = screen.getByRole('region', {
      name: 'Completed tasks',
    })
    const completedTabItem = within(completedSection)
      .getByText('Today completed urgent')
      .closest('li')
    if (!completedTabItem) throw new Error('expected a list item')
    expect(within(completedTabItem).getByText('45m')).toBeTruthy()
    expect(within(completedTabItem).getByText('Urgent')).toBeTruthy()
  })
})

describe('a heading names its level in text (7.2)', () => {
  it('reads "Very low" for a Today group of very-low tasks, identifiable without color', async () => {
    const veryLow = makeTask({
      id: 'very-low-task',
      name: 'Very low task',
      priority: 'very-low',
    })

    const repository = createInMemoryRepository()
    await repository.saveTasks([veryLow])
    await repository.saveSnapshot({
      date: '2026-08-18',
      plannedIds: [veryLow.id],
      admittedIds: [],
    })

    renderApp(repository)
    await waitForLoaded()

    const heading = screen.getByRole('heading', {
      level: 3,
      name: 'Very low',
    })
    // The heading's own text, not an aria-label standing in for it, is what
    // names the level - so it reads correctly with color disregarded.
    expect(heading.textContent).toBe('Very low')
  })
})

describe('"Recalculate today" sits after the groups (7.3)', () => {
  it('appears after the last priority group rather than above the first', async () => {
    const urgent = makeTask({
      id: 'urgent-1',
      name: 'Urgent task',
      priority: 'urgent',
    })
    const low = makeTask({ id: 'low-1', name: 'Low task', priority: 'low' })

    const repository = createInMemoryRepository()
    await repository.saveTasks([urgent, low])
    await repository.saveSnapshot({
      date: '2026-08-18',
      plannedIds: [urgent.id, low.id],
      admittedIds: [],
    })

    renderApp(repository)
    await waitForLoaded()

    const todaySection = screen.getByRole('region', { name: 'Today' })
    const orderedNodes = Array.from(todaySection.querySelectorAll('h3, button'))
    const recalculateIndex = orderedNodes.findIndex(
      (node) => node.textContent === 'Recalculate today',
    )
    const lastHeadingIndex = orderedNodes.reduce(
      (last, node, index) => (node.tagName === 'H3' ? index : last),
      -1,
    )
    expect(lastHeadingIndex).toBeGreaterThan(-1)
    expect(recalculateIndex).toBeGreaterThan(lastHeadingIndex)
  })

  it('is still available when the Today tab shows its empty state', async () => {
    renderApp()
    await waitForLoaded()

    const todaySection = screen.getByRole('region', { name: 'Today' })
    expect(within(todaySection).getByText('empty')).toBeTruthy()
    expect(
      within(todaySection).getByRole('button', { name: 'Recalculate today' }),
    ).toBeTruthy()
  })

  it('is absent from the All and Completed tabs', async () => {
    renderApp()
    await waitForLoaded()

    switchTab('All')
    expect(
      screen.queryByRole('button', { name: 'Recalculate today' }),
    ).toBeNull()

    switchTab('Completed')
    expect(
      screen.queryByRole('button', { name: 'Recalculate today' }),
    ).toBeNull()
  })
})

describe('edit and delete controls are present in every tab (6.4)', () => {
  it('offers named Edit and Delete controls on every row in Today, All and Completed', async () => {
    const planned = makeTask({
      id: 'planned',
      name: 'Planned task',
      priority: 'medium',
    })
    const pendingOther = makeTask({
      id: 'pending-other',
      name: 'Other pending task',
      priority: 'high',
    })
    const completed = makeTask({
      id: 'completed',
      name: 'Completed task',
      priority: 'low',
      completedAt: new Date('2026-08-18T07:00:00.000Z'),
    })

    const repository = createInMemoryRepository()
    await repository.saveTasks([planned, pendingOther, completed])
    await repository.saveSnapshot({
      date: '2026-08-18',
      plannedIds: [planned.id],
      admittedIds: [],
    })

    renderApp(repository)
    await waitForLoaded()

    const todaySection = screen.getByRole('region', { name: 'Today' })
    const todayItem = within(todaySection)
      .getByText('Planned task')
      .closest('li')
    if (!todayItem) throw new Error('expected a list item')
    expect(within(todayItem).getByRole('button', { name: 'Edit' })).toBeTruthy()
    expect(
      within(todayItem).getByRole('button', { name: 'Delete' }),
    ).toBeTruthy()

    switchTab('All')
    const allSection = screen.getByRole('region', { name: 'All tasks' })
    for (const name of ['Planned task', 'Other pending task']) {
      const item = within(allSection).getByText(name).closest('li')
      if (!item) throw new Error('expected a list item')
      expect(within(item).getByRole('button', { name: 'Edit' })).toBeTruthy()
      expect(within(item).getByRole('button', { name: 'Delete' })).toBeTruthy()
    }

    switchTab('Completed')
    const completedSection = screen.getByRole('region', {
      name: 'Completed tasks',
    })
    const completedItem = within(completedSection)
      .getByText('Completed task')
      .closest('li')
    if (!completedItem) throw new Error('expected a list item')
    expect(
      within(completedItem).getByRole('button', { name: 'Edit' }),
    ).toBeTruthy()
    expect(
      within(completedItem).getByRole('button', { name: 'Delete' }),
    ).toBeTruthy()
  })
})
