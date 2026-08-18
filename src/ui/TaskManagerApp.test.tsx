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
