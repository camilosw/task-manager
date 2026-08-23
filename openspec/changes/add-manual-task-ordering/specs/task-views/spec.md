## MODIFIED Requirements

### Requirement: Ordering within a list

Within a priority group in the Today tab, tasks SHALL be ordered by the place the user has arranged them in. In the All tab, tasks SHALL be ordered by priority level first and by that same place second. Neither tab SHALL order tasks by creation timestamp, and neither SHALL order them by duration.

Because a task that has never been reordered holds a place matching its creation order, both tabs SHALL show tasks oldest first within a priority level until the user reorders them.

#### Scenario: The All tab orders by priority then age

Given five pending tasks, none ever reordered, so their places match their creation order:

| Place | Task | Priority | Created |
| ----- | ---- | -------- | ------- |
| 1     | D    | very low | 07:00   |
| 2     | C    | medium   | 08:00   |
| 3     | A    | medium   | 09:00   |
| 4     | B    | urgent   | 11:00   |
| 5     | E    | high     | 12:00   |

- **WHEN** the All tab is displayed
- **THEN** the tasks appear in the order B, E, C, A, D
- **AND** C precedes A because its place is earlier, even though both are medium
- **AND** D appears last despite holding the earliest place of all, because its priority is lowest

#### Scenario: The All tab reflects a reordering

Continuing from the arrangement above, the user moves A above C, so A holds place 2 and C holds place 3.

- **WHEN** the All tab is displayed
- **THEN** the tasks appear in the order B, E, A, C, D
- **AND** only the two medium tasks changed position relative to each other

#### Scenario: Ordering within a Today group

- **WHEN** a priority group in the Today tab contains several tasks
- **THEN** they are listed in the order of the places the user has arranged them in
- **AND** a task completed today keeps its position in that order, struck through, rather than moving

## ADDED Requirements

### Requirement: The All tab groups tasks by priority

The All tab SHALL group its tasks under headings by priority level, ordered urgent, high, medium, low, very low, in the same way the Today tab does. A group with no tasks SHALL NOT be displayed, including its heading.

The grouping SHALL be visible rather than implied by ordering alone, because it is the boundary a reordering cannot cross.

#### Scenario: Pending tasks are shown under their priority headings

- **WHEN** the All tab contains two medium tasks and one low task
- **THEN** a medium heading is shown with both medium tasks beneath it
- **AND** a low heading is shown with the single low task beneath it
- **AND** the medium group appears above the low group

#### Scenario: Empty priority groups are hidden

- **WHEN** the All tab contains no pending task of a given priority level
- **THEN** neither that group's heading nor an empty placeholder is displayed

#### Scenario: The All tab is empty

- **WHEN** no pending tasks exist
- **THEN** the All tab shows an empty state inviting the user to create a task
- **AND** no priority headings are displayed

### Requirement: Tasks are reordered in the All tab only

The All tab SHALL be the only place a task's place in the order can be changed. The user SHALL be able to drag a task to a new position within its priority group there.

A task SHALL NOT be draggable out of its priority group. An attempt to drop a task into a different group SHALL leave every task's place unchanged and SHALL NOT alter the dragged task's priority. Abandoning a drag SHALL likewise leave every place unchanged.

Neither the Today tab nor the Completed tab SHALL offer a way to reorder tasks.

#### Scenario: Dragging within a group reorders

- **WHEN** the user drags a task to a new position within its own priority group in the All tab
- **THEN** the task appears at that position
- **AND** the order of every other priority group is unchanged

#### Scenario: A drop outside the group is rejected

- **WHEN** the user drags a task and releases it over a different priority group
- **THEN** the task returns to the position it held
- **AND** its priority is unchanged
- **AND** no other task changes position

#### Scenario: An abandoned drag changes nothing

- **WHEN** the user starts dragging a task and abandons the drag without dropping it
- **THEN** every task holds the position it held before the drag began

#### Scenario: The other tabs offer no reordering

- **WHEN** the user is viewing the Today tab or the Completed tab
- **THEN** no control for reordering tasks is offered there

### Requirement: Reordering is operable without a drag gesture

Reordering SHALL be operable by keyboard alone, so the order is not reachable only by users who can perform a pointer or touch drag. The keyboard path SHALL move a task within its priority group only, under the same rules as dragging, and SHALL produce the same result.

The control that begins a reordering SHALL carry an accessible name, and the outcome of a completed move SHALL be conveyed to assistive technology rather than only shown visually.

#### Scenario: A task is moved by keyboard

- **WHEN** the user moves a task within its priority group using the keyboard alone
- **THEN** the task takes its new position
- **AND** the resulting order is the same as if the task had been dragged there

#### Scenario: The keyboard path cannot leave the group

- **WHEN** the user attempts, by keyboard, to move a task past the last position of its priority group
- **THEN** the task stays at the last position of that group
- **AND** its priority is unchanged

#### Scenario: The reordering control is named

- **WHEN** a pending task is shown in the All tab
- **THEN** its reordering control carries an accessible name

### Requirement: Reordering does not change what the Today tab contains

Reordering tasks in the All tab SHALL NOT add a task to the Today tab, remove a task from it, or change which tasks it contains in any way. The Today tab SHALL, however, display the tasks it already contains in the new order, so the two tabs never disagree about the order of the same tasks.

The Completed tab SHALL be unaffected by a reordering; it stays ordered most recently completed first.

#### Scenario: A reordering re-sequences Today without changing its membership

Given the Today tab contains high task H1 and medium tasks M1 and M2, in that order, and the All tab additionally contains a pending medium task M3 that is not in today's plan:

- **WHEN** the user moves M2 above M1 in the All tab
- **THEN** the Today tab shows H1, then M2, then M1
- **AND** M3 still does not appear in the Today tab
- **AND** no task has been removed from the Today tab

#### Scenario: A reordering cannot pull a task into Today

- **WHEN** the user moves a pending task that is not part of today's plan to the first position of its priority group in the All tab
- **THEN** the task still does not appear in the Today tab
- **AND** it appears first among its group in the All tab

#### Scenario: The Completed tab ignores the arranged order

- **WHEN** the user reorders pending tasks in the All tab
- **THEN** the Completed tab still lists completed tasks most recently completed first
