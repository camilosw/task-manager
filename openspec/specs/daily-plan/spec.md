# daily-plan Specification

## Purpose

Defines which tasks make up the day's plan shown in the Today tab: how the selection is computed against a one-hour budget, how it stays frozen through the day while urgent work still gets in immediately, and when it is recomputed.

## Requirements

### Requirement: Composition of the daily plan

The Today tab SHALL show every recurring task that is currently due, plus every pending urgent task, plus the frozen non-urgent selection computed at the start of the day. These parts SHALL follow different rules: the recurring and urgent parts are live and always complete, the non-urgent part is fixed for the day.

Whether a recurring task is due is defined by the recurring-tasks capability. A recurring task that is at rest SHALL NOT be shown in the Today tab.

#### Scenario: The plan is the union of both parts

- **WHEN** the Today tab is displayed
- **THEN** it shows every recurring task that is due
- **AND** it shows every pending task whose priority is urgent
- **AND** it shows the non-urgent tasks selected when the day's plan was last computed
- **AND** it shows no other task

#### Scenario: A recurring task at rest is not part of the plan

- **WHEN** the Today tab is displayed and a recurring task is at rest
- **THEN** that task is not shown in the Today tab
- **AND** it is still listed in the All tab, as the task-views capability defines

### Requirement: Daily plan selection algorithm

The daily plan SHALL be computed by considering all pending tasks in a fixed order: every due recurring task first, then one-off tasks in priority order — urgent, high, medium, low, very low. Within the recurring group, and within a priority level, tasks SHALL be considered in the order of the places the user has arranged them in. A running total of included durations SHALL be maintained, starting at zero.

- Every due recurring task SHALL be included, regardless of the running total.
- Every urgent task SHALL be included, regardless of the running total.
- A non-urgent one-off task SHALL be included if and only if the running total of the tasks already considered is strictly less than the 60-minute budget.
- Every included task, due recurring and urgent ones included, SHALL add its duration to the running total.
- A recurring task that is at rest SHALL NOT be considered at all, and SHALL NOT add its duration to the running total.

Because the running total never decreases, once it reaches 60 minutes no further non-urgent task is included — selection effectively stops there. The budget is therefore a threshold that is crossed once, not a ceiling: the task that carries the total past 60 minutes is included, and nothing after it is.

The 60-minute budget SHALL remain a fixed value.

#### Scenario: Selection crosses the budget on its last task

Given four pending tasks, none recurring, arranged in the order listed:

| #   | Task | Priority | Duration | Total before | Rule applied             | Included | Total after |
| --- | ---- | -------- | -------- | ------------ | ------------------------ | -------- | ----------- |
| 1   | T1   | urgent   | 15m      | 0            | urgent — always included | yes      | 15          |
| 2   | T2   | high     | 30m      | 15           | 15 < 60                  | yes      | 45          |
| 3   | T3   | medium   | 20m      | 45           | 45 < 60                  | yes      | 65          |
| 4   | T4   | low      | 10m      | 65           | 65 is not < 60           | **no**   | 65          |

- **WHEN** the daily plan is computed
- **THEN** the plan contains T1, T2, and T3
- **AND** the plan does not contain T4, even though T4 is shorter than the amount by which T3 overshot
- **AND** the planned total is 65 minutes

#### Scenario: Selection stops when the budget is met exactly

Given three pending tasks, none urgent and none recurring, arranged in the order listed:

| #   | Task | Priority | Duration | Total before | Rule applied   | Included | Total after |
| --- | ---- | -------- | -------- | ------------ | -------------- | -------- | ----------- |
| 1   | H1   | high     | 30m      | 0            | 0 < 60         | yes      | 30          |
| 2   | M1   | medium   | 30m      | 30           | 30 < 60        | yes      | 60          |
| 3   | L1   | low      | 5m       | 60           | 60 is not < 60 | **no**   | 60          |

- **WHEN** the daily plan is computed
- **THEN** the plan contains H1 and M1
- **AND** the plan does not contain L1, because the budget was already met exactly

#### Scenario: A later, shorter task is not substituted for an excluded one

- **WHEN** a non-urgent task is excluded because the running total has reached the budget
- **THEN** no lower-priority task is considered as a substitute, however short it is
- **AND** no task arranged later within the same priority level is considered as a substitute either
- **AND** the plan is a prefix of the arranged order, not a best fit for the remaining time

#### Scenario: A due recurring task is considered before every priority level

Given four tasks, arranged in the order listed, where R1 is a recurring task that is due today:

| #   | Task | Kind               | Duration | Total before | Rule applied                    | Included | Total after |
| --- | ---- | ------------------ | -------- | ------------ | -------------------------------- | -------- | ----------- |
| 1   | R1   | recurring, due     | 30m      | 0            | recurring and due — always included | yes  | 30          |
| 2   | H1   | high               | 45m      | 30           | 30 < 60                         | yes      | 75          |
| 3   | M1   | medium             | 20m      | 75           | 75 is not < 60                  | **no**   | 75          |
| 4   | L1   | low                | 10m      | 75           | 75 is not < 60                  | **no**   | 75          |

- **WHEN** the daily plan is computed
- **THEN** the plan contains R1 and H1
- **AND** M1 is excluded, because R1's 30 minutes were already counted when M1 was considered
- **AND** the planned total is 75 minutes

### Requirement: Urgent tasks consume the budget and can crowd out all other work

Urgent tasks SHALL be included in the daily plan unconditionally and SHALL contribute their duration to the running total. When urgent tasks alone bring the running total to 60 minutes or more, no non-urgent task SHALL be included, and the Today tab SHALL contain only urgent tasks.

#### Scenario: Urgent work alone exceeds the budget

Given three pending tasks, created in the order listed:

| #   | Task | Priority | Duration | Total before | Rule applied             | Included | Total after |
| --- | ---- | -------- | -------- | ------------ | ------------------------ | -------- | ----------- |
| 1   | U1   | urgent   | 45m      | 0            | urgent — always included | yes      | 45          |
| 2   | U2   | urgent   | 30m      | 45           | urgent — always included | yes      | 75          |
| 3   | H1   | high     | 5m       | 75           | 75 is not < 60           | **no**   | 75          |

- **WHEN** the daily plan is computed
- **THEN** the plan contains U1 and U2 only
- **AND** H1 is excluded despite lasting only 5 minutes
- **AND** the planned total is 75 minutes, which exceeds the budget

### Requirement: Due recurring tasks reserve their duration before the budget is spent

A due recurring task's duration SHALL be counted toward the running total before any one-off task is considered. The budget available to one-off tasks is therefore reduced by the recurring work committed for that day, rather than the recurring work being added on top of a full day's selection.

When due recurring tasks alone bring the running total to 60 minutes or more, no non-urgent one-off task SHALL be included, and the Today tab SHALL contain only recurring and urgent tasks.

#### Scenario: Recurring work alone exceeds the budget

Given three tasks, where R1 and R2 are recurring tasks that are both due today:

| #   | Task | Kind           | Duration | Total before | Rule applied                        | Included | Total after |
| --- | ---- | -------------- | -------- | ------------ | ----------------------------------- | -------- | ----------- |
| 1   | R1   | recurring, due | 45m      | 0            | recurring and due — always included | yes      | 45          |
| 2   | R2   | recurring, due | 30m      | 45           | recurring and due — always included | yes      | 75          |
| 3   | H1   | high           | 5m       | 75           | 75 is not < 60                      | **no**   | 75          |

- **WHEN** the daily plan is computed
- **THEN** the plan contains R1 and R2 only
- **AND** H1 is excluded despite lasting only 5 minutes
- **AND** the planned total is 75 minutes, which exceeds the budget

#### Scenario: Recurring and urgent work together crowd out the rest

| #   | Task | Kind           | Duration | Total before | Rule applied                        | Included | Total after |
| --- | ---- | -------------- | -------- | ------------ | ----------------------------------- | -------- | ----------- |
| 1   | R1   | recurring, due | 30m      | 0            | recurring and due — always included | yes      | 30          |
| 2   | U1   | urgent         | 45m      | 30           | urgent — always included            | yes      | 75          |
| 3   | H1   | high           | 5m       | 75           | 75 is not < 60                      | **no**   | 75          |

- **WHEN** the daily plan is computed
- **THEN** the plan contains R1 and U1
- **AND** H1 is excluded
- **AND** the planned total is 75 minutes

#### Scenario: Which of recurring and urgent comes first does not change the plan

- **WHEN** a plan is computed containing both due recurring tasks and urgent tasks
- **THEN** every one of them is included, whatever order they are considered in
- **AND** the running total when the first non-urgent task is considered is the sum of all of them, whatever that order was
- **AND** the plan therefore contains the same tasks either way; only the order they are displayed in differs

### Requirement: A recurring task at rest reserves nothing

A recurring task that is at rest SHALL NOT be considered for the plan and SHALL NOT contribute its duration to the running total. The budget available to one-off tasks on a day when no recurring task is due SHALL be the full 60 minutes.

#### Scenario: The same tasks, on a day when the recurring task is at rest

Given the same three one-off tasks as the reservation example, on a day when recurring task R1 is at rest:

| #   | Task | Kind               | Duration | Total before | Rule applied   | Included | Total after |
| --- | ---- | ------------------ | -------- | ------------ | -------------- | -------- | ----------- |
| —   | R1   | recurring, at rest | 30m      | —            | not considered | **no**   | —           |
| 1   | H1   | high               | 45m      | 0            | 0 < 60         | yes      | 45          |
| 2   | M1   | medium             | 20m      | 45           | 45 < 60        | yes      | 65          |
| 3   | L1   | low                | 10m      | 65           | 65 is not < 60 | **no**   | 65          |

- **WHEN** the daily plan is computed
- **THEN** the plan contains H1 and M1
- **AND** M1 is included, where it was excluded on the day R1 was due
- **AND** the planned total is 65 minutes rather than 75
- **AND** R1 contributed nothing to the running total

### Requirement: Ordering within the selection

Due recurring tasks SHALL be considered before every one-off task, whatever its priority. Two tasks within the same group — two due recurring tasks, or two one-off tasks of the same priority — SHALL be considered in the order of the places the user has arranged them in. They SHALL never be reordered relative to each other by their duration, nor by their creation timestamp. The selection SHALL NOT attempt to fit more work into the budget by considering shorter tasks earlier.

#### Scenario: Same priority is broken by age, not by length

Given three pending medium-priority tasks, none ever reordered, so their places match their creation order:

| Place | Task | Created | Duration |
| ----- | ---- | ------- | -------- |
| 1     | M1   | 09:00   | 45m      |
| 2     | M2   | 10:00   | 5m       |
| 3     | M3   | 11:00   | 20m      |

- **WHEN** these tasks are considered for the daily plan
- **THEN** they are considered in the order M1, M2, M3
- **AND** M2 is not considered before M1 despite being much shorter

#### Scenario: The arranged place overrides age

Given three pending medium-priority tasks the user has arranged against their creation order:

| Place | Task | Created | Duration |
| ----- | ---- | ------- | -------- |
| 1     | M3   | 11:00   | 20m      |
| 2     | M1   | 09:00   | 45m      |
| 3     | M2   | 10:00   | 5m       |

- **WHEN** these tasks are considered for the daily plan
- **THEN** they are considered in the order M3, M1, M2
- **AND** M1 is not considered first despite being the oldest

#### Scenario: Recurring tasks are considered in their arranged order, ahead of everything

Given two due recurring tasks and one urgent task:

| Place | Task | Kind           | Duration |
| ----- | ---- | -------------- | -------- |
| 1     | U1   | urgent         | 15m      |
| 2     | R2   | recurring, due | 10m      |
| 3     | R1   | recurring, due | 20m      |

- **WHEN** these tasks are considered for the daily plan
- **THEN** they are considered in the order R2, R1, U1
- **AND** R2 precedes R1 because its place is earlier
- **AND** both precede U1 despite holding later places, because due recurring tasks are considered first

### Requirement: The non-urgent selection is frozen for the day

Once computed, the non-urgent part of the daily plan SHALL NOT change until the plan is recomputed. Completing a task SHALL NOT pull another task into the plan, a non-urgent task created after the plan was computed SHALL NOT enter the Today tab that day, and reordering tasks SHALL NOT add a task to the plan or remove one from it.

#### Scenario: Completing a task frees no space

- **WHEN** the user completes a task that is part of today's plan
- **THEN** no additional task is added to the Today tab
- **AND** the remaining plan is unchanged

#### Scenario: A newly created non-urgent task waits for the next day

- **WHEN** the user creates a task with priority high, medium, low, or very low after today's plan was computed
- **THEN** the task appears in the All tab immediately
- **AND** the task does not appear in the Today tab until the plan is next recomputed

#### Scenario: A reordering waits for the next computation

- **WHEN** the user reorders tasks after today's plan was computed
- **THEN** the plan contains exactly the tasks it contained before the reordering
- **AND** the new order is used the next time the plan is computed

### Requirement: A reordering changes the plan at the next computation

A reordering SHALL take effect when the plan is next computed — on a day rollover or through "Recalculate today" — and not before. At that computation the plan SHALL be built from the arranged order, which MAY admit a task that was previously excluded and MAY exclude a pending, unfinished task that was previously in the plan.

No separate action to apply an order to the current day SHALL exist beyond "Recalculate today".

#### Scenario: A reordering evicts an unfinished task at the next computation

Given five pending tasks, none urgent, arranged in the order listed. The plan computed from this arrangement is:

| #   | Place | Task | Priority | Duration | Total before | Rule applied   | Included | Total after |
| --- | ----- | ---- | -------- | -------- | ------------ | -------------- | -------- | ----------- |
| 1   | 1     | H1   | high     | 30m      | 0            | 0 < 60         | yes      | 30          |
| 2   | 2     | M1   | medium   | 15m      | 30           | 30 < 60        | yes      | 45          |
| 3   | 3     | M2   | medium   | 30m      | 45           | 45 < 60        | yes      | 75          |
| 4   | 4     | M3   | medium   | 20m      | 75           | 75 is not < 60 | **no**   | 75          |
| 5   | 5     | L1   | low      | 10m      | 75           | 75 is not < 60 | **no**   | 75          |

The Today tab therefore contains H1, M1, and M2. The user then moves M3 above M1, so the medium tasks are arranged M3, M1, M2 in places 2, 3, and 4.

- **WHEN** the user reorders M3 above M1
- **THEN** the Today tab still contains H1, M1, and M2
- **WHEN** the plan is next computed, whether by day rollover or by "Recalculate today"
- **THEN** the computation runs as follows:

| #   | Place | Task | Priority | Duration | Total before | Rule applied   | Included | Total after |
| --- | ----- | ---- | -------- | -------- | ------------ | -------------- | -------- | ----------- |
| 1   | 1     | H1   | high     | 30m      | 0            | 0 < 60         | yes      | 30          |
| 2   | 2     | M3   | medium   | 20m      | 30           | 30 < 60        | yes      | 50          |
| 3   | 3     | M1   | medium   | 15m      | 50           | 50 < 60        | yes      | 65          |
| 4   | 4     | M2   | medium   | 30m      | 65           | 65 is not < 60 | **no**   | 65          |
| 5   | 5     | L1   | low      | 10m      | 65           | 65 is not < 60 | **no**   | 65          |

- **AND** the plan contains H1, M3, and M1
- **AND** M2 has left the plan even though it is pending and unfinished
- **AND** the planned total is 65 minutes rather than 75

### Requirement: A reordering can never push an urgent task out of the plan

Every pending urgent task SHALL be included in the plan at every computation, regardless of how tasks have been arranged. Because a task cannot be moved out of its priority level by reordering, no non-urgent task SHALL ever be arranged ahead of an urgent one, and no arrangement SHALL cause an urgent task to be excluded.

#### Scenario: Urgent tasks survive any arrangement

Given four pending tasks whose urgent tasks alone approach the budget:

| Place | Task | Priority | Duration |
| ----- | ---- | -------- | -------- |
| 1     | U1   | urgent   | 30m      |
| 2     | U2   | urgent   | 30m      |
| 3     | U3   | urgent   | 15m      |
| 4     | H1   | high     | 10m      |

- **WHEN** the user reorders the urgent tasks in any arrangement and the plan is computed
- **THEN** U1, U2, and U3 are all in the plan
- **AND** the running total after the urgent tasks is 75 minutes in every arrangement
- **AND** H1 is excluded, because 75 is not less than 60

### Requirement: When a reordering changes the plan and when it does not

Reordering the tasks of a priority level SHALL change the plan's composition only when the running total crosses the 60-minute budget within that level. Reordering a level whose tasks are all included, or a level whose tasks are all excluded, SHALL leave the plan's composition and its planned total unchanged.

#### Scenario: Reordering a level that is wholly inside the plan changes nothing

Given three pending tasks:

| Place | Task | Priority | Duration | Total before | Rule applied | Included | Total after |
| ----- | ---- | -------- | -------- | ------------ | ------------ | -------- | ----------- |
| 1     | H1   | high     | 20m      | 0            | 0 < 60       | yes      | 20          |
| 2     | H2   | high     | 15m      | 20           | 20 < 60      | yes      | 35          |
| 3     | M1   | medium   | 30m      | 35           | 35 < 60      | yes      | 65          |

- **WHEN** the user moves H2 above H1 and the plan is computed
- **THEN** H2 is considered first, at a running total of 0, and is included, bringing the total to 15
- **AND** H1 is considered next, at 15, and is included, bringing the total to 35
- **AND** M1 is considered at 35 and is included, bringing the total to 65
- **AND** the plan contains the same three tasks, with the same planned total of 65 minutes

#### Scenario: Reordering a level that is wholly outside the plan changes nothing

Given the running total has already reached 65 minutes when the low level is reached, and the low level contains L1 at 10 minutes and L2 at 5 minutes:

- **WHEN** the user reorders L1 and L2 in any arrangement and the plan is computed
- **THEN** neither L1 nor L2 is included, because 65 is not less than 60
- **AND** the planned total remains 65 minutes

### Requirement: A task that becomes urgent enters the plan immediately

A pending task that becomes an unconditional member of the plan SHALL appear in the Today tab immediately, without waiting for a recomputation. A task becomes an unconditional member when it becomes urgent — whether created with urgent priority or edited to urgent — or when it becomes a due recurring task, whether created as one on a date its rule fires or converted into one.

No task SHALL be removed from the plan to make room, so the planned total MAY grow beyond the budget during the day.

A recurring task SHALL NOT become due partway through a day on its own. Due-ness changes only when the local calendar date changes, which is when the plan is recomputed in any case.

#### Scenario: An urgent task created mid-day is admitted

At the start of the day, three tasks are pending and the plan is computed:

| #   | Task | Priority | Duration | Total before | Rule applied   | Included | Total after |
| --- | ---- | -------- | -------- | ------------ | -------------- | -------- | ----------- |
| 1   | H1   | high     | 45m      | 0            | 0 < 60         | yes      | 45          |
| 2   | M1   | medium   | 30m      | 45           | 45 < 60        | yes      | 75          |
| 3   | L1   | low      | 5m       | 75           | 75 is not < 60 | **no**   | 75          |

- **WHEN** the user later creates task U1 with priority urgent and duration 20 minutes
- **THEN** U1 appears in the Today tab immediately
- **AND** H1 and M1 remain in the Today tab
- **AND** L1 is still absent, because the frozen selection did not change
- **AND** the planned total is now 95 minutes

#### Scenario: A recurring task created mid-day on one of its own occurrence dates is admitted

Continuing from the plan above, computed on Monday 24 August 2026 with a planned total of 75 minutes:

- **WHEN** the user creates task R1 as a recurring task with a rule of every Monday and duration 20 minutes
- **AND** the current date is Monday 24 August 2026, so R1 is due the day it is created
- **THEN** R1 appears in the Today tab immediately, in the Recurring group
- **AND** H1 and M1 remain in the Today tab
- **AND** L1 is still absent, because the frozen selection did not change
- **AND** the planned total is now 95 minutes

#### Scenario: A recurring task created on a date its rule does not fire waits

- **WHEN** the user creates a recurring task with a rule of every Monday on Tuesday 25 August 2026
- **THEN** the task does not appear in the Today tab
- **AND** it appears in the All tab immediately, in the Recurring group
- **AND** it appears in the Today tab on Monday 31 August, when the plan is next computed

#### Scenario: An existing task edited to urgent is admitted

- **WHEN** the user edits a pending task that is not in today's plan and sets its priority to urgent
- **THEN** the task appears in the Today tab immediately
- **AND** no task is removed from the Today tab to compensate

#### Scenario: A task converted into a due recurring task is admitted

- **WHEN** the user converts a pending one-off task that is not in today's plan into a recurring task whose rule fires today
- **THEN** the task appears in the Today tab immediately, in the Recurring group
- **AND** no task is removed from the Today tab to compensate

#### Scenario: A task that stops being urgent leaves the plan

- **WHEN** a task that is in the Today tab only because it is urgent — that is, it was not part of the frozen non-urgent selection — is edited to a non-urgent priority
- **THEN** the task no longer appears in the Today tab
- **AND** it remains in the All tab

#### Scenario: A task that stops being a due recurring task leaves the plan

- **WHEN** a task that is in the Today tab only because it was admitted as a due recurring task is converted to a non-urgent one-off task
- **THEN** the task no longer appears in the Today tab
- **AND** it remains in the All tab

#### Scenario: A frozen task edited to urgent and back stays in the plan

- **WHEN** a task that is part of the frozen non-urgent selection is edited to urgent and later edited back to a non-urgent priority
- **THEN** the task remains in the Today tab throughout
- **AND** it is displayed under the group matching its current priority

### Requirement: The plan is recomputed when the day changes

The system SHALL recompute the daily plan when the application is opened or returns to the foreground and the date of the stored plan is earlier than the current date. The system SHALL NOT rely on a background process running at midnight.

The current date SHALL be the calendar date in the device's local time zone at the moment of the check. A change of time zone SHALL therefore take effect immediately, and no plan SHALL be computed for a date earlier than the one already stored.

A recomputation SHALL first return to the pending state every recurring task that has become due again since it was last completed, and only then select the plan. A recurring task that has become due again SHALL therefore be shown as pending and not struck through, and SHALL be eligible for selection at that same recomputation.

#### Scenario: The day boundary follows the device's local time zone

- **WHEN** the device's local calendar date advances past the stored plan's date
- **THEN** the plan is recomputed on the next open or return to the foreground
- **AND** the decision uses the device's local date rather than any fixed or universal time zone

#### Scenario: Moving to a time zone where it is still the previous day

- **WHEN** the device's local calendar date becomes earlier than the stored plan's date
- **THEN** the stored plan is kept and is not recomputed
- **AND** the Today tab continues to show that plan

#### Scenario: Returning to the foreground after midnight

- **WHEN** the application is open across midnight and then returns to the foreground
- **AND** the stored plan is dated the previous day
- **THEN** the plan is recomputed for the current date from the tasks pending at that moment
- **AND** the Today tab shows the newly computed plan

#### Scenario: A recurring task becomes due again at a recomputation

A recurring task with a rule of every Monday, completed on Monday 24 August 2026, with the application next opened on Monday 31 August.

| Step | What happens |
| ---- | ------------ |
| 1 | The stored plan is dated 24 August, which is earlier than 31 August, so the plan is recomputed |
| 2 | The task's last completion, 24 August, is earlier than its most recent occurrence, 31 August, so the task returns to the pending state |
| 3 | The plan is selected, and the task is included unconditionally because it is a due recurring task |

- **WHEN** the application is opened on Monday 31 August
- **THEN** the task appears in the Today tab, in the Recurring group
- **AND** it is shown as pending rather than struck through
- **AND** its duration is counted in the running total before any one-off task is considered

#### Scenario: The plan does not change while the app stays in the foreground

- **WHEN** the application remains in the foreground and the date changes
- **THEN** the displayed plan is not replaced mid-interaction
- **AND** it is recomputed the next time the application returns to the foreground

#### Scenario: Reopening after several days away

- **WHEN** the application is opened and the stored plan is dated several days earlier
- **THEN** a single new plan is computed for the current date
- **AND** the intervening days produce no plans of their own
- **AND** tasks completed on those earlier days are not considered

#### Scenario: Reopening after several days away with a missed occurrence

A recurring task with a rule of every Monday, last completed on Monday 17 August 2026, with the application not opened on 24 August and next opened on Wednesday 26 August.

- **WHEN** the application is opened on Wednesday 26 August
- **THEN** a single new plan is computed for 26 August
- **AND** the recurring task is due, because its occurrence of 24 August was never completed
- **AND** it appears in the Today tab in the Recurring group
- **AND** exactly one such task appears, not one for each occurrence that passed

#### Scenario: Opening the application for the very first time

- **WHEN** the application is opened and no plan has ever been computed
- **THEN** a plan is computed for the current date

### Requirement: Manual recalculation

The user SHALL be able to rebuild the current day's plan on demand through a "Recalculate today" action. Recalculation SHALL apply the same selection algorithm to the tasks pending at that moment.

#### Scenario: Recalculating picks up newly created tasks

- **WHEN** the user creates several non-urgent tasks during the day and then triggers "Recalculate today"
- **THEN** the plan is recomputed from all currently pending tasks
- **AND** the newly created tasks are eligible for selection

#### Scenario: Recalculating reconsiders every pending task

- **WHEN** the user triggers "Recalculate today"
- **THEN** the plan is rebuilt from scratch rather than extended
- **AND** a task that was in the previous plan is included again only if the algorithm selects it

### Requirement: Empty daily plan

When no task qualifies for the daily plan, the Today tab SHALL show an empty state rather than an empty list with no explanation.

#### Scenario: No tasks exist at all

- **WHEN** the daily plan is computed and no tasks exist
- **THEN** the Today tab shows an empty state inviting the user to create a task

#### Scenario: Every task is already completed

- **WHEN** the daily plan is computed and every existing one-off task is already completed
- **AND** every existing recurring task is at rest
- **THEN** the Today tab shows an empty state

#### Scenario: Only at-rest recurring tasks exist

- **WHEN** the daily plan is computed, the only tasks that exist are recurring, and none of them is due
- **THEN** the Today tab shows an empty state
- **AND** the All tab still lists those recurring tasks, as the task-views capability defines

#### Scenario: Every planned task has been completed today

- **WHEN** the user completes every task in today's plan
- **THEN** the completed tasks remain visible in the Today tab, struck through
- **AND** no new task is pulled in to replace them
