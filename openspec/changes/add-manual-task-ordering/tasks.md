## 1. Dependencies

- [ ] 1.1 Add `@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities` as runtime dependencies, and confirm the existing suite, lint, and build all stay green with them installed but unused
- [ ] 1.2 Verify the import-boundary lint rule still fails on a deliberate `@dnd-kit` import from `src/domain/`, then revert the violation — the drag library must never reach the domain layer

## 2. Domain — the place attribute

- [ ] 2.1 Write a failing test that a task carries a `place` and that `createTask` records the place it is given, the way it already records the id, then add `place` to `Task` and `CreateTaskInput`
- [ ] 2.2 Write a failing test that `nextPlace` returns one past the highest existing place, and returns the first place for an empty task list, then implement it
- [ ] 2.3 Write a failing test that `editTask` preserves the place, including when the edit changes the priority, then confirm or implement it
- [ ] 2.4 Write a failing test that `completeTask` preserves the place, so a completed task keeps its position rather than moving

## 3. Domain — ordering

- [ ] 3.1 Write a failing test pinning both "Ordering within the selection" scenarios — same-priority tasks are considered by place, never by duration, and the place overrides age when the two disagree — then change `compareForSelection` to break ties on `place` instead of `createdAt`
- [ ] 3.2 Add the "All tab orders by priority then age" example as a test, with places matching creation order, to pin that a user who has never reordered sees exactly what they saw before; if it passes without a code change, confirm it can fail before moving on
- [ ] 3.3 Write a failing test for the six-task worked example — moving M3 above M1 leaves the medium tasks holding places 2, 3 and 4 in the order M3, M1, M2, with H1, H2 and L1 unmoved — then implement `reorderWithinPriority`
- [ ] 3.4 Write a failing test that `reorderWithinPriority` returns the input unchanged for an unknown id, for two equal ids, and for two tasks of different priorities, then extend it — the last case is what makes a rejected cross-group drop a domain guarantee
- [ ] 3.5 Write a failing test that reordering one priority level leaves the order of every other level untouched, and changes no task's priority
- [ ] 3.6 Write a failing test for both promoted-task scenarios — a task edited to a new priority keeps its place and lands among its new peers by that place, whether or not those peers have been reordered; if it passes on the strength of 2.3, confirm it can fail before moving on

## 4. Domain — the daily plan under the new order

- [ ] 4.1 Write a failing test for the eviction trace: the plan is H1, M1, M2 at 75 minutes, and after M3 is moved above M1 the next computation yields H1, M3, M1 at 65 minutes with M2 excluded while still pending
- [ ] 4.2 Write a failing test that urgent tasks are invariant under reordering — U1, U2 and U3 all enter in any arrangement, the running total after them is 75 in every one, and H1 is excluded at 10 minutes
- [ ] 4.3 Write a failing test that reordering a level wholly inside the plan changes neither its composition nor its planned total, using the H1/H2/M1 example that reaches 65 either way
- [ ] 4.4 Write a failing test that reordering a level wholly outside the plan changes nothing, using the low level reached at a running total of 65
- [ ] 4.5 Re-run the three pre-existing selection examples — the overshoot, the exact boundary, and the urgent-only day — with places matching creation order, confirming each still produces its documented result

## 5. Persistence — round-trip and upgrade

- [ ] 5.1 Extend the shared contract suite with a failing test that `place` round-trips through a save and load, then implement it in both the in-memory and IndexedDB repositories
- [ ] 5.2 Write a failing contract test that tasks stored without a place are given places in creation order on first read, so the All tab shows the same B, E, C, A, D order it showed before, then implement the version-2 `onupgradeneeded` and bump `DB_VERSION`
- [ ] 5.3 Write a failing contract test that the upgrade sorts on `createdAt` alone and not on priority-then-age, by upgrading a fixture whose oldest task has the lowest priority and then promoting it, asserting it lands first among its new peers
- [ ] 5.4 Write a failing contract test that reopening after the upgrade leaves the places untouched, and that data already carrying places is never reassigned
- [ ] 5.5 Write a failing contract test that the upgrade neither reads nor writes the snapshot store, and that opening at version 2 with empty stores is a no-op

## 6. Application state

- [ ] 6.1 Write a failing provider test that a newly created task is assigned `nextPlace` over the current tasks, so it appears last among its priority level, then wire it into `createTask`
- [ ] 6.2 Write a failing provider test that a reorder action passes through `reorderWithinPriority` and persists the whole task list afterwards, then add the action to the reducer and the context
- [ ] 6.3 Write a failing provider test that a reorder leaves the snapshot untouched and writes no snapshot, so the day's membership cannot change as a side effect

## 7. UI — the All tab becomes grouped

- [ ] 7.1 Extract `TodayTab`'s priority-group rendering — heading, colour marker, hidden empty groups — into a component both tabs use, with a test pinning that the Today tab's output is unchanged by the extraction
- [ ] 7.2 Write a failing test that the All tab renders its pending tasks under priority headings in the fixed order, omits a heading for a level with no pending tasks, and still shows its empty state with no headings when nothing is pending, then render it through the shared component
- [ ] 7.3 Write a failing test that tasks within an All tab group appear in place order, and that a reordering is reflected there

## 8. UI — the drag and its keyboard equivalent

- [ ] 8.1 Write a failing test that every pending row in the All tab exposes a reordering control carrying an accessible name, then add the drag handle as a dedicated element so the drag starts only from it
- [ ] 8.2 Wire a single `DndContext` over the All tab with one `SortableContext` per priority group, registering `PointerSensor` at `distance: 8` and `TouchSensor` at `delay: 250, tolerance: 5`; write a failing test that a drag end reporting two ids of the same priority reorders through the domain function
- [ ] 8.3 Write a failing test that a drag end reporting an `over` target in a different priority group changes no task's place and no task's priority
- [ ] 8.4 Write a failing test that an abandoned drag — a drag end with no `over` target — leaves every place unchanged
- [ ] 8.5 Register `KeyboardSensor` with `sortableKeyboardCoordinates` and write a failing test that a keyboard move produces the same order a drag to that position would
- [ ] 8.6 Write a failing test that a keyboard move past the last position of a priority group leaves the task at that last position with its priority unchanged
- [ ] 8.7 Enable dnd-kit's screen-reader announcements for the reordering, and write a failing test that a completed move is announced through the live region

## 9. UI — Today, Completed, and feedback

- [ ] 9.1 Write a failing test that each Today group orders its tasks by place rather than by creation timestamp
- [ ] 9.2 Write a failing test for the cross-tab scenario: with Today holding H1, M1 and M2 and a pending M3 outside the plan, moving M2 above M1 in the All tab makes Today show H1, M2, M1 while M3 stays out and nothing is removed
- [ ] 9.3 Write a failing test that moving a task not in today's plan to the first position of its group in the All tab still leaves it absent from the Today tab
- [ ] 9.4 Write a failing test that a task completed today keeps its position in the Today group's order, struck through, rather than moving
- [ ] 9.5 Write a failing test that neither the Today tab nor the Completed tab offers a reordering control, and that the Completed tab still lists most recently completed first
- [ ] 9.6 Write a failing test that a completed reordering displays no confirmation, does not replace a confirmation already on screen from an earlier action, and that a rejected or abandoned drag displays neither a confirmation nor a validation message

## 10. Verification

- [ ] 10.1 Verify by hand on a touch device that a short press-and-scroll still scrolls the All tab, that a held press begins a drag, and that dropping outside a group returns the task to its position — record the result, since jsdom cannot produce these event sequences
- [ ] 10.2 Verify by hand with a mouse that a click on a row's checkbox, edit or delete control still acts on that control rather than starting a drag
- [ ] 10.3 Verify by hand that a build installed over an existing one preserves the user's task order, by loading the previous version's data before updating
- [ ] 10.4 Run the full suite, the linter, and the formatter, and confirm `openspec validate add-manual-task-ordering --strict` still passes
