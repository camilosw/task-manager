# daily-plan Specification

## Purpose

Defines which tasks make up the day's plan shown in the Today tab: how the selection is computed against a one-hour budget, how it stays frozen through the day while urgent work still gets in immediately, and when it is recomputed.

## Requirements

### Requirement: Composition of the daily plan

The Today tab SHALL show every pending urgent task, plus the frozen non-urgent selection computed at the start of the day. These two parts SHALL follow different rules: the urgent part is live and always complete, the non-urgent part is fixed for the day.

#### Scenario: The plan is the union of both parts

- **WHEN** the Today tab is displayed
- **THEN** it shows every pending task whose priority is urgent
- **AND** it shows the non-urgent tasks selected when the day's plan was last computed
- **AND** it shows no other task

### Requirement: Daily plan selection algorithm

The daily plan SHALL be computed by considering all pending tasks in priority order — urgent, high, medium, low, very low — and, within a priority level, oldest first by creation timestamp. A running total of included durations SHALL be maintained, starting at zero.

- Every urgent task SHALL be included, regardless of the running total.
- A non-urgent task SHALL be included if and only if the running total of the tasks already considered is strictly less than the 60-minute budget.
- Every included task, urgent ones included, SHALL add its duration to the running total.

Because the running total never decreases, once it reaches 60 minutes no further non-urgent task is included — selection effectively stops there. The budget is therefore a threshold that is crossed once, not a ceiling: the task that carries the total past 60 minutes is included, and nothing after it is.

The 60-minute budget SHALL be a fixed value in this change.

#### Scenario: Selection crosses the budget on its last task

Given four pending tasks, created in the order listed:

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

Given three pending tasks, none urgent, created in the order listed:

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
- **AND** the plan is a prefix of the priority order, not a best fit for the remaining time

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

### Requirement: Ordering within the selection

Two tasks of the same priority SHALL never be reordered relative to each other by their duration. The selection SHALL NOT attempt to fit more work into the budget by considering shorter tasks earlier.

#### Scenario: Same priority is broken by age, not by length

Given three pending medium-priority tasks:

| Task | Created | Duration |
| ---- | ------- | -------- |
| M1   | 09:00   | 45m      |
| M2   | 10:00   | 5m       |
| M3   | 11:00   | 20m      |

- **WHEN** these tasks are considered for the daily plan
- **THEN** they are considered in the order M1, M2, M3
- **AND** M2 is not considered before M1 despite being much shorter

### Requirement: The non-urgent selection is frozen for the day

Once computed, the non-urgent part of the daily plan SHALL NOT change until the plan is recomputed. Completing a task SHALL NOT pull another task into the plan, and a non-urgent task created after the plan was computed SHALL NOT enter the Today tab that day.

#### Scenario: Completing a task frees no space

- **WHEN** the user completes a task that is part of today's plan
- **THEN** no additional task is added to the Today tab
- **AND** the remaining plan is unchanged

#### Scenario: A newly created non-urgent task waits for the next day

- **WHEN** the user creates a task with priority high, medium, low, or very low after today's plan was computed
- **THEN** the task appears in the All tab immediately
- **AND** the task does not appear in the Today tab until the plan is next recomputed

### Requirement: A task that becomes urgent enters the plan immediately

A pending task that becomes urgent — whether created with urgent priority or edited to urgent — SHALL appear in the Today tab immediately, without waiting for a recomputation. No task SHALL be removed from the plan to make room, so the planned total MAY grow beyond the budget during the day.

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

#### Scenario: An existing task edited to urgent is admitted

- **WHEN** the user edits a pending task that is not in today's plan and sets its priority to urgent
- **THEN** the task appears in the Today tab immediately
- **AND** no task is removed from the Today tab to compensate

#### Scenario: A task that stops being urgent leaves the plan

- **WHEN** a task that is in the Today tab only because it is urgent — that is, it was not part of the frozen non-urgent selection — is edited to a non-urgent priority
- **THEN** the task no longer appears in the Today tab
- **AND** it remains in the All tab

#### Scenario: A frozen task edited to urgent and back stays in the plan

- **WHEN** a task that is part of the frozen non-urgent selection is edited to urgent and later edited back to a non-urgent priority
- **THEN** the task remains in the Today tab throughout
- **AND** it is displayed under the group matching its current priority

### Requirement: The plan is recomputed when the day changes

The system SHALL recompute the daily plan when the application is opened or returns to the foreground and the date of the stored plan is earlier than the current date. The system SHALL NOT rely on a background process running at midnight.

The current date SHALL be the calendar date in the device's local time zone at the moment of the check. A change of time zone SHALL therefore take effect immediately, and no plan SHALL be computed for a date earlier than the one already stored.

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

#### Scenario: The plan does not change while the app stays in the foreground

- **WHEN** the application remains in the foreground and the date changes
- **THEN** the displayed plan is not replaced mid-interaction
- **AND** it is recomputed the next time the application returns to the foreground

#### Scenario: Reopening after several days away

- **WHEN** the application is opened and the stored plan is dated several days earlier
- **THEN** a single new plan is computed for the current date
- **AND** the intervening days produce no plans of their own
- **AND** tasks completed on those earlier days are not considered

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

- **WHEN** the daily plan is computed and every existing task is already completed
- **THEN** the Today tab shows an empty state

#### Scenario: Every planned task has been completed today

- **WHEN** the user completes every task in today's plan
- **THEN** the completed tasks remain visible in the Today tab, struck through
- **AND** no new task is pulled in to replace them
