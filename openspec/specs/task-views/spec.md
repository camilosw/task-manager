# task-views Specification

## Purpose

Defines the three tabs the application presents — Today, All, and Completed — covering what each one lists, how tasks are grouped and ordered within them, and how a completed task is rendered in each.

## Requirements

### Requirement: Three tabs

The main screen SHALL present exactly three tabs: Today, All, and Completed. Today SHALL be the tab shown when the application opens.

#### Scenario: The tabs are available on the main screen

- **WHEN** the user opens the application
- **THEN** the Today, All, and Completed tabs are available
- **AND** the Today tab is the one displayed

### Requirement: Every task display shows name, duration, and priority

Wherever a task is listed, its name and duration SHALL be visible, and its priority SHALL be identifiable. Duration and priority SHALL each be shown as their own labelled element on the row, distinct from the name and from each other.

The priority level's name — Urgent, High, Medium, Low, or Very low — SHALL be present as text on every task row in every tab. Color MAY be used to reinforce the level and SHALL follow the appearance capability's assignment, but SHALL NOT be the only means of conveying it: with color removed, the priority of every listed task SHALL still be determinable.

#### Scenario: A listed task is legible at a glance

- **WHEN** a task is shown in any tab
- **THEN** its name and its duration are visible
- **AND** its priority level can be determined from the display

#### Scenario: Duration and priority are separately identifiable

- **WHEN** a task lasting 45 minutes with priority Urgent is shown in any tab
- **THEN** "45m" is displayed as its own element
- **AND** "Urgent" is displayed as its own element
- **AND** neither is only readable as part of the task's name

#### Scenario: Priority survives the removal of color

- **WHEN** tasks of all five priority levels are listed and color is disregarded
- **THEN** each task's priority is still readable as text on its row
- **AND** no two levels become indistinguishable

#### Scenario: A completed task still shows its duration and priority

- **WHEN** a completed task is shown in the Today tab, struck through, or in the Completed tab
- **THEN** its duration and its priority name are still visible
- **AND** the priority name is not struck through into illegibility

### Requirement: The Today tab groups tasks by priority

The Today tab SHALL group its tasks under headings by priority level, ordered urgent, high, medium, low, very low. A group with no tasks SHALL NOT be displayed, including its heading. Each heading SHALL name its priority level as text and MAY carry a color marker for that level; the color marker SHALL NOT be the only thing distinguishing one heading from another.

#### Scenario: Tasks are shown under their priority headings

- **WHEN** the Today tab contains two urgent tasks and one high-priority task
- **THEN** an urgent heading is shown with both urgent tasks beneath it
- **AND** a high heading is shown with the single high-priority task beneath it
- **AND** the urgent group appears above the high group

#### Scenario: Empty priority groups are hidden

- **WHEN** the Today tab contains no task of a given priority level
- **THEN** neither that group's heading nor an empty placeholder is displayed

#### Scenario: A heading names its level in text

- **WHEN** the Today tab shows a group of very low priority tasks
- **THEN** the heading reads "Very low"
- **AND** it is identifiable as the very low group without relying on its color

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

### Requirement: The All tab lists every pending task

The All tab SHALL list every task that has not been completed, whether or not it is part of the day's plan. It SHALL NOT list completed tasks.

#### Scenario: Tasks outside the daily plan are still listed

- **WHEN** a pending task was not selected for today's plan
- **THEN** it appears in the All tab
- **AND** it does not appear in the Today tab

#### Scenario: The All tab is empty

- **WHEN** no pending tasks exist
- **THEN** the All tab shows an empty state inviting the user to create a task

### Requirement: The Completed tab lists every completed task

The Completed tab SHALL list every task that has been completed, regardless of the day on which it was completed and regardless of whether it was ever part of a daily plan. Tasks SHALL be listed most recently completed first.

#### Scenario: A completed task is listed

- **WHEN** the user completes a task
- **THEN** the task appears in the Completed tab
- **AND** it appears above tasks completed earlier

#### Scenario: The Completed tab is empty

- **WHEN** no task has been completed
- **THEN** the Completed tab shows an empty state

### Requirement: Completing a task from the Today tab keeps it visible

A task completed from the Today tab SHALL remain visible in the Today tab, marked as completed and struck through, until the daily plan is next recomputed. It SHALL also appear in the Completed tab, and SHALL NOT appear in the All tab.

#### Scenario: A task completed in Today stays struck through

- **WHEN** the user completes a task from the Today tab
- **THEN** the task remains in its priority group in the Today tab, struck through and marked completed
- **AND** the task appears in the Completed tab
- **AND** the task no longer appears in the All tab

#### Scenario: The struck-through task disappears on recalculation

- **WHEN** the daily plan is recomputed, whether by day rollover or by the manual action
- **THEN** tasks completed before the recomputation are no longer shown in the Today tab

### Requirement: Completing a task from the All tab

Completing a task from the All tab SHALL remove it from that tab and place it in the Completed tab. If the task is also part of the current daily plan, it SHALL additionally appear struck through in the Today tab, exactly as if it had been completed there.

#### Scenario: Completing a task that is not in today's plan

- **WHEN** the user completes a task from the All tab that is not part of today's plan
- **THEN** the task disappears from the All tab
- **AND** the task appears in the Completed tab
- **AND** the Today tab is unaffected

#### Scenario: Completing a task that is also in today's plan

- **WHEN** the user completes a task from the All tab that is also shown in the Today tab
- **THEN** the task disappears from the All tab
- **AND** the task appears struck through in the Today tab
- **AND** the task appears in the Completed tab

### Requirement: Recalculate today is available from the Today tab

The "Recalculate today" action SHALL be reachable from the Today tab. Its effect on the plan is defined by the daily-plan capability. The action SHALL be positioned after the priority groups it acts on, SHALL be present whether or not the plan currently contains any task, and SHALL NOT appear on the All or Completed tabs.

#### Scenario: The action is reachable

- **WHEN** the user is viewing the Today tab
- **THEN** a "Recalculate today" action is available

#### Scenario: The action sits below the groups

- **WHEN** the Today tab shows one or more priority groups
- **THEN** the "Recalculate today" action appears after the last group rather than above the first

#### Scenario: The action is available on an empty plan

- **WHEN** the Today tab shows its empty state because no task qualifies for the plan
- **THEN** the "Recalculate today" action is still available

#### Scenario: The action is confined to the Today tab

- **WHEN** the user is viewing the All tab or the Completed tab
- **THEN** no "Recalculate today" action is presented
