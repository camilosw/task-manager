import type { Task } from '../domain/task'
import type { DaySnapshot } from '../domain/snapshot'

/**
 * Everything the application persists (see design.md, decision 8): every
 * task, and the current day's snapshot if one has ever been computed.
 * `snapshot` is `null` on a fresh install, before any plan has been
 * computed and saved.
 */
export type RepositoryData = {
  tasks: Task[]
  snapshot: DaySnapshot | null
}

/**
 * The persistence port (see design.md, decision 5): a small interface that
 * keeps the storage choice out of the domain and the UI, so every other
 * layer can be tested against an in-memory double with no fake browser
 * database involved.
 *
 * `saveTasks` and `saveSnapshot` each replace their record wholesale — the
 * caller always passes the complete set to persist, not a delta — mirroring
 * how the domain layer replaces snapshot membership wholesale on
 * recomputation rather than extending it (see `recomputeSnapshot` in
 * `src/domain/snapshot.ts`).
 */
export interface Repository {
  /** Loads every task and the current snapshot in one call. */
  loadAll(): Promise<RepositoryData>
  /** Replaces the persisted task list wholesale with `tasks`. */
  saveTasks(tasks: Task[]): Promise<void>
  /** Replaces the persisted snapshot wholesale with `snapshot`. */
  saveSnapshot(snapshot: DaySnapshot): Promise<void>
}
