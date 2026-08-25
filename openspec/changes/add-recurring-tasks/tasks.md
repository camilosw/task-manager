## 1. Recurrence rules in the domain

- [x] 1.1 Test first in `src/domain/recurrence.test.ts`: `occursOn` returns true for a weekly rule on its named weekday and false on all six others. Pins the weekly predicate and creates the module.
- [x] 1.2 Test first: a weekly rule naming Monday and Wednesday fires on both and on nothing else. Pins that one rule produces several occurrences per week.
- [x] 1.3 Test first: a `first Monday` monthly rule fires on 3 August 2026 and 7 September 2026 and not on 10, 17, 24, or 31 August. Pins nth-weekday resolution against the spec's traced months.
- [x] 1.4 Test first: `nth: -1` resolves to 31 August 2026 (five Mondays) and 28 September 2026 (four Mondays). Pins "last" in both month shapes.
- [x] 1.5 Test first: rule validation rejects a weekly rule with no weekday, and a monthly rule missing its position or its weekday. Pins the incomplete-rule case the form relies on.
- [x] 1.6 Test first: `formatRule` renders the long form ("Repeats every Monday and Wednesday", "Repeats the first Monday of every month") and the short form ("Every Mon", "1st Mon"). Pins both strings the UI needs before any component reads them.

## 2. Due-ness in the domain

- [x] 2.1 Test first in `src/domain/recurrence.test.ts`: `lastDueDate` returns the most recent occurrence at or before a given date, never earlier than the creation date, and null when none exists. Pins the creation floor.
- [x] 2.2 Test first: `isDue` traced across the spec's cycle — due on 10 Aug, not due once completed that day, not due 11 and 16 Aug, due again 17 Aug. Pins the completion-clears-occurrence comparison.
- [x] 2.3 Test first: a task created Saturday 22 August 2026 with a weekly-Monday rule is not due 22 or 23 August and is due 24 August. Pins that an occurrence predating creation does not count.
- [x] 2.4 Test first: a task created on one of its own occurrence dates is due that same day. Pins the boundary of the creation floor.
- [x] 2.5 Test first: an occurrence missed on 24 August leaves the task due on 25 and 26 August. Pins that a missed occurrence is not lost.
- [x] 2.6 Test first: completing on 25 August leaves the task not due on 26 August and due again on 31 August. Pins the late-completion case.
- [x] 2.7 Test first: three consecutive missed Mondays yield one due task, with no count or backlog exposed. Pins non-accumulation.
- [x] 2.8 Test first: `lastDueDate` terminates and returns null for a rule that cannot fire within its search window. Pins the bounded backward walk called out in design.md, Risks.

## 3. The task record

- [x] 3.1 Test first in `src/domain/task.test.ts`: `createTask` with a rule produces a task carrying the rule, a null priority, and no recorded last completion. Pins the recurring shape.
- [x] 3.2 Test first: `createTask` rejects an input carrying both a priority and a rule, and one carrying neither. Pins the mutual exclusion.
- [x] 3.3 Test first: a recurring creation missing name, duration, and rule reports all three at once. Pins that the existing report-every-missing-field behavior extends to the rule.
- [x] 3.4 Test first: `editTask` converts one-off to recurring and back, leaving name, duration, creation timestamp, place, and last completion date untouched. Pins conversion.
- [x] 3.5 Test first: `editTask` rejects an edit that would leave a task with neither a priority nor a complete rule. Pins the invariant under editing.
- [x] 3.6 Test first: `completeTask` on a recurring task sets `completedAt` and records the local date as its last completion; on a one-off task it sets only `completedAt`. Pins the two-field model.
- [x] 3.7 Mechanical, no new behavior: widen `Task` to `priority: Priority | null` plus `recurrence` and `lastCompletedOn`, and update every call site and test factory the compiler flags. `tsc -b` passes with no behavior change. Do not add a null branch to `comparePriority` — see design.md, Risks.

## 4. Reawakening

- [x] 4.1 Test first in `src/domain/recurrence.test.ts`: `reawaken` clears `completedAt` on a recurring task that is due again while leaving its last completion date intact. Pins the reset.
- [x] 4.2 Test first: `reawaken` leaves at-rest recurring tasks and every one-off task untouched, and returns the same array reference when nothing changed. Pins the no-write common case.

## 5. Daily plan selection

- [x] 5.1 Test first in `src/domain/dailyPlan.test.ts`: `compareForSelection` orders due recurring tasks ahead of every priority level, and orders two recurring tasks by place. Pins the walk order.
- [x] 5.2 Test first: the spec's reservation table — R1 30m due, H1 45m, M1 20m, L1 10m — yields R1 and H1 with a planned total of 75. Pins that a due recurring task reserves budget from the front.
- [x] 5.3 Test first: the same three one-off tasks with R1 at rest yield H1 and M1, total 65, with R1 contributing nothing. Pins the contrast that makes reservation observable.
- [x] 5.4 Test first: R1 45m and R2 30m, both due, exclude a 5-minute high task. Pins recurring work alone crowding out the day.
- [x] 5.5 Test first: a due recurring task and an urgent task are both included whatever order they are considered in, and the first conditional task sees the same running total either way. Pins the ordering-does-not-affect-membership claim in design.md, decision 6.

## 6. Snapshot admission

- [x] 6.1 Test first in `src/domain/snapshot.test.ts`: `admitIfUnconditional` admits a recurring task created mid-day on a date its rule fires, and does not admit one created on a date it does not. Pins mid-day admission.
- [x] 6.2 Test first: `removeIfNoLongerUnconditional` drops a task converted from due-recurring to a non-urgent one-off from `admittedIds`, and never touches `plannedIds`. Pins the existing asymmetry under the new case.
- [x] 6.3 Test first: the existing urgent admission and removal scenarios still hold under the generalised functions. Pins that urgent behavior is unchanged.

## 7. Persistence

- [ ] 7.1 Test first in `src/persistence/repositoryContract.ts`: a recurring task round-trips with its rule and its last completion date, through both repository implementations. Pins what persists.
- [ ] 7.2 Test first in `src/persistence/indexedDbRepository.test.ts`: opening a version-2 database at version 3 backfills a null rule and null last completion on every stored task, leaving name, duration, priority, place, and completion state untouched. Pins the upgrade.
- [ ] 7.3 Test first: the version-3 upgrade does not run against a database that never existed at an earlier version. Pins the fresh-install guard the version-2 upgrade already established.
- [ ] 7.4 Test first: a stored daily plan is unchanged by the upgrade. Pins that the snapshot store is not touched.

## 8. Application state

- [ ] 8.1 Test first in `src/ui/AppStateProvider.test.tsx`: on load, reawakening runs before the plan is recomputed, and the reawakened tasks are persisted. Pins the pipeline order from design.md, decision 8.
- [ ] 8.2 Test first in `src/ui/Rollover.test.tsx`: a recurring task completed last Monday appears pending, not struck through, after a rollover to the following Monday. Pins the reawaken-then-select sequence end to end.
- [ ] 8.3 Test first: a recurring task completed on Tuesday is not brought back by "Recalculate today" on Wednesday. Pins the user's stated case.
- [ ] 8.4 Test first: reopening after several days away with a missed occurrence produces one plan containing exactly one instance of the recurring task. Pins non-accumulation through the real state path.
- [ ] 8.5 Test first: creating a recurring task mid-day on a date its rule fires admits it into the current snapshot and persists it. Pins mid-day admission through the provider.

## 9. The creation and edit form

- [ ] 9.1 Test first in a new `src/ui/RecurringTaskForm.test.tsx`: the form offers a task type choice defaulting to one-off, with the priority chips shown and no rule builder. Pins the default.
- [ ] 9.2 Test first: choosing Recurring hides the priority chips and shows the rule builder. Pins the exclusion being visible, not just validated.
- [ ] 9.3 Test first: the weekly builder multi-selects weekdays, so Monday and Wednesday can both be active. Pins multi-day rules.
- [ ] 9.4 Test first: the monthly builder single-selects a position and a weekday. Pins the nth-weekday path.
- [ ] 9.5 Test first: the plain-language echo renders for a weekly rule, a multi-day weekly rule, and a monthly rule. Pins the confirmation line.
- [ ] 9.6 Test first: switching the task type keeps the name and duration already entered. Pins that the switch is not destructive.
- [ ] 9.7 Test first: a rejected recurring creation keeps the form open with the type still recurring and the built rule intact. Pins the rejection path.
- [ ] 9.8 Test first: the edit form pre-fills a recurring task's type and rule, and cancelling restores the row unchanged. Pins editing.
- [ ] 9.9 Test first: the type choice and every rule control are reachable and operable from the keyboard, and the echo is available to assistive technology. Pins the accessibility requirement.

## 10. Task rows and groups

- [ ] 10.1 Test first in `src/ui/TaskItem.test.tsx`: a recurring row shows its duration and a text rule description as separate elements, and shows no priority name. Pins the badge substitution.
- [ ] 10.2 Test first: a recurring task completed today renders struck through with its rule description still legible. Pins the completed-row requirement.
- [ ] 10.3 Test first in `src/ui/TaskViews.test.tsx`: `PriorityGroups` renders a "Recurring" heading ahead of the urgent group, and omits it entirely when no recurring task is present. Pins the group and its empty case.
- [ ] 10.4 Test first: the Today tab places a due recurring task under Recurring and never under a priority heading. Pins Today's grouping.
- [ ] 10.5 Test first: the All tab places recurring tasks under Recurring, ahead of every priority group, ordered by place. Pins All's grouping and ordering.

## 11. Tab membership

- [ ] 11.1 Test first in `src/ui/TaskViews.test.tsx`: the All tab lists a recurring task while it is due, while it is at rest, and immediately after it is completed. Pins that All is the always-available management surface.
- [ ] 11.2 Test first: the Completed tab lists no recurring task, however many times it has been completed. Pins the (β) decision.
- [ ] 11.3 Test first: completing a recurring task from the All tab leaves it in All, strikes it through in Today, and adds nothing to Completed. Pins the three-tab consequence in one test.
- [ ] 11.4 Test first: Today shows its empty state when the only tasks are at-rest recurring ones, while All lists them and does not show its empty state. Pins the divergent empty states.
- [ ] 11.5 Test first: the Completed tab shows its empty state when only recurring completions have happened. Pins the last empty state.

## 12. Reordering boundary

- [ ] 12.1 Test first in `src/ui/AllTabReordering.test.tsx`: a recurring task is reordered within the Recurring group and no priority group changes. Pins reordering inside the new group.
- [ ] 12.2 Test first: dropping a recurring task onto a priority group, and a one-off task onto the Recurring group, leaves every place unchanged and converts neither task. Pins the boundary in both directions.
- [ ] 12.3 Test first: the Recurring group is reorderable by keyboard alone and cannot be left by keyboard. Pins parity with the priority groups.

## 13. Appearance

- [ ] 13.1 Test first in `src/ui/TaskViews.test.tsx` or a token test: the recurring indicator, the recurring choice in the form, and the "Recurring" heading resolve to one shared color token, distinct from the five priority tokens. Pins consistent assignment.
- [ ] 13.2 Add the recurring color token to `src/styles/tokens.css` for both themes, and verify contrast by hand in light and dark. Contrast is not machine-checked in this suite, so record the result.

## 14. Verification

- [ ] 14.1 Run the full suite and confirm it is green, with no skipped or commented-out tests.
- [ ] 14.2 By hand: create "every Monday" and "first Monday of the month" tasks in the running application, confirm each appears in Today on its date, completes, disappears, and returns at the next occurrence. Verified by changing the device date, since the day boundary cannot be crossed in the test environment.
- [ ] 14.3 By hand: confirm a database written by the previous version opens after the upgrade with every task intact and no Recurring group displayed.
- [ ] 14.4 Confirm every requirement in the six spec deltas has at least one test or a recorded manual check, and note any that shipped differently from the specs.
