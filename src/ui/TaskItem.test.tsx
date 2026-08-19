import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { TaskItem } from './TaskItem'
import type { Task } from '../domain/task'

function makeTask(overrides: Partial<Task> & { id: string }): Task {
  return {
    name: overrides.id,
    duration: 30,
    priority: 'medium',
    createdAt: new Date('2026-08-17T09:00:00.000Z'),
    completedAt: null,
    ...overrides,
  }
}

/** Renders a bare `TaskItem` inside the `<ul>` its `<li>` requires, with
 * spy handlers standing in for the store actions `TaskManagerApp` normally
 * supplies. Isolated from `AppStateProvider` on purpose: sections 6.1, 6.2
 * and 6.4 are about this row's own markup and accessible names, which does
 * not need a live store to exercise. */
function renderItem(task: Task) {
  const onEdit = vi.fn().mockResolvedValue({ ok: true, task })
  const onDelete = vi.fn().mockResolvedValue(undefined)
  const onComplete = vi.fn().mockResolvedValue(undefined)
  render(
    <ul>
      <TaskItem
        task={task}
        onEdit={onEdit}
        onDelete={onDelete}
        onComplete={onComplete}
      />
    </ul>,
  )
  return { onEdit, onDelete, onComplete }
}

describe('completing a task from its checkbox (6.1)', () => {
  it('is unchecked and interactive on a pending task, and completes it when checked', () => {
    const task = makeTask({ id: 't1', name: 'Submit quarterly report' })
    const { onComplete } = renderItem(task)

    const checkbox = screen.getByRole('checkbox', {
      name: 'Submit quarterly report',
    }) as HTMLInputElement
    expect(checkbox.checked).toBe(false)
    expect(checkbox.disabled).toBe(false)

    fireEvent.click(checkbox)

    expect(onComplete).toHaveBeenCalledWith('t1')
  })

  it("is associated with the task's name via aria-labelledby on the existing name element, not a duplicated string", () => {
    const task = makeTask({ id: 't1', name: 'Submit quarterly report' })
    renderItem(task)

    const checkbox = screen.getByRole('checkbox') as HTMLInputElement
    // The accessible name comes from a reference to the row's own name
    // element, not from a second, independent copy of the string.
    expect(checkbox.hasAttribute('aria-label')).toBe(false)
    const labelledBy = checkbox.getAttribute('aria-labelledby')
    expect(labelledBy).toBeTruthy()

    const nameElement = document.getElementById(labelledBy as string)
    expect(nameElement).toBeTruthy()
    expect(nameElement?.textContent).toBe('Submit quarterly report')

    // Exactly one element in the row renders the name as text - proof
    // nothing was duplicated to build the label.
    expect(screen.getAllByText('Submit quarterly report')).toHaveLength(1)
  })
})

describe("a completed task's checkbox (6.2)", () => {
  it('is checked and not interactive, and activating it leaves the task completed', () => {
    const task = makeTask({
      id: 't1',
      name: 'Ship the release',
      completedAt: new Date('2026-08-18T09:00:00.000Z'),
    })
    renderItem(task)

    const checkbox = screen.getByRole('checkbox', {
      name: 'Ship the release',
    }) as HTMLInputElement
    expect(checkbox.checked).toBe(true)
    // `disabled` is what makes the box non-interactive (design.md, decision
    // 8): a real browser never dispatches a `click` at all to a disabled
    // form control in response to a real user gesture, so a genuine
    // activation can never reach `onComplete`. `fireEvent.click`, which
    // dispatches the event programmatically, does not reproduce that
    // browser-level suppression, so it cannot stand in for "no user
    // activation is possible" here. What it can prove, and what matters
    // observably, is the guarantee the scenario is actually about: the box
    // cannot be toggled back to unchecked - completion cannot be undone.
    expect(checkbox.disabled).toBe(true)

    fireEvent.click(checkbox)

    expect(checkbox.checked).toBe(true)
  })
})

describe('edit and delete controls on a task row (6.4)', () => {
  it('exposes native, keyboard-reachable controls named "Edit" and "Delete"', () => {
    const task = makeTask({ id: 't1', name: 'Water the plants' })
    renderItem(task)

    const editButton = screen.getByRole('button', { name: 'Edit' })
    const deleteButton = screen.getByRole('button', { name: 'Delete' })
    expect(editButton.tagName).toBe('BUTTON')
    expect(deleteButton.tagName).toBe('BUTTON')
    // A native, non-disabled <button> is keyboard-reachable (in the tab
    // order) with no further wiring needed.
    expect(editButton.hasAttribute('disabled')).toBe(false)
    expect(deleteButton.hasAttribute('disabled')).toBe(false)
  })

  it('deletes the task immediately, with no confirmation step', () => {
    const task = makeTask({ id: 't1', name: 'Water the plants' })
    const { onDelete } = renderItem(task)

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(onDelete).toHaveBeenCalledWith('t1')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('replaces the row with a form pre-filled from the task, and cancelling restores it unchanged', () => {
    const task = makeTask({
      id: 't1',
      name: 'Water the plants',
      duration: 20,
      priority: 'low',
    })
    renderItem(task)

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe(
      'Water the plants',
    )
    const durationButton = within(
      screen.getByRole('group', { name: 'Duration' }),
    ).getByRole('button', { name: '20m' })
    const priorityButton = within(
      screen.getByRole('group', { name: 'Priority' }),
    ).getByRole('button', { name: 'Low' })
    expect(durationButton.getAttribute('aria-pressed')).toBe('true')
    expect(priorityButton.getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByLabelText('Name')).toBeNull()
    expect(screen.getByText('Water the plants')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
  })
})
