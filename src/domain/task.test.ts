import { describe, expect, it } from 'vitest'
import type { Task } from './task'
import { completeTask, createTask, editTask, nextPlace } from './task'

function makeTask(overrides: Partial<Task> & { id: string }): Task {
  return {
    name: overrides.id,
    duration: 30,
    priority: 'medium',
    createdAt: new Date('2026-08-17T09:00:00Z'),
    place: 0,
    completedAt: null,
    ...overrides,
  }
}

describe('createTask', () => {
  const now = new Date('2026-08-17T09:00:00Z')

  it('creates a pending task recording the creation timestamp from the injected now', () => {
    const result = createTask(
      {
        id: 'task-1',
        name: 'Review the PR',
        duration: 30,
        priority: 'high',
        place: 0,
      },
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
      place: 0,
      completedAt: null,
    })
  })

  it('records the place it is given, the way it already records the id', () => {
    const result = createTask(
      {
        id: 'task-1',
        name: 'Review the PR',
        duration: 30,
        priority: 'high',
        place: 4,
      },
      now,
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.task.place).toBe(4)
  })

  it('trims surrounding whitespace from the name', () => {
    const result = createTask(
      {
        id: 'task-1',
        name: '  Review the PR  ',
        duration: 30,
        priority: 'high',
        place: 0,
      },
      now,
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.task.name).toBe('Review the PR')
  })

  it('rejects an empty name', () => {
    const result = createTask(
      { id: 'task-1', name: '', duration: 30, priority: 'high', place: 0 },
      now,
    )

    expect(result).toEqual({ ok: false, errors: ['name'] })
  })

  it('rejects a name that is only whitespace', () => {
    const result = createTask(
      { id: 'task-1', name: '   ', duration: 30, priority: 'high', place: 0 },
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
        place: 0,
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
        place: 0,
      },
      now,
    )

    expect(result).toEqual({ ok: false, errors: ['priority'] })
  })

  it('reports every missing field at once', () => {
    const result = createTask(
      {
        id: 'task-1',
        name: '   ',
        duration: undefined,
        priority: undefined,
        place: 0,
      },
      now,
    )

    expect(result).toEqual({
      ok: false,
      errors: ['name', 'duration', 'priority'],
    })
  })
})

describe('nextPlace', () => {
  it('returns the first place for an empty task list', () => {
    expect(nextPlace([])).toBe(0)
  })

  it('returns one past the highest existing place', () => {
    const tasks = [
      makeTask({ id: 'a', place: 0 }),
      makeTask({ id: 'b', place: 3 }),
      makeTask({ id: 'c', place: 1 }),
    ]

    expect(nextPlace(tasks)).toBe(4)
  })

  it('returns one past the highest existing place regardless of priority level', () => {
    const tasks = [
      makeTask({ id: 'a', priority: 'low', place: 5 }),
      makeTask({ id: 'b', priority: 'urgent', place: 2 }),
    ]

    expect(nextPlace(tasks)).toBe(6)
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
    place: 2,
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

  it('preserves the place, including when the edit changes the priority', () => {
    // The task's own priority is 'high'; this edit changes it to 'low'.
    const result = editTask(task, {
      name: 'Review the big PR',
      duration: 15,
      priority: 'low',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.task.place).toBe(task.place)
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
    place: 3,
    completedAt: null,
  } as const

  it('records the completion time from the injected now', () => {
    const completed = completeTask(task, completedAt)

    expect(completed.completedAt).toBe(completedAt)
  })

  it('preserves the place, so a completed task keeps its position rather than moving', () => {
    const completed = completeTask(task, completedAt)

    expect(completed.place).toBe(task.place)
  })

  it('leaves every other field unchanged', () => {
    const completed = completeTask(task, completedAt)

    expect(completed).toEqual({ ...task, completedAt })
  })
})
