## Why

Within a priority level, the order of tasks is currently dictated by their creation timestamp, and the user has no say in it. That order is not merely cosmetic: it is the order the daily plan's selection walks, so when the 60-minute budget runs out partway through a priority level, which tasks make it into Today is decided by which ones happened to be typed in first. A user who knows that one of three medium tasks matters most today has no way to express it short of promoting it to a higher priority level, which overstates the case and distorts every future day.

Letting the user arrange tasks within a priority level gives them the missing control, and because the selection already walks that order, the control lands exactly where it matters — on which work the day surfaces.

## What Changes

- A task gains a **manual position**: an ordering the user sets, which replaces the creation timestamp as the tiebreaker between two tasks of the same priority. Creation time is still recorded, but it no longer determines display or selection order.
- The **All tab groups its tasks by priority level**, the way the Today tab already does, instead of presenting one flat list. The grouping makes the boundary of a reordering visible, since a task can only be moved within its own group.
- Within an All tab group, a task can be **dragged to a new position**. The new position is persisted immediately and survives a restart.
- **Dragging never changes a task's priority.** A task cannot be dragged out of its group; changing a priority level remains an edit, not a drag.
- The daily plan's selection walks the manual order, so **reordering changes which tasks the next plan contains**. Because the budget is a threshold crossed once, moving a task up a group can push a longer one below the cut. Urgent tasks are unaffected: they are already selected unconditionally, and no non-urgent task can be dragged above them.
- **Reordering does not disturb the plan already on screen.** Today's membership continues to change only on a day rollover, on "Recalculate today", and when a task becomes or stops being urgent. A reordering takes effect on the next of those.
- Today's priority groups display their tasks in the manual order too. Membership stays frozen; only the sequence within a group reflects a reordering, so the two tabs never disagree about the order of the same tasks.
- Reordering is reachable **without a pointer drag**, so the ordering is not available only to users who can perform a drag gesture.
- Tasks stored by an earlier version, which carry no manual position, are given one on upgrade such that their **existing relative order is preserved** — an upgrade reshuffles nothing.

### Deliberately out of scope

- **No reordering in the Today or Completed tabs.** All is the single place an order is set. Today reflects it; Completed keeps its most-recently-completed-first order, which is not a manual sequence.
- **No dragging across priority groups**, and therefore no way to change a priority by dragging.
- **No immediate re-selection of the day.** Dragging deliberately does not recompute the plan, add a task to Today, or evict one on the spot. There is no new "apply this order now" action beyond the existing "Recalculate today".
- **No change to the selection algorithm's rule or to the 60-minute budget.** The budget stays a fixed threshold crossed once, not a ceiling, and no shorter task is ever substituted for an excluded one. Only the order the algorithm walks changes.
- **No manual ordering of completed tasks**, and no reordering of the priority levels themselves.
- **No cross-device ordering.** The manual order is device-local, like all other data.

## Capabilities

### New Capabilities

None. Manual ordering is expressed by extending the capabilities that already own task attributes, list ordering, plan selection, and persistence, rather than by introducing a capability that would overlap all four.

### Modified Capabilities

- `task-management`: a task gains a manual position among its peers as an attribute; reordering becomes an operation on a task alongside creating, editing, deleting, and completing; and the rules for what position a newly created task takes, and what happens to a position when a task's priority changes, are specified.
- `task-views`: the All tab groups by priority instead of listing flat, and is the surface where a task is reordered; ordering within a group in both the All and Today tabs becomes the manual order rather than the creation timestamp; and the reordering must be operable without a drag gesture.
- `daily-plan`: the selection algorithm's within-priority ordering changes from oldest-first to the manual order, which makes the plan's composition depend on it; and the fact that a reordering does not alter the plan already computed is pinned explicitly.
- `action-feedback`: the list of actions that produce a transient confirmation is closed explicitly, and reordering is recorded as deliberately absent from it, so "every completed action" no longer reads as though it covers a reordering.
- `offline-storage`: the manual order is part of what persists on the device and survives a restart, and data written before this change is upgraded without altering the order the user currently sees.

## Impact

- The task record gains a field, which every persisted task carries. Stored data from earlier versions must be upgraded on read or on open; the upgrade is the one place where getting the order wrong would silently reshuffle a user's list.
- The domain's ordering comparator, used both by the daily plan's selection and by the All tab, changes its tiebreaker. Every existing worked example in the daily-plan spec keeps its result only because a fresh install's manual order matches creation order.
- The All tab's rendering changes shape from a flat list to grouped sections, which is the structure the Today tab already uses — a candidate for shared rendering rather than a second implementation.
- The task row gains a drag affordance alongside its existing checkbox, duration, priority, edit and delete elements, on a mobile-first surface where row space is already tight.
- This change introduces the project's first runtime dependency beyond React, for the drag interaction. The redesign-ui change deferred reordering by drag explicitly and held a no-new-dependency line; this change is where that deferral is taken up, and the dependency is a deliberate reversal to be recorded in design rather than assumed.
- The drag gesture itself cannot be exercised in the existing test environment, which places it alongside installability and true offline operation in the small set of behaviors verified by hand.
