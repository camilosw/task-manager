import { describe, expect, it } from 'vitest'
import type { Task } from './task'
import { compareForSelection, selectDailyPlan } from './dailyPlan'

function makeTask(overrides: Partial<Task> & { id: string }): Task {
  return {
    name: overrides.id,
    duration: 30,
    priority: 'medium',
    createdAt: new Date('2026-08-17T09:00:00Z'),
    completedAt: null,
    ...overrides,
  }
}

describe('compareForSelection', () => {
  it('orders by priority first, most important before least', () => {
    const urgent = makeTask({
      id: 'urgent',
      priority: 'urgent',
      createdAt: new Date('2026-08-17T12:00:00Z'),
    })
    const low = makeTask({
      id: 'low',
      priority: 'low',
      createdAt: new Date('2026-08-17T09:00:00Z'),
    })

    const sorted = [low, urgent].sort(compareForSelection)

    expect(sorted.map((task) => task.id)).toEqual(['urgent', 'low'])
  })

  it('breaks ties within the same priority by creation timestamp, oldest first', () => {
    const m1 = makeTask({
      id: 'M1',
      priority: 'medium',
      createdAt: new Date('2026-08-17T09:00:00Z'),
      duration: 45,
    })
    const m2 = makeTask({
      id: 'M2',
      priority: 'medium',
      createdAt: new Date('2026-08-17T10:00:00Z'),
      duration: 5,
    })
    const m3 = makeTask({
      id: 'M3',
      priority: 'medium',
      createdAt: new Date('2026-08-17T11:00:00Z'),
      duration: 20,
    })

    // Deliberately shuffled and duration-sorted-ascending, to prove duration
    // plays no part in the ordering: sorting by duration would yield
    // M2, M3, M1, but the spec requires M1, M2, M3 (creation order).
    const sorted = [m3, m1, m2].sort(compareForSelection)

    expect(sorted.map((task) => task.id)).toEqual(['M1', 'M2', 'M3'])
  })

  it('never reorders same-priority tasks by duration', () => {
    const long = makeTask({
      id: 'long',
      priority: 'high',
      duration: 120,
      createdAt: new Date('2026-08-17T09:00:00Z'),
    })
    const short = makeTask({
      id: 'short',
      priority: 'high',
      duration: 5,
      createdAt: new Date('2026-08-17T10:00:00Z'),
    })

    const sorted = [long, short].sort(compareForSelection)

    expect(sorted.map((task) => task.id)).toEqual(['long', 'short'])
  })
})

describe('selectDailyPlan', () => {
  it('includes the task that crosses the budget, and excludes what follows it (spec: overshoot example)', () => {
    // T1 urgent 15m, T2 high 30m, T3 medium 20m, T4 low 10m, created in
    // that order. Running total: 15, 45, 65 (crosses 60, included), then
    // T4 is excluded because 65 is not < 60.
    const t1 = makeTask({
      id: 'T1',
      priority: 'urgent',
      duration: 15,
      createdAt: new Date('2026-08-17T09:00:00Z'),
    })
    const t2 = makeTask({
      id: 'T2',
      priority: 'high',
      duration: 30,
      createdAt: new Date('2026-08-17T09:01:00Z'),
    })
    const t3 = makeTask({
      id: 'T3',
      priority: 'medium',
      duration: 20,
      createdAt: new Date('2026-08-17T09:02:00Z'),
    })
    const t4 = makeTask({
      id: 'T4',
      priority: 'low',
      duration: 10,
      createdAt: new Date('2026-08-17T09:03:00Z'),
    })

    const plan = selectDailyPlan([t1, t2, t3, t4])

    expect(plan.map((task) => task.id)).toEqual(['T1', 'T2', 'T3'])
    expect(plan.reduce((total, task) => total + task.duration, 0)).toBe(65)
  })

  it('stops when the budget is met exactly, excluding the task that would only meet it again (spec: exact-boundary example)', () => {
    // H1 high 30m, M1 medium 30m, L1 low 5m, created in that order.
    // Running total: 30, 60 (meets the budget exactly, included), then L1
    // is excluded because 60 is not < 60.
    const h1 = makeTask({
      id: 'H1',
      priority: 'high',
      duration: 30,
      createdAt: new Date('2026-08-17T09:00:00Z'),
    })
    const m1 = makeTask({
      id: 'M1',
      priority: 'medium',
      duration: 30,
      createdAt: new Date('2026-08-17T09:01:00Z'),
    })
    const l1 = makeTask({
      id: 'L1',
      priority: 'low',
      duration: 5,
      createdAt: new Date('2026-08-17T09:02:00Z'),
    })

    const plan = selectDailyPlan([h1, m1, l1])

    expect(plan.map((task) => task.id)).toEqual(['H1', 'M1'])
  })

  it('includes every urgent task even when they alone exceed the budget (spec: urgent-only example)', () => {
    // U1 urgent 45m, U2 urgent 30m, H1 high 5m, created in that order.
    // Both urgent tasks are included unconditionally, bringing the total to
    // 75 before H1 is even considered, so H1 is excluded because 75 is not
    // < 60 — despite being much shorter than the overshoot.
    const u1 = makeTask({
      id: 'U1',
      priority: 'urgent',
      duration: 45,
      createdAt: new Date('2026-08-17T09:00:00Z'),
    })
    const u2 = makeTask({
      id: 'U2',
      priority: 'urgent',
      duration: 30,
      createdAt: new Date('2026-08-17T09:01:00Z'),
    })
    const h1 = makeTask({
      id: 'H1',
      priority: 'high',
      duration: 5,
      createdAt: new Date('2026-08-17T09:02:00Z'),
    })

    const plan = selectDailyPlan([u1, u2, h1])

    expect(plan.map((task) => task.id)).toEqual(['U1', 'U2'])
    expect(plan.reduce((total, task) => total + task.duration, 0)).toBe(75)
  })

  it('never selects a completed task, however high its priority', () => {
    const completedUrgent = makeTask({
      id: 'completed-urgent',
      priority: 'urgent',
      duration: 15,
      createdAt: new Date('2026-08-17T09:00:00Z'),
      completedAt: new Date('2026-08-17T10:00:00Z'),
    })
    const pendingLow = makeTask({
      id: 'pending-low',
      priority: 'low',
      duration: 10,
      createdAt: new Date('2026-08-17T09:01:00Z'),
    })

    const plan = selectDailyPlan([completedUrgent, pendingLow])

    expect(plan.map((task) => task.id)).toEqual(['pending-low'])
  })

  it('returns an empty plan for an empty task list', () => {
    expect(selectDailyPlan([])).toEqual([])
  })

  it('returns an empty plan when every task is already completed', () => {
    const completed = makeTask({
      id: 'done',
      priority: 'urgent',
      duration: 15,
      completedAt: new Date('2026-08-17T10:00:00Z'),
    })

    expect(selectDailyPlan([completed])).toEqual([])
  })
})
