import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import type { CreateTaskResult } from '../domain/task'
import type { CreateTaskFormInput } from './appStateContext'
import { CreateTaskForm } from './CreateTaskForm'

export type CreateTaskSheetProps = {
  createTask: (input: CreateTaskFormInput) => Promise<CreateTaskResult>
}

/**
 * The persistent add-task control and the creation form it opens as a
 * modal sheet (see specs/task-management/spec.md, "Task creation is opened
 * on demand from a persistent control"). Rendered once, above the tabs, so
 * it is present and identical on Today, All and Completed alike; opening
 * it never changes which tab is in view behind it.
 *
 * A native `<dialog>` supplies the top layer, the backdrop and background
 * inertness for free in a real browser, with no focus-trap library (see
 * design.md, decision 6). `showModal`/`close` are stubbed to a dumb
 * `open`-property toggle under this project's jsdom (see
 * vitest.setup.ts), which is why the two behaviors the spec actually pins
 * down - focus moving into the form on open, focus returning to the
 * trigger on close - are handled explicitly here rather than left to the
 * platform. Escape is likewise handled with an explicit `onKeyDown` rather
 * than the native `cancel` event, for the same reason. Activating the area
 * outside the form (the backdrop) is handled with an `onClick` on the
 * dialog itself: a click that never reaches any child element - because it
 * landed on the dialog's own box, outside the form it contains - arrives
 * with the dialog as `event.target`, which is how a native `<dialog>`
 * distinguishes a backdrop click from one inside its content without a
 * separate overlay element.
 *
 * The form is mounted only while `open`, so every open is a fresh
 * `TaskForm` instance: closing (by any route) discards whatever draft was
 * typed, and reopening always starts empty (specs/task-management/spec.md,
 * "The form starts empty every time it is opened").
 */
export function CreateTaskSheet({ createTask }: CreateTaskSheetProps) {
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) {
      dialogRef.current?.showModal()
    }
  }, [open])

  function openSheet() {
    setOpen(true)
  }

  function closeSheet() {
    dialogRef.current?.close()
    setOpen(false)
    triggerRef.current?.focus()
  }

  async function handleCreateTask(
    input: CreateTaskFormInput,
  ): Promise<CreateTaskResult> {
    const result = await createTask(input)
    // A rejected creation (see "A rejected creation keeps the form open")
    // must leave the sheet open with the chosen duration and priority
    // still selected - `TaskForm` already keeps that state on a rejection,
    // so the sheet only needs to close on the `ok` branch.
    if (result.ok) {
      closeSheet()
    }
    return result
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeSheet()
    }
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    // Only a click landing on the dialog element's own box - the backdrop
    // area, since the form content fills a smaller region within it -
    // reports the dialog itself as the target. A click on the form or any
    // of its fields has that element as `event.target` instead, and simply
    // bubbles here without matching.
    if (event.target === dialogRef.current) {
      closeSheet()
    }
  }

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        onClick={openSheet}
        aria-label="Add a task"
      >
        +
      </button>
      {open && (
        <dialog
          ref={dialogRef}
          onKeyDown={handleKeyDown}
          onClick={handleBackdropClick}
        >
          <CreateTaskForm
            createTask={handleCreateTask}
            onCancel={closeSheet}
            autoFocus
          />
        </dialog>
      )}
    </>
  )
}
