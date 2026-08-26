## Why

Deletion is currently immediate: activating a task row's delete control removes the task with no intermediate step. A single misclick or an accidental tap destroys a task with no way to undo it, since the application has no undo mechanism. Asking for confirmation before the delete takes effect closes that gap.

## What Changes

- **BREAKING**: Activating a task row's delete control no longer deletes the task immediately. It opens a confirmation step that names the task and asks the user to confirm or cancel.
- Confirming proceeds with the deletion exactly as it behaves today (task disappears from every tab, is not counted in any daily plan, and the existing "Task deleted" feedback is shown).
- Cancelling (including via keyboard escape or dismissing the confirmation) leaves the task untouched, with no feedback message and no other side effect.
- The confirmation step is reachable and operable from the keyboard, matching the accessibility bar the rest of task management holds itself to.
- Applies uniformly to every tab that offers a delete control (Today, All, Completed) and to both one-off and recurring tasks — deleting a recurring task still ends it for good once confirmed.

Deferred / out of scope:
- No "don't ask me again" or per-user setting to disable the confirmation — it always appears.
- No undo-after-delete mechanism; confirmation is the only safeguard this change adds.
- No change to what happens after a confirmed deletion (feedback message, daily-plan recomputation) — only the immediacy of the delete action itself changes.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `task-management`: the "Editing and deleting are named controls on every task row" requirement changes from immediate, unconfirmed deletion to deletion gated behind a confirmation step.

## Impact

- Affected UI: the task row's delete control and the component that currently calls the delete handler directly on click.
- No changes to storage, domain logic, or the daily-plan selection algorithm — a confirmed deletion behaves exactly as today's deletion does.
