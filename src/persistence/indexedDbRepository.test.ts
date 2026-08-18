import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import type { Task } from '../domain/task'
import type { DaySnapshot } from '../domain/snapshot'
import { createIndexedDbRepository } from './indexedDbRepository'
import { runRepositoryContractTests } from './repositoryContract'

// Each contract-suite call needs its own isolated database — fake-indexeddb
// keeps every opened database alive for the lifetime of this test file, so
// reusing one name across `it()`s would leak state between them exactly
// like a shared real database would. A counter-suffixed name per call keeps
// every test's database private to itself.
let dbCounter = 0

runRepositoryContractTests(() =>
  createIndexedDbRepository({
    dbName: `contract-suite-db-${dbCounter++}`,
    version: 1,
  }),
)

describe('database identity across instances', () => {
  it('reopening the database at the same name and version preserves data saved by a previous instance', async () => {
    const task: Task = {
      id: 'reopen-task',
      name: 'Survive a reopen',
      duration: 30,
      priority: 'high',
      createdAt: new Date('2026-08-17T09:00:00.000Z'),
      completedAt: null,
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
