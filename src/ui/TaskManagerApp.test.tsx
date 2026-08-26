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

/** Waits for the initial load to finish. The create form now lives behind
 * the add-task control rather than always on screen (see design.md,
 * decision 6), so this anchors on that control instead of the "Name"
 * field it used to resolve on. */
async function waitForLoaded() {
  await screen.findByRole('button', { name: 'Add a task' })
}

/** Switches to the named tab (see tasks.md section 9, which introduces the
 * Today/All/Completed tab structure that these section-8 tests now have to
 * navigate to reach the "All tasks" panel they were written against). */
function switchTab(name: 'Today' | 'All' | 'Completed') {
  fireEvent.click(screen.getByRole('button', { name }))
}

/** The app's own confirmation region (design.md, decision 7), disambiguated
 * from dnd-kit's own `role="status"` live region — mounted alongside it
 * whenever the All tab is in view, once section 8 wires a `DndContext`
 * there (see specs/task-views/spec.md, "the outcome of a completed move is
 * conveyed to assistive technology"). The two are told apart by
 * `aria-live`: this app's region is `polite` (TaskManagerApp.tsx); dnd-kit's
 * is `assertive`. */
function getFeedbackRegion(): HTMLElement {
  const region = screen
    .getAllByRole('status')
    .find((element) => element.getAttribute('aria-live') === 'polite')
  if (!region) throw new Error('expected the app feedback region')
  return region
}

/** Opens the creation sheet from the add-task control and returns its
 * duration and priority groups, which several tests need directly. */
function openCreateForm() {
  fireEvent.click(screen.getByRole('button', { name: 'Add a task' }))
  return {
    durationGroup: screen.getByRole('group', { name: 'Duration' }),
    priorityGroup: screen.getByRole('group', { name: 'Priority' }),
  }
}

/** Opens the creation sheet, fills in and submits the form. */
function createTaskViaForm(
  name: string,
  durationLabel: string,
  priorityLabel: string,
) {
  fireEvent.click(screen.getByRole('button', { name: 'Add a task' }))
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
    await waitForLoaded()
    const { durationGroup, priorityGroup } = openCreateForm()

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
    await waitForLoaded()
    switchTab('All')
    const { durationGroup, priorityGroup } = openCreateForm()

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
    await waitForLoaded()
    switchTab('All')
    const { priorityGroup } = openCreateForm()

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
    await waitForLoaded()
    switchTab('All')
    const { durationGroup } = openCreateForm()

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
    // Deleting is gated behind a confirmation dialog (see
    // openspec/changes/add-delete-confirmation) - the "Delete" click above
    // only opens it. "Delete task" is the dialog's confirm control, named
    // distinctly from the row's own "Delete" trigger since both are mounted
    // at once (see TaskItem.test.tsx for the naming rationale).
    fireEvent.click(screen.getByRole('button', { name: 'Delete task' }))

    await waitFor(() => {
      expect(screen.queryByText('Task A')).toBeNull()
    })
    // The other task is still there, and nothing new took Task A's place:
    // exactly one item remains.
    expect(screen.getByText('Task B')).toBeTruthy()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })

  it('cancelling the confirmation leaves the task visible and shows no "Task deleted" feedback', async () => {
    renderApp()
    await waitForLoaded()
    switchTab('All')
    createTaskViaForm('Keep me', '15m', 'Medium')

    const item = (await screen.findByText('Keep me')).closest('li')
    if (!item) throw new Error('expected a list item')
    fireEvent.click(within(item).getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByText('Keep me')).toBeTruthy()
    expect(screen.queryByText('Task deleted')).toBeNull()
    // Cancelling must not produce a *new* "Task deleted" feedback message.
    // This does not assert the region is empty: the earlier
    // `createTaskViaForm` call above leaves a real "Task added" message
    // that only self-clears after FEEDBACK_DURATION_MS (see
    // useActionFeedback.ts), and this test does not wait that out.
    expect(getFeedbackRegion().textContent).not.toBe('Task deleted')
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

  it('switching the theme preserves the current context: the All tab, the open sheet, and the entered name (9.2)', async () => {
    renderThemedApp()
    await waitForLoaded()
    switchTab('All')

    fireEvent.click(screen.getByRole('button', { name: 'Add a task' }))
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Partially typed name' },
    })

    fireEvent.click(screen.getByRole('button', { name: THEME_TOGGLE_NAME }))

    expect(
      screen.getByRole('button', { name: 'All', pressed: true }),
    ).toBeTruthy()
    expect(screen.getByRole('region', { name: 'All tasks' })).toBeTruthy()
    // The sheet is still open, and its draft survived the theme switch
    // rather than being remounted fresh (see CreateTaskSheet.tsx: the form
    // is mounted only while `open`, so a remount would have discarded it).
    expect(screen.getByRole('button', { name: 'Add task' })).toBeTruthy()
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe(
      'Partially typed name',
    )
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
    const region = getFeedbackRegion()
    expect(region.textContent).toBe('')

    createTaskViaForm('Task A', '30m', 'Medium')

    await waitFor(() => {
      expect(region.textContent).toBe('Task added')
    })
    expect(getFeedbackRegion()).toBe(region)
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
    fireEvent.click(within(item).getByRole('checkbox'))

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
    fireEvent.click(screen.getByRole('button', { name: 'Delete task' }))

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
    await waitForLoaded()
    switchTab('All')
    const { durationGroup, priorityGroup } = openCreateForm()

    fireEvent.click(within(durationGroup).getByRole('button', { name: '15m' }))
    fireEvent.click(
      within(priorityGroup).getByRole('button', { name: 'Medium' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }))

    expect(await screen.findByText('Name is required.')).toBeTruthy()
    expect(screen.queryByText('Task added')).toBeNull()
    expect(getFeedbackRegion().textContent).toBe('')
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
    fireEvent.click(within(todayItem).getByRole('checkbox'))

    expect(await screen.findByText('Task completed')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Today', pressed: true }),
    ).toBeTruthy()

    switchTab('All')
    const allItem = (await screen.findByText('From all')).closest('li')
    if (!allItem) throw new Error('expected a list item')
    fireEvent.click(within(allItem).getByRole('checkbox'))

    // Exactly the same message as from Today, and the All tab - not Today
    // - is still the tab in view.
    expect(await screen.findByText('Task completed')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'All', pressed: true }),
    ).toBeTruthy()
  })

  it('leaves focus on the checkbox when completing via the keyboard', async () => {
    renderApp()
    await waitForLoaded()
    switchTab('All')
    // Urgent tasks are admitted to today's plan unconditionally, so this
    // one is reachable from Today right after creation. That matters here:
    // unlike the All tab, which drops a task from its list the moment it is
    // completed, the Today tab keeps a completed task's row mounted in
    // place, struck through (see specs/task-views/spec.md, "Completing a
    // task from the Today tab keeps it visible") - the row staying put is
    // exactly what lets focus stay on its checkbox instead of the row (and
    // the focused element within it) disappearing out from under it.
    createTaskViaForm('Keyboard task', '15m', 'Urgent')

    switchTab('Today')
    const item = (await screen.findByText('Keyboard task')).closest('li')
    if (!item) throw new Error('expected a list item')
    const checkbox = within(item).getByRole('checkbox')
    checkbox.focus()
    expect(document.activeElement).toBe(checkbox)

    fireEvent.click(checkbox)

    const status = await screen.findByText('Task completed')
    // The confirmation must never be the thing that receives focus (see
    // specs/action-feedback/spec.md, "The confirmation reaches assistive
    // technology without stealing focus").
    expect(document.activeElement).not.toBe(status)
    // Section 6 replaced the vanishing "Complete" button with a checkbox
    // that stays mounted across the pending -> completed transition, merely
    // toggling checked/disabled in place (design.md, decision 8). That is
    // what makes the rest of "Focus stays where the user left it" testable:
    // completing from the keyboard now leaves focus exactly where the user
    // left it, on the checkbox itself - previously untestable here because
    // the old button unmounted synchronously the instant
    // `AppStateProvider.completeTask` dispatched, moving
    // `document.activeElement` to `<body>` regardless of anything this
    // section's wiring did.
    expect(document.activeElement).toBe(checkbox)
  })
})

describe('the add-task control is available on every tab (5.2)', () => {
  it('has an accessible name identifying it as the way to add a task, and is a keyboard-reachable button, on Today, All and Completed', async () => {
    renderApp()
    await waitForLoaded()

    for (const tab of ['Today', 'All', 'Completed'] as const) {
      switchTab(tab)
      const addTaskButton = screen.getByRole('button', { name: 'Add a task' })
      expect(addTaskButton.tagName).toBe('BUTTON')
      expect(addTaskButton.hasAttribute('disabled')).toBe(false)
      addTaskButton.focus()
      expect(document.activeElement).toBe(addTaskButton)
    }
  })
})

describe('opening the creation form (5.3)', () => {
  it('renders the form over the All tab, leaves All the tab in view, and moves focus into the form', async () => {
    renderApp()
    await waitForLoaded()
    switchTab('All')

    fireEvent.click(screen.getByRole('button', { name: 'Add a task' }))

    // The All tab is still the tab in view behind the form.
    expect(
      screen.getByRole('button', { name: 'All', pressed: true }),
    ).toBeTruthy()
    expect(screen.getByRole('region', { name: 'All tasks' })).toBeTruthy()

    const nameField = screen.getByLabelText('Name')
    expect(document.activeElement).toBe(nameField)
  })

  it('starts empty every time it is opened: an empty name, and no duration or priority selected', async () => {
    renderApp()
    await waitForLoaded()

    const { durationGroup, priorityGroup } = openCreateForm()
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('')
    within(durationGroup)
      .getAllByRole('button')
      .forEach((button) => {
        expect(button.getAttribute('aria-pressed')).toBe('false')
      })
    within(priorityGroup)
      .getAllByRole('button')
      .forEach((button) => {
        expect(button.getAttribute('aria-pressed')).toBe('false')
      })

    // Partially fill the draft, then dismiss without submitting.
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Draft that should not survive' },
    })
    fireEvent.click(within(durationGroup).getByRole('button', { name: '15m' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    // Reopening shows a fresh form, not the discarded draft.
    const reopened = openCreateForm()
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('')
    within(reopened.durationGroup)
      .getAllByRole('button')
      .forEach((button) => {
        expect(button.getAttribute('aria-pressed')).toBe('false')
      })
  })
})

describe('dismissing the creation form (5.4)', () => {
  it('cancelling closes the form, creates nothing, returns focus to the trigger, and discards the draft', async () => {
    renderApp()
    await waitForLoaded()
    const addTaskButton = screen.getByRole('button', { name: 'Add a task' })
    const { durationGroup } = openCreateForm()

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Never created' },
    })
    fireEvent.click(within(durationGroup).getByRole('button', { name: '15m' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByLabelText('Name')).toBeNull()
    expect(document.activeElement).toBe(addTaskButton)

    switchTab('All')
    const allSection = screen.getByRole('region', { name: 'All tasks' })
    expect(within(allSection).getByText('empty')).toBeTruthy()
  })

  it('Escape closes the form and creates nothing', async () => {
    renderApp()
    await waitForLoaded()
    openCreateForm()

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Never created' },
    })
    fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'Escape' })

    expect(screen.queryByLabelText('Name')).toBeNull()

    switchTab('All')
    const allSection = screen.getByRole('region', { name: 'All tasks' })
    expect(within(allSection).getByText('empty')).toBeTruthy()
  })

  it('activating the area outside the form (the backdrop) closes it, creates nothing, and returns focus to the trigger', async () => {
    renderApp()
    await waitForLoaded()
    const addTaskButton = screen.getByRole('button', { name: 'Add a task' })
    openCreateForm()

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Never created' },
    })
    // A click that lands on the dialog element itself - never reaching any
    // child - is how a real `<dialog>`'s backdrop click is distinguished
    // from a click inside its content, whose target is a descendant.
    fireEvent.click(screen.getByRole('dialog'))

    expect(screen.queryByLabelText('Name')).toBeNull()
    expect(document.activeElement).toBe(addTaskButton)

    switchTab('All')
    const allSection = screen.getByRole('region', { name: 'All tasks' })
    expect(within(allSection).getByText('empty')).toBeTruthy()
  })

  it('clicking inside the form content does not close it', async () => {
    renderApp()
    await waitForLoaded()
    openCreateForm()

    fireEvent.click(screen.getByLabelText('Name'))

    expect(screen.getByLabelText('Name')).toBeTruthy()
  })

  it('a valid submission closes the form and returns focus to the trigger', async () => {
    renderApp()
    await waitForLoaded()
    const addTaskButton = screen.getByRole('button', { name: 'Add a task' })

    createTaskViaForm('Ship the feature', '30m', 'High')

    await waitFor(() => {
      expect(screen.queryByLabelText('Name')).toBeNull()
    })
    expect(document.activeElement).toBe(addTaskButton)
  })

  it('a submission rejected for a blank name keeps the form open with the chosen duration and priority still selected', async () => {
    renderApp()
    await waitForLoaded()
    const { durationGroup, priorityGroup } = openCreateForm()

    fireEvent.click(within(durationGroup).getByRole('button', { name: '15m' }))
    fireEvent.click(
      within(priorityGroup).getByRole('button', { name: 'Medium' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }))

    expect(await screen.findByText('Name is required.')).toBeTruthy()
    expect(screen.getByLabelText('Name')).toBeTruthy()
    const durationButton = within(durationGroup).getByRole('button', {
      name: '15m',
    })
    const priorityButton = within(priorityGroup).getByRole('button', {
      name: 'Medium',
    })
    expect(durationButton.getAttribute('aria-pressed')).toBe('true')
    expect(priorityButton.getAttribute('aria-pressed')).toBe('true')
  })
})
