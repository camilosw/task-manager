import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createInMemoryRepository } from '../persistence/inMemoryRepository'
import type { Repository } from '../persistence/repository'
import {
  reorderWithinPriority,
  type CreateTaskResult,
  type EditTaskResult,
  type Task,
} from '../domain/task'
import { recomputeSnapshot, type DaySnapshot } from '../domain/snapshot'
import type { RecurrenceRule } from '../domain/recurrence'
import { AppStateProvider } from './AppStateProvider'
import { useAppState } from './useAppState'
import type { AppState } from './appStateContext'

/** A rule of every Monday, reused across the recurring-task scenarios below
 * (tasks.md section 8). Matches the dates traced in
 * specs/recurring-tasks/spec.md and specs/daily-plan/spec.md, which use
 * Monday 17/24/31 August 2026 throughout. */
const weeklyMonday: RecurrenceRule = { kind: 'weekly', weekdays: [1] }

function wrapperFor(repository: Repository, now?: () => Date) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AppStateProvider repository={repository} now={now}>
        {children}
      </AppStateProvider>
    )
  }
}

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

/** Renders the hook and waits for it to leave the loading state. */
async function renderLoaded(repository: Repository, now?: () => Date) {
  const { result } = renderHook(() => useAppState(), {
    wrapper: wrapperFor(repository, now),
  })

  await waitFor(() => {
    expect(result.current.status).toBe('loaded')
  })

  return result
}

function assertLoaded(
  state: AppState,
): asserts state is Extract<AppState, { status: 'loaded' }> {
  if (state.status !== 'loaded') {
    throw new Error('expected state to be loaded')
  }
}

describe('useAppState loading', () => {
  it('starts in a loading state before the repository resolves', () => {
    const repository = createInMemoryRepository()

    const { result } = renderHook(() => useAppState(), {
      wrapper: wrapperFor(repository),
    })

    expect(result.current.status).toBe('loading')
  })

  it('transitions to loaded once repository.loadAll() resolves', async () => {
    const repository = createInMemoryRepository()

    const { result } = renderHook(() => useAppState(), {
      wrapper: wrapperFor(repository),
    })

    await waitFor(() => {
      expect(result.current.status).toBe('loaded')
    })
  })
})

describe('useAppState mutations', () => {
  const fixedNow = new Date('2026-08-17T09:00:00.000Z')
  const now = () => fixedNow

  it('creates a task through the domain createTask function and persists the resulting tasks', async () => {
    const repository = createInMemoryRepository()
    const saveTasksSpy = vi.spyOn(repository, 'saveTasks')
    const result = await renderLoaded(repository, now)
    assertLoaded(result.current)

    let createResult!: CreateTaskResult
    await act(async () => {
      assertLoaded(result.current)
      createResult = await result.current.createTask({
        name: 'Write the report',
        duration: 30,
        priority: 'medium',
      })
    })

    expect(createResult.ok).toBe(true)
    if (!createResult.ok) return
    expect(createResult.task).toMatchObject({
      name: 'Write the report',
      duration: 30,
      priority: 'medium',
      createdAt: fixedNow,
      completedAt: null,
    })
    assertLoaded(result.current)
    expect(result.current.tasks).toEqual([createResult.task])
    expect(saveTasksSpy).toHaveBeenLastCalledWith([createResult.task])
  })

  it('assigns a newly created task the next place, after every existing task, regardless of priority', async () => {
    const existing = [
      makeTask({ id: 'task-1', priority: 'medium', place: 3 }),
      makeTask({ id: 'task-2', priority: 'high', place: 7 }),
    ]
    const repository = createInMemoryRepository()
    await repository.saveTasks(existing)
    const result = await renderLoaded(repository, now)
    assertLoaded(result.current)

    let createResult!: CreateTaskResult
    await act(async () => {
      assertLoaded(result.current)
      createResult = await result.current.createTask({
        name: 'Write the report',
        duration: 30,
        priority: 'medium',
      })
    })

    expect(createResult.ok).toBe(true)
    if (!createResult.ok) return
    // nextPlace(existing) is one past the highest existing place (7), so the
    // new task sorts after every task of every priority, and in particular
    // after task-1, the other medium task (see
    // specs/task-management/spec.md, "A new task takes the last place in
    // the order").
    expect(createResult.task.place).toBe(8)
    assertLoaded(result.current)
    expect(result.current.tasks).toEqual([...existing, createResult.task])
  })

  it('rejects an invalid creation without mutating state or persisting anything', async () => {
    const repository = createInMemoryRepository()
    const saveTasksSpy = vi.spyOn(repository, 'saveTasks')
    const result = await renderLoaded(repository, now)
    assertLoaded(result.current)
    saveTasksSpy.mockClear()

    let createResult!: CreateTaskResult
    await act(async () => {
      assertLoaded(result.current)
      createResult = await result.current.createTask({ name: '   ' })
    })

    expect(createResult).toEqual({
      ok: false,
      errors: ['name', 'duration', 'priority'],
    })
    assertLoaded(result.current)
    expect(result.current.tasks).toEqual([])
    expect(saveTasksSpy).not.toHaveBeenCalled()
  })

  it('admits a newly created urgent task into the existing snapshot and persists it', async () => {
    const repository = createInMemoryRepository()
    const existingSnapshot: DaySnapshot = {
      date: '2026-08-17',
      plannedIds: [],
      admittedIds: [],
    }
    await repository.saveSnapshot(existingSnapshot)
    const result = await renderLoaded(repository, now)
    assertLoaded(result.current)
    const saveSnapshotSpy = vi.spyOn(repository, 'saveSnapshot')

    let createResult!: CreateTaskResult
    await act(async () => {
      assertLoaded(result.current)
      createResult = await result.current.createTask({
        name: 'Fix the outage',
        duration: 15,
        priority: 'urgent',
      })
    })

    expect(createResult.ok).toBe(true)
    if (!createResult.ok) return
    assertLoaded(result.current)
    expect(result.current.snapshot).toEqual({
      ...existingSnapshot,
      admittedIds: [createResult.task.id],
    })
    expect(saveSnapshotSpy).toHaveBeenCalledWith(result.current.snapshot)
  })

  it('does not save a snapshot when the created task is not urgent', async () => {
    const repository = createInMemoryRepository()
    await repository.saveSnapshot({
      date: '2026-08-17',
      plannedIds: [],
      admittedIds: [],
    })
    const result = await renderLoaded(repository, now)
    assertLoaded(result.current)
    const saveSnapshotSpy = vi.spyOn(repository, 'saveSnapshot')

    await act(async () => {
      assertLoaded(result.current)
      await result.current.createTask({
        name: 'Read a book',
        duration: 30,
        priority: 'low',
      })
    })

    expect(saveSnapshotSpy).not.toHaveBeenCalled()
  })

  it('edits a task through the domain editTask function and persists the resulting tasks', async () => {
    const task = makeTask({
      id: 'task-1',
      name: 'Old name',
      priority: 'medium',
    })
    const repository = createInMemoryRepository()
    await repository.saveTasks([task])
    const saveTasksSpy = vi.spyOn(repository, 'saveTasks')
    const result = await renderLoaded(repository, now)
    assertLoaded(result.current)
    saveTasksSpy.mockClear()

    let editResult!: EditTaskResult
    await act(async () => {
      assertLoaded(result.current)
      editResult = await result.current.editTask('task-1', {
        name: 'New name',
        duration: 15,
        priority: 'high',
      })
    })

    expect(editResult.ok).toBe(true)
    if (!editResult.ok) return
    assertLoaded(result.current)
    expect(result.current.tasks).toEqual([editResult.task])
    expect(editResult.task).toMatchObject({
      id: 'task-1',
      name: 'New name',
      duration: 15,
      priority: 'high',
      createdAt: task.createdAt,
    })
    expect(saveTasksSpy).toHaveBeenLastCalledWith([editResult.task])
  })

  it('rejects an edit that clears the name, leaving state and persistence untouched', async () => {
    const task = makeTask({ id: 'task-1', name: 'Old name' })
    const repository = createInMemoryRepository()
    await repository.saveTasks([task])
    const saveTasksSpy = vi.spyOn(repository, 'saveTasks')
    const result = await renderLoaded(repository, now)
    assertLoaded(result.current)
    saveTasksSpy.mockClear()

    let editResult!: EditTaskResult
    await act(async () => {
      assertLoaded(result.current)
      editResult = await result.current.editTask('task-1', {
        name: '   ',
        duration: 15,
        priority: 'high',
      })
    })

    expect(editResult).toEqual({ ok: false, errors: ['name'] })
    assertLoaded(result.current)
    expect(result.current.tasks).toEqual([task])
    expect(saveTasksSpy).not.toHaveBeenCalled()
  })

  it('removes a task from admittedIds when an edit makes it no longer urgent, and persists the snapshot', async () => {
    const task = makeTask({ id: 'task-1', priority: 'urgent' })
    const repository = createInMemoryRepository()
    await repository.saveTasks([task])
    await repository.saveSnapshot({
      date: '2026-08-17',
      plannedIds: [],
      admittedIds: ['task-1'],
    })
    const result = await renderLoaded(repository, now)
    assertLoaded(result.current)
    const saveSnapshotSpy = vi.spyOn(repository, 'saveSnapshot')

    await act(async () => {
      assertLoaded(result.current)
      await result.current.editTask('task-1', {
        name: task.name,
        duration: task.duration,
        priority: 'medium',
      })
    })

    assertLoaded(result.current)
    expect(result.current.snapshot).toEqual({
      date: '2026-08-17',
      plannedIds: [],
      admittedIds: [],
    })
    expect(saveSnapshotSpy).toHaveBeenCalledWith(result.current.snapshot)
  })

  it('deletes a task by removing it from tasks and pruning it from the snapshot, persisting both', async () => {
    const task = makeTask({ id: 'task-1' })
    const repository = createInMemoryRepository()
    await repository.saveTasks([task])
    await repository.saveSnapshot({
      date: '2026-08-17',
      plannedIds: ['task-1'],
      admittedIds: [],
    })
    const result = await renderLoaded(repository, now)
    assertLoaded(result.current)
    const saveTasksSpy = vi.spyOn(repository, 'saveTasks')
    const saveSnapshotSpy = vi.spyOn(repository, 'saveSnapshot')

    await act(async () => {
      assertLoaded(result.current)
      await result.current.deleteTask('task-1')
    })

    assertLoaded(result.current)
    expect(result.current.tasks).toEqual([])
    expect(result.current.snapshot).toEqual({
      date: '2026-08-17',
      plannedIds: [],
      admittedIds: [],
    })
    expect(saveTasksSpy).toHaveBeenLastCalledWith([])
    expect(saveSnapshotSpy).toHaveBeenCalledWith(result.current.snapshot)
  })

  it('completes a task through the domain completeTask function, recording the injected now, and persists tasks only', async () => {
    const task = makeTask({ id: 'task-1' })
    const completedAt = new Date('2026-08-17T15:00:00.000Z')
    const repository = createInMemoryRepository()
    await repository.saveTasks([task])
    await repository.saveSnapshot({
      date: '2026-08-17',
      plannedIds: ['task-1'],
      admittedIds: [],
    })
    const result = await renderLoaded(repository, () => completedAt)
    assertLoaded(result.current)
    const saveTasksSpy = vi.spyOn(repository, 'saveTasks')
    const saveSnapshotSpy = vi.spyOn(repository, 'saveSnapshot')

    await act(async () => {
      assertLoaded(result.current)
      await result.current.completeTask('task-1')
    })

    assertLoaded(result.current)
    expect(result.current.tasks).toEqual([{ ...task, completedAt }])
    expect(saveTasksSpy).toHaveBeenLastCalledWith([{ ...task, completedAt }])
    // Completion never changes snapshot membership (see design.md, "The
    // non-urgent selection is frozen for the day") — only the tasks record
    // changes, so no snapshot save should follow a completion.
    expect(saveSnapshotSpy).not.toHaveBeenCalled()
  })

  it('reorders tasks through the domain reorderWithinPriority function and persists the resulting tasks', async () => {
    const taskA = makeTask({ id: 'task-a', priority: 'medium', place: 0 })
    const taskB = makeTask({ id: 'task-b', priority: 'medium', place: 1 })
    const taskC = makeTask({ id: 'task-c', priority: 'medium', place: 2 })
    const repository = createInMemoryRepository()
    await repository.saveTasks([taskA, taskB, taskC])
    const result = await renderLoaded(repository, now)
    assertLoaded(result.current)
    const saveTasksSpy = vi.spyOn(repository, 'saveTasks')

    await act(async () => {
      assertLoaded(result.current)
      await result.current.reorderTasks('task-c', 'task-a')
    })

    const expectedTasks = reorderWithinPriority(
      [taskA, taskB, taskC],
      'task-c',
      'task-a',
    )
    assertLoaded(result.current)
    expect(result.current.tasks).toEqual(expectedTasks)
    expect(saveTasksSpy).toHaveBeenLastCalledWith(expectedTasks)
  })

  it('leaves the snapshot untouched and persists no snapshot when reordering', async () => {
    const taskA = makeTask({ id: 'task-a', priority: 'medium', place: 0 })
    const taskB = makeTask({ id: 'task-b', priority: 'medium', place: 1 })
    const existingSnapshot: DaySnapshot = {
      date: '2026-08-17',
      plannedIds: ['task-a', 'task-b'],
      admittedIds: [],
    }
    const repository = createInMemoryRepository()
    await repository.saveTasks([taskA, taskB])
    await repository.saveSnapshot(existingSnapshot)
    const result = await renderLoaded(repository, now)
    assertLoaded(result.current)
    const saveSnapshotSpy = vi.spyOn(repository, 'saveSnapshot')

    await act(async () => {
      assertLoaded(result.current)
      await result.current.reorderTasks('task-b', 'task-a')
    })

    assertLoaded(result.current)
    // Reordering changes no id, so the snapshot — which holds ids, not
    // copied task values — cannot go stale as a side effect (see design.md,
    // decision 5, and specs/daily-plan/spec.md, "A reordering waits for the
    // next computation"). Nothing about the day's membership should change,
    // and nothing should be written to the snapshot store at all.
    expect(result.current.snapshot).toEqual(existingSnapshot)
    expect(saveSnapshotSpy).not.toHaveBeenCalled()
  })
})

describe('useAppState first-ever load', () => {
  const fixedNow = new Date('2026-08-18T09:00:00.000Z')
  const now = () => fixedNow

  it('computes and persists a plan when the repository has no snapshot yet', async () => {
    const tasks = [
      makeTask({ id: 'task-1', priority: 'high', duration: 30 }),
      makeTask({ id: 'task-2', priority: 'urgent', duration: 15 }),
    ]
    const repository = createInMemoryRepository()
    await repository.saveTasks(tasks)
    const saveSnapshotSpy = vi.spyOn(repository, 'saveSnapshot')

    const result = await renderLoaded(repository, now)

    assertLoaded(result.current)
    const expectedSnapshot = recomputeSnapshot(tasks, fixedNow)
    expect(result.current.snapshot).not.toBeNull()
    expect(result.current.snapshot).toEqual(expectedSnapshot)
    expect(saveSnapshotSpy).toHaveBeenCalledWith(expectedSnapshot)
  })

  it('does not recompute a plan when the repository already has a snapshot', async () => {
    const existingSnapshot: DaySnapshot = {
      date: '2026-08-18',
      plannedIds: [],
      admittedIds: [],
    }
    const repository = createInMemoryRepository()
    await repository.saveSnapshot(existingSnapshot)
    const saveSnapshotSpy = vi.spyOn(repository, 'saveSnapshot')

    const result = await renderLoaded(repository, now)

    assertLoaded(result.current)
    expect(result.current.snapshot).toEqual(existingSnapshot)
    expect(saveSnapshotSpy).not.toHaveBeenCalled()
  })
})

describe('useAppState load reawakening (8.1)', () => {
  it('reawakens a due recurring task and persists it before recomputing the snapshot, on load', async () => {
    const now = () => new Date('2026-08-24T09:00:00.000Z') // the following Monday

    const recurringTask = makeTask({
      id: 'weekly-review',
      name: 'Weekly review',
      priority: null,
      recurrence: weeklyMonday,
      createdAt: new Date('2026-08-03T09:00:00.000Z'), // an earlier Monday
      completedAt: new Date('2026-08-17T10:00:00.000Z'), // stale — last Monday's completion
      lastCompletedOn: '2026-08-17',
    })

    const repository = createInMemoryRepository()
    await repository.saveTasks([recurringTask])
    await repository.saveSnapshot({
      date: '2026-08-17',
      plannedIds: [recurringTask.id],
      admittedIds: [],
    })
    const saveTasksSpy = vi.spyOn(repository, 'saveTasks')
    const saveSnapshotSpy = vi.spyOn(repository, 'saveSnapshot')

    const result = await renderLoaded(repository, now)
    assertLoaded(result.current)

    // The reawakened task — completedAt cleared, lastCompletedOn intact — is
    // written back to the repository as part of loading (see design.md,
    // decision 8: recomputation gains a task-record write it did not have
    // before).
    const reawakenedTask = { ...recurringTask, completedAt: null }
    expect(saveTasksSpy).toHaveBeenCalledWith([reawakenedTask])

    // The order is not interchangeable: `recomputeSnapshot` calls
    // `selectDailyPlan`, which filters on `completedAt === null`, so the
    // task write must land before the snapshot write for the reawakened
    // task to be seen as pending and selected (see design.md, decision 8).
    expect(saveTasksSpy.mock.invocationCallOrder[0]).toBeLessThan(
      saveSnapshotSpy.mock.invocationCallOrder[0],
    )

    expect(result.current.tasks).toEqual([reawakenedTask])
    expect(result.current.snapshot?.date).toBe('2026-08-24')
    // The task landed in the freshly computed plan — proof recomputation ran
    // against the reawakened tasks, not the stale ones.
    expect(result.current.snapshot?.plannedIds).toContain(recurringTask.id)
  })

  it('does not persist tasks on load when reawakening leaves every task unchanged', async () => {
    const now = () => new Date('2026-08-24T09:00:00.000Z')

    // Completed today already, so it is not due — nothing for reawaken to
    // clear (see recurrence.ts, `reawaken`'s no-write common case).
    const atRestTask = makeTask({
      id: 'weekly-review',
      priority: null,
      recurrence: weeklyMonday,
      createdAt: new Date('2026-08-03T09:00:00.000Z'),
      completedAt: new Date('2026-08-24T08:00:00.000Z'),
      lastCompletedOn: '2026-08-24',
    })

    const repository = createInMemoryRepository()
    await repository.saveTasks([atRestTask])
    // Dated earlier than `now`, so the load still triggers a recomputation —
    // only the task write should be skipped.
    await repository.saveSnapshot({
      date: '2026-08-17',
      plannedIds: [],
      admittedIds: [],
    })
    const saveTasksSpy = vi.spyOn(repository, 'saveTasks')
    const saveSnapshotSpy = vi.spyOn(repository, 'saveSnapshot')

    const result = await renderLoaded(repository, now)
    assertLoaded(result.current)

    expect(saveTasksSpy).not.toHaveBeenCalled()
    expect(saveSnapshotSpy).toHaveBeenCalled()
    expect(result.current.tasks).toEqual([atRestTask])
  })
})

describe('useAppState task creation admits a due recurring task (8.5)', () => {
  const fixedNow = new Date('2026-08-17T09:00:00.000Z') // a Monday
  const now = () => fixedNow

  it('admits a recurring task created mid-day, on a date its rule fires, into the existing snapshot and persists it', async () => {
    const repository = createInMemoryRepository()
    const existingSnapshot: DaySnapshot = {
      date: '2026-08-17',
      plannedIds: [],
      admittedIds: [],
    }
    await repository.saveSnapshot(existingSnapshot)
    const result = await renderLoaded(repository, now)
    assertLoaded(result.current)
    const saveTasksSpy = vi.spyOn(repository, 'saveTasks')
    const saveSnapshotSpy = vi.spyOn(repository, 'saveSnapshot')

    let createResult!: CreateTaskResult
    await act(async () => {
      assertLoaded(result.current)
      createResult = await result.current.createTask({
        name: 'Weekly review',
        duration: 30,
        recurrence: weeklyMonday,
      })
    })

    expect(createResult.ok).toBe(true)
    if (!createResult.ok) return
    expect(createResult.task).toMatchObject({
      name: 'Weekly review',
      duration: 30,
      priority: null,
      recurrence: weeklyMonday,
      lastCompletedOn: null,
    })

    assertLoaded(result.current)
    expect(result.current.snapshot).toEqual({
      ...existingSnapshot,
      admittedIds: [createResult.task.id],
    })
    expect(saveTasksSpy).toHaveBeenLastCalledWith([createResult.task])
    expect(saveSnapshotSpy).toHaveBeenCalledWith(result.current.snapshot)
  })

  it('does not admit a recurring task created on a date its rule does not fire', async () => {
    const repository = createInMemoryRepository()
    const existingSnapshot: DaySnapshot = {
      date: '2026-08-17',
      plannedIds: [],
      admittedIds: [],
    }
    await repository.saveSnapshot(existingSnapshot)
    const result = await renderLoaded(repository, now)
    assertLoaded(result.current)
    const saveSnapshotSpy = vi.spyOn(repository, 'saveSnapshot')

    // Monday 17 August 2026 is not a Wednesday, so a weekly-Wednesday rule
    // does not fire today.
    await act(async () => {
      assertLoaded(result.current)
      await result.current.createTask({
        name: 'Midweek check-in',
        duration: 15,
        recurrence: { kind: 'weekly', weekdays: [3] },
      })
    })

    expect(saveSnapshotSpy).not.toHaveBeenCalled()
  })
})

describe('useAppState persistent storage request', () => {
  // jsdom (the environment every other test in this file runs under) has no
  // `navigator.storage` at all, which is itself the common case this
  // feature must tolerate — see the assertions below that the app still
  // reaches 'loaded' with no `navigator.storage` present. These tests
  // additionally install one on `navigator` to cover the two outcomes
  // jsdom can't otherwise exercise: the browser granting persistence, and
  // the browser explicitly refusing it. The property is restored
  // afterwards so it doesn't leak into other test files.
  const originalStorage = Object.getOwnPropertyDescriptor(navigator, 'storage')

  afterEach(() => {
    if (originalStorage) {
      Object.defineProperty(navigator, 'storage', originalStorage)
    } else {
      delete (navigator as { storage?: unknown }).storage
    }
  })

  it('has no navigator.storage in the jsdom test environment, and still loads normally', async () => {
    expect('storage' in navigator).toBe(false)

    const repository = createInMemoryRepository()
    const result = await renderLoaded(repository)

    assertLoaded(result.current)
  })

  it('requests persistent storage on mount when the API is available', async () => {
    const persist = vi.fn().mockResolvedValue(true)
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { persist },
    })

    const repository = createInMemoryRepository()
    await renderLoaded(repository)

    expect(persist).toHaveBeenCalledTimes(1)
  })

  it('still loads when the browser refuses persistent storage', async () => {
    const persist = vi.fn().mockResolvedValue(false)
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { persist },
    })

    const repository = createInMemoryRepository()
    const result = await renderLoaded(repository)

    assertLoaded(result.current)
  })

  it('still loads, with no unhandled rejection, when persist() rejects', async () => {
    const persist = vi.fn().mockRejectedValue(new Error('denied'))
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { persist },
    })

    const repository = createInMemoryRepository()
    const result = await renderLoaded(repository)

    assertLoaded(result.current)
  })
})
