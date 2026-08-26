## 1. Update existing tests for confirmation-gated deletion (red)

- [ ] 1.1 In `src/ui/TaskItem.test.tsx`, replace the `'deletes the task immediately, with no confirmation step'` test (in the `'edit and delete controls on a task row'` describe block) with a test asserting that clicking the "Delete" control presents a dialog naming the task and does **not** call `onDelete` yet.
- [ ] 1.2 In the same file, add a test asserting that activating the dialog's confirm control calls `onDelete('t1')` and closes the dialog.
- [ ] 1.3 In the same file, add a test asserting that activating the dialog's cancel control leaves `onDelete` uncalled, closes the dialog, and leaves the row unchanged.
- [ ] 1.4 In the same file, add a test asserting that pressing Escape while the dialog is open behaves like cancel (`onDelete` uncalled, dialog closes).
- [ ] 1.5 In `src/ui/TaskManagerApp.test.tsx`, update `'removes the task from the list and pulls no replacement into view'` (describe `'deleting a task (8.4)'`) to activate the dialog's confirm control after clicking "Delete", before asserting the task is gone.
- [ ] 1.6 In the same file, update `'shows "Task deleted" after deleting a task'` the same way: confirm after clicking "Delete", before asserting the feedback message.
- [ ] 1.7 In the same file, add a test asserting that cancelling the confirmation leaves the task visible in the list and shows no "Task deleted" feedback.
- [ ] 1.8 Run the full test suite and confirm every test touched or added in this section fails for the expected reason (no confirmation step exists yet), not from a typo or missing import.

## 2. Implement the confirmation dialog in `TaskItem`

- [ ] 2.1 Add an `isConfirmingDelete` boolean state to `src/ui/TaskItem.tsx`, alongside the existing `isEditing` state. The delete button's `onClick` sets it to `true` instead of calling `onDelete` directly.
- [ ] 2.2 Render a native `<dialog>`, mounted only while `isConfirmingDelete` is true, whose content names `task.name` and offers a confirm control and a cancel control. Confirm calls `onDelete(task.id)` and then closes the dialog (clears the state); cancel only closes it.
- [ ] 2.3 Wire the dialog the same way `src/ui/CreateTaskSheet.tsx` wires its own: `showModal()`/`close()` via a ref and effect, an explicit `onKeyDown` handler treating Escape as cancel, and a backdrop click (`event.target === dialogRef.current`) treated as cancel. Focus moves into the dialog on open and returns to the "Delete" button on close.
- [ ] 2.4 Run the full test suite and confirm every test from section 1 now passes, with no regressions in the rest of the suite (in particular `src/ui/TaskViews.test.tsx`, which only asserts the "Delete" control's presence and is unaffected by this change).

## 3. Verify recurring-task deletion is unaffected in effect

- [ ] 3.1 Confirm that the existing coverage for "deleting a recurring task ends it for good" (`specs/task-management/spec.md`) still holds once deletion is confirmed — `TaskItem` calls `onDelete(task.id)` identically regardless of task type, so no recurrence-specific test changes are expected; note in the task if one turns out to be needed.
