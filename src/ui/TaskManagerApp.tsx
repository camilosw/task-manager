import { useAppState } from './useAppState'
import { CreateTaskForm } from './CreateTaskForm'
import { TaskList } from './TaskList'

/**
 * The application's root content once wrapped in `AppStateProvider`.
 *
 * This is only a minimal single-list view — enough to prove creation,
 * editing, and deletion work (see tasks.md, section 8). The three-tab
 * layout (Today, All, Completed) that section 9 adds will extend this
 * rather than replace it: this component is what "All" grows into.
 */
export function TaskManagerApp() {
  const state = useAppState()

  if (state.status === 'loading') {
    return <p>Loading…</p>
  }

  const pendingTasks = state.tasks.filter((task) => task.completedAt === null)

  return (
    <main>
      <h1>Task Manager</h1>
      <CreateTaskForm createTask={state.createTask} />
      <section aria-label="All tasks">
        <h2>All</h2>
        <TaskList
          tasks={pendingTasks}
          onEdit={state.editTask}
          onDelete={state.deleteTask}
        />
      </section>
    </main>
  )
}
