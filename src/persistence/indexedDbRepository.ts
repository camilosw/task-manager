import type { Task } from '../domain/task'
import type { DaySnapshot } from '../domain/snapshot'
import type { Repository, RepositoryData } from './repository'

/**
 * The database name and version the application's IndexedDB store opens
 * (see tasks.md, 6.4). Both are pinned as constants — the application
 * always calls `createIndexedDbRepository()` with no arguments, which
 * resolves to these — because a name or version that drifted between
 * launches would silently point at a different, empty database and the
 * user's data would appear to have vanished.
 */
export const DB_NAME = 'task-manager'
export const DB_VERSION = 2

const TASKS_STORE = 'tasks'
const SNAPSHOT_STORE = 'snapshot'
const SNAPSHOT_KEY = 'current'

export type IndexedDbRepositoryOptions = {
  dbName?: string
  version?: number
}

/**
 * The version-2 upgrade (see design.md, decision 9, and
 * specs/offline-storage/spec.md, "Data stored before manual ordering keeps
 * the order it already showed"): every task stored by version 1, which
 * carries no `place`, is given one by sorting on `createdAt` ascending and
 * writing back `place = 0, 1, 2, …` in that order. Sorting on `createdAt`
 * alone — not on `(priority, createdAt)` — is deliberate: it reproduces the
 * order every list already displayed, and it is the assignment that later
 * lets a task promoted to a new priority level land among its new peers by
 * age, exactly as if it had never been touched by the upgrade.
 *
 * Runs inside the versionchange transaction `onupgradeneeded` already holds
 * open, so it commits atomically with the object-store creation above it.
 * The snapshot store is never touched here — the upgrade only reads and
 * writes `TASKS_STORE`.
 */
function assignPlacesByCreationOrder(transaction: IDBTransaction): void {
  const store = transaction.objectStore(TASKS_STORE)
  const getAllRequest = store.getAll() as IDBRequest<Task[]>

  getAllRequest.onsuccess = () => {
    const tasks = [...getAllRequest.result].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
    tasks.forEach((task, index) => {
      store.put({ ...task, place: index })
    })
  }
}

function openDatabase(dbName: string, version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, version)

    request.onupgradeneeded = (event) => {
      const db = request.result
      if (!db.objectStoreNames.contains(TASKS_STORE)) {
        db.createObjectStore(TASKS_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
        db.createObjectStore(SNAPSHOT_STORE)
      }

      // Only a database that already existed at version 1 can hold tasks
      // written before `place` existed. A brand-new database — `oldVersion`
      // 0 — has just had its stores created above and is empty, so the
      // migration would be a no-op anyway; skipping it for that case keeps
      // a fresh install from ever being said to have run an upgrade at all
      // (see specs/offline-storage/spec.md, "First launch with no stored
      // data needs no upgrade").
      if (event.oldVersion === 1) {
        assignPlacesByCreationOrder(request.transaction as IDBTransaction)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

/**
 * The IndexedDB-backed implementation of the repository port (see
 * design.md, decision 5). A fresh connection is opened and closed on every
 * call rather than held open, which keeps this simple correct for a
 * single-instance PWA with no cross-tab coordination (see design.md,
 * Non-Goals).
 *
 * `options` lets tests point at an isolated database; the application
 * itself always calls this with no arguments, which uses the pinned
 * `DB_NAME` and `DB_VERSION` above.
 */
export function createIndexedDbRepository(
  options: IndexedDbRepositoryOptions = {},
): Repository {
  const dbName = options.dbName ?? DB_NAME
  const version = options.version ?? DB_VERSION

  async function withDb<T>(fn: (db: IDBDatabase) => Promise<T>): Promise<T> {
    const db = await openDatabase(dbName, version)
    try {
      return await fn(db)
    } finally {
      db.close()
    }
  }

  return {
    async loadAll(): Promise<RepositoryData> {
      return withDb(async (db) => {
        const transaction = db.transaction(
          [TASKS_STORE, SNAPSHOT_STORE],
          'readonly',
        )
        const tasksRequest = transaction
          .objectStore(TASKS_STORE)
          .getAll() as IDBRequest<Task[]>
        const snapshotRequest = transaction
          .objectStore(SNAPSHOT_STORE)
          .get(SNAPSHOT_KEY) as IDBRequest<DaySnapshot | undefined>

        const [tasks, snapshot] = await Promise.all([
          requestToPromise(tasksRequest),
          requestToPromise(snapshotRequest),
        ])

        return { tasks, snapshot: snapshot ?? null }
      })
    },

    async saveTasks(tasks: Task[]): Promise<void> {
      return withDb(async (db) => {
        const transaction = db.transaction(TASKS_STORE, 'readwrite')
        const store = transaction.objectStore(TASKS_STORE)
        store.clear()
        for (const task of tasks) {
          store.put(task)
        }
        await transactionDone(transaction)
      })
    },

    async saveSnapshot(snapshot: DaySnapshot): Promise<void> {
      return withDb(async (db) => {
        const transaction = db.transaction(SNAPSHOT_STORE, 'readwrite')
        transaction.objectStore(SNAPSHOT_STORE).put(snapshot, SNAPSHOT_KEY)
        await transactionDone(transaction)
      })
    },
  }
}
