## Why

General-purpose task lists let work pile up without telling you what to actually do next: everything is visible, nothing is prioritized against the time you have. This change introduces a task manager whose core idea is a **bounded daily plan** — each day the app selects a short, realistic set of tasks that fits roughly one hour of work and freezes that selection, so the plan stays stable instead of shifting every time something is completed — while anything urgent still surfaces immediately.

The project is greenfield: there is no existing code, so this change defines the whole initial application.

## What Changes

- **Task model**: a task has a name, a duration, and a priority. Duration is chosen from a fixed set of nine options (5m, 10m, 15m, 20m, 30m, 45m, 1h, 1.5h, 2h) presented as buttons, not free text. Priority is one of five levels: urgent, high, medium, low, very low.
- **Task lifecycle**: tasks can be created, edited, deleted, and completed.
- **Daily plan selection**: once per day the app computes the set of tasks shown in the Today tab:
  - every urgent task is always included, and urgent tasks consume the time budget;
  - remaining tasks are considered in priority order, then oldest first, and a task is included as long as the tasks before it total less than the 60-minute budget;
  - the budget is a threshold, not a ceiling — the task that crosses 60 minutes is included, and selection stops there;
  - as a consequence, urgent tasks alone can fill or exceed the budget, in which case the Today tab shows only urgent tasks.
- **Frozen day, with a live urgent section**: the non-urgent selection is stored as a snapshot and does not change during the day — completing a task does not pull a new one in, and newly created non-urgent tasks are only eligible the next day. Urgent tasks are the exception: a task that becomes urgent enters the Today tab immediately. Nothing is evicted to make room, so the day's total can grow past the budget.
  - The resulting invariant: **Today shows every pending urgent task, plus the frozen non-urgent selection computed at the start of the day.**
- **Day rollover**: the snapshot is recomputed lazily when the app is opened or returns to the foreground and the stored date is no longer today. A manual **Recalculate today** action lets the user rebuild the snapshot on demand.
- **Three tabs**: Today (the daily plan, grouped by priority level, empty groups hidden), All (every pending task), and Completed (every finished task).
- **Completion behavior**: completing a task from Today leaves it visible but struck through until the day is recalculated; completing a task from All removes it from that tab. In both cases the task appears in Completed.
- **Offline-first PWA**: the application is installable and works without a network connection; all data is stored locally on the device.

The 60-minute budget is a fixed constant in this change. Making it user-configurable is explicitly deferred.

## Capabilities

### New Capabilities

- `task-management`: the task entity and its lifecycle — the fixed duration options, the five priority levels, and creating, editing, deleting, and completing tasks.
- `daily-plan`: the Today selection algorithm, the frozen non-urgent snapshot, immediate admission of urgent tasks, day rollover on foreground, and manual recalculation.
- `task-views`: the three tabs and what each one shows, including priority grouping, ordering by priority then creation date, hidden empty groups, and how completed tasks are rendered in each tab.
- `offline-storage`: local persistence of tasks and the daily snapshot, and PWA installability and offline operation.

### Modified Capabilities

None — this is the initial change and no specs exist yet.

## Impact

- **New codebase**: the repository currently contains only `openspec/`. This change establishes the application source, build tooling, and PWA assets (manifest and service worker).
- **Test surface**: the selection algorithm is the risk concentration of this change — urgent-only days, budget overshoot, live urgent admission, and day rollover are all edge cases that must be covered as pure logic, not only through the UI. Day rollover additionally requires the clock to be injectable so tests can cross midnight without waiting.
- **Storage**: introduces a local persistence layer holding two record types — tasks and the current day snapshot.
- **Platform**: browser-based PWA. Day rollover depends on the device clock and on foreground/visibility events rather than any background process, since a PWA has no guaranteed execution at midnight.
- **Deferred**: configurable time budget, due dates, recurring tasks, multi-device sync, and any notion of a calendar date attached to a task.
