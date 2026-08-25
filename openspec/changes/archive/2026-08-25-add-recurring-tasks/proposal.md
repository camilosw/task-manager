## Why

Some work is not a one-off item that gets done and disappears forever — it comes back on a schedule. A weekly review every Monday, a monthly routine on the first Monday of the month. Today the only way to express that is to recreate the task by hand every time it comes around, which means the user is doing the scheduling the application should be doing, and forgetting to recreate it is indistinguishable from having no such commitment at all.

These items also differ from ordinary tasks in a second way: they are not competing for the day's attention against other work. When Monday comes, the weekly review is happening. Ranking it against the backlog with a priority level misstates what it is, and leaving it to the 60-minute budget's selection means the commitment silently loses to whatever else happened to be near the top of the list.

## What Changes

- A task can be **recurring**: it carries a repetition rule instead of a priority, and the two are mutually exclusive. A recurring task is one durable item, not a series of generated copies — completing it does not end it, it puts it to rest until its rule brings it back.
- A recurring task is **due** when its rule has produced an occurrence on or before today that a completion has not yet cleared. Due-ness is derived from the rule, the task's creation date, and the date it was last completed — nothing is generated, scheduled, or created in the background.
- **A missed occurrence is not lost.** If the application is not opened on the day an occurrence falls, the task is still due the next time it is opened. It stays due until it is completed.
- **A missed occurrence never accumulates.** If a second occurrence arrives before the first was completed, the task remains the single item it already was. Three missed Mondays produce one pending item, not three.
- **Once completed, a recurring task stays at rest** until its rule produces a later occurrence, and no recomputation of the day brings it back in the meantime.
- **Recurring tasks are unconditional members of the daily plan and consume the day's budget before anything else is considered.** They are always in Today, they are never crowded out, and the time they take is subtracted from what the ordinary selection has left to spend. This is the same rule urgent tasks already follow, applied from the front of the selection.
- Two repetition rules are supported: **on chosen days of the week**, and **on the Nth chosen weekday of the month** — where Nth may also be the last. Between them these cover "every Monday", "every Monday and Wednesday", "the first Monday of the month", and "the last Friday of the month".
- Today and All present recurring tasks in a **Recurring group of their own**, ahead of the priority groups. A recurring task shows its repetition rule where an ordinary task shows its priority level.
- **All lists every recurring task at all times**, due or at rest, so it is always reachable for editing and deletion. **Completed never lists a recurring task**, so it stays a history of one-off work.
- Tasks stored by an earlier version carry no repetition rule and remain ordinary one-off tasks, unchanged in every respect.

### Deliberately out of scope

- **No repetition by day of the month** — "the 1st of every month", "the last day of the month" — regardless of weekday. The rule vocabulary is shaped so this is additive later, but it is not built here.
- **No intervals other than weekly and monthly.** No "every 3 days", no "every other week", no yearly, no arbitrary start dates or end dates, and no "repeat N times".
- **No completion history.** The application remembers only the date a recurring task was last completed, not the sequence of times it was completed. There is no streak, no adherence rate, and no record of missed occurrences.
- **No catch-up for missed occurrences.** A missed occurrence makes the task due; it does not create a separate item to be worked through, and skipped occurrences leave no trace.
- **No priority on a recurring task**, and therefore no way to rank one against another by importance. Their order within the Recurring group is the manual order, as with any other group.
- **No urgent recurring task.** Because recurrence replaces priority, a recurring task cannot also be urgent. It is already unconditional in the plan, so the two would mean the same thing.
- **No reminders or notifications** of any kind. A due task appears in Today when the application is opened; nothing announces it.
- **No change to the 60-minute budget**, to the threshold-crossed-once rule, or to how ordinary tasks are selected among themselves.

## Capabilities

### New Capabilities

- `recurring-tasks`: the repetition rule vocabulary and what each rule means as a calendar predicate; when a recurring task is due and when it is at rest; how completion moves it between those states; how a missed occurrence behaves; and the fact that no occurrence is ever generated, scheduled, or created in the background.

### Modified Capabilities

- `task-management`: priority becomes optional on a task, and a task gains a repetition rule; priority and recurrence become mutually exclusive, which changes what creation and editing validate and what a valid task is; completing a recurring task stops being terminal; and converting a task between one-off and recurring by editing it is specified.
- `task-views`: Today and All gain a Recurring group ahead of the priority groups; a recurring task's row shows its repetition rule where an ordinary row shows its priority level, which relaxes the rule that a priority name appears on every row in every tab; All lists recurring tasks whether or not they are due or completed; and Completed excludes them entirely.
- `daily-plan`: recurring tasks join urgent tasks as unconditional members of the plan, and are considered at the front of the selection so their duration is reserved before the budget is spent on anything else; the plan's composition rules state which recurring tasks are members on a given day.
- `offline-storage`: a task's repetition rule and the date it was last completed are part of what persists on the device and survives a restart, and data written before this change is upgraded without altering any existing task.
- `appearance`: the Recurring group and the recurrence badge need their own color in both themes, alongside the five priority levels, and must stay identifiable with color disregarded.

## Impact

- The task record gains two fields and makes an existing one optional. Making priority optional is the wider of the two: every place that reads a priority — ordering, grouping, labelling, coloring, and validation — currently assumes one is present, and each has to state what it does when there is none.
- Stored data from earlier versions must be upgraded on read or on open. The upgrade is trivial in content, since every existing task remains a one-off task, but it is the one place where an error would corrupt tasks the user already has.
- The daily plan's selection gains a second class of unconditional member. The existing worked examples in the daily-plan spec keep their results, since a day with no due recurring task reserves nothing — but every example gains a reserved-time step ahead of the first task considered.
- Recomputing the day gains a step that writes to the task record, not only to the day's plan: a recurring task that has become due again must have its previous completion cleared, and that has to be persisted before the day's state settles. Recomputation is currently a plan-only write.
- Task creation and editing gain a type choice and a rule builder. This is the largest addition to a form that is deliberately compact and shared between creating a task and editing one in place, on a surface where space is already tight.
- The order in which the Recurring group is presented is not merely cosmetic: it is the order the selection walks, and placing it first is what makes a recurring task's duration reserve time rather than be added on top of a full day.
