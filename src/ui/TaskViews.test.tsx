import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { AppStateProvider } from './AppStateProvider'
import { TaskManagerApp } from './TaskManagerApp'
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
    createdAt: new Date('2026-08-17T09:00:00.000Z'),
    completedAt: null,
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
    const older = makeTask({
      id: 'older',
      name: 'Older task',
      priority: 'medium',
      createdAt: new Date('2026-08-18T05:00:00.000Z'),
    })
    const newer = makeTask({
      id: 'newer',
      name: 'Newer task',
      priority: 'medium',
      createdAt: new Date('2026-08-18T09:00:00.000Z'),
    })

    const repository = createInMemoryRepository()
    // Save in reverse creation order to prove display order is not just
    // insertion order.
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

describe('All tab ordering (9.3)', () => {
  it('orders every pending task by priority then age, excluding completed tasks', async () => {
    // The worked example from specs/task-views/spec.md, "The All tab orders
    // by priority then age".
    const taskA = makeTask({
      id: 'A',
      name: 'A',
      priority: 'medium',
      createdAt: new Date('2026-08-18T09:00:00.000Z'),
    })
    const taskB = makeTask({
      id: 'B',
      name: 'B',
      priority: 'urgent',
      createdAt: new Date('2026-08-18T11:00:00.000Z'),
    })
    const taskC = makeTask({
      id: 'C',
      name: 'C',
      priority: 'medium',
      createdAt: new Date('2026-08-18T08:00:00.000Z'),
    })
    const taskD = makeTask({
      id: 'D',
      name: 'D',
      priority: 'very-low',
      createdAt: new Date('2026-08-18T07:00:00.000Z'),
    })
    const taskE = makeTask({
      id: 'E',
      name: 'E',
      priority: 'high',
      createdAt: new Date('2026-08-18T12:00:00.000Z'),
    })
    const completed = makeTask({
      id: 'done',
      name: 'Already done',
      priority: 'urgent',
      createdAt: new Date('2026-08-18T06:00:00.000Z'),
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
    fireEvent.click(within(item).getByRole('button', { name: 'Complete' }))

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
    fireEvent.click(within(item).getByRole('button', { name: 'Complete' }))

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
    fireEvent.click(within(item).getByRole('button', { name: 'Complete' }))

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
