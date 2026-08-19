import { useState } from 'react'
import { compareForSelection } from '../domain/dailyPlan'
import type { CreateTaskResult } from '../domain/task'
import { useAppState } from './useAppState'
import type { AppState, CreateTaskFormInput } from './appStateContext'
import { CreateTaskSheet } from './CreateTaskSheet'
import { TaskList } from './TaskList'
import { TodayTab } from './TodayTab'
import { ThemeToggle } from './ThemeToggle'
import { useActionFeedback } from './useActionFeedback'

const TABS = ['today', 'all', 'completed'] as const
type Tab = (typeof TABS)[number]

const TAB_LABELS: Record<Tab, string> = {
  today: 'Today',
  all: 'All',
  completed: 'Completed',
}

/** Narrows `AppState` to its loaded variant. Needed because TypeScript does
 * not carry a `state.status === 'loading'` early return's narrowing into a
 * nested function's body — only into code that runs inline in the same
 * scope — so each action wrapper below calls this first (mirrors the same
 * guard `AppStateProvider`'s own action functions use internally). */
function assertLoaded(
  state: AppState,
): asserts state is Extract<AppState, { status: 'loaded' }> {
  if (state.status !== 'loaded') {
    throw new Error('action invoked before state finished loading')
  }
}

/**
 * The application's root content once wrapped in `AppStateProvider`: the
 * persistent add-task control (`CreateTaskSheet`), above the three tabs the
 * main screen presents — Today, All and Completed (see
 * specs/task-views/spec.md, "Three tabs"). Today is the tab shown when the
 * application opens. The control is rendered once, outside the
 * tab-conditional sections below, so it is identical on every tab and
 * opening it never changes which tab is in view (see
 * specs/task-management/spec.md, "Task creation is opened on demand from a
 * persistent control").
 *
 * Only the active tab's panel is rendered. Grouping, ordering and
 * filtering are all derived here on every render rather than stored (see
 * design.md, decision 8), since the tasks and the snapshot are the only
 * persisted state.
 */
export function TaskManagerApp() {
  const state = useAppState()
  const [activeTab, setActiveTab] = useState<Tab>('today')
  const feedback = useActionFeedback()

  if (state.status === 'loading') {
    return <p>Loading…</p>
  }

  // Feedback is wired at this call site, not inside `AppStateProvider` (see
  // design.md, decision 7): each wrapper below calls the store's action and
  // then, once it has actually taken effect, shows the matching confirmation
  // (specs/action-feedback/spec.md, "A confirmation follows every completed
  // action"). `createTask` is the only one of the four whose underlying
  // action can be rejected by validation, which is why it alone inspects
  // `result.ok` before calling `feedback.show` - a rejected creation must
  // produce no confirmation (see "A rejected action produces no
  // confirmation"); its own validation message is already handled inside
  // `TaskForm`.
  async function handleCreateTask(
    input: CreateTaskFormInput,
  ): Promise<CreateTaskResult> {
    assertLoaded(state)
    const result = await state.createTask(input)
    if (result.ok) {
      feedback.show('Task added')
    }
    return result
  }

  async function handleComplete(id: string): Promise<void> {
    assertLoaded(state)
    await state.completeTask(id)
    feedback.show('Task completed')
  }

  async function handleDelete(id: string): Promise<void> {
    assertLoaded(state)
    await state.deleteTask(id)
    feedback.show('Task deleted')
  }

  async function handleRecalculateToday(): Promise<void> {
    assertLoaded(state)
    await state.recalculateToday()
    feedback.show('Today recalculated')
  }

  const pendingTasks = state.tasks.filter((task) => task.completedAt === null)
  const completedTasks = state.tasks.filter((task) => task.completedAt !== null)

  // The All tab lists every pending task ordered by priority then age (see
  // specs/task-views/spec.md, "The All tab orders by priority then age").
  // `compareForSelection` is exactly that ordering, with no dependency on
  // today's snapshot, so it is reused directly rather than reimplemented.
  const allTasks = [...pendingTasks].sort(compareForSelection)

  // The Completed tab lists every completed task, most recently completed
  // first (see specs/task-views/spec.md, "The Completed tab lists every
  // completed task").
  const completedTasksSorted = [...completedTasks].sort((a, b) => {
    const aCompletedAt = a.completedAt as Date
    const bCompletedAt = b.completedAt as Date
    return bCompletedAt.getTime() - aCompletedAt.getTime()
  })

  return (
    <main>
      <header>
        <h1>Task Manager</h1>
        <ThemeToggle />
      </header>

      {/* Always mounted, empty until `feedback.show` puts text in it (see
          design.md, decision 7). A live region inserted into the DOM at the
          same moment as its text is announced unreliably by screen readers;
          one that is already present and whose text merely changes is
          announced dependably, which is the entire reason this exists ahead
          of any action rather than being rendered conditionally. */}
      <p role="status" aria-live="polite">
        {feedback.message}
      </p>

      <CreateTaskSheet createTask={handleCreateTask} />

      <nav aria-label="Task views">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            aria-pressed={activeTab === tab}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </nav>

      {activeTab === 'today' && (
        <section aria-label="Today">
          <h2>Today</h2>
          <button type="button" onClick={() => handleRecalculateToday()}>
            Recalculate today
          </button>
          <TodayTab
            tasks={state.tasks}
            snapshot={state.snapshot}
            onEdit={state.editTask}
            onDelete={handleDelete}
            onComplete={handleComplete}
          />
        </section>
      )}

      {activeTab === 'all' && (
        <section aria-label="All tasks">
          <h2>All</h2>
          <TaskList
            tasks={allTasks}
            onEdit={state.editTask}
            onDelete={handleDelete}
            onComplete={handleComplete}
          />
        </section>
      )}

      {activeTab === 'completed' && (
        <section aria-label="Completed tasks">
          <h2>Completed</h2>
          <TaskList
            tasks={completedTasksSorted}
            onEdit={state.editTask}
            onDelete={handleDelete}
            onComplete={handleComplete}
          />
        </section>
      )}
    </main>
  )
}
