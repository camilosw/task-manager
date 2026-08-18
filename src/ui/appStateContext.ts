import { createContext } from 'react'
import type { Duration } from '../domain/duration'
import type { Priority } from '../domain/priority'
import type {
  CreateTaskResult,
  EditTaskInput,
  EditTaskResult,
  Task,
} from '../domain/task'
import type { DaySnapshot } from '../domain/snapshot'

/** The fields a caller supplies to create a task through the store; `id`
 * and `createdAt` are the store's responsibility, not the caller's. */
export type CreateTaskFormInput = {
  name: string
  duration?: Duration
  priority?: Priority
}

/**
 * The application state exposed by `useAppState()` (see design.md, decision
 * 6): a single loading flag alongside the two records the repository
 * persists, plus the mutation actions once loaded. `status` is `'loading'`
 * until `repository.loadAll()` resolves, so a consumer can render a loading
 * UI rather than an empty task list that briefly flashes before data
 * arrives (see design.md, "Asynchronous storage adds a loading state").
 *
 * Every mutation goes through the matching domain function from
 * `src/domain/task.ts` — never reimplementing validation or field updates
 * inline — and persists the result via the injected repository before
 * resolving (see design.md, decision 6: "dispatch → domain function
 * computes new state → persist → re-render"). `deleteTask` has no domain
 * counterpart (section 2 defines no `deleteTask` function), so it removes
 * the task directly and prunes its id from the snapshot via `pruneTaskId`.
 */
export type AppState =
  | { status: 'loading' }
  | {
      status: 'loaded'
      tasks: Task[]
      snapshot: DaySnapshot | null
      createTask: (input: CreateTaskFormInput) => Promise<CreateTaskResult>
      editTask: (id: string, input: EditTaskInput) => Promise<EditTaskResult>
      deleteTask: (id: string) => Promise<void>
      completeTask: (id: string) => Promise<void>
    }

/**
 * The context `AppStateProvider` populates and `useAppState` reads.
 * `null` only when there is no provider above in the tree.
 */
export const AppStateContext = createContext<AppState | null>(null)
