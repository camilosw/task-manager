import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import type { Task } from '../domain/task'
import type { DaySnapshot } from '../domain/snapshot'
import { compareForSelection } from '../domain/dailyPlan'
import { DB_VERSION, createIndexedDbRepository } from './indexedDbRepository'
import { runRepositoryContractTests } from './repositoryContract'

// The pre-upgrade (version 1) object store names and snapshot key, mirrored
// here rather than imported: version 1 never had `place` on `Task`, so
// seeding it has to bypass the `Repository` port entirely and talk to a raw
// IndexedDB database, the way a real user's version-1 data looks before
// this change ships.
const LEGACY_TASKS_STORE = 'tasks'
const LEGACY_SNAPSHOT_STORE = 'snapshot'
const LEGACY_SNAPSHOT_KEY = 'current'

// Version 1 predates `place` (added in version 2) and also predates
// `recurrence`/`lastCompletedOn` (added in version 3, tasks.md section 7),
// so a legacy fixture omits all three.
type LegacyTask = Omit<Task, 'place' | 'recurrence' | 'lastCompletedOn'>

/**
 * Opens `dbName` at version 1 — the schema that predates `place` — and
 * writes `tasks` and, if given, `snapshot` directly into it. Simulates
 * exactly what a device holds before it is ever opened by version-2 code,
 * so the version-2 `onupgradeneeded` handler has real pre-upgrade data to
 * migrate when the repository under test next opens the same database name
 * at `DB_VERSION`.
 */
function seedLegacyDatabase(
  dbName: string,
  tasks: LegacyTask[],
  snapshot: DaySnapshot | null = null,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1)

    request.onupgradeneeded = () => {
      const db = request.result
      db.createObjectStore(LEGACY_TASKS_STORE, { keyPath: 'id' })
      db.createObjectStore(LEGACY_SNAPSHOT_STORE)
    }

    request.onsuccess = () => {
      const db = request.result
      const transaction = db.transaction(
        [LEGACY_TASKS_STORE, LEGACY_SNAPSHOT_STORE],
        'readwrite',
      )
      const tasksStore = transaction.objectStore(LEGACY_TASKS_STORE)
      for (const task of tasks) {
        tasksStore.put(task)
      }
      if (snapshot !== null) {
        transaction
          .objectStore(LEGACY_SNAPSHOT_STORE)
          .put(snapshot, LEGACY_SNAPSHOT_KEY)
      }

      transaction.oncomplete = () => {
        db.close()
        resolve()
      }
      transaction.onerror = () => reject(transaction.error)
    }

    request.onerror = () => reject(request.error)
  })
}

function getById(tasks: Task[], id: string): Task {
  const task = tasks.find((candidate) => candidate.id === id)
  if (task === undefined) {
    throw new Error(`Expected a task with id "${id}"`)
  }
  return task
}

// Each contract-suite call needs its own isolated database — fake-indexeddb
// keeps every opened database alive for the lifetime of this test file, so
// reusing one name across `it()`s would leak state between them exactly
// like a shared real database would. A counter-suffixed name per call keeps
// every test's database private to itself.
let dbCounter = 0

runRepositoryContractTests(() =>
  createIndexedDbRepository({
    dbName: `contract-suite-db-${dbCounter++}`,
    version: DB_VERSION,
  }),
)

describe('database identity across instances', () => {
  it('reopening the database at the same name and version preserves data saved by a previous instance', async () => {
    const task: Task = {
      id: 'reopen-task',
      name: 'Survive a reopen',
      duration: 30,
      priority: 'high',
      recurrence: null,
      createdAt: new Date('2026-08-17T09:00:00.000Z'),
      place: 0,
      completedAt: null,
      lastCompletedOn: null,
    }
    const snapshot: DaySnapshot = {
      date: '2026-08-17',
      plannedIds: ['reopen-task'],
      admittedIds: [],
    }

    const firstInstance = createIndexedDbRepository()
    await firstInstance.saveTasks([task])
    await firstInstance.saveSnapshot(snapshot)

    // A fresh instance created with no arguments — as the application does
    // on every launch — sharing no in-process state with `firstInstance`.
    // The only thing that can make its data visible is the database name
    // and version being pinned rather than accidentally varying.
    const secondInstance = createIndexedDbRepository()
    const data = await secondInstance.loadAll()

    expect(data.tasks).toEqual([task])
    expect(data.snapshot).toEqual(snapshot)
  })
})

describe('version-2 upgrade (5.2-5.5)', () => {
  it('assigns places in creation order to tasks stored without one, so the All tab shows the same order it showed before (5.2)', async () => {
    const dbName = `upgrade-db-${dbCounter++}`
    // The "B, E, C, A, D" fixture from specs/offline-storage/spec.md,
    // "Upgrading preserves the order the user last saw".
    await seedLegacyDatabase(dbName, [
      {
        id: 'a',
        name: 'A',
        duration: 30,
        priority: 'medium',
        createdAt: new Date('2026-08-17T09:00:00.000Z'),
        completedAt: null,
      },
      {
        id: 'b',
        name: 'B',
        duration: 30,
        priority: 'urgent',
        createdAt: new Date('2026-08-17T11:00:00.000Z'),
        completedAt: null,
      },
      {
        id: 'c',
        name: 'C',
        duration: 30,
        priority: 'medium',
        createdAt: new Date('2026-08-17T08:00:00.000Z'),
        completedAt: null,
      },
      {
        id: 'd',
        name: 'D',
        duration: 30,
        priority: 'very-low',
        createdAt: new Date('2026-08-17T07:00:00.000Z'),
        completedAt: null,
      },
      {
        id: 'e',
        name: 'E',
        duration: 30,
        priority: 'high',
        createdAt: new Date('2026-08-17T12:00:00.000Z'),
        completedAt: null,
      },
    ])

    const repository = createIndexedDbRepository({
      dbName,
      version: DB_VERSION,
    })
    const data = await repository.loadAll()

    expect(new Set(data.tasks.map((task) => task.place)).size).toBe(
      data.tasks.length,
    )

    const displayOrder = [...data.tasks].sort(compareForSelection)
    expect(displayOrder.map((task) => task.id)).toEqual([
      'b',
      'e',
      'c',
      'a',
      'd',
    ])
  })

  it('sorts by createdAt alone rather than by priority then age, so a task promoted after the upgrade lands first among its new peers (5.3)', async () => {
    const dbName = `upgrade-db-${dbCounter++}`
    // Y is newer but already high priority; X is older but starts at the
    // lowest priority. Sorting by `(priority, createdAt)` would walk Y
    // before X and give X a later place; sorting by `createdAt` alone gives
    // X the earlier place, because X really is the older task.
    await seedLegacyDatabase(dbName, [
      {
        id: 'y',
        name: 'Y',
        duration: 30,
        priority: 'high',
        createdAt: new Date('2026-08-17T08:00:00.000Z'),
        completedAt: null,
      },
      {
        id: 'x',
        name: 'X',
        duration: 30,
        priority: 'very-low',
        createdAt: new Date('2026-08-17T07:00:00.000Z'),
        completedAt: null,
      },
    ])

    const repository = createIndexedDbRepository({
      dbName,
      version: DB_VERSION,
    })
    const afterUpgrade = await repository.loadAll()
    const x = getById(afterUpgrade.tasks, 'x')
    const y = getById(afterUpgrade.tasks, 'y')

    expect(x.place).toBeLessThan(y.place)

    // Promote X to high priority, preserving its place — exactly what
    // `editTask` does (see specs/task-management/spec.md, "A task keeps its
    // place when its priority changes").
    const promotedX: Task = { ...x, priority: 'high' }
    await repository.saveTasks([promotedX, y])

    const afterPromotion = await repository.loadAll()
    const highGroup = afterPromotion.tasks
      .filter((task) => task.priority === 'high')
      .sort((a, b) => a.place - b.place)

    expect(highGroup.map((task) => task.id)).toEqual(['x', 'y'])
  })

  it('leaves places untouched on reopening: the upgrade runs once, and later reads never recompute from createdAt again (5.4)', async () => {
    const dbName = `upgrade-db-${dbCounter++}`
    await seedLegacyDatabase(dbName, [
      {
        id: 'first',
        name: 'First',
        duration: 30,
        priority: 'medium',
        createdAt: new Date('2026-08-17T08:00:00.000Z'),
        completedAt: null,
      },
      {
        id: 'second',
        name: 'Second',
        duration: 30,
        priority: 'medium',
        createdAt: new Date('2026-08-17T09:00:00.000Z'),
        completedAt: null,
      },
    ])

    const upgraded = createIndexedDbRepository({ dbName, version: DB_VERSION })
    const afterUpgrade = await upgraded.loadAll()
    const firstPlace = getById(afterUpgrade.tasks, 'first').place
    const secondPlace = getById(afterUpgrade.tasks, 'second').place
    expect(firstPlace).toBeLessThan(secondPlace)

    // The user reorders, swapping the two places — the same permutation
    // `reorderWithinPriority` would produce.
    const reordered = afterUpgrade.tasks.map((task) => {
      if (task.id === 'first') return { ...task, place: secondPlace }
      if (task.id === 'second') return { ...task, place: firstPlace }
      return task
    })
    await upgraded.saveTasks(reordered)

    // A fresh instance, as the application creates on every launch, opening
    // the same database again — `onupgradeneeded` does not fire a second
    // time at the same version, so this must show the reordered places, not
    // places recomputed from `createdAt`.
    const reopened = createIndexedDbRepository({ dbName, version: DB_VERSION })
    const data = await reopened.loadAll()

    expect(getById(data.tasks, 'first').place).toBe(secondPlace)
    expect(getById(data.tasks, 'second').place).toBe(firstPlace)
  })

  it('never reassigns places for data that already carries them, on a fresh install opened straight at version 2 (5.4)', async () => {
    const dbName = `fresh-install-db-${dbCounter++}`
    const repository = createIndexedDbRepository({
      dbName,
      version: DB_VERSION,
    })
    await repository.saveTasks([
      {
        id: 'one',
        name: 'One',
        duration: 15,
        priority: 'medium',
        recurrence: null,
        createdAt: new Date('2026-08-17T09:00:00.000Z'),
        place: 7,
        completedAt: null,
        lastCompletedOn: null,
      },
      {
        id: 'two',
        name: 'Two',
        duration: 15,
        priority: 'medium',
        recurrence: null,
        createdAt: new Date('2026-08-17T08:00:00.000Z'),
        place: 2,
        completedAt: null,
        lastCompletedOn: null,
      },
    ])

    const reopened = createIndexedDbRepository({ dbName, version: DB_VERSION })
    const data = await reopened.loadAll()

    expect(getById(data.tasks, 'one').place).toBe(7)
    expect(getById(data.tasks, 'two').place).toBe(2)
  })

  it('does not read or write the snapshot store (5.5)', async () => {
    const dbName = `upgrade-db-${dbCounter++}`
    const snapshot: DaySnapshot = {
      date: '2026-08-17',
      plannedIds: ['a'],
      admittedIds: [],
    }
    await seedLegacyDatabase(
      dbName,
      [
        {
          id: 'a',
          name: 'A',
          duration: 30,
          priority: 'medium',
          createdAt: new Date('2026-08-17T09:00:00.000Z'),
          completedAt: null,
        },
      ],
      snapshot,
    )

    const repository = createIndexedDbRepository({
      dbName,
      version: DB_VERSION,
    })
    const data = await repository.loadAll()

    expect(data.snapshot).toEqual(snapshot)
    expect(data.snapshot?.date).toBe('2026-08-17')
    expect(data.snapshot?.plannedIds).toEqual(['a'])
  })

  it('opening at version 2 with empty stores — a first launch with no stored data — is a no-op (5.5)', async () => {
    const dbName = `fresh-empty-db-${dbCounter++}`
    const repository = createIndexedDbRepository({
      dbName,
      version: DB_VERSION,
    })

    const data = await repository.loadAll()

    expect(data.tasks).toEqual([])
    expect(data.snapshot).toBeNull()
  })
})
