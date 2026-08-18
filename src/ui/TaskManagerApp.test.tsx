import { describe, expect, it } from 'vitest'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { AppStateProvider } from './AppStateProvider'
import { TaskManagerApp } from './TaskManagerApp'
import { ThemeProvider } from './ThemeProvider'
import { createInMemoryRepository } from '../persistence/inMemoryRepository'
import type { Repository } from '../persistence/repository'

const FIXED_NOW = new Date('2026-08-18T09:00:00.000Z')

function renderApp(repository: Repository = createInMemoryRepository()) {
  return render(
    <AppStateProvider repository={repository} now={() => FIXED_NOW}>
      <TaskManagerApp />
    </AppStateProvider>,
  )
}

/** Waits for the initial load to finish and returns the create form's
 * duration and priority groups, which every test needs. */
async function waitForLoaded() {
  await screen.findByLabelText('Name')
  return {
    durationGroup: screen.getByRole('group', { name: 'Duration' }),
    priorityGroup: screen.getByRole('group', { name: 'Priority' }),
  }
}

/** Switches to the named tab (see tasks.md section 9, which introduces the
 * Today/All/Completed tab structure that these section-8 tests now have to
 * navigate to reach the "All tasks" panel they were written against). */
function switchTab(name: 'Today' | 'All' | 'Completed') {
  fireEvent.click(screen.getByRole('button', { name }))
}

/** Fills in and submits the (top-level) create form. */
function createTaskViaForm(
  name: string,
  durationLabel: string,
  priorityLabel: string,
) {
  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: name },
  })
  fireEvent.click(
    within(screen.getByRole('group', { name: 'Duration' })).getByRole(
      'button',
      { name: durationLabel },
    ),
  )
  fireEvent.click(
    within(screen.getByRole('group', { name: 'Priority' })).getByRole(
      'button',
      { name: priorityLabel },
    ),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Add task' }))
}

describe('creating a task (8.1)', () => {
  it('offers exactly nine duration buttons and five priority choices', async () => {
    renderApp()
    const { durationGroup, priorityGroup } = await waitForLoaded()

    const durationButtons = within(durationGroup).getAllByRole('button')
    expect(durationButtons).toHaveLength(9)
    ;['5m', '10m', '15m', '20m', '30m', '45m', '1h', '1.5h', '2h'].forEach(
      (label) => {
        // getByRole throws if the button isn't found, so a returned value
        // is itself proof the button exists.
        expect(
          within(durationGroup).getByRole('button', { name: label }),
        ).toBeTruthy()
      },
    )

    const priorityButtons = within(priorityGroup).getAllByRole('button')
    expect(priorityButtons).toHaveLength(5)
    ;['Urgent', 'High', 'Medium', 'Low', 'Very low'].forEach((label) => {
      expect(
        within(priorityGroup).getByRole('button', { name: label }),
      ).toBeTruthy()
    })
  })

  it('adds a fully filled task to the All list on submit', async () => {
    renderApp()
    await waitForLoaded()
    switchTab('All')

    createTaskViaForm('Write the report', '30m', 'High')

    const allSection = screen.getByRole('region', { name: 'All tasks' })
    expect(await within(allSection).findByText('Write the report')).toBeTruthy()
  })
})

describe('validating the create form (8.2)', () => {
  it('rejects a blank name with a visible message and creates no task', async () => {
    renderApp()
    const { durationGroup, priorityGroup } = await waitForLoaded()
    switchTab('All')

    fireEvent.click(within(durationGroup).getByRole('button', { name: '15m' }))
    fireEvent.click(
      within(priorityGroup).getByRole('button', { name: 'Medium' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }))

    expect(await screen.findByText('Name is required.')).toBeTruthy()
    const allSection = screen.getByRole('region', { name: 'All tasks' })
    expect(within(allSection).getByText('empty')).toBeTruthy()
  })

  it('rejects a missing duration with a message naming duration', async () => {
    renderApp()
    const { priorityGroup } = await waitForLoaded()
    switchTab('All')

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Buy milk' },
    })
    fireEvent.click(within(priorityGroup).getByRole('button', { name: 'Low' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }))

    expect(await screen.findByText('Duration is required.')).toBeTruthy()
    const allSection = screen.getByRole('region', { name: 'All tasks' })
    expect(within(allSection).getByText('empty')).toBeTruthy()
  })

  it('rejects a missing priority with a message naming priority', async () => {
    renderApp()
    const { durationGroup } = await waitForLoaded()
    switchTab('All')

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Buy milk' },
    })
    fireEvent.click(within(durationGroup).getByRole('button', { name: '15m' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }))

    expect(await screen.findByText('Priority is required.')).toBeTruthy()
    const allSection = screen.getByRole('region', { name: 'All tasks' })
    expect(within(allSection).getByText('empty')).toBeTruthy()
  })
})

describe('editing a task (8.3)', () => {
  it("updates the task's name, duration and priority everywhere it is displayed", async () => {
    renderApp()
    await waitForLoaded()
    switchTab('All')
    createTaskViaForm('Old name', '30m', 'Medium')

    const item = (await screen.findByText('Old name')).closest('li')
    if (!item) throw new Error('expected a list item')
    fireEvent.click(within(item).getByRole('button', { name: 'Edit' }))

    fireEvent.change(within(item).getByLabelText('Name'), {
      target: { value: 'New name' },
    })
    fireEvent.click(
      within(within(item).getByRole('group', { name: 'Duration' })).getByRole(
        'button',
        { name: '15m' },
      ),
    )
    fireEvent.click(
      within(within(item).getByRole('group', { name: 'Priority' })).getByRole(
        'button',
        { name: 'High' },
      ),
    )
    fireEvent.click(within(item).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('New name')).toBeTruthy()
    expect(screen.queryByText('Old name')).toBeNull()
    const updatedItem = screen.getByText('New name').closest('li')
    if (!updatedItem) throw new Error('expected a list item')
    expect(within(updatedItem).getByText('15m')).toBeTruthy()
    expect(within(updatedItem).getByText('High')).toBeTruthy()
  })

  it('rejects clearing the name during an edit, leaving the task unchanged', async () => {
    renderApp()
    await waitForLoaded()
    switchTab('All')
    createTaskViaForm('Keep me', '20m', 'Low')

    const item = (await screen.findByText('Keep me')).closest('li')
    if (!item) throw new Error('expected a list item')
    fireEvent.click(within(item).getByRole('button', { name: 'Edit' }))

    fireEvent.change(within(item).getByLabelText('Name'), {
      target: { value: '   ' },
    })
    fireEvent.click(within(item).getByRole('button', { name: 'Save' }))

    expect(await within(item).findByText('Name is required.')).toBeTruthy()
    // The rejected edit did not change the underlying task: cancelling out
    // of the still-open edit form reveals its previous, unedited value.
    fireEvent.click(within(item).getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('Keep me')).toBeTruthy()
  })
})

describe('deleting a task (8.4)', () => {
  it('removes the task from the list and pulls no replacement into view', async () => {
    renderApp()
    await waitForLoaded()
    switchTab('All')
    createTaskViaForm('Task A', '30m', 'Medium')
    createTaskViaForm('Task B', '15m', 'High')

    expect(screen.getAllByRole('listitem')).toHaveLength(2)

    const itemA = (await screen.findByText('Task A')).closest('li')
    if (!itemA) throw new Error('expected a list item')
    fireEvent.click(within(itemA).getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(screen.queryByText('Task A')).toBeNull()
    })
    // The other task is still there, and nothing new took Task A's place:
    // exactly one item remains.
    expect(screen.getByText('Task B')).toBeTruthy()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })
})

describe('theme toggle in the header (3.4)', () => {
  const THEME_TOGGLE_NAME = 'Toggle theme between light and dark'

  /** Unlike `renderApp` above, wraps in `ThemeProvider` too — the real
   * composition root (`App.tsx`) always does, but the shared `renderApp`
   * helper is left as-is here so the suites for other sections (and the
   * rest of this file) keep exercising `TaskManagerApp` exactly as they
   * did before this control existed. */
  function renderThemedApp(
    repository: Repository = createInMemoryRepository(),
  ) {
    return render(
      <ThemeProvider>
        <AppStateProvider repository={repository} now={() => FIXED_NOW}>
          <TaskManagerApp />
        </AppStateProvider>
      </ThemeProvider>,
    )
  }

  it('exposes an accessible name stating it toggles light and dark, and is a native, keyboard-reachable button', async () => {
    renderThemedApp()
    await waitForLoaded()

    const toggle = screen.getByRole('button', { name: THEME_TOGGLE_NAME })
    expect(toggle.tagName).toBe('BUTTON')
    expect(toggle.hasAttribute('disabled')).toBe(false)
  })

  it('does not change the active tab when the theme is switched', async () => {
    renderThemedApp()
    await waitForLoaded()
    switchTab('All')
    expect(
      screen.getByRole('button', { name: 'All', pressed: true }),
    ).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: THEME_TOGGLE_NAME }))

    expect(
      screen.getByRole('button', { name: 'All', pressed: true }),
    ).toBeTruthy()
    expect(screen.getByRole('region', { name: 'All tasks' })).toBeTruthy()
  })
})

describe('the feedback region is always mounted (4.2)', () => {
  it('is present before any action, empty, and carries role=status with aria-live=polite', async () => {
    renderApp()
    await waitForLoaded()

    const region = screen.getByRole('status')
    expect(region.textContent).toBe('')
    expect(region.getAttribute('aria-live')).toBe('polite')
  })

  it('changes the same element in place rather than a new one being inserted', async () => {
    renderApp()
    await waitForLoaded()
    switchTab('All')

    // Captured before any action: decision 7's whole point is that this is
    // the same node whose text later changes, not a node that shows up
    // once there is something to say.
    const region = screen.getByRole('status')
    expect(region.textContent).toBe('')

    createTaskViaForm('Task A', '30m', 'Medium')

    await waitFor(() => {
      expect(region.textContent).toBe('Task added')
    })
    expect(screen.getByRole('status')).toBe(region)
  })
})

describe('action feedback follows every completed action (4.3)', () => {
  it('shows "Task added" after creating a task', async () => {
    renderApp()
    await waitForLoaded()
    switchTab('All')

    createTaskViaForm('Write the report', '30m', 'High')

    expect(await screen.findByText('Task added')).toBeTruthy()
  })

  it('shows "Task completed" after completing a task', async () => {
    renderApp()
    await waitForLoaded()
    switchTab('All')
    createTaskViaForm('Wash dishes', '15m', 'Low')

    const item = (await screen.findByText('Wash dishes')).closest('li')
    if (!item) throw new Error('expected a list item')
    fireEvent.click(within(item).getByRole('button', { name: 'Complete' }))

    expect(await screen.findByText('Task completed')).toBeTruthy()
  })

  it('shows "Task deleted" after deleting a task', async () => {
    renderApp()
    await waitForLoaded()
    switchTab('All')
    createTaskViaForm('Throw away', '10m', 'Medium')

    const item = (await screen.findByText('Throw away')).closest('li')
    if (!item) throw new Error('expected a list item')
    fireEvent.click(within(item).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('Task deleted')).toBeTruthy()
  })

  it('shows "Today recalculated" after recalculating today', async () => {
    renderApp()
    await waitForLoaded()

    fireEvent.click(screen.getByRole('button', { name: 'Recalculate today' }))

    expect(await screen.findByText('Today recalculated')).toBeTruthy()
  })

  it('shows the validation message, and not "Task added", for a creation rejected for a blank name', async () => {
    renderApp()
    const { durationGroup, priorityGroup } = await waitForLoaded()
    switchTab('All')

    fireEvent.click(within(durationGroup).getByRole('button', { name: '15m' }))
    fireEvent.click(
      within(priorityGroup).getByRole('button', { name: 'Medium' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }))

    expect(await screen.findByText('Name is required.')).toBeTruthy()
    expect(screen.queryByText('Task added')).toBeNull()
    expect(screen.getByRole('status').textContent).toBe('')
  })
})

describe('the confirmation is identical from every tab (4.4)', () => {
  it('shows the same message and leaves the tab in view unchanged whether completing from Today or from All', async () => {
    renderApp()
    await waitForLoaded()
    switchTab('All')
    // Urgent tasks are admitted to today's plan unconditionally (see
    // src/domain/dailyPlan.ts), so this one is reachable from Today right
    // after creation with no recalculation needed.
    createTaskViaForm('From today', '15m', 'Urgent')
    createTaskViaForm('From all', '15m', 'Low')

    switchTab('Today')
    const todayItem = (await screen.findByText('From today')).closest('li')
    if (!todayItem) throw new Error('expected a list item')
    fireEvent.click(within(todayItem).getByRole('button', { name: 'Complete' }))

    expect(await screen.findByText('Task completed')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Today', pressed: true }),
    ).toBeTruthy()

    switchTab('All')
    const allItem = (await screen.findByText('From all')).closest('li')
    if (!allItem) throw new Error('expected a list item')
    fireEvent.click(within(allItem).getByRole('button', { name: 'Complete' }))

    // Exactly the same message as from Today, and the All tab - not Today
    // - is still the tab in view.
    expect(await screen.findByText('Task completed')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'All', pressed: true }),
    ).toBeTruthy()
  })

  it('never moves focus onto the feedback region when completing via the keyboard', async () => {
    renderApp()
    await waitForLoaded()
    switchTab('All')
    createTaskViaForm('Keyboard task', '15m', 'Medium')

    const item = (await screen.findByText('Keyboard task')).closest('li')
    if (!item) throw new Error('expected a list item')
    const completeButton = within(item).getByRole('button', {
      name: 'Complete',
    })
    completeButton.focus()
    expect(document.activeElement).toBe(completeButton)

    fireEvent.click(completeButton)

    const status = await screen.findByText('Task completed')
    // The confirmation must never be the thing that receives focus (see
    // specs/action-feedback/spec.md, "The confirmation reaches assistive
    // technology without stealing focus"). This is the part of "Focus stays
    // where the user left it" that this section's wiring owns and can pin
    // today. It cannot yet assert that focus stays *on* the "Complete"
    // button itself: `TaskItem`'s conditional `{!isCompleted && <button>}`
    // (pre-existing, unrelated to this section) unmounts that button
    // synchronously the instant `AppStateProvider.completeTask` dispatches
    // - before this wrapper's own `feedback.show` call even runs - so
    // jsdom moves `document.activeElement` to `<body>` regardless of
    // anything this section does. That half of the scenario becomes
    // reachable in section 6, once the checkbox (which stays in place,
    // merely toggling checked/disabled, per design.md decision 8) replaces
    // this vanishing button.
    expect(document.activeElement).not.toBe(status)
  })
})
