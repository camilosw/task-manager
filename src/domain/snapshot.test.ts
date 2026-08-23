import { describe, expect, it } from 'vitest'
import type { Task } from './task'
import type { DaySnapshot } from './snapshot'
import {
  admitIfUrgent,
  pruneTaskId,
  recomputeSnapshot,
  removeIfNoLongerUrgent,
  resolveSnapshotTasks,
} from './snapshot'

function makeTask(overrides: Partial<Task> & { id: string }): Task {
  return {
    name: overrides.id,
    duration: 30,
    priority: 'medium',
    createdAt: new Date('2026-08-17T09:00:00Z'),
    completedAt: null,
    place: 0,
    ...overrides,
  }
}

describe('resolveSnapshotTasks', () => {
  it('resolves the union of plannedIds and admittedIds against existing tasks', () => {
    const planned = makeTask({ id: 'planned-1' })
    const admitted = makeTask({ id: 'admitted-1', priority: 'urgent' })
    const snapshot: DaySnapshot = {
      date: '2026-08-17',
      plannedIds: [planned.id],
      admittedIds: [admitted.id],
    }

    const resolved = resolveSnapshotTasks(snapshot, [planned, admitted])

    expect(resolved.map((task) => task.id)).toEqual(['planned-1', 'admitted-1'])
  })

  it('silently skips an id that no longer resolves to an existing task', () => {
    const planned = makeTask({ id: 'planned-1' })
    const snapshot: DaySnapshot = {
      date: '2026-08-17',
      plannedIds: [planned.id, 'deleted-task'],
      admittedIds: ['also-deleted'],
    }

    const resolved = resolveSnapshotTasks(snapshot, [planned])

    expect(resolved.map((task) => task.id)).toEqual(['planned-1'])
  })
})

describe('admitIfUrgent', () => {
  it('appends a pending task that just became urgent to admittedIds', () => {
    const snapshot: DaySnapshot = {
      date: '2026-08-17',
      plannedIds: ['planned-1'],
      admittedIds: [],
    }
    const urgentTask = makeTask({ id: 'urgent-1', priority: 'urgent' })

    const next = admitIfUrgent(snapshot, urgentTask)

    expect(next.admittedIds).toEqual(['urgent-1'])
  })

  it('does not evict anything already in plannedIds or admittedIds to make room', () => {
    const snapshot: DaySnapshot = {
      date: '2026-08-17',
      plannedIds: ['planned-1', 'planned-2'],
      admittedIds: ['admitted-1'],
    }
    const urgentTask = makeTask({ id: 'urgent-2', priority: 'urgent' })

    const next = admitIfUrgent(snapshot, urgentTask)

    expect(next.plannedIds).toEqual(['planned-1', 'planned-2'])
    expect(next.admittedIds).toEqual(['admitted-1', 'urgent-2'])
  })

  it('does not admit a task that is not urgent', () => {
    const snapshot: DaySnapshot = {
      date: '2026-08-17',
      plannedIds: [],
      admittedIds: [],
    }
    const highTask = makeTask({ id: 'high-1', priority: 'high' })

    const next = admitIfUrgent(snapshot, highTask)

    expect(next.admittedIds).toEqual([])
  })

  it('does not duplicate a task that is already in plannedIds', () => {
    const snapshot: DaySnapshot = {
      date: '2026-08-17',
      plannedIds: ['already-planned'],
      admittedIds: [],
    }
    const task = makeTask({ id: 'already-planned', priority: 'urgent' })

    const next = admitIfUrgent(snapshot, task)

    expect(next.plannedIds).toEqual(['already-planned'])
    expect(next.admittedIds).toEqual([])
  })

  it('does not duplicate a task that is already in admittedIds', () => {
    const snapshot: DaySnapshot = {
      date: '2026-08-17',
      plannedIds: [],
      admittedIds: ['already-admitted'],
    }
    const task = makeTask({ id: 'already-admitted', priority: 'urgent' })

    const next = admitIfUrgent(snapshot, task)

    expect(next.admittedIds).toEqual(['already-admitted'])
  })
})

describe('removeIfNoLongerUrgent (asymmetry between admittedIds and plannedIds)', () => {
  it('removes a task from admittedIds once it stops being urgent', () => {
    const snapshot: DaySnapshot = {
      date: '2026-08-17',
      plannedIds: [],
      admittedIds: ['admitted-1'],
    }
    const deprioritized = makeTask({ id: 'admitted-1', priority: 'medium' })

    const next = removeIfNoLongerUrgent(snapshot, deprioritized)

    expect(next.admittedIds).toEqual([])
  })

  it('keeps a frozen plannedIds task through urgent and back to non-urgent, while an admitted task is dropped on the same edit', () => {
    // A task in plannedIds only got there because the algorithm selected it
    // when the plan was computed. Passing through urgent and back must not
    // touch plannedIds. A task in admittedIds got there only because it was
    // admitted as urgent, so ceasing to be urgent removes it.
    let snapshot: DaySnapshot = {
      date: '2026-08-17',
      plannedIds: ['frozen-1'],
      admittedIds: [],
    }

    // The frozen task is edited to urgent: already a member (via
    // plannedIds), so admission is a no-op — it must not be added to
    // admittedIds too.
    const frozenAsUrgent = makeTask({ id: 'frozen-1', priority: 'urgent' })
    snapshot = admitIfUrgent(snapshot, frozenAsUrgent)
    expect(snapshot).toEqual({
      date: '2026-08-17',
      plannedIds: ['frozen-1'],
      admittedIds: [],
    })

    // Meanwhile an unrelated task is created urgent and admitted for real.
    const admitted = makeTask({ id: 'admitted-1', priority: 'urgent' })
    snapshot = admitIfUrgent(snapshot, admitted)

    // Now both are edited back to a non-urgent priority.
    const frozenBackToMedium = makeTask({
      id: 'frozen-1',
      priority: 'medium',
    })
    const admittedBackToMedium = makeTask({
      id: 'admitted-1',
      priority: 'medium',
    })
    snapshot = removeIfNoLongerUrgent(snapshot, frozenBackToMedium)
    snapshot = removeIfNoLongerUrgent(snapshot, admittedBackToMedium)

    // The frozen task stays in plannedIds throughout; the admitted task is
    // removed because admittedIds membership can shrink.
    expect(snapshot.plannedIds).toEqual(['frozen-1'])
    expect(snapshot.admittedIds).toEqual([])
  })

  it('has no effect when the task is still urgent', () => {
    const snapshot: DaySnapshot = {
      date: '2026-08-17',
      plannedIds: [],
      admittedIds: ['admitted-1'],
    }
    const stillUrgent = makeTask({ id: 'admitted-1', priority: 'urgent' })

    const next = removeIfNoLongerUrgent(snapshot, stillUrgent)

    expect(next.admittedIds).toEqual(['admitted-1'])
  })
})

describe('pruneTaskId', () => {
  it('removes a deleted task id from plannedIds', () => {
    const snapshot: DaySnapshot = {
      date: '2026-08-17',
      plannedIds: ['keep-1', 'deleted-1'],
      admittedIds: ['keep-2'],
    }

    const next = pruneTaskId(snapshot, 'deleted-1')

    expect(next).toEqual({
      date: '2026-08-17',
      plannedIds: ['keep-1'],
      admittedIds: ['keep-2'],
    })
  })

  it('removes a deleted task id from admittedIds', () => {
    const snapshot: DaySnapshot = {
      date: '2026-08-17',
      plannedIds: ['keep-1'],
      admittedIds: ['keep-2', 'deleted-1'],
    }

    const next = pruneTaskId(snapshot, 'deleted-1')

    expect(next).toEqual({
      date: '2026-08-17',
      plannedIds: ['keep-1'],
      admittedIds: ['keep-2'],
    })
  })

  it('resolveSnapshotTasks stays correct even when pruning has not run yet', () => {
    // Deleting a task removes it from the task list but pruning is a
    // separate, later step (see design.md, decision 3: "filtering on read
    // is mandatory ... pruning on delete is hygiene"). Resolution must be
    // robust to the snapshot still referencing the deleted id regardless of
    // whether pruneTaskId has been called.
    const remaining = makeTask({ id: 'remaining-1' })
    const snapshotBeforePruning: DaySnapshot = {
      date: '2026-08-17',
      plannedIds: ['remaining-1', 'deleted-1'],
      admittedIds: ['deleted-2'],
    }

    const resolved = resolveSnapshotTasks(snapshotBeforePruning, [remaining])

    expect(resolved.map((task) => task.id)).toEqual(['remaining-1'])
  })
})

describe('recomputeSnapshot', () => {
  it('sets plannedIds to selectDailyPlan output (urgent included) and starts admittedIds empty', () => {
    // U1 urgent 20m (always included, total 20), H1 high 45m (20 < 60,
    // included, total 65), M1 medium 30m (65 not < 60, excluded).
    const u1 = makeTask({
      id: 'U1',
      priority: 'urgent',
      duration: 20,
      createdAt: new Date('2026-08-17T09:00:00Z'),
    })
    const h1 = makeTask({
      id: 'H1',
      priority: 'high',
      duration: 45,
      createdAt: new Date('2026-08-17T09:01:00Z'),
    })
    const m1 = makeTask({
      id: 'M1',
      priority: 'medium',
      duration: 30,
      createdAt: new Date('2026-08-17T09:02:00Z'),
    })
    const now = new Date(2026, 7, 17, 9, 0, 0)

    const snapshot = recomputeSnapshot([u1, h1, m1], now)

    expect(snapshot).toEqual({
      date: '2026-08-17',
      plannedIds: ['U1', 'H1'],
      admittedIds: [],
    })
  })

  it('replaces both lists wholesale rather than extending the previous snapshot', () => {
    // Day 1: a plan is computed and a task is admitted mid-day.
    const oldTask = makeTask({
      id: 'old-1',
      priority: 'medium',
      duration: 30,
      createdAt: new Date('2026-08-17T09:00:00Z'),
    })
    const day1 = new Date(2026, 7, 17, 9, 0, 0)
    let snapshot = recomputeSnapshot([oldTask], day1)
    const admittedTask = makeTask({
      id: 'admitted-old',
      priority: 'urgent',
      createdAt: new Date('2026-08-17T12:00:00Z'),
    })
    snapshot = admitIfUrgent(snapshot, admittedTask)
    expect(snapshot.plannedIds).toEqual(['old-1'])
    expect(snapshot.admittedIds).toEqual(['admitted-old'])

    // Day 2: a completely different pending task set. Recomputation must
    // not carry over old-1 or admitted-old — it replaces, not extends.
    const newTask = makeTask({
      id: 'new-1',
      priority: 'medium',
      duration: 20,
      createdAt: new Date('2026-08-18T09:00:00Z'),
    })
    const day2 = new Date(2026, 7, 18, 9, 0, 0)

    snapshot = recomputeSnapshot([newTask], day2)

    expect(snapshot).toEqual({
      date: '2026-08-18',
      plannedIds: ['new-1'],
      admittedIds: [],
    })
  })

  it('excludes completed tasks from the fresh selection', () => {
    const completed = makeTask({
      id: 'done-1',
      priority: 'urgent',
      completedAt: new Date('2026-08-17T08:00:00Z'),
    })
    const pending = makeTask({ id: 'pending-1', priority: 'medium' })
    const now = new Date(2026, 7, 17, 9, 0, 0)

    const snapshot = recomputeSnapshot([completed, pending], now)

    expect(snapshot.plannedIds).toEqual(['pending-1'])
  })
})
