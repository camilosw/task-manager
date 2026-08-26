## 1. Update existing tests for confirmation-gated deletion (red)

- [x] 1.1 In `src/ui/TaskItem.test.tsx`, replace the `'deletes the task immediately, with no confirmation step'` test (in the `'edit and delete controls on a task row'` describe block) with a test asserting that clicking the "Delete" control presents a dialog naming the task and does **not** call `onDelete` yet.
- [x] 1.2 In the same file, add a test asserting that activating the dialog's confirm control calls `onDelete('t1')` and closes the dialog.
- [x] 1.3 In the same file, add a test asserting that activating the dialog's cancel control leaves `onDelete` uncalled, closes the dialog, and leaves the row unchanged.
- [x] 1.4 In the same file, add a test asserting that pressing Escape while the dialog is open behaves like cancel (`onDelete` uncalled, dialog closes).
- [x] 1.5 In `src/ui/TaskManagerApp.test.tsx`, update `'removes the task from the list and pulls no replacement into view'` (describe `'deleting a task (8.4)'`) to activate the dialog's confirm control after clicking "Delete", before asserting the task is gone.
- [x] 1.6 In the same file, update `'shows "Task deleted" after deleting a task'` the same way: confirm after clicking "Delete", before asserting the feedback message.
- [x] 1.7 In the same file, add a test asserting that cancelling the confirmation leaves the task visible in the list and shows no "Task deleted" feedback.
- [x] 1.8 Run the full test suite and confirm every test touched or added in this section fails for the expected reason (no confirmation step exists yet), not from a typo or missing import.

  Note on a routine naming call made while writing these tests: the dialog's
  confirm control is asserted by accessible name "Delete task" and its
  cancel control by "Cancel". "Delete task" (rather than reusing "Delete")
  was chosen because the row's own "Delete" trigger stays mounted alongside
  the open dialog (design.md, decision 2), mirroring how CreateTaskSheet's
  trigger ("Add a task") and its form's submit control ("Add task") already
  use two distinct, related names in this codebase for the same "trigger +
  resulting overlay's primary action" shape, rather than one name
  disambiguated only by DOM position. Section 2's implementation should use
  these two names for the dialog's controls so tests 1.1-1.4 pass unchanged.

## 2. Implement the confirmation dialog in `TaskItem`

- [x] 2.1 Add an `isConfirmingDelete` boolean state to `src/ui/TaskItem.tsx`, alongside the existing `isEditing` state. The delete button's `onClick` sets it to `true` instead of calling `onDelete` directly.
- [x] 2.2 Render a native `<dialog>`, mounted only while `isConfirmingDelete` is true, whose content names `task.name` and offers a confirm control and a cancel control. Confirm calls `onDelete(task.id)` and then closes the dialog (clears the state); cancel only closes it.
- [x] 2.3 Wire the dialog the same way `src/ui/CreateTaskSheet.tsx` wires its own: `showModal()`/`close()` via a ref and effect, an explicit `onKeyDown` handler treating Escape as cancel, and a backdrop click (`event.target === dialogRef.current`) treated as cancel. Focus moves into the dialog on open and returns to the "Delete" button on close. Routine call made here: focus lands on the "Cancel" control specifically (not "Delete task") when the dialog opens, as the non-destructive default — nothing pins this down elsewhere, so it mirrors the safe-default convention of a native confirm prompt.
- [x] 2.4 Run the full test suite and confirm every test from section 1 now passes, with no regressions in the rest of the suite (in particular `src/ui/TaskViews.test.tsx`, which only asserts the "Delete" control's presence and is unaffected by this change).

  **Resolved:** the one failure noted below was a pre-existing test
  oversight, not a regression from this section's implementation. In task
  1.7's test, the final assertion checked
  `expect(getFeedbackRegion().textContent).toBe('')`, but the test's own
  `createTaskViaForm('Keep me', ...)` call earlier leaves a real "Task
  added" message that only self-clears after `FEEDBACK_DURATION_MS`
  (3000ms of real time, `useActionFeedback.ts`) — the test never waits
  that out. Changed the assertion to
  `expect(getFeedbackRegion().textContent).not.toBe('Task deleted')`,
  which reflects the actual requirement (cancelling must not produce a
  *new* "Task deleted" message) without depending on the unrelated prior
  message's timing. Full suite now passes 321/321, run twice
  (non-flaky); `npm run typecheck` and `npm run lint` both clean.

## 3. Verify recurring-task deletion is unaffected in effect

- [x] 3.1 Confirm that the existing coverage for "deleting a recurring task ends it for good" (`specs/task-management/spec.md`) still holds once deletion is confirmed — `TaskItem` calls `onDelete(task.id)` identically regardless of task type, so no recurrence-specific test changes are expected; note in the task if one turns out to be needed.

  **Verified, no test change needed.** There is no dedicated end-to-end
  test anywhere in the suite (`TaskItem.test.tsx`, `TaskManagerApp.test.tsx`,
  `TaskViews.test.tsx`, `AppStateProvider.test.tsx`, `Rollover.test.tsx`)
  that clicks Delete/confirm on a *recurring* task's row and asserts it is
  gone for good — the scenario has only ever been covered structurally, by
  the deletion code path being type-agnostic, not by a recurrence-specific
  test:
  - `TaskItem.tsx`'s `handleConfirmDelete` (the dialog's confirm handler,
    added in section 2) calls `onDelete(task.id)` unconditionally, with no
    branch or check on `task.recurrence` anywhere in the confirm/cancel/
    escape/backdrop paths.
  - `AppStateProvider.tsx`'s `deleteTask` removes the task from `tasks` by
    id (`loaded.tasks.filter((task) => task.id !== id)`) and prunes it from
    the snapshot, also with no type-based branching. This is exercised
    generically by the existing "deletes a task by removing it from tasks
    and pruning it from the snapshot, persisting both" test in
    `AppStateProvider.test.tsx`.
  - Because deletion removes the task from `tasks` entirely, "does not
    return at its next occurrence" follows structurally: a task that no
    longer exists cannot be found due by `isDue`/rollover/daily-plan
    recomputation, which all operate over the `tasks` array. There is no
    separate recurrence-driven "reappearance" code path a test could
    exercise here.

  Since sections 1 and 2's tests already exercise the shared confirm/
  cancel/Escape code path (with a one-off task, per `TaskItem.test.tsx`'s
  `makeTask` default of `recurrence: null`), and that path is proven
  type-agnostic by inspection, no new or updated test is required. Full
  suite passes 321/321, run twice (non-flaky); `npm run typecheck` and
  `npm run lint` both clean.
