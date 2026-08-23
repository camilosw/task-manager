## MODIFIED Requirements

### Requirement: Task attributes

A task SHALL consist of a name, a duration, a priority level, a creation timestamp, a place in the order the user has arranged, and a completion state. The creation timestamp SHALL be recorded when the task is created and SHALL NOT change thereafter. The place in the order SHALL be assigned when the task is created and SHALL change only when the user reorders tasks.

Every task SHALL hold a distinct place, so the order of any two tasks is always defined. The creation timestamp SHALL NOT determine where a task is displayed or in what order it is considered for the daily plan; that is the place's role alone.

#### Scenario: A created task carries all attributes

- **WHEN** a task is created with name "Review the PR", duration 30 minutes, and priority high
- **THEN** the task has that name, duration, and priority
- **AND** the task is in the pending state
- **AND** the task records the moment it was created
- **AND** the task holds a place in the order, distinct from every other task's

#### Scenario: Editing does not alter the creation timestamp

- **WHEN** an existing task's name, duration, or priority is edited
- **THEN** the task's creation timestamp remains the value it had before the edit
- **AND** the task's place in the order remains the one it had before the edit

## ADDED Requirements

### Requirement: A new task takes the last place in the order

A newly created task SHALL take a place after every existing task, so it appears last among the tasks of its own priority level. This SHALL hold regardless of how the existing tasks have been arranged.

#### Scenario: A new task appears last among its peers

Given three existing medium tasks, arranged by the user in the order shown:

| Place | Task | Priority |
| ----- | ---- | -------- |
| 1     | M2   | medium   |
| 2     | M1   | medium   |
| 3     | M3   | medium   |

- **WHEN** the user creates a fourth medium task, M4
- **THEN** M4 takes place 4, after every existing task
- **AND** the medium tasks are ordered M2, M1, M3, M4
- **AND** the arrangement of M2, M1, and M3 relative to each other is unchanged

#### Scenario: A new task of a different priority still takes the last place

- **WHEN** the user creates a task whose priority level already contains tasks
- **THEN** the new task appears last among the tasks of that level
- **AND** the order of every other level is unchanged

### Requirement: Reordering a task within its priority level

The user SHALL be able to move a task to a different place among the tasks of its own priority level. Reordering SHALL exchange places only among the tasks of that level: no task of another priority level SHALL change place relative to any other task as a result.

Reordering SHALL NOT change a task's priority, name, duration, creation timestamp, or completion state. A reordering SHALL be recorded as soon as it is made, without a separate confirming action.

#### Scenario: Moving a task up its level

Given six pending tasks in the places shown:

| Place | Task | Priority |
| ----- | ---- | -------- |
| 1     | H1   | high     |
| 2     | M1   | medium   |
| 3     | M2   | medium   |
| 4     | M3   | medium   |
| 5     | H2   | high     |
| 6     | L1   | low      |

The medium tasks hold places 2, 3, and 4, in the order M1, M2, M3.

- **WHEN** the user moves M3 above M1
- **THEN** the medium tasks are ordered M3, M1, M2, holding the same places 2, 3, and 4 between them
- **AND** M3 holds place 2, M1 holds place 3, and M2 holds place 4
- **AND** H1 still holds place 1, H2 still holds place 5, and L1 still holds place 6
- **AND** the high tasks are still ordered H1, H2

#### Scenario: Reordering leaves every other level untouched

- **WHEN** the user reorders the tasks of one priority level
- **THEN** the order of the tasks of every other priority level is unchanged
- **AND** no task changes its priority level

#### Scenario: A reordering survives a restart

- **WHEN** the user reorders tasks and then closes and reopens the application
- **THEN** the tasks appear in the order the user arranged

### Requirement: A task keeps its place when its priority changes

Editing a task's priority SHALL NOT change its place in the order. The task SHALL therefore appear among the tasks of its new priority level at the position that place gives it, rather than being moved to the start or the end of that level.

Because a task that has never been reordered holds a place matching its creation order, a task promoted or demoted into a level whose tasks have never been reordered SHALL appear among them oldest first.

#### Scenario: A promoted task lands among its new peers by its place

Given four pending tasks, none ever reordered, so their places match their creation order:

| Place | Task | Created | Priority |
| ----- | ---- | ------- | -------- |
| 1     | A    | 08:00   | low      |
| 2     | B    | 09:00   | high     |
| 3     | C    | 10:00   | high     |
| 4     | D    | 11:00   | low      |

- **WHEN** the user edits A and sets its priority to high
- **THEN** A keeps place 1
- **AND** the high tasks are ordered A, B, C
- **AND** A appears first among the high tasks, not last, because its place precedes both B's and C's

#### Scenario: A promoted task lands by its place, not by its age, when peers have been reordered

Continuing from the arrangement above, the user first moves C above B, so C holds place 2 and B holds place 3.

- **WHEN** the user then edits A and sets its priority to high
- **THEN** A keeps place 1
- **AND** the high tasks are ordered A, C, B

#### Scenario: A demoted task keeps its place too

- **WHEN** the user lowers a task's priority to a level that already contains tasks
- **THEN** the task keeps the place it held
- **AND** it appears among the tasks of its new level at the position that place gives it
