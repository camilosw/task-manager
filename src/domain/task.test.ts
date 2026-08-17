import { describe, expect, it } from 'vitest'
import { completeTask, createTask, editTask } from './task'

describe('createTask', () => {
  const now = new Date('2026-08-17T09:00:00Z')

  it('creates a pending task recording the creation timestamp from the injected now', () => {
    const result = createTask(
      { id: 'task-1', name: 'Review the PR', duration: 30, priority: 'high' },
      now,
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.task).toEqual({
      id: 'task-1',
      name: 'Review the PR',
      duration: 30,
      priority: 'high',
      createdAt: now,
      completedAt: null,
    })
  })

  it('trims surrounding whitespace from the name', () => {
    const result = createTask(
      {
        id: 'task-1',
        name: '  Review the PR  ',
        duration: 30,
        priority: 'high',
      },
      now,
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.task.name).toBe('Review the PR')
  })

  it('rejects an empty name', () => {
    const result = createTask(
      { id: 'task-1', name: '', duration: 30, priority: 'high' },
      now,
    )

    expect(result).toEqual({ ok: false, errors: ['name'] })
  })

  it('rejects a name that is only whitespace', () => {
    const result = createTask(
      { id: 'task-1', name: '   ', duration: 30, priority: 'high' },
      now,
    )

    expect(result).toEqual({ ok: false, errors: ['name'] })
  })

  it('rejects a missing duration', () => {
    const result = createTask(
      {
        id: 'task-1',
        name: 'Review the PR',
        duration: undefined,
        priority: 'high',
      },
      now,
    )

    expect(result).toEqual({ ok: false, errors: ['duration'] })
  })

  it('rejects a missing priority', () => {
    const result = createTask(
      {
        id: 'task-1',
        name: 'Review the PR',
        duration: 30,
        priority: undefined,
      },
      now,
    )

    expect(result).toEqual({ ok: false, errors: ['priority'] })
  })

  it('reports every missing field at once', () => {
    const result = createTask(
      { id: 'task-1', name: '   ', duration: undefined, priority: undefined },
      now,
    )

    expect(result).toEqual({
      ok: false,
      errors: ['name', 'duration', 'priority'],
    })
  })
})

describe('editTask', () => {
  const createdAt = new Date('2026-08-17T09:00:00Z')
  const task = {
    id: 'task-1',
    name: 'Review the PR',
    duration: 30,
    priority: 'high',
    createdAt,
    completedAt: null,
  } as const

  it('applies the new name, duration, and priority', () => {
    const result = editTask(task, {
      name: 'Review the big PR',
      duration: 15,
      priority: 'low',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.task.name).toBe('Review the big PR')
    expect(result.task.duration).toBe(15)
    expect(result.task.priority).toBe('low')
  })

  it('preserves the original creation timestamp', () => {
    const result = editTask(task, {
      name: 'Review the big PR',
      duration: 15,
      priority: 'low',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.task.createdAt).toBe(createdAt)
  })

  it('trims surrounding whitespace from the edited name', () => {
    const result = editTask(task, {
      name: '  Renamed  ',
      duration: 30,
      priority: 'high',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.task.name).toBe('Renamed')
  })

  it('rejects an edit that clears the name, and the task keeps its previous value', () => {
    const result = editTask(task, { name: '', duration: 15, priority: 'low' })

    expect(result).toEqual({ ok: false, errors: ['name'] })
  })

  it('rejects an edit whose name is only whitespace', () => {
    const result = editTask(task, {
      name: '   ',
      duration: 15,
      priority: 'low',
    })

    expect(result).toEqual({ ok: false, errors: ['name'] })
  })
})

describe('completeTask', () => {
  const createdAt = new Date('2026-08-17T09:00:00Z')
  const completedAt = new Date('2026-08-17T15:30:00Z')
  const task = {
    id: 'task-1',
    name: 'Review the PR',
    duration: 30,
    priority: 'high',
    createdAt,
    completedAt: null,
  } as const

  it('records the completion time from the injected now', () => {
    const completed = completeTask(task, completedAt)

    expect(completed.completedAt).toBe(completedAt)
  })

  it('leaves every other field unchanged', () => {
    const completed = completeTask(task, completedAt)

    expect(completed).toEqual({ ...task, completedAt })
  })
})
