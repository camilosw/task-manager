import { describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createInMemoryRepository } from '../persistence/inMemoryRepository'
import type { Repository } from '../persistence/repository'
import type { CreateTaskResult, EditTaskResult, Task } from '../domain/task'
import { recomputeSnapshot, type DaySnapshot } from '../domain/snapshot'
import { AppStateProvider } from './AppStateProvider'
import { useAppState } from './useAppState'
import type { AppState } from './appStateContext'

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
    createdAt: new Date('2026-08-17T09:00:00.000Z'),
    completedAt: null,
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
