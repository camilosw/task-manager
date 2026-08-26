## Context

`TaskItem` (`src/ui/TaskItem.tsx`) renders each row's delete control and today calls `onDelete(task.id)` directly from the button's `onClick`, with no intermediate state. The row already holds one piece of local UI state of this shape — `isEditing`, which swaps the row for an inline `TaskForm` — so there is precedent in this component for a second, similarly-scoped boolean.

Separately, `CreateTaskSheet` (`src/ui/CreateTaskSheet.tsx`) already established this project's pattern for a modal surface: a native `<dialog>`, opened with `showModal()`, with focus-into-dialog-on-open and focus-back-to-trigger-on-close handled explicitly in React (not left to the browser), and Escape handled via an explicit `onKeyDown` rather than the native `cancel` event. `vitest.setup.ts` shims `HTMLDialogElement.prototype.showModal`/`close` globally (to a plain `open`-property toggle) precisely so this pattern is testable in jsdom — the shim is not scoped to `CreateTaskSheet` and applies to any `<dialog>` the app renders.

See proposal.md for why a confirmation step is being added; this document only covers how.

## Goals / Non-Goals

**Goals:**
- Reuse the existing native-`<dialog>` pattern for the confirmation, rather than introducing a second modal mechanism.
- Keep the confirmation scoped to the row being deleted, consistent with how editing is already row-local state.
- Change nothing about what happens once a deletion is confirmed — the existing `onDelete` call, feedback message, and daily-plan effects are untouched.

**Non-Goals:**
- No general-purpose confirmation-dialog abstraction for other destructive actions (there are none today). If a second use case appears later, extracting one is a separate change.
- No changes to `AppStateProvider.deleteTask` or the daily-plan/storage layers — this is a UI-only gate in front of an unchanged call.

## Decisions

### 1. The confirmation is a native `<dialog>`, following the `CreateTaskSheet` pattern

Same rationale as that decision: `<dialog>` gives the top layer, backdrop, and background inertness for free, with no focus-trap library, and the existing global jsdom shim already makes it testable without new test infrastructure.

Alternatives considered:
- **`window.confirm()`** — rejected. It cannot be styled to match the app, its accessible presentation is inconsistent across browsers, and — more concretely for this codebase — it is a synchronous global call that the existing jsdom environment does not model the way it models `<dialog>`, so exercising confirm/cancel in tests would mean mocking `window.confirm` instead of reusing the pattern already proven out for `CreateTaskSheet`.
- **A hand-rolled `div role="dialog" aria-modal="true"` with a focus trap** — rejected for the same reason it was rejected for `CreateTaskSheet`: it reimplements platform behavior (top-layer stacking, inertness) that is easy to get subtly wrong.

### 2. Confirmation state is local to `TaskItem`, mirroring `isEditing`

A new `isConfirmingDelete` boolean sits alongside `isEditing` in `TaskItem`'s local state. Activating the delete control sets it instead of calling `onDelete` directly; the dialog's confirm action calls `onDelete(task.id)` and clears the flag, its cancel action (and Escape, and a backdrop click) only clears the flag.

Alternative considered:
- **A single confirmation dialog hoisted to `TaskList`/`TaskManagerApp`, tracking the pending task's id** — rejected. It would need to carry the task's display name up separately (or look it up by id) purely to render the dialog's copy, adding a layer of plumbing for no behavioral difference. Row-local state keeps the confirmation next to the control that triggers it, the same way `isEditing` already does, and each row's dialog is only ever mounted while that row is confirming.

### 3. The dialog names the task and offers exactly two controls: confirm and cancel

The dialog's copy includes `task.name`, so the user is confirming a specific, named task rather than a generic "are you sure?". The two controls are the only interactive elements in the dialog (no "don't ask again" — see proposal.md's deferred list).

## Risks / Trade-offs

- **Extra click for every deletion** → accepted; this is the point of the change (see proposal.md - Why). No "don't ask again" escape hatch is being added in this change.
- **Row-local dialog means N possible dialogs, one per row, versus one hoisted dialog** → not a real cost here: only one is ever mounted/open at a time (mirroring `isEditing`, which already has the same shape), and mounting the dialog only while `isConfirmingDelete` is true keeps the other rows unaffected.
