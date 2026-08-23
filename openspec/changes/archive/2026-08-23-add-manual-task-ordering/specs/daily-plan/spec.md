## MODIFIED Requirements

### Requirement: Daily plan selection algorithm

The daily plan SHALL be computed by considering all pending tasks in priority order — urgent, high, medium, low, very low — and, within a priority level, in the order of the places the user has arranged them in. A running total of included durations SHALL be maintained, starting at zero.

- Every urgent task SHALL be included, regardless of the running total.
- A non-urgent task SHALL be included if and only if the running total of the tasks already considered is strictly less than the 60-minute budget.
- Every included task, urgent ones included, SHALL add its duration to the running total.

Because the running total never decreases, once it reaches 60 minutes no further non-urgent task is included — selection effectively stops there. The budget is therefore a threshold that is crossed once, not a ceiling: the task that carries the total past 60 minutes is included, and nothing after it is.

The 60-minute budget SHALL remain a fixed value.

#### Scenario: Selection crosses the budget on its last task

Given four pending tasks, arranged in the order listed:

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

Given three pending tasks, none urgent, arranged in the order listed:

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

### Requirement: Ordering within the selection

Two tasks of the same priority SHALL be considered in the order of the places the user has arranged them in. They SHALL never be reordered relative to each other by their duration, nor by their creation timestamp. The selection SHALL NOT attempt to fit more work into the budget by considering shorter tasks earlier.

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

## ADDED Requirements

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
