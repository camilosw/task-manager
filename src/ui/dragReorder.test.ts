import { describe, expect, it, vi } from 'vitest'
import { reorderWithinPriority, type Task } from '../domain/task'
import { handleTaskDragEnd } from './dragReorder'

function makeTask(overrides: Partial<Task> & { id: string }): Task {
  return {
    name: overrides.id,
    duration: 30,
    priority: 'medium',
    createdAt: new Date('2026-08-17T09:00:00.000Z'),
    place: 0,
    completedAt: null,
    ...overrides,
  }
}

describe('a drag end within a priority reorders through the domain function (8.2)', () => {
  it('calls reorderTasks with the two ids, which itself resolves through reorderWithinPriority', () => {
    const m1 = makeTask({ id: 'm1', priority: 'medium', place: 0 })
    const m2 = makeTask({ id: 'm2', priority: 'medium', place: 1 })
    const m3 = makeTask({ id: 'm3', priority: 'medium', place: 2 })
    let tasks = [m1, m2, m3]

    handleTaskDragEnd(
      { active: { id: 'm3' }, over: { id: 'm1' } },
      tasks,
      (activeId, overId) => {
        tasks = reorderWithinPriority(tasks, activeId, overId)
      },
    )

    // m3 now holds the place m1 held, and m1/m2 shift down by one — exactly
    // what reorderWithinPriority does for two same-priority ids.
    expect(tasks.find((task) => task.id === 'm3')?.place).toBe(0)
    expect(tasks.find((task) => task.id === 'm1')?.place).toBe(1)
    expect(tasks.find((task) => task.id === 'm2')?.place).toBe(2)
  })
})

describe('a drop outside the group is rejected (8.3)', () => {
  it('does not call reorderTasks, so no place and no priority changes, when over belongs to a different priority', () => {
    const m1 = makeTask({ id: 'm1', priority: 'medium', place: 0 })
    const h1 = makeTask({ id: 'h1', priority: 'high', place: 1 })
    const reorderTasks = vi.fn()

    handleTaskDragEnd(
      { active: { id: 'm1' }, over: { id: 'h1' } },
      [m1, h1],
      reorderTasks,
    )

    expect(reorderTasks).not.toHaveBeenCalled()
  })
})

describe('an abandoned drag changes nothing (8.4)', () => {
  it('does not call reorderTasks when the drag end reports no over target', () => {
    const m1 = makeTask({ id: 'm1', priority: 'medium', place: 0 })
    const reorderTasks = vi.fn()

    handleTaskDragEnd({ active: { id: 'm1' }, over: null }, [m1], reorderTasks)

    expect(reorderTasks).not.toHaveBeenCalled()
  })
})
