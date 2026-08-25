import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import {
  TaskForm,
  type TaskFormProps,
  type TaskFormSubmitResult,
  type TaskFormValues,
} from './TaskForm'

/**
 * `TaskForm` is the shared creation/edit form (see `src/ui/TaskForm.tsx`);
 * this file exercises the task-type choice and repetition-rule builder it
 * gains in tasks.md section 9 (specs/task-management/spec.md, "The
 * creation and edit form offers a task type and a rule builder"). Named
 * `RecurringTaskForm.test.tsx` per tasks.md 9.1, even though the component
 * under test remains `TaskForm` — there is no separate `RecurringTaskForm`
 * component.
 */

function renderForm(overrides: Partial<TaskFormProps> = {}) {
  const onSubmit = vi.fn<TaskFormProps['onSubmit']>(
    async (): Promise<TaskFormSubmitResult> => ({ ok: true }),
  )
  const onCancel = vi.fn()
  const utils = render(
    <TaskForm
      heading="Add a task"
      submitLabel="Add task"
      onSubmit={onSubmit}
      onCancel={onCancel}
      {...overrides}
    />,
  )
  return { onSubmit, onCancel, ...utils }
}

function typeGroup() {
  return screen.getByRole('group', { name: 'Type' })
}

function chooseRecurring() {
  fireEvent.click(
    within(typeGroup()).getByRole('button', { name: 'Recurring' }),
  )
}

function frequencyGroup() {
  return screen.getByRole('group', { name: 'Frequency' })
}

function chooseMonthly() {
  fireEvent.click(
    within(frequencyGroup()).getByRole('button', { name: 'Monthly' }),
  )
}

function weeklyDaysGroup() {
  return screen.getByRole('group', { name: 'Days of the week' })
}

function positionGroup() {
  return screen.getByRole('group', { name: 'Position' })
}

function monthlyDayGroup() {
  return screen.getByRole('group', { name: 'Day of the week' })
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Add task' }))
}

describe('9.1 the type choice defaults to one-off', () => {
  it('offers a type choice defaulting to one-off, with priority chips shown and no rule builder', () => {
    renderForm()

    expect(
      screen.getByRole('button', { name: 'One-off', pressed: true }),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Recurring', pressed: false }),
    ).toBeTruthy()

    expect(screen.getByRole('group', { name: 'Priority' })).toBeTruthy()

    expect(screen.queryByRole('group', { name: 'Frequency' })).toBeNull()
    expect(screen.queryByRole('group', { name: 'Days of the week' })).toBeNull()
    expect(screen.queryByRole('group', { name: 'Position' })).toBeNull()
    expect(screen.queryByRole('group', { name: 'Day of the week' })).toBeNull()
  })
})

describe('9.2 choosing recurring swaps priority for the rule builder', () => {
  it('hides the priority chips and shows the rule builder', () => {
    renderForm()

    chooseRecurring()

    expect(
      screen.getByRole('button', { name: 'Recurring', pressed: true }),
    ).toBeTruthy()
    expect(screen.queryByRole('group', { name: 'Priority' })).toBeNull()
    expect(screen.getByRole('group', { name: 'Frequency' })).toBeTruthy()
  })

  it('choosing one-off again brings the priority chips back and hides the rule builder', () => {
    renderForm()

    chooseRecurring()
    fireEvent.click(
      within(typeGroup()).getByRole('button', { name: 'One-off' }),
    )

    expect(screen.getByRole('group', { name: 'Priority' })).toBeTruthy()
    expect(screen.queryByRole('group', { name: 'Frequency' })).toBeNull()
  })
})

describe('9.3 the weekly builder multi-selects weekdays', () => {
  it('lets Monday and Wednesday both be active at once', () => {
    renderForm()
    chooseRecurring()
    // Weekly is the rule builder's own default once recurring is chosen.
    expect(
      within(frequencyGroup()).getByRole('button', {
        name: 'Weekly',
        pressed: true,
      }),
    ).toBeTruthy()

    const days = weeklyDaysGroup()
    fireEvent.click(within(days).getByRole('button', { name: 'Monday' }))
    fireEvent.click(within(days).getByRole('button', { name: 'Wednesday' }))

    expect(
      within(days).getByRole('button', { name: 'Monday', pressed: true }),
    ).toBeTruthy()
    expect(
      within(days).getByRole('button', { name: 'Wednesday', pressed: true }),
    ).toBeTruthy()
    expect(
      within(days).getByRole('button', { name: 'Tuesday', pressed: false }),
    ).toBeTruthy()
  })

  it('deselects a day already selected', () => {
    renderForm()
    chooseRecurring()
    const days = weeklyDaysGroup()

    fireEvent.click(within(days).getByRole('button', { name: 'Monday' }))
    fireEvent.click(within(days).getByRole('button', { name: 'Monday' }))

    expect(
      within(days).getByRole('button', { name: 'Monday', pressed: false }),
    ).toBeTruthy()
  })
})

describe('9.4 the monthly builder single-selects a position and a weekday', () => {
  it('selects exactly one position and one weekday', () => {
    renderForm()
    chooseRecurring()
    chooseMonthly()

    const positions = positionGroup()
    fireEvent.click(within(positions).getByRole('button', { name: 'First' }))
    fireEvent.click(within(positions).getByRole('button', { name: 'Second' }))

    expect(
      within(positions).getByRole('button', { name: 'First', pressed: false }),
    ).toBeTruthy()
    expect(
      within(positions).getByRole('button', { name: 'Second', pressed: true }),
    ).toBeTruthy()

    const days = monthlyDayGroup()
    fireEvent.click(within(days).getByRole('button', { name: 'Monday' }))
    fireEvent.click(within(days).getByRole('button', { name: 'Friday' }))

    expect(
      within(days).getByRole('button', { name: 'Monday', pressed: false }),
    ).toBeTruthy()
    expect(
      within(days).getByRole('button', { name: 'Friday', pressed: true }),
    ).toBeTruthy()
  })

  it('offers the last position alongside first through fourth', () => {
    renderForm()
    chooseRecurring()
    chooseMonthly()

    const positions = positionGroup()
    ;['First', 'Second', 'Third', 'Fourth', 'Last'].forEach((label) => {
      expect(
        within(positions).getByRole('button', { name: label }),
      ).toBeTruthy()
    })
  })
})

describe('9.5 the plain-language echo', () => {
  function echo() {
    return screen.getByRole('status')
  }

  it('renders for a single-day weekly rule', () => {
    renderForm()
    chooseRecurring()
    fireEvent.click(
      within(weeklyDaysGroup()).getByRole('button', { name: 'Monday' }),
    )

    expect(echo().textContent).toBe('Repeats every Monday')
  })

  it('renders for a multi-day weekly rule', () => {
    renderForm()
    chooseRecurring()
    const days = weeklyDaysGroup()
    fireEvent.click(within(days).getByRole('button', { name: 'Monday' }))
    fireEvent.click(within(days).getByRole('button', { name: 'Wednesday' }))

    expect(echo().textContent).toBe('Repeats every Monday and Wednesday')
  })

  it('renders for a monthly rule', () => {
    renderForm()
    chooseRecurring()
    chooseMonthly()
    fireEvent.click(
      within(positionGroup()).getByRole('button', { name: 'First' }),
    )
    fireEvent.click(
      within(monthlyDayGroup()).getByRole('button', { name: 'Monday' }),
    )

    expect(echo().textContent).toBe('Repeats the first Monday of every month')
  })

  it('is empty while the rule is not yet complete', () => {
    renderForm()
    chooseRecurring()

    expect(echo().textContent).toBe('')
  })
})

describe('9.6 switching the task type keeps the name and duration', () => {
  it('keeps the name and duration entered before switching to recurring, and back', () => {
    renderForm()

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Weekly review' },
    })
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Duration' })).getByRole(
        'button',
        { name: '30m' },
      ),
    )

    chooseRecurring()

    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe(
      'Weekly review',
    )
    expect(
      within(screen.getByRole('group', { name: 'Duration' })).getByRole(
        'button',
        { name: '30m', pressed: true },
      ),
    ).toBeTruthy()

    fireEvent.click(
      within(typeGroup()).getByRole('button', { name: 'One-off' }),
    )

    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe(
      'Weekly review',
    )
    expect(
      within(screen.getByRole('group', { name: 'Duration' })).getByRole(
        'button',
        { name: '30m', pressed: true },
      ),
    ).toBeTruthy()
  })
})

describe('9.7 a rejected recurring creation keeps the form open and the rule intact', () => {
  it('stays on the recurring type with the built rule intact after a rejection', async () => {
    const onSubmit = vi.fn<TaskFormProps['onSubmit']>(async () => ({
      ok: false,
      errors: ['name'],
    }))
    renderForm({ onSubmit })

    fireEvent.click(
      within(screen.getByRole('group', { name: 'Duration' })).getByRole(
        'button',
        { name: '30m' },
      ),
    )
    chooseRecurring()
    fireEvent.click(
      within(weeklyDaysGroup()).getByRole('button', { name: 'Monday' }),
    )

    submit()

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        priority: undefined,
        recurrence: { kind: 'weekly', weekdays: [1] },
      }),
    )

    expect(await screen.findByText('Name is required.')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Recurring', pressed: true }),
    ).toBeTruthy()
    expect(
      within(weeklyDaysGroup()).getByRole('button', {
        name: 'Monday',
        pressed: true,
      }),
    ).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('Repeats every Monday')
    expect(
      within(screen.getByRole('group', { name: 'Duration' })).getByRole(
        'button',
        { name: '30m', pressed: true },
      ),
    ).toBeTruthy()
  })
})

describe('9.8 the edit form pre-fills a recurring task, and cancelling changes nothing', () => {
  const recurringValues: TaskFormValues = {
    name: 'Weekly review',
    duration: 30,
    recurrence: { kind: 'weekly', weekdays: [1, 3] },
  }

  it('pre-fills the type and the rule from a recurring task', () => {
    renderForm({ initialValues: recurringValues })

    expect(
      screen.getByRole('button', { name: 'Recurring', pressed: true }),
    ).toBeTruthy()
    const days = weeklyDaysGroup()
    expect(
      within(days).getByRole('button', { name: 'Monday', pressed: true }),
    ).toBeTruthy()
    expect(
      within(days).getByRole('button', { name: 'Wednesday', pressed: true }),
    ).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe(
      'Repeats every Monday and Wednesday',
    )
  })

  it('pre-fills a monthly rule from a recurring task', () => {
    renderForm({
      initialValues: {
        name: 'Rent',
        duration: 15,
        recurrence: { kind: 'monthly-weekday', nth: 1, weekday: 1 },
      },
    })

    expect(
      screen.getByRole('button', { name: 'Recurring', pressed: true }),
    ).toBeTruthy()
    expect(
      within(positionGroup()).getByRole('button', {
        name: 'First',
        pressed: true,
      }),
    ).toBeTruthy()
    expect(
      within(monthlyDayGroup()).getByRole('button', {
        name: 'Monday',
        pressed: true,
      }),
    ).toBeTruthy()
  })

  it('cancelling calls onCancel without ever submitting', () => {
    const { onCancel, onSubmit } = renderForm({
      initialValues: recurringValues,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe('9.9 keyboard operability and assistive technology', () => {
  it('exposes the type choice and every rule control as native, non-disabled buttons', () => {
    renderForm()
    chooseRecurring()
    chooseMonthly()

    const controls = [
      ...within(typeGroup()).getAllByRole('button'),
      ...within(frequencyGroup()).getAllByRole('button'),
      ...within(positionGroup()).getAllByRole('button'),
      ...within(monthlyDayGroup()).getAllByRole('button'),
    ]

    expect(controls.length).toBeGreaterThan(0)
    controls.forEach((control) => {
      expect(control.tagName).toBe('BUTTON')
      expect(control.hasAttribute('disabled')).toBe(false)
    })
  })

  it('exposes the weekly days as native, non-disabled buttons too', () => {
    renderForm()
    chooseRecurring()

    within(weeklyDaysGroup())
      .getAllByRole('button')
      .forEach((control) => {
        expect(control.tagName).toBe('BUTTON')
        expect(control.hasAttribute('disabled')).toBe(false)
      })
  })

  it('exposes the echo to assistive technology via a status live region', () => {
    renderForm()
    chooseRecurring()
    fireEvent.click(
      within(weeklyDaysGroup()).getByRole('button', { name: 'Monday' }),
    )

    const region = screen.getByRole('status')
    expect(region.getAttribute('aria-live')).toBe('polite')
    expect(region.textContent).toBe('Repeats every Monday')
  })
})
