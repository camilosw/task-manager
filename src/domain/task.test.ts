import { describe, expect, it } from 'vitest'
import type { Task } from './task'
import {
  completeTask,
  createTask,
  editTask,
  nextPlace,
  reorderWithinPriority,
} from './task'
import { compareForSelection } from './dailyPlan'
import type { RecurrenceRule } from './recurrence'

function makeTask(overrides: Partial<Task> & { id: string }): Task {
  return {
    name: overrides.id,
    duration: 30,
    priority: 'medium',
    recurrence: null,
    createdAt: new Date('2026-08-17T09:00:00Z'),
    place: 0,
    completedAt: null,
    lastCompletedOn: null,
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
      recurrence: null,
      createdAt: now,
      place: 0,
      completedAt: null,
      lastCompletedOn: null,
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

  // 3.1: a recurring creation carries the rule, a null priority, and no
  // recorded last completion (see specs/task-management/spec.md, "A created
  // recurring task carries all attributes").
  it('creates a recurring task carrying the rule, a null priority, and no recorded last completion', () => {
    const rule: RecurrenceRule = { kind: 'weekly', weekdays: [1] }

    const result = createTask(
      {
        id: 'task-1',
        name: 'Weekly review',
        duration: 30,
        priority: undefined,
        recurrence: rule,
        place: 0,
      },
      now,
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.task.recurrence).toEqual(rule)
    expect(result.task.priority).toBeNull()
    expect(result.task.lastCompletedOn).toBeNull()
  })

  // 3.2: the mutual exclusion between a priority and a rule (see
  // specs/recurring-tasks/spec.md, "A task cannot carry both a priority and
  // a rule").
  it('rejects an input carrying both a priority and a rule, and one carrying neither', () => {
    const both = createTask(
      {
        id: 'task-1',
        name: 'Weekly review',
        duration: 30,
        priority: 'high',
        recurrence: { kind: 'weekly', weekdays: [1] },
        place: 0,
      },
      now,
    )
    expect(both.ok).toBe(false)

    const neither = createTask(
      {
        id: 'task-1',
        name: 'Weekly review',
        duration: 30,
        priority: undefined,
        recurrence: undefined,
        place: 0,
      },
      now,
    )
    expect(neither.ok).toBe(false)
  })

  // 3.3: the existing report-every-missing-field behavior extends to the
  // rule (see specs/recurring-tasks/spec.md, "An incomplete rule is
  // rejected").
  it('reports name, duration, and rule together for a recurring creation missing all three', () => {
    const result = createTask(
      {
        id: 'task-1',
        name: '   ',
        duration: undefined,
        priority: undefined,
        recurrence: { kind: 'weekly', weekdays: [] },
        place: 0,
      },
      now,
    )

    expect(result).toEqual({
      ok: false,
      errors: ['name', 'duration', 'rule'],
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
    recurrence: null,
    createdAt,
    place: 2,
    completedAt: null,
    lastCompletedOn: null,
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

  // 3.4: converting between one-off and recurring leaves name, duration,
  // creation timestamp, place, and last completion date untouched (see
  // specs/task-management/spec.md, "Converting a task between one-off and
  // recurring").
  it('converts a one-off task to recurring, leaving name, duration, creation timestamp, place, and last completion untouched', () => {
    const lastCompletedTask = { ...task, lastCompletedOn: '2026-08-10' }
    const rule: RecurrenceRule = { kind: 'weekly', weekdays: [1] }

    const result = editTask(lastCompletedTask, {
      name: lastCompletedTask.name,
      duration: lastCompletedTask.duration,
      recurrence: rule,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.task.recurrence).toEqual(rule)
    expect(result.task.priority).toBeNull()
    expect(result.task.name).toBe(lastCompletedTask.name)
    expect(result.task.duration).toBe(lastCompletedTask.duration)
    expect(result.task.createdAt).toBe(lastCompletedTask.createdAt)
    expect(result.task.place).toBe(lastCompletedTask.place)
    expect(result.task.lastCompletedOn).toBe(lastCompletedTask.lastCompletedOn)
  })

  it('converts a recurring task back to one-off, leaving name, duration, creation timestamp, place, and last completion untouched', () => {
    const recurringTask = {
      ...task,
      priority: null,
      recurrence: { kind: 'weekly', weekdays: [1] } as RecurrenceRule,
      lastCompletedOn: '2026-08-10',
    }

    const result = editTask(recurringTask, {
      name: recurringTask.name,
      duration: recurringTask.duration,
      priority: 'medium',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.task.priority).toBe('medium')
    expect(result.task.recurrence).toBeNull()
    expect(result.task.name).toBe(recurringTask.name)
    expect(result.task.duration).toBe(recurringTask.duration)
    expect(result.task.createdAt).toBe(recurringTask.createdAt)
    expect(result.task.place).toBe(recurringTask.place)
    expect(result.task.lastCompletedOn).toBe(recurringTask.lastCompletedOn)
  })

  // 3.5: the invariant holds under editing too (see
  // specs/task-management/spec.md, "An edit cannot leave a task with
  // neither a priority nor a rule").
  it('rejects an edit that would leave neither a priority nor a complete rule', () => {
    const result = editTask(task, {
      name: task.name,
      duration: task.duration,
    })

    expect(result).toEqual({ ok: false, errors: ['priority'] })
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
    recurrence: null,
    createdAt,
    place: 3,
    completedAt: null,
    lastCompletedOn: null,
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

  // 3.6: the two-field completion model (see design.md, decision 3, and
  // specs/recurring-tasks/spec.md, "Completing a recurring task puts it to
  // rest, it does not end it"). Constructed with the local `Date` — not a
  // UTC ISO string — so `toLocalDateString` resolves to the intended
  // calendar date regardless of the test environment's time zone (see
  // src/domain/dayBoundary.test.ts's own convention).
  it('records completedAt and the local date as the last completion on a recurring task', () => {
    const recurringTask = {
      ...task,
      priority: null,
      recurrence: { kind: 'weekly', weekdays: [1] } as RecurrenceRule,
    }
    const recurringCompletedAt = new Date(2026, 7, 24, 15, 30, 0)

    const completed = completeTask(recurringTask, recurringCompletedAt)

    expect(completed.completedAt).toBe(recurringCompletedAt)
    expect(completed.lastCompletedOn).toBe('2026-08-24')
  })

  it('sets only completedAt on a one-off task, leaving lastCompletedOn null', () => {
    const completed = completeTask(task, completedAt)

    expect(completed.completedAt).toBe(completedAt)
    expect(completed.lastCompletedOn).toBeNull()
  })
})

describe('reorderWithinPriority', () => {
  it('moves a task up its level, permuting the places already held by that level (spec: moving a task up its level)', () => {
    // The six-task worked example from
    // specs/task-management/spec.md, "Reordering a task within its
    // priority level".
    const h1 = makeTask({ id: 'H1', priority: 'high', place: 1 })
    const m1 = makeTask({ id: 'M1', priority: 'medium', place: 2 })
    const m2 = makeTask({ id: 'M2', priority: 'medium', place: 3 })
    const m3 = makeTask({ id: 'M3', priority: 'medium', place: 4 })
    const h2 = makeTask({ id: 'H2', priority: 'high', place: 5 })
    const l1 = makeTask({ id: 'L1', priority: 'low', place: 6 })
    const tasks = [h1, m1, m2, m3, h2, l1]

    const result = reorderWithinPriority(tasks, 'M3', 'M1')

    const byId = new Map(result.map((task) => [task.id, task]))
    expect(byId.get('M3')?.place).toBe(2)
    expect(byId.get('M1')?.place).toBe(3)
    expect(byId.get('M2')?.place).toBe(4)
    expect(byId.get('H1')?.place).toBe(1)
    expect(byId.get('H2')?.place).toBe(5)
    expect(byId.get('L1')?.place).toBe(6)

    const mediumOrder = result
      .filter((task) => task.priority === 'medium')
      .sort((a, b) => a.place - b.place)
      .map((task) => task.id)
    expect(mediumOrder).toEqual(['M3', 'M1', 'M2'])

    const highOrder = result
      .filter((task) => task.priority === 'high')
      .sort((a, b) => a.place - b.place)
      .map((task) => task.id)
    expect(highOrder).toEqual(['H1', 'H2'])
  })

  it('returns the input unchanged for an unknown id', () => {
    const m1 = makeTask({ id: 'M1', priority: 'medium', place: 0 })
    const m2 = makeTask({ id: 'M2', priority: 'medium', place: 1 })
    const tasks = [m1, m2]

    expect(reorderWithinPriority(tasks, 'missing', 'M2')).toEqual(tasks)
    expect(reorderWithinPriority(tasks, 'M1', 'missing')).toEqual(tasks)
  })

  it('returns the input unchanged when the active and over ids are equal', () => {
    const m1 = makeTask({ id: 'M1', priority: 'medium', place: 0 })
    const m2 = makeTask({ id: 'M2', priority: 'medium', place: 1 })
    const tasks = [m1, m2]

    expect(reorderWithinPriority(tasks, 'M1', 'M1')).toEqual(tasks)
  })

  it('returns the input unchanged for two tasks of different priorities, so a cross-group drop is rejected', () => {
    // Two medium tasks, so that dropping the second one onto a task from a
    // different group would, absent the priority guard, still permute the
    // medium group's own places (see the reasoning in design.md, decision
    // 3) — this fixture is deliberately sized to make that bug observable
    // rather than accidentally masked by a single-item group.
    const m1 = makeTask({ id: 'M1', priority: 'medium', place: 0 })
    const m2 = makeTask({ id: 'M2', priority: 'medium', place: 1 })
    const h1 = makeTask({ id: 'H1', priority: 'high', place: 2 })
    const tasks = [m1, m2, h1]

    const result = reorderWithinPriority(tasks, 'M2', 'H1')

    expect(result).toEqual(tasks)
    expect(result.find((task) => task.id === 'M1')?.priority).toBe('medium')
    expect(result.find((task) => task.id === 'M2')?.priority).toBe('medium')
    expect(result.find((task) => task.id === 'H1')?.priority).toBe('high')
  })

  it('reordering one priority level leaves every other level untouched and changes no priority', () => {
    // Deliberately interleaved so the medium tasks are not contiguous in
    // the global place order (unlike the six-task worked example above):
    // H2 and L1 sit between M1 and M3. This makes the test able to catch a
    // reorder that is scoped globally instead of to the priority level —
    // such a bug would shift H2's and L1's places even though this
    // fixture's neighbouring worked example wouldn't reveal it, because
    // there the medium tasks already happen to be contiguous.
    const h1 = makeTask({ id: 'H1', priority: 'high', place: 1 })
    const m1 = makeTask({ id: 'M1', priority: 'medium', place: 2 })
    const h2 = makeTask({ id: 'H2', priority: 'high', place: 3 })
    const m2 = makeTask({ id: 'M2', priority: 'medium', place: 4 })
    const l1 = makeTask({ id: 'L1', priority: 'low', place: 5 })
    const m3 = makeTask({ id: 'M3', priority: 'medium', place: 6 })
    const tasks = [h1, m1, h2, m2, l1, m3]

    const result = reorderWithinPriority(tasks, 'M3', 'M1')

    const byId = new Map(result.map((task) => [task.id, task]))
    // The high and low levels are untouched: same places, same priorities.
    expect(byId.get('H1')).toEqual(h1)
    expect(byId.get('H2')).toEqual(h2)
    expect(byId.get('L1')).toEqual(l1)
    // The medium level was in fact permuted, so this test is exercising a
    // real reorder rather than passing because nothing moved.
    expect(byId.get('M3')?.place).toBe(2)
    expect(byId.get('M1')?.place).toBe(4)
    expect(byId.get('M2')?.place).toBe(6)
    // No task changed its priority level.
    for (const task of result) {
      const original = [h1, m1, h2, m2, l1, m3].find((t) => t.id === task.id)
      expect(task.priority).toBe(original?.priority)
    }
  })
})

describe('a promoted task lands among its new peers by its place', () => {
  // The four-task worked example from specs/task-management/spec.md, "A
  // task keeps its place when its priority changes": none of A, B, C, D
  // have ever been reordered, so their places match their creation order.
  function makeFixture() {
    return {
      a: makeTask({
        id: 'A',
        priority: 'low',
        place: 1,
        createdAt: new Date('2026-08-17T08:00:00Z'),
      }),
      b: makeTask({
        id: 'B',
        priority: 'high',
        place: 2,
        createdAt: new Date('2026-08-17T09:00:00Z'),
      }),
      c: makeTask({
        id: 'C',
        priority: 'high',
        place: 3,
        createdAt: new Date('2026-08-17T10:00:00Z'),
      }),
      d: makeTask({
        id: 'D',
        priority: 'low',
        place: 4,
        createdAt: new Date('2026-08-17T11:00:00Z'),
      }),
    }
  }

  it('lands among its new peers by place when those peers have never been reordered (spec: A promoted task lands among its new peers by its place)', () => {
    const { a, b, c } = makeFixture()

    const edited = editTask(a, {
      name: a.name,
      duration: a.duration,
      priority: 'high',
    })

    expect(edited.ok).toBe(true)
    if (!edited.ok) return
    expect(edited.task.place).toBe(1)

    const highOrder = [edited.task, b, c]
      .sort(compareForSelection)
      .map((task) => task.id)
    // A appears first among the high tasks, not last, because its place
    // (1) precedes both B's (2) and C's (3).
    expect(highOrder).toEqual(['A', 'B', 'C'])
  })

  it('lands by its place, not by its age, when its new peers have been reordered (spec: A promoted task lands by its place, not by its age, when peers have been reordered)', () => {
    const { a, b, c, d } = makeFixture()

    // The user first moves C above B, so C holds place 2 and B holds
    // place 3.
    const reordered = reorderWithinPriority([a, b, c, d], 'C', 'B')
    const bReordered = reordered.find((task) => task.id === 'B')
    const cReordered = reordered.find((task) => task.id === 'C')
    expect(cReordered?.place).toBe(2)
    expect(bReordered?.place).toBe(3)
    if (bReordered === undefined || cReordered === undefined) return

    // The user then edits A and sets its priority to high. A keeps place 1
    // — its oldest, unreordered place — even though B and C's relative
    // order no longer matches their creation age.
    const edited = editTask(a, {
      name: a.name,
      duration: a.duration,
      priority: 'high',
    })

    expect(edited.ok).toBe(true)
    if (!edited.ok) return
    expect(edited.task.place).toBe(1)

    const highOrder = [edited.task, bReordered, cReordered]
      .sort(compareForSelection)
      .map((task) => task.id)
    // A, C, B — not A, B, C (age order) and not A, C, B by coincidence of
    // this fixture only: C now precedes B because C's place (2) precedes
    // B's (3), which is the opposite of C and B's creation age.
    expect(highOrder).toEqual(['A', 'C', 'B'])
  })
})
