## Context

See proposal.md — Why. This section covers only the existing structure the design has to fit into.

Three things in the current code shape every decision below:

- **`Task` assumes a priority is always present.** `priority: Priority` is non-optional, and `comparePriority`, `PRIORITY_LABELS`, `PriorityGroups`, the appearance color tokens, and `createTask`'s validation all read it unconditionally.
- **Completion is terminal.** `completedAt: Date | null` moves a task from pending to done once, and `selectDailyPlan` filters on `completedAt === null`.
- **The day is recomputed only when the application is opened or returns to the foreground.** `needsRecompute` compares the stored `DaySnapshot.date` against `toLocalDateString(now())`, and `AppStateProvider` acts on it in the load effect and the `visibilitychange` handler. There is no timer and no background process, and `specs/daily-plan/spec.md` forbids relying on one.

The manual-ordering work is merged: every task carries `place`, `compareForSelection` breaks priority ties with it, and `PriorityGroups` is shared by Today and All.

## Goals / Non-Goals

**Goals:**

- Express recurrence as a pure function of a calendar date, so it can be exercised across weeks and month boundaries without waiting for real time to pass or faking a scheduler.
- Keep `DaySnapshot`'s shape unchanged, so the frozen-plan model that the daily-plan spec already pins down is extended rather than replaced.
- Make the rule vocabulary extensible by addition — a new rule kind should be a new variant plus a new predicate branch, touching nothing that already works.
- Confine the blast radius of making priority optional: every site that reads `priority` should be forced by the compiler to state what it does when there is none.

**Non-Goals:**

- No general scheduling engine. `RecurrenceRule` covers exactly the two kinds this change ships and is not an iCalendar RRULE subset.
- No abstraction over "unconditional plan member" beyond what urgent and recurring need today. Two cases is not enough to justify a strategy interface.
- No change to how ordinary tasks are ordered or selected among themselves.

## Decisions

### 1. Recurrence is a calendar predicate, not a materializer

`occursOn(rule: RecurrenceRule, date: Date): boolean` — a pure function of a rule and a local calendar date. Nothing is generated, queued, or written when an occurrence arrives.

*Alternative rejected — definition plus generated occurrences.* A `RecurringDefinition` record that spawns a real `Task` on each occurrence. This was the first shape considered and it is the conventional one, but it was rejected on three counts. It only pays for itself if completion history matters, and the user explicitly does not want history. It grows without bound — a weekly rule produces roughly 52 rows a year, and the application has no pruning of any kind. And it introduces an idempotency obligation that has no analogue anywhere else in the codebase: generation must run at least once and at most once per (rule, date), which has to hold across "Recalculate today", a foreground return, and a reopen on a later day. The predicate has no such obligation because it writes nothing.

*Alternative rejected — a background check at midnight.* Forbidden outright by `specs/daily-plan/spec.md` ("SHALL NOT rely on a background process running at midnight"), and impossible to honor in an offline PWA that may simply not be running.

### 2. Due-ness is derived, never stored

A recurring task is due when its rule has produced an occurrence on or before today that no completion has cleared:

```
lastDueDate(rule, createdOn, today)
  = the most recent d with createdOn <= d <= today and occursOn(rule, d)
  = null when no such d exists

isDue(task, now)
  d = lastDueDate(task.recurrence, toLocalDateString(task.createdAt), toLocalDateString(now))
  = d !== null && (task.lastCompletedOn === null || task.lastCompletedOn < d)
```

Both take the date as a parameter; neither reads the system clock, in keeping with the injected-`now` rule that already governs `createTask`, `completeTask`, and `needsRecompute`. Dates are compared as `YYYY-MM-DD` strings produced by the existing `toLocalDateString`, so the whole feature inherits the local-time-zone day boundary already specified for the daily plan, with no second notion of "what day it is".

Two properties fall out of the formula rather than being coded as special cases, and both are requirements:

- **A missed occurrence is not lost.** `lastDueDate` looks back to the most recent occurrence, not to today only, so a rule that fired on Monday still reports Monday when asked on Tuesday.
- **Missed occurrences never accumulate.** The formula answers a boolean, not a count. Three missed Mondays and one missed Monday are indistinguishable, which is exactly the required behavior.

**The `createdOn` floor is load-bearing.** Without it, a task created on Monday with an "every Monday" rule would look back to the *previous* Monday — a date on which the task did not exist — and a task created on Saturday would be due on the spot. With the floor, a task created on an occurrence date is due that same day, and one created between occurrences sleeps until the next.

*Alternative rejected — storing a `dueSince` date on the task.* Cheaper to read, but it is derived state with a write obligation attached: it must be updated when the rule is edited, when the task is completed, and on every day rollover, and any missed update produces a task that is silently due or silently absent. Deriving it costs a handful of date comparisons on each render, which is nothing at this scale.

### 3. Two completion fields, not one

`Task` gains `lastCompletedOn: string | null` (a local date string) alongside the existing `completedAt: Date | null`.

- `completedAt` keeps its current meaning exactly: *completed and not yet cleared by a recomputation.* Every existing consumer — the strikethrough in `TaskItem`, the `completedAt === null` filter in `selectDailyPlan`, the Completed tab's ordering — reads it unchanged.
- `lastCompletedOn` is the durable memory that drives `isDue`. It survives the clearing of `completedAt`.

*Alternative rejected — a single `completedAt` that is never cleared.* Tempting, since `lastCompletedOn` is derivable from it. It fails because `completedAt !== null` would stop meaning "completed now": a recurring task that is due again on the 31st would still carry the completion timestamp from the 25th, and `TaskItem` would render it struck through while it sits in Today waiting to be done. Recovering the right behavior would mean teaching every consumer of `completedAt` about due-ness, which is a far larger change than one extra field.

### 4. `priority: Priority | null`, not a sentinel level

Priority becomes nullable, and `recurrence: RecurrenceRule | null` is added. The invariant — exactly one of the two is non-null — is enforced in `createTask`/`editTask` validation rather than in the type.

*Alternative rejected — a sixth sentinel value `'recurring'` at the front of `PRIORITIES`.* This was by far the cheapest diff: grouping, color assignment, and front-of-selection ordering would all have come for free from machinery that already exists. It was rejected because it conflates two independent axes. `PRIORITIES` is documented as "ordered from most to least important" and is authoritative wherever tasks are sorted by importance; recurrence is not a degree of importance. The concrete cost arrives the day a recurring task also needs to be urgent — under the sentinel that combination is unrepresentable, and unwinding it would mean touching every site the sentinel silently served.

*Alternative rejected — a discriminated union `Task = OneOffTask | RecurringTask`.* The strongest option: it makes the mutually-exclusive invariant unrepresentable-if-violated rather than merely validated. Rejected on blast radius — `Task` appears in the repository port, the snapshot resolver, every view, and every test factory, and narrowing at each of those sites is a large mechanical change for an invariant that two validation branches already cover.

*Consequence to accept:* `priority: Priority | null` means the compiler flags every current read of `priority`, which is the point, but it also means the null case has to be answered honestly at each one rather than defaulted away. `comparePriority` in particular must not be given a "null sorts as X" branch — recurring tasks are grouped and ordered ahead of the priority axis, never compared on it.

### 5. The rule vocabulary

```ts
type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6   // Date#getDay: 0 = Sunday

type RecurrenceRule =
  | { kind: 'weekly'; weekdays: Weekday[] }
  | { kind: 'monthly-weekday'; nth: 1 | 2 | 3 | 4 | -1; weekday: Weekday }
```

`weekly` with a *list* of weekdays, rather than a single day, is what makes "Mondays and Wednesdays" cost nothing beyond the multi-select in the form. `nth: -1` for "last" is the standard encoding (iCalendar spells it `BYDAY=-1MO`) and avoids a separate `{ kind: 'monthly-last-weekday' }` variant. `Weekday` follows `Date#getDay`'s numbering deliberately, so `occursOn` compares against `date.getDay()` with no conversion layer to get backwards.

The deferred `{ kind: 'monthly-day'; day: number }` — "the 1st", "the last day" — is a third variant and a third branch of `occursOn`. Nothing above changes to admit it.

*Alternative rejected — storing an RRULE string.* Standard and maximally expressive, but it needs a parser, and expressiveness beyond these rules is explicitly out of scope. A string also cannot be exhaustively checked by the compiler, where a discriminated union forces every new variant to be handled everywhere it matters.

### 6. Recurring tasks are unconditional members, considered first

`selectDailyPlan` currently includes a task when `task.priority === 'urgent' || total < DAILY_BUDGET_MINUTES`. The condition generalizes to `isUnconditional(task, now) || total < DAILY_BUDGET_MINUTES`, where a task is unconditional if it is urgent or is a due recurring task. Unconditional tasks still add their duration to the running total, exactly as urgent tasks do now.

`compareForSelection` sorts recurring tasks ahead of every priority level, so they are considered before anything else and their duration is reserved before the budget is spent.

**Where a recurring task sits relative to urgent does not affect membership** — only display order. Both classes are included regardless of the running total, both contribute to it, and the sort groups them contiguously, so no conditional task is considered between them; the total when the first conditional task is examined is the same either way. Placing recurring first is a presentation choice, matching the "this time is committed" reading.

*Alternative rejected — adding recurring tasks after the ordinary selection.* Same set of tasks, different budget arithmetic: a 60-minute recurring task considered first leaves nothing for the backlog, while the same task appended afterwards leaves a full 60 minutes of ordinary work in place and produces a 120-minute day. The reserved-first reading is what makes the duration "count toward the time calculation" in any meaningful sense.

### 7. Becoming due mid-day mirrors becoming urgent

`admitIfUrgent` and `removeIfNoLongerUrgent` generalize to `admitIfUnconditional` / `removeIfNoLongerUnconditional`, taking `now` so they can evaluate `isDue`.

This matters for one case: a recurring task **created** — or edited into existence — partway through a day on which its rule already fires. By the `createdOn` floor in decision 2 it is due immediately, and the daily-plan spec's existing treatment of urgent tasks ("A task that becomes urgent enters the plan immediately") is the precedent for admitting it rather than making the user wait until tomorrow for a task they just said happens today. The mirror case — a recurring task edited back into a non-urgent one-off — drops out of `admittedIds` on the same asymmetry that already governs urgent: `plannedIds` is never touched by an edit.

A recurring task does *not* become due mid-day on its own. Due-ness changes only when the local date changes, which is exactly when the plan is recomputed anyway.

### 8. Reawakening happens before recomputation, and writes tasks

Recomputation today writes only the snapshot. It gains a step that writes the task record:

```
on open / foreground return / "Recalculate today":
    1. reawaken(tasks, now)      → clear completedAt on every recurring
                                    task that isDue again
    2. persist tasks             ← new write, only when step 1 changed something
    3. recomputeSnapshot(tasks)  → due recurring tasks land in plannedIds
    4. persist snapshot
```

The order is not interchangeable. `recomputeSnapshot` calls `selectDailyPlan`, which filters on `completedAt === null`; a task whose completion has not yet been cleared would be filtered out and would miss its own occurrence.

`reawaken` is pure — `(tasks, now) => tasks` — and returns the same array reference when nothing changed, so the common case adds no write.

*Alternative rejected — clearing `completedAt` lazily at read time.* Avoids the extra write, but makes the persisted record disagree with what every view shows, and reintroduces exactly the ambiguity decision 3 exists to prevent.

### 9. What is persisted and what is derived

| | Persisted | Derived |
|---|---|---|
| `recurrence` rule | ✅ on the task | |
| `lastCompletedOn` | ✅ on the task | |
| `completedAt` | ✅ on the task, cleared on reawaken | |
| Whether a task is due today | | `isDue(task, now)` |
| The next/previous occurrence date | | `lastDueDate(...)` |
| Membership in today's plan | ✅ as ids in `DaySnapshot.plannedIds` | resolved to tasks by `resolveSnapshotTasks` |

`DaySnapshot` is unchanged in both shape and meaning: it still stores **identifiers, never copied values**, so an edit to a recurring task's name or duration is reflected in Today immediately, and a deletion is tolerated by the existing unresolved-id filter in `resolveSnapshotTasks`. A due recurring task enters `plannedIds` through the ordinary `recomputeSnapshot` path — no new list, no new field, no special-casing in the resolver.

### 10. Tab membership

Recurring tasks do not follow the ordinary pending/completed split:

| Tab | Rule |
|---|---|
| Today | Snapshot membership, as for any task. Struck through when `completedAt !== null`, until the next recomputation. |
| All | **Every recurring task, always** — due or at rest, completed or not. This is the only surface on which one can be edited or deleted, so hiding it while at rest would make it unreachable for most of its cycle. |
| Completed | **Never.** Completed stays a history of one-off work. |

Concretely: All's filter becomes `completedAt === null || recurrence !== null`, and Completed's becomes `completedAt !== null && recurrence === null`.

*Alternative rejected — letting recurring tasks follow the ordinary rules.* A completed recurring task would leave All and appear in Completed, then migrate back a week later when it came due — a row that moves between tabs on its own, which reads as a defect. It would also fill Completed with the same title over and over, which is precisely the history the user does not want.

### 11. Presentation

- **Grouping key** becomes `task.priority ?? 'recurring'`, and `PriorityGroups` renders a `Recurring` group ahead of the five priority groups. The component is already shared by Today and All, so both surfaces get the group from one change; the existing "a group with no tasks is omitted entirely" rule applies to it unchanged.
- **The row** shows the repetition rule in the slot where a one-off task shows its priority — `↻ Every Mon`, `↻ 1st Mon` — keeping duration and the second badge as separate labelled elements, which is what the task-views requirement actually asks for.
- **The form** gains a `Type` control (`One-off` / `Recurring`) above `Duration`, which swaps the `Priority` chips for a rule builder. The builder is two levels: a frequency (`Weekly` / `Monthly`), then a multi-select weekday row for `Weekly`, or an nth row (`First`…`Fourth`, `Last`) plus a single-select weekday row for `Monthly`. Making the exclusion an explicit choice, rather than inferring it from whether a rule was filled in, is what keeps "a task has a priority or a rule, never both and never neither" legible in the UI as well as in validation.
- **A natural-language echo** of the built rule ("Repeats every Monday", "Repeats the first Monday of every month") sits below the builder. This is not decoration: a rule builder is easy to misread, and a misread rule fails silently weeks later when the task does not appear. The echo is also the natural place to render the deferred rule kinds when they arrive.
- **Appearance** gains a recurring color token in both themes. Like the five priority colors it reinforces and never replaces the text label — the group heading reads "Recurring" and the badge names the rule.

### 12. Storage upgrade

`DB_VERSION` goes from 2 to 3. Every task written by version 2 is a one-off task, so the upgrade backfills `recurrence: null` and `lastCompletedOn: null` and changes nothing a user can see.

The backfill is written explicitly rather than relying on absent fields reading as `undefined`. `undefined` and `null` would both be falsy at every use site, so tolerating the gap would work — right up until a future upgrade or an exhaustiveness check treats the two as distinct. The version-2 upgrade already established the pattern of rewriting every task inside `onupgradeneeded`, including its guard against running against a database that never existed at the previous version.

## Risks / Trade-offs

- **Making `priority` nullable touches everything that reads it** → This is intentional: the compiler enumerates the sites, and each is answered explicitly rather than defaulted. The risk is answering one of them lazily — most dangerously by giving `comparePriority` a null branch, which would quietly place recurring tasks on the importance axis they were removed from. Recurring tasks must be partitioned out before any priority comparison, not sorted within it.
- **Recomputation gains a write to the task record** → A failure between the task write and the snapshot write leaves a reawakened task that is not yet in the plan. The existing model already tolerates this class of divergence — `resolveSnapshotTasks` filters unresolved ids on every read for the same reason — and the next recomputation corrects it. Writing tasks first is the safe order: the reverse would put a task in the plan that `selectDailyPlan` had filtered as completed.
- **`isDue` is evaluated on every render for every recurring task** → `lastDueDate` walks backward from today to find the most recent occurrence, which is bounded by roughly a week for `weekly` and a month for `monthly-weekday`. At single-user scale this is irrelevant, but the walk must be bounded explicitly rather than looping until it finds a match, or a rule that can never fire would hang the render.
- **A recurring task can be edited while it is due and showing in Today** → Changing its rule mid-cycle can make it not-due, and it would then sit in `plannedIds` for the rest of the day. This is the same behavior the frozen plan already has for a task edited out of relevance, and the daily-plan spec's asymmetry covers it: `plannedIds` is not rewritten by an edit. It is worth a spec scenario rather than being left to inference.
- **"Last" as `nth: -1` is a small encoding trick** → It saves a variant but reads as a magic number at every use site. Confined to `occursOn` and to the form's label mapping, and named at both.
- **The form grows substantially on a deliberately compact, mobile-first surface** → The rule builder is only rendered in the `Recurring` branch, so the one-off form is unchanged in size. The nth row (`First`…`Last`) is the tightest element and will wrap on narrow screens.

## Migration Plan

One storage version bump, applied on open, with no user-visible effect on existing data (decision 12). There is no server, no coordinated rollout, and no partial-upgrade state to reconcile — a device either has opened the new version or has not.

Rollback is the ordinary PWA rollback, with one caveat worth recording: a database upgraded to version 3 cannot be reopened by version 2, since the storage layer opens at a pinned version and downgrades are rejected. A user who somehow reverts to the previous build would find the application unable to open its own database. This is inherent to the versioning scheme the project already uses and is not introduced here, but it means the version bump should not be shipped speculatively.
