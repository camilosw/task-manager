import { useEffect, useReducer, useRef, type ReactNode } from 'react'
import {
  completeTask as completeTaskDomain,
  createTask as createTaskDomain,
  editTask as editTaskDomain,
  type CreateTaskResult,
  type EditTaskInput,
  type EditTaskResult,
  type Task,
} from '../domain/task'
import { needsRecompute } from '../domain/dayBoundary'
import {
  admitIfUrgent,
  pruneTaskId,
  recomputeSnapshot,
  removeIfNoLongerUrgent,
  type DaySnapshot,
} from '../domain/snapshot'
import type { Repository } from '../persistence/repository'
import {
  AppStateContext,
  type AppState,
  type CreateTaskFormInput,
} from './appStateContext'

/** The data the reducer tracks: the loading flag and the two persisted
 * records, with none of the action closures — those are built fresh each
 * render in `AppStateProvider`, since they close over `repository`/`now`. */
type LoadedData = {
  status: 'loaded'
  tasks: Task[]
  snapshot: DaySnapshot | null
}
type Data = { status: 'loading' } | LoadedData

type Action = {
  type: 'set'
  tasks: Task[]
  snapshot: DaySnapshot | null
}

function reducer(_state: Data, action: Action): Data {
  return { status: 'loaded', tasks: action.tasks, snapshot: action.snapshot }
}

const defaultNow = () => new Date()

export type AppStateProviderProps = {
  /** The persistence port. Injected so tests can use the in-memory
   * repository instead of the real IndexedDB one (see design.md, decision
   * 5). */
  repository: Repository
  /** The current time, injected rather than read from the global clock, in
   * keeping with how the domain layer takes `now` as a parameter (see
   * design.md, decision 2). Defaults to the real clock. */
  now?: () => Date
  children: ReactNode
}

/**
 * Wires application state to the injected `repository` (see design.md,
 * decision 6): a single context, updated through a reducer, starting in a
 * loading state until `repository.loadAll()` resolves.
 *
 * On load, and again whenever the document returns to the foreground (see
 * "Rollover is checked on mount and on becoming visible" — design.md,
 * decision 7), the stored snapshot's date is checked against `now()` with
 * `needsRecompute`. Two situations both lead to a fresh `recomputeSnapshot`
 * call, persisted before the state settles:
 *
 * - No snapshot exists at all — a fresh install that has never computed a
 *   plan (see specs/daily-plan/spec.md, "Opening the application for the
 *   very first time").
 * - A snapshot exists but is dated earlier than `now()`'s local calendar
 *   date (see specs/daily-plan/spec.md, "The plan is recomputed when the
 *   day changes").
 *
 * An equal (or later — see `needsRecompute`) stored date leaves the
 * snapshot untouched, so the frozen plan is never replaced merely because
 * the application re-checked (see specs/daily-plan/spec.md, "The plan does
 * not change while the app stays in the foreground").
 */
export function AppStateProvider({
  repository,
  now = defaultNow,
  children,
}: AppStateProviderProps) {
  const [data, dispatch] = useReducer(reducer, { status: 'loading' } as Data)

  // Tracks the latest `data` for the visibilitychange handler below, whose
  // effect only re-runs when `repository`/`now` change — not on every state
  // update — so a plain closure over `data` would go stale.
  const dataRef = useRef(data)
  useEffect(() => {
    dataRef.current = data
  }, [data])

  useEffect(() => {
    let cancelled = false

    async function recomputeAndSet(tasks: Task[]) {
      const snapshot = recomputeSnapshot(tasks, now())
      await repository.saveSnapshot(snapshot)
      if (cancelled) return
      dispatch({ type: 'set', tasks, snapshot })
    }

    async function load() {
      const loaded = await repository.loadAll()
      if (cancelled) return

      const shouldRecompute =
        loaded.snapshot === null || needsRecompute(loaded.snapshot.date, now())

      if (shouldRecompute) {
        await recomputeAndSet(loaded.tasks)
      } else {
        dispatch({
          type: 'set',
          tasks: loaded.tasks,
          snapshot: loaded.snapshot,
        })
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [repository, now])

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') return

      const current = dataRef.current
      if (current.status !== 'loaded' || current.snapshot === null) return
      if (!needsRecompute(current.snapshot.date, now())) return

      void (async () => {
        const snapshot = recomputeSnapshot(current.tasks, now())
        await repository.saveSnapshot(snapshot)
        dispatch({ type: 'set', tasks: current.tasks, snapshot })
      })()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [repository, now])

  async function createTask(
    input: CreateTaskFormInput,
  ): Promise<CreateTaskResult> {
    if (data.status !== 'loaded') {
      throw new Error('createTask called before state finished loading')
    }
    const loaded = data

    const result = createTaskDomain(
      {
        id: crypto.randomUUID(),
        name: input.name,
        duration: input.duration,
        priority: input.priority,
      },
      now(),
    )
    if (!result.ok) {
      return result
    }

    const nextTasks = [...loaded.tasks, result.task]
    const nextSnapshot = loaded.snapshot
      ? admitIfUrgent(loaded.snapshot, result.task)
      : loaded.snapshot

    dispatch({ type: 'set', tasks: nextTasks, snapshot: nextSnapshot })
    await repository.saveTasks(nextTasks)
    if (nextSnapshot !== null && nextSnapshot !== loaded.snapshot) {
      await repository.saveSnapshot(nextSnapshot)
    }

    return result
  }

  async function editTask(
    id: string,
    input: EditTaskInput,
  ): Promise<EditTaskResult> {
    if (data.status !== 'loaded') {
      throw new Error('editTask called before state finished loading')
    }
    const loaded = data

    const existing = loaded.tasks.find((task) => task.id === id)
    if (!existing) {
      throw new Error(`editTask: no task with id ${id}`)
    }

    const result = editTaskDomain(existing, input)
    if (!result.ok) {
      return result
    }

    const nextTasks = loaded.tasks.map((task) =>
      task.id === id ? result.task : task,
    )
    let nextSnapshot = loaded.snapshot
    if (nextSnapshot) {
      nextSnapshot = admitIfUrgent(nextSnapshot, result.task)
      nextSnapshot = removeIfNoLongerUrgent(nextSnapshot, result.task)
    }

    dispatch({ type: 'set', tasks: nextTasks, snapshot: nextSnapshot })
    await repository.saveTasks(nextTasks)
    if (nextSnapshot !== null && nextSnapshot !== loaded.snapshot) {
      await repository.saveSnapshot(nextSnapshot)
    }

    return result
  }

  async function deleteTask(id: string): Promise<void> {
    if (data.status !== 'loaded') {
      throw new Error('deleteTask called before state finished loading')
    }
    const loaded = data

    const nextTasks = loaded.tasks.filter((task) => task.id !== id)
    const nextSnapshot = loaded.snapshot
      ? pruneTaskId(loaded.snapshot, id)
      : loaded.snapshot

    dispatch({ type: 'set', tasks: nextTasks, snapshot: nextSnapshot })
    await repository.saveTasks(nextTasks)
    if (nextSnapshot !== null) {
      await repository.saveSnapshot(nextSnapshot)
    }
  }

  async function completeTask(id: string): Promise<void> {
    if (data.status !== 'loaded') {
      throw new Error('completeTask called before state finished loading')
    }
    const loaded = data

    const existing = loaded.tasks.find((task) => task.id === id)
    if (!existing) {
      throw new Error(`completeTask: no task with id ${id}`)
    }

    const completed = completeTaskDomain(existing, now())
    const nextTasks = loaded.tasks.map((task) =>
      task.id === id ? completed : task,
    )

    // Completion never changes snapshot membership (see design.md, "The
    // non-urgent selection is frozen for the day") — a completed task keeps
    // its place in the plan, struck through, until the next recomputation —
    // so only the tasks record is persisted here.
    dispatch({ type: 'set', tasks: nextTasks, snapshot: loaded.snapshot })
    await repository.saveTasks(nextTasks)
  }

  async function recalculateToday(): Promise<void> {
    if (data.status !== 'loaded') {
      throw new Error('recalculateToday called before state finished loading')
    }
    const loaded = data

    const snapshot = recomputeSnapshot(loaded.tasks, now())
    dispatch({ type: 'set', tasks: loaded.tasks, snapshot })
    await repository.saveSnapshot(snapshot)
  }

  const value: AppState =
    data.status === 'loading'
      ? data
      : {
          status: 'loaded',
          tasks: data.tasks,
          snapshot: data.snapshot,
          createTask,
          editTask,
          deleteTask,
          completeTask,
          recalculateToday,
        }

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  )
}
