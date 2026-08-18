import type { Task } from '../domain/task'
import type { DaySnapshot } from '../domain/snapshot'
import type { Repository, RepositoryData } from './repository'

/**
 * An in-memory implementation of the repository port, holding no state
 * beyond the current process (see design.md, decision 5). Used throughout
 * the rest of the test suite in place of the IndexedDB adapter, and proven
 * against the same contract suite that adapter runs so it cannot silently
 * drift from what actually ships.
 */
export function createInMemoryRepository(): Repository {
  let tasks: Task[] = []
  let snapshot: DaySnapshot | null = null

  return {
    async loadAll(): Promise<RepositoryData> {
      return { tasks, snapshot }
    },

    async saveTasks(next: Task[]): Promise<void> {
      tasks = [...next]
    },

    async saveSnapshot(next: DaySnapshot): Promise<void> {
      snapshot = next
    },
  }
}
