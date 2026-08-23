import { useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { compareForSelection } from '../domain/dailyPlan'
import type { CreateTaskResult } from '../domain/task'
import { handleTaskDragEnd } from './dragReorder'
import { reorderAnnouncements } from './reorderAnnouncements'
import { useAppState } from './useAppState'
import type { AppState, CreateTaskFormInput } from './appStateContext'
import { CreateTaskSheet } from './CreateTaskSheet'
import { PriorityGroups } from './PriorityGroups'
import { TaskList } from './TaskList'
import { TodayTab } from './TodayTab'
import { ThemeToggle } from './ThemeToggle'
import { useActionFeedback } from './useActionFeedback'
import { RefreshIcon } from './icons'
import './TaskManagerApp.css'

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

  // The All tab's drag sensors (see specs/task-views/spec.md, "Tasks are
  // reordered in the All tab only", and design.md, decision 6): `distance:
  // 8` lets a mouse click still read as a click rather than always starting
  // a drag, and `delay: 250, tolerance: 5` lets a short press-and-scroll on
  // a touch screen still scroll the page. `KeyboardSensor` with
  // `sortableKeyboardCoordinates` is what makes reordering operable without
  // a pointer or touch gesture at all (specs/task-views/spec.md,
  // "Reordering is operable without a drag gesture"). Declared
  // unconditionally, above the loading early-return below, because hooks
  // cannot be called conditionally — it costs nothing while the Today or
  // Completed tab is in view, since `DndContext` is only mounted around the
  // All tab's panel further down.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

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

  // `handleTaskDragEnd` is the thin translation from `{active, over}` to a
  // `reorderTasks` call (see dragReorder.ts and design.md, decision 7); it
  // produces no confirmation of its own, deliberately - see
  // specs/action-feedback/spec.md, "The list of actions that show a
  // confirmation is closed", which reordering is not on.
  function handleDragEnd(event: DragEndEvent): void {
    assertLoaded(state)
    handleTaskDragEnd(
      {
        active: { id: String(event.active.id) },
        over: event.over ? { id: String(event.over.id) } : null,
      },
      state.tasks,
      (activeId, overId) => {
        void state.reorderTasks(activeId, overId)
      },
    )
  }

  const pendingTasks = state.tasks.filter((task) => task.completedAt === null)
  const completedTasks = state.tasks.filter((task) => task.completedAt !== null)

  // The All tab groups every pending task under priority headings (see
  // specs/task-views/spec.md, "The All tab groups tasks by priority"),
  // ordered within each group by priority then place (see "The All tab
  // orders by priority then age"). `compareForSelection` is exactly that
  // ordering, with no dependency on today's snapshot, so it is reused
  // directly rather than reimplemented — sorting the flat list before
  // handing it to `PriorityGroups` produces the same per-group order as
  // sorting each group independently would (see TodayTab.tsx).
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
    <main className="app">
      <header className="app__header">
        <h1 className="app__title">Task Manager</h1>
        <ThemeToggle />
      </header>

      {/* Always mounted, empty until `feedback.show` puts text in it (see
          design.md, decision 7). A live region inserted into the DOM at the
          same moment as its text is announced unreliably by screen readers;
          one that is already present and whose text merely changes is
          announced dependably, which is the entire reason this exists ahead
          of any action rather than being rendered conditionally. */}
      <p role="status" aria-live="polite" className="app__feedback">
        {feedback.message}
      </p>

      <CreateTaskSheet createTask={handleCreateTask} />

      <nav aria-label="Task views" className="app__tabs">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            className="app__tab"
            aria-pressed={activeTab === tab}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </nav>

      {activeTab === 'today' && (
        <section aria-label="Today" className="app__panel">
          {/* The tab bar above already names this panel for sighted users;
              this heading stays for structure and for anyone navigating by
              heading, visually hidden rather than duplicated on screen. */}
          <h2 className="sr-only">Today</h2>
          <TodayTab
            tasks={state.tasks}
            snapshot={state.snapshot}
            onEdit={state.editTask}
            onDelete={handleDelete}
            onComplete={handleComplete}
          />
          {/* Positioned after the priority groups (and after the empty
              state) rather than above them (see specs/task-views/spec.md,
              "Recalculate today is available from the Today tab" — "The
              action sits below the groups"), while staying present even
              when there is nothing to group ("The action is available on an
              empty plan"). */}
          <button
            type="button"
            className="app__recalculate"
            onClick={() => handleRecalculateToday()}
          >
            <RefreshIcon />
            Recalculate today
          </button>
        </section>
      )}

      {activeTab === 'all' && (
        <section aria-label="All tasks" className="app__panel">
          <h2 className="sr-only">All</h2>
          {/* A single DndContext over the whole tab; PriorityGroups renders
              one SortableContext per priority group beneath it (see
              TaskList.tsx and design.md, decision 7). Screen-reader
              announcements are always on as soon as DndContext is used;
              `accessibility.announcements` below only replaces dnd-kit's
              generic wording with one that names the tasks involved (see
              reorderAnnouncements.ts, and specs/task-views/spec.md, "the
              outcome of a completed move is conveyed to assistive
              technology"). */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            accessibility={{ announcements: reorderAnnouncements(allTasks) }}
          >
            <PriorityGroups
              tasks={allTasks}
              onEdit={state.editTask}
              onDelete={handleDelete}
              onComplete={handleComplete}
              reorderable
            />
          </DndContext>
        </section>
      )}

      {activeTab === 'completed' && (
        <section aria-label="Completed tasks" className="app__panel">
          <h2 className="sr-only">Completed</h2>
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
