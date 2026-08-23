import { describe, expect, it } from 'vitest'
import type { Task } from '../domain/task'
import type { DaySnapshot } from '../domain/snapshot'
import type { Repository } from './repository'

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

// The port makes no ordering promise on `loadAll`'s tasks — ordering for
// display is always derived, never persisted (see design.md, decision 8) —
// so comparisons of more than one task sort by id first. An IndexedDB
// object store legitimately returns records in key order rather than
// insertion order, and the contract must not assume otherwise.
function sortedById(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * The repository contract (see design.md, "One contract suite, two
 * implementations"): written once against the `Repository` port and run
 * unchanged against every implementation, so the in-memory double used
 * throughout the rest of the test suite cannot silently drift from the
 * adapter that actually ships.
 *
 * `createRepository` must return a fresh repository each time it is
 * called, as if the application had just started with whatever that
 * implementation persists between calls (nothing, for the in-memory
 * double). Implementations backed by real storage are responsible for
 * their own isolation between calls — e.g. a distinct database per call —
 * so this suite can run the same `it()`s against both without changes.
 */
export function runRepositoryContractTests(
  createRepository: () => Repository | Promise<Repository>,
): void {
  describe('repository contract', () => {
    it('loading before anything has been saved yields empty state', async () => {
      const repository = await createRepository()

      const data = await repository.loadAll()

      expect(data.tasks).toEqual([])
      expect(data.snapshot).toBeNull()
    })

    it('round-trips saved tasks', async () => {
      const repository = await createRepository()
      const urgent = makeTask({ id: 'urgent-task', priority: 'urgent' })
      const completed = makeTask({
        id: 'completed-task',
        priority: 'low',
        completedAt: new Date('2026-08-17T12:00:00.000Z'),
      })

      await repository.saveTasks([urgent, completed])
      const data = await repository.loadAll()

      expect(sortedById(data.tasks)).toEqual(sortedById([urgent, completed]))
    })

    it("round-trips a task's place", async () => {
      const repository = await createRepository()
      const first = makeTask({ id: 'first-place', place: 3 })
      const second = makeTask({ id: 'second-place', place: 0 })

      await repository.saveTasks([first, second])
      const data = await repository.loadAll()

      const placeById = new Map(data.tasks.map((task) => [task.id, task.place]))
      expect(placeById.get('first-place')).toBe(3)
      expect(placeById.get('second-place')).toBe(0)
    })

    it('round-trips the saved snapshot', async () => {
      const repository = await createRepository()
      const snapshot: DaySnapshot = {
        date: '2026-08-17',
        plannedIds: ['a', 'b'],
        admittedIds: ['c'],
      }

      await repository.saveSnapshot(snapshot)
      const data = await repository.loadAll()

      expect(data.snapshot).toEqual(snapshot)
    })

    it('preserves Date fields exactly across a save/load round trip', async () => {
      const repository = await createRepository()
      const createdAt = new Date('2026-08-17T09:15:30.123Z')
      const completedAt = new Date('2026-08-17T13:45:00.456Z')
      const task = makeTask({ id: 'timestamped', createdAt, completedAt })

      await repository.saveTasks([task])
      const data = await repository.loadAll()

      const [loaded] = data.tasks
      expect(loaded.createdAt).toBeInstanceOf(Date)
      expect(loaded.createdAt.getTime()).toBe(createdAt.getTime())
      expect(loaded.completedAt).toBeInstanceOf(Date)
      expect(loaded.completedAt?.getTime()).toBe(completedAt.getTime())
    })

    it('a pending task round-trips with a null completedAt, not a missing or stringified one', async () => {
      const repository = await createRepository()
      const pending = makeTask({ id: 'pending-task' })

      await repository.saveTasks([pending])
      const data = await repository.loadAll()

      expect(data.tasks[0].completedAt).toBeNull()
    })

    it('saving tasks again replaces the previous set wholesale, not appends to it', async () => {
      const repository = await createRepository()
      await repository.saveTasks([makeTask({ id: 'first' })])

      await repository.saveTasks([makeTask({ id: 'second' })])
      const data = await repository.loadAll()

      expect(data.tasks.map((task) => task.id)).toEqual(['second'])
    })

    it('saving the snapshot again replaces the previous one', async () => {
      const repository = await createRepository()
      await repository.saveSnapshot({
        date: '2026-08-17',
        plannedIds: ['a'],
        admittedIds: [],
      })

      const replacement: DaySnapshot = {
        date: '2026-08-18',
        plannedIds: ['b'],
        admittedIds: ['c'],
      }
      await repository.saveSnapshot(replacement)
      const data = await repository.loadAll()

      expect(data.snapshot).toEqual(replacement)
    })
  })
}
