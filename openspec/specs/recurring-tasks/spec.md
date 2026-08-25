# recurring-tasks Specification

## Purpose

Defines tasks that come back on a schedule rather than being done once and finished: what repetition rules can be expressed, when such a task counts as due, and how completing one puts it to rest until its rule brings it back.

## Requirements

### Requirement: A recurring task carries a repetition rule instead of a priority

A task SHALL either carry a priority level or carry a repetition rule, never both and never neither. A task carrying a repetition rule SHALL be called a recurring task.

A recurring task SHALL carry a name and a duration exactly as any other task does. Its duration SHALL count toward the day's time in the same way every other task's duration does, as defined by the daily-plan capability.

A recurring task SHALL NOT carry a priority level, and SHALL NOT be ranked against other tasks by importance in any tab or in the daily plan's selection.

#### Scenario: A recurring task has a rule and no priority

- **WHEN** a task is created with name "Weekly review", duration 30 minutes, and a rule of every Monday
- **THEN** the task carries that repetition rule
- **AND** the task carries no priority level
- **AND** the task carries the name and the duration given

#### Scenario: A task cannot carry both a priority and a rule

- **WHEN** a task is created or edited
- **THEN** it ends up with exactly one of a priority level or a repetition rule
- **AND** no task exists that carries both
- **AND** no task exists that carries neither

#### Scenario: A recurring task cannot be urgent

- **WHEN** the user creates a recurring task
- **THEN** no priority level, urgent included, can be assigned to it while it remains recurring
- **AND** it is already an unconditional member of the daily plan when due, as the daily-plan capability defines

### Requirement: The repetition rules that can be expressed

A repetition rule SHALL be one of exactly two kinds:

- **On chosen days of the week.** The rule names one or more days of the week, and produces an occurrence on every one of those days, every week.
- **On the Nth chosen weekday of the month.** The rule names a position — first, second, third, fourth, or last — together with a single day of the week, and produces one occurrence per month, on that weekday at that position within the month.

The system SHALL NOT accept a rule outside these two kinds. In particular, repetition by day of the month regardless of weekday, intervals other than every week or every month, start dates, end dates, and occurrence counts SHALL NOT be expressible.

A rule of the first kind naming no day of the week SHALL be rejected, as SHALL a rule of the second kind missing either its position or its weekday.

#### Scenario: A weekly rule on one day

- **WHEN** the user builds a rule naming Monday as its only day of the week
- **THEN** the rule produces an occurrence on every Monday
- **AND** it produces no occurrence on any other day

#### Scenario: A weekly rule on several days

- **WHEN** the user builds a rule naming Monday and Wednesday
- **THEN** the rule produces an occurrence on every Monday and on every Wednesday
- **AND** the two occurrences are occurrences of the same task, not of two tasks

#### Scenario: A monthly rule on the first Monday

Traced against August and September 2026, whose Mondays fall on the dates shown:

| Month | Mondays in the month | First Monday | Occurrence |
| ----- | -------------------- | ------------ | ---------- |
| August 2026 | 3, 10, 17, 24, 31 | 3 August | 3 August |
| September 2026 | 7, 14, 21, 28 | 7 September | 7 September |

- **WHEN** the rule names the first Monday of the month
- **THEN** it produces an occurrence on 3 August 2026 and on 7 September 2026
- **AND** it produces no occurrence on 10, 17, 24, or 31 August, which are also Mondays

#### Scenario: A monthly rule on the last weekday of the month

| Month | Mondays in the month | Last Monday | Occurrence |
| ----- | -------------------- | ----------- | ---------- |
| August 2026 | 3, 10, 17, 24, 31 | 31 August | 31 August |
| September 2026 | 7, 14, 21, 28 | 28 September | 28 September |

- **WHEN** the rule names the last Monday of the month
- **THEN** it produces an occurrence on 31 August 2026 and on 28 September 2026
- **AND** the position "last" resolves to the final matching weekday of each month, whether that month contains four or five of them

#### Scenario: An incomplete rule is rejected

- **WHEN** the user attempts to save a weekly rule with no day of the week selected
- **THEN** the task is not created or saved
- **AND** the user is shown that the rule is incomplete

### Requirement: When a recurring task is due

A recurring task SHALL be due when its rule has produced an occurrence on or before the current date that the task's completion has not cleared, and SHALL be at rest otherwise.

Occurrences SHALL be counted only from the task's creation date onward. An occurrence date falling before the task was created SHALL NOT make the task due, because the task did not exist on that date.

A completion SHALL clear an occurrence when the task was last completed on or after that occurrence's date. A completion recorded before the occurrence's date SHALL NOT clear it.

The current date SHALL be the calendar date in the device's local time zone, the same day boundary the daily-plan capability uses. No second notion of what day it is SHALL exist.

#### Scenario: Due-ness traced across a cycle

A task "Weekly review" with a rule of every Monday, created on Monday 10 August 2026. The Mondays in range are 10, 17, 24, and 31 August.

| Current date | Most recent occurrence on or after creation | Last completed | Comparison | Due? |
| ------------ | ------------------------------------------- | -------------- | ---------- | ---- |
| Mon 10 Aug | 10 Aug | never | no completion to clear it | **yes** |
| Mon 10 Aug, after completing | 10 Aug | 10 Aug | 10 Aug is on or after 10 Aug — cleared | no |
| Tue 11 Aug | 10 Aug | 10 Aug | cleared | no |
| Sun 16 Aug | 10 Aug | 10 Aug | cleared | no |
| Mon 17 Aug | 17 Aug | 10 Aug | 10 Aug is before 17 Aug — not cleared | **yes** |

- **WHEN** the current date is each of the dates above
- **THEN** the task is due exactly on the dates marked yes
- **AND** it is at rest on every other date

#### Scenario: An occurrence before the task existed does not make it due

A task with a rule of every Monday, created on Saturday 22 August 2026. The preceding Monday was 17 August; the following Monday is 24 August.

| Current date | Occurrences on or after creation (22 Aug) | Due? |
| ------------ | ----------------------------------------- | ---- |
| Sat 22 Aug | none yet — 17 Aug precedes creation | no |
| Sun 23 Aug | none yet | no |
| Mon 24 Aug | 24 Aug | **yes** |

- **WHEN** the task is created on Saturday 22 August
- **THEN** it is not due that day, even though the rule's most recent Monday was 17 August
- **AND** it becomes due on Monday 24 August

#### Scenario: A task created on one of its own occurrence dates is due at once

- **WHEN** the user creates a task on Monday 24 August 2026 with a rule of every Monday
- **THEN** the task is due that same day
- **AND** it does not wait until the following Monday

### Requirement: A missed occurrence keeps the task due

A recurring task whose occurrence date has passed without the task being completed SHALL remain due on every later date until it is completed. The system SHALL NOT require the application to have been opened on the occurrence date for the occurrence to count.

#### Scenario: The application was not opened on the occurrence date

A task with a rule of every Monday, last completed on Monday 17 August 2026. The application is not opened at all on Monday 24 August.

| Current date | Most recent occurrence | Last completed | Comparison | Due? |
| ------------ | ---------------------- | -------------- | ---------- | ---- |
| Tue 25 Aug | 24 Aug | 17 Aug | 17 Aug is before 24 Aug | **yes** |
| Wed 26 Aug | 24 Aug | 17 Aug | 17 Aug is before 24 Aug | **yes** |

- **WHEN** the user opens the application on Tuesday 25 August
- **THEN** the task is due
- **AND** it remains due on Wednesday 26 August if it is still not completed
- **AND** nothing about the occurrence was lost by the application being closed on 24 August

#### Scenario: A missed occurrence stays due indefinitely

- **WHEN** a recurring task's occurrence passes without the task being completed
- **THEN** the task is still due a week later, a month later, and on every date in between
- **AND** only completing it puts it back at rest

### Requirement: Missed occurrences never accumulate

A recurring task SHALL remain a single task no matter how many of its occurrences have passed uncompleted. The system SHALL NOT produce a second task, a backlog, a count of missed occurrences, or any other record of them.

Completing the task once SHALL put it at rest until its rule produces a later occurrence, regardless of how many occurrences were missed before.

#### Scenario: Three missed Mondays are one pending item

A task with a rule of every Monday, last completed on Monday 3 August 2026, not completed on 10, 17, or 24 August.

| Current date | Most recent occurrence | Last completed | Due? | Number of pending items |
| ------------ | ---------------------- | -------------- | ---- | ----------------------- |
| Mon 24 Aug | 24 Aug | 3 Aug | **yes** | 1 |

- **WHEN** the current date is Monday 24 August
- **THEN** the task is due
- **AND** exactly one item is presented, not three
- **AND** no indication of the missed occurrences of 10 and 17 August is shown anywhere

#### Scenario: One completion clears every missed occurrence

Continuing from the arrangement above:

- **WHEN** the user completes the task on Monday 24 August
- **THEN** the task is at rest
- **AND** it does not become due again for the occurrences of 10 or 17 August
- **AND** it becomes due again on Monday 31 August

### Requirement: Completing a recurring task puts it to rest, it does not end it

Completing a recurring task SHALL record the date of the completion and SHALL put the task at rest. The task SHALL NOT be finished, removed, or archived by the completion: it SHALL become due again when its rule produces an occurrence later than the recorded completion date.

While at rest, the task SHALL NOT be brought back into the day's plan by any recomputation of that plan, whether by day rollover or by the manual recalculation the daily-plan capability defines.

#### Scenario: Completing late, then recalculating the next day

A task with a rule of every Monday, due since Monday 24 August 2026 because the application was not opened that day.

| Step | Date | Action | Most recent occurrence | Last completed | Due after the step? |
| ---- | ---- | ------ | ---------------------- | -------------- | ------------------- |
| 1 | Tue 25 Aug | user opens the application | 24 Aug | 17 Aug | **yes** |
| 2 | Tue 25 Aug | user completes the task | 24 Aug | 25 Aug | no — 25 Aug is on or after 24 Aug |
| 3 | Wed 26 Aug | user triggers "Recalculate today" | 24 Aug | 25 Aug | no |
| 4 | Mon 31 Aug | day rollover | 31 Aug | 25 Aug | **yes** — 25 Aug is before 31 Aug |

- **WHEN** the user completes the task on Tuesday 25 August
- **THEN** it is at rest from that moment
- **AND** recalculating the plan on Wednesday 26 August does not bring it back
- **AND** it becomes due again on Monday 31 August

#### Scenario: A completed recurring task is not finished

- **WHEN** the user completes a recurring task
- **THEN** the task still exists and is still listed in the All tab, as the task-views capability defines
- **AND** it is not listed in the Completed tab
- **AND** it becomes due again at its next occurrence

### Requirement: No occurrence is ever generated, scheduled, or announced

The system SHALL NOT create a task, a copy, or a record of any kind when an occurrence date arrives. Whether a recurring task is due SHALL be determined from its rule, its creation date, and the date it was last completed at the moment the question is asked.

The system SHALL NOT rely on a background process, a timer, or any activity while the application is closed. It SHALL NOT notify, remind, or otherwise announce that a task has become due; a due task becomes visible when the application is next opened.

#### Scenario: Nothing happens while the application is closed

- **WHEN** the application is closed across one or more occurrence dates
- **THEN** no task has been created on the user's behalf when it is next opened
- **AND** the recurring task is simply shown as due, per the rules above

#### Scenario: A due task is not announced

- **WHEN** a recurring task becomes due
- **THEN** no notification, reminder, badge, or alert of any kind is produced
- **AND** the task is visible in the Today tab the next time the application is opened

### Requirement: Editing a repetition rule takes effect from that moment

Changing a recurring task's repetition rule SHALL change which dates it is due on from that moment onward. The date the task was last completed SHALL NOT be altered by a rule edit, and neither SHALL its creation date.

A rule edit SHALL NOT change which tasks the day's plan already contains; that plan stays frozen as the daily-plan capability defines, and the new rule takes effect at the next computation.

#### Scenario: Changing the day of the week

A task with a rule of every Monday, last completed on Monday 24 August 2026, edited on Tuesday 25 August to a rule of every Wednesday.

| Current date | Most recent occurrence under the new rule | Last completed | Due? |
| ------------ | ----------------------------------------- | -------------- | ---- |
| Tue 25 Aug | 19 Aug (a Wednesday) | 24 Aug | no — 24 Aug is on or after 19 Aug |
| Wed 26 Aug | 26 Aug | 24 Aug | **yes** — 24 Aug is before 26 Aug |

- **WHEN** the rule is changed on Tuesday 25 August
- **THEN** the task is due on Wednesday 26 August
- **AND** the date it was last completed is still 24 August

#### Scenario: A rule edit leaves today's plan alone

- **WHEN** the user edits a recurring task's rule while that task is shown in the Today tab
- **THEN** the task remains in the Today tab for the rest of the day
- **AND** the new rule decides whether it is due at the next computation of the plan
