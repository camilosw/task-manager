## Context

See proposal.md — Why. This section records only the existing structure the design has to fit into.

Three facts about the current code shape the decisions below.

**Ordering is currently derived from `createdAt` in one comparator.** `compareForSelection` in `src/domain/dailyPlan.ts` sorts by priority, then by creation timestamp, and it is used twice: by `selectDailyPlan` to walk candidates for the plan, and by `TaskManagerApp` to order the All tab. `TodayTab` sorts each group by `createdAt` separately. Changing the tiebreaker therefore touches one shared comparator plus one inline sort.

**The original design states the opposite of what this change needs.** `add-task-manager-app` design.md, decision 8 lists "the ordering of every list" as derived and never stored, and `repositoryContract.ts` repeats it. Decision 1 below reconciles this rather than silently contradicting it.

**`redesign-ui` has been archived, so its `action-feedback` and `appearance` capabilities are now part of `openspec/specs/`.** That archive left "Ordering within a list" and "Task attributes" — the two requirements this change modifies — untouched, so the deltas here are written against their current text. It also makes `action-feedback` available to write against, which is what decision 8 depends on.

## Goals / Non-Goals

**Goals:**

- Keep the reordering operation a pure function over tasks, so the arithmetic that decides an order is unit-testable with no rendering and no clock.
- Preserve, exactly, the order every existing user currently sees. A user who never drags anything must not notice this change.
- Keep one source of truth for the order, consumed identically by the plan's selection, the All tab, and the Today tab.

**Non-Goals:**

- No change to how the snapshot records membership. `plannedIds`/`admittedIds` and their id-not-value semantics are untouched; this change only alters the order in which candidates are walked when a snapshot is computed.
- No rebalancing scheme, no fractional ranks, no ordering that needs periodic repair.
- No abstraction over the drag library. It is used directly in the one component that needs it.

## Decisions

### 1. The place in the order is a task attribute, not stored presentation

`Task` gains a numeric `place`. Ordering stays derived — `(priority, place)` is computed on every render, never stored as a list — but the *input* to that derivation is now a persisted field rather than a timestamp.

This refines, rather than contradicts, `add-task-manager-app` decision 8. That decision's target was a second source of truth: a stored list of ids that could disagree with the tasks themselves about what exists or what priority it has. A scalar on the task cannot disagree with the task. Every hazard decision 8 named — grouping, hidden empty groups, which tab shows a task, empty states — stays derived.

**Alternative rejected — a separate ordered id list, like `snapshot.plannedIds`.** This is exactly the second source of truth decision 8 warns about, and it would need the same stale-id filtering and pruning machinery the snapshot already carries, for no benefit. A task's position is a property of the task; the snapshot's membership genuinely is not.

**Alternative rejected — keep `createdAt` as the order and layer an override list on top.** Two orderings that must be reconciled on every read, and no answer for a task present in one and absent from the other.

### 2. One global sequence of dense integers, permuted within a priority level

`place` is a single sequence spanning every task, not a per-level counter. Display and selection sort by `(priority, place)`; `place` is only ever compared, never interpreted.

A reordering **permutes the places already held by that level's tasks**. It does not renumber globally.

```
   medium holds places {3, 7, 12}:   M1=3   M2=7   M3=12
   user moves M3 to the front    →   order M3, M1, M2
   the same places, reassigned   →   M3=3   M1=7   M2=12
```

Every other level's places are untouched, so the global sequence stays a permutation of itself and no other group's displayed order can shift as a side effect.

**Why global rather than per-level.** A task that changes priority must land among its new peers *by age* when nobody has reordered them — `task-views` requires "priority then age", and demoting a task to the bottom of its new level would break it. With a global sequence the task simply carries its place across and lands correctly, with no rule for priority changes at all. Per-level counters would need one, and any such rule ("append to the new level") contradicts that requirement.

**Why dense integers rather than fractional ranks.** The usual argument for fractional ranks is avoiding neighbor rewrites, and it does not apply here: `Repository.saveTasks` replaces the whole task list on every write regardless, so rewriting a few places costs nothing. Fractional ranks would add precision drift and a rebalancing path to maintain, for zero saving.

**Alternative rejected — renumber `0..n` across the whole list after each move**, which is what `groceries` does with its flat list. Applied here it would renumber by *display* order, collapsing `place` into priority order — and then a `low` task promoted to `high` lands last among the high tasks, breaking "priority then age". Permuting within the level is the same idea scoped correctly.

### 3. Reordering is a pure domain function

```ts
reorderWithinPriority(tasks: Task[], activeId: string, overId: string): Task[]
```

Lives in `src/domain/` beside the other domain modules. Takes no clock — a reordering has no time component — and returns a new task list. It is a no-op returning the input when either id is unknown, when they are equal, or when the two tasks' priorities differ.

That last case is the load-bearing one: it is what makes "a drop outside the group is rejected" a domain guarantee rather than a UI courtesy, so no interaction bug can smuggle a cross-level move past it.

### 4. The tiebreaker changes in one comparator

`compareForSelection` swaps `a.createdAt.getTime() - b.createdAt.getTime()` for `a.place - b.place`. Because it is already shared by `selectDailyPlan` and the All tab, that single edit covers both the plan's selection order and the All tab's order. `TodayTab`'s per-group inline sort switches to `place` for the same reason.

`createdAt` remains on the task and remains immutable — it is still the record of when the task was made — but it stops being an ordering input anywhere.

### 5. Persisted versus derived, restated

Persisted: tasks with all their fields, `place` now among them, and the snapshot. Nothing else.

Derived on every render, never stored: the grouping of both All and Today by priority, hidden empty groups, the sequence of every list, which tabs show a task, and every empty state. The sequence is derived *from* `place`; the sequence itself is never written down.

The snapshot is unchanged. It still holds ids, not copied values, so a reordering — which changes no id — cannot invalidate it. This is why reordering leaves the day's membership alone with no extra guard: there is nothing in the snapshot for a reordering to touch.

### 6. `@dnd-kit` for the gesture, reversing `redesign-ui`'s no-dependency line

`@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities`. This is a deliberate reversal of the "no new runtime dependency" constraint `redesign-ui` held, and of its explicit deferral of "reordering by drag".

The reversal is grounded rather than a preference: the same three packages, on the same React 19 + Vite + PWA stack, already carry the reordering in this author's `groceries` app, including the sensor configuration that resolves the hard part on touch:

| Sensor | Constraint | What it buys |
| --- | --- | --- |
| `PointerSensor` | `distance: 8` | a mouse drag starts only after real movement, so a click still reads as a click |
| `TouchSensor` | `delay: 250, tolerance: 5` | a press must be held before it becomes a drag, so vertical scrolling on a phone still scrolls |

**Alternative rejected — hand-rolled Pointer Events.** The touch case is where this gets expensive: press-vs-scroll disambiguation, autoscroll near the viewport edges, and a keyboard path all have to be written and tuned. Reimplementing a solved, already-validated configuration is not a good use of the budget.

**Alternative rejected — HTML5 drag and drop.** It does not fire on touch, which rules it out for a mobile-first PWA.

**Alternative rejected — move-up/move-down buttons only, no drag.** This is the accessible path (decision 7) and it would satisfy the ordering requirements, but the proposal asks for dragging and two buttons on every row cost more space than one handle.

### 7. One `SortableContext` per priority group, with a guard on the drop

A single `DndContext` wraps the All tab; each priority group renders its own `SortableContext` over that group's ids with `verticalListSortingStrategy`. The drag handle is a small dedicated element carrying the sortable listeners, so the drag starts only from it and never competes with the row's checkbox, edit, or delete controls.

Grouped contexts are where this departs from `groceries`, which has one flat list. dnd-kit will still report an `over` target belonging to a different group, so `onDragEnd` must compare the two tasks' priorities and do nothing when they differ. Since `reorderWithinPriority` refuses the same case (decision 3), the guard is defence in depth and the handler stays a thin translation from `{active, over}` to a domain call.

`KeyboardSensor` with `sortableKeyboardCoordinates` is registered alongside the pointer sensors, and dnd-kit's screen-reader announcements are enabled. `groceries` has neither; the accessibility requirement in `task-views` is where this implementation deliberately exceeds the one it borrows from, and the cost is a few lines because the library ships both.

### 8. Reordering produces no transient confirmation

The `action-feedback` capability enumerates four actions that show a message. Reordering is deliberately not a fifth: the task visibly moving *is* the feedback, a toast on every drag would be noise during a run of adjustments, and the keyboard path already announces each move through dnd-kit's live region — an announcement aimed at assistive technology, which is a different channel from the visible confirmation and is unaffected by this exclusion.

Because that requirement is titled "A confirmation follows every completed action" while its table lists exactly four, adding a fifth action without touching it would leave the title reading as though it covered reordering. The `action-feedback` delta therefore closes the list explicitly rather than relying on the table's silence, and adds the rejected and abandoned drags to it: neither shows a confirmation, and neither shows a validation message either, since nothing was rejected that the user needs to correct.

**Alternative rejected — a "Task moved" confirmation for symmetry with the other four.** The other four all report a change that is either invisible (a deletion removes the evidence) or easy to miss (a completion is a strikethrough, a recalculation may not alter anything on screen). A reordering is the opposite: the movement is the largest visible event on the page, and it is the one action a user performs repeatedly in a burst.

### 9. The upgrade runs once, in an IndexedDB version bump

`DB_VERSION` goes from 1 to 2. The `onupgradeneeded` handler reads every stored task, sorts by `createdAt` ascending, and writes back `place = 0, 1, 2, …` in that order.

**Sorting by `createdAt` alone is the whole point, and sorting by `(priority, createdAt)` would be a bug.** Both reproduce today's displayed order on the spot, because display sorts by priority first either way. They diverge later: with places assigned by priority-then-age, a `low` task promoted to `high` carries a place derived from its old priority and lands at the bottom of the high group, breaking "priority then age" for every task the user ever re-prioritises. Pure creation order makes `(priority, place)` exactly equivalent to today's `(priority, createdAt)` until the first drag.

A fresh install opens straight at version 2 with empty stores, so the handler finds nothing and does nothing. The snapshot store is not read or written by the upgrade — membership is untouched.

**Alternative rejected — coerce on read in `loadAll`**, defaulting a missing place to the task's index, which is the pattern `groceries` uses in its `storage.ts`. It suits `groceries`, which parses one JSON blob per read, but here it would leave migration logic on the hot read path permanently, re-deciding on every load whether data is old. A version bump runs once, atomically, and the repository contract suite already names "upgrade path" as something it covers.

### 10. Testing, routed to the existing tiers

| Behavior | Tier |
| --- | --- |
| `reorderWithinPriority`: moves, no-ops, cross-level refusal, places permuted within the level | Unit |
| `compareForSelection` and the grouping projections under the new tiebreaker | Unit |
| Every worked example in the `daily-plan` delta, including the eviction trace and the urgent-invariance trace | Unit, one test per example |
| The version-2 upgrade, and that a second open changes nothing further | Contract, against both repository implementations |
| A reordering re-sequencing Today without changing its membership; a reordering surviving a reload; the All tab's grouping | Integration |
| That a completed, rejected, or abandoned reordering shows no confirmation, and does not clear one already on screen | Integration |
| The pointer and touch drag gestures themselves | **Manual** |

The last row joins installability and true offline operation in `design.md`'s "What is not automated". jsdom does not produce the pointer and touch event sequences dnd-kit's sensors need, so a green suite would say nothing about whether a drag works on a phone. The keyboard path *is* automatable and is covered under Integration, which means the ordering behavior is verified end to end even though one of its two input methods is not — `tasks.md` records the manual check for the gesture rather than implying the suite covers it.

## Risks / Trade-offs

- **The upgrade is the one irreversible step** → Assigning places wrongly silently reshuffles a user's list, and there is no backup because local data is the only copy. Mitigated by keeping the upgrade trivial (sort by one immutable field, write an index) and by covering it in the contract suite against both implementations. Not eliminated.
- **The frozen day feels more broken than before** → `add-task-manager-app` already lists this risk for created tasks; dragging makes it sharper, because the user has just performed a deliberate, physical act and Today does not move. The existing "Recalculate today" escape hatch is the mitigation, and it already sits directly below the Today groups. Watch for whether the gap needs a nudge in copy; deliberately not solved here.
- **The task row is getting crowded** → checkbox, name, duration, priority, edit, delete, and now a handle, on a mobile-first surface. Mitigated by making the handle a compact grip glyph rather than a labelled control, and by it appearing only in the All tab, where reordering is the point. If the row proves too tight, the fallback is a dedicated arrange mode — the shape `groceries` chose — which was considered and set aside in favour of reordering in place.
- **Two open instances still overwrite each other** → Unchanged from the original design, but a reordering is a whole-list write, so a stale second tab now clobbers an order as well as a task set. No new mitigation; noted because the blast radius grew.
- **A dependency on a drag library is a dependency forever** → Three packages, used in one component, behind a domain function that knows nothing about them. If dnd-kit ever has to go, the ordering behavior and all its tests survive; only the handler wiring is rewritten.

## Migration Plan

1. Ship `place` on `Task` and the version-2 upgrade together. There is no intermediate state in which a task can lack a place once read.
2. On first open after the update, the upgrade assigns places by creation order. Nothing in the UI changes: every list shows exactly what it showed before, and the stored plan is untouched.
3. Rollback is a code revert. Version-2 data read by version-1 code is not a scenario IndexedDB permits — a database at version 2 refuses to open at version 1 — so a revert after users have upgraded requires shipping a forward fix rather than an actual downgrade. This is the standard cost of a version bump and is accepted; it is the reason the upgrade is kept to sorting on one immutable field.
