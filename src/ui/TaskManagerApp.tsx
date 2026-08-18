import { useState } from 'react'
import { compareForSelection } from '../domain/dailyPlan'
import { useAppState } from './useAppState'
import { CreateTaskForm } from './CreateTaskForm'
import { TaskList } from './TaskList'
import { TodayTab } from './TodayTab'

const TABS = ['today', 'all', 'completed'] as const
type Tab = (typeof TABS)[number]

const TAB_LABELS: Record<Tab, string> = {
  today: 'Today',
  all: 'All',
  completed: 'Completed',
}

/**
 * The application's root content once wrapped in `AppStateProvider`: the
 * task creation form, always visible, above the three tabs the main screen
 * presents — Today, All and Completed (see specs/task-views/spec.md,
 * "Three tabs"). Today is the tab shown when the application opens.
 *
 * Only the active tab's panel is rendered. Grouping, ordering and
 * filtering are all derived here on every render rather than stored (see
 * design.md, decision 8), since the tasks and the snapshot are the only
 * persisted state.
 */
export function TaskManagerApp() {
  const state = useAppState()
  const [activeTab, setActiveTab] = useState<Tab>('today')

  if (state.status === 'loading') {
    return <p>Loading…</p>
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
      <h1>Task Manager</h1>
      <CreateTaskForm createTask={state.createTask} />

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
          <TodayTab
            tasks={state.tasks}
            snapshot={state.snapshot}
            onEdit={state.editTask}
            onDelete={state.deleteTask}
            onComplete={state.completeTask}
          />
        </section>
      )}

      {activeTab === 'all' && (
        <section aria-label="All tasks">
          <h2>All</h2>
          <TaskList
            tasks={allTasks}
            onEdit={state.editTask}
            onDelete={state.deleteTask}
            onComplete={state.completeTask}
          />
        </section>
      )}

      {activeTab === 'completed' && (
        <section aria-label="Completed tasks">
          <h2>Completed</h2>
          <TaskList
            tasks={completedTasksSorted}
            onEdit={state.editTask}
            onDelete={state.deleteTask}
            onComplete={state.completeTask}
          />
        </section>
      )}
    </main>
  )
}
