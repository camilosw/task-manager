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

Wherever a task is listed, its name and duration SHALL be visible, and its priority SHALL be identifiable.

#### Scenario: A listed task is legible at a glance

- **WHEN** a task is shown in any tab
- **THEN** its name and its duration are visible
- **AND** its priority level can be determined from the display

### Requirement: The Today tab groups tasks by priority

The Today tab SHALL group its tasks under headings by priority level, ordered urgent, high, medium, low, very low. A group with no tasks SHALL NOT be displayed, including its heading.

#### Scenario: Tasks are shown under their priority headings

- **WHEN** the Today tab contains two urgent tasks and one high-priority task
- **THEN** an urgent heading is shown with both urgent tasks beneath it
- **AND** a high heading is shown with the single high-priority task beneath it
- **AND** the urgent group appears above the high group

#### Scenario: Empty priority groups are hidden

- **WHEN** the Today tab contains no task of a given priority level
- **THEN** neither that group's heading nor an empty placeholder is displayed

### Requirement: Ordering within a list

Within a priority group in the Today tab, tasks SHALL be ordered oldest first by creation timestamp. In the All tab, tasks SHALL be ordered by priority level first and by creation timestamp — oldest first — second.

#### Scenario: The All tab orders by priority then age

Given five pending tasks:

| Task | Priority | Created |
| ---- | -------- | ------- |
| A    | medium   | 09:00   |
| B    | urgent   | 11:00   |
| C    | medium   | 08:00   |
| D    | very low | 07:00   |
| E    | high     | 12:00   |

- **WHEN** the All tab is displayed
- **THEN** the tasks appear in the order B, E, C, A, D
- **AND** C precedes A because it is older, even though both are medium
- **AND** D appears last despite being the oldest task of all, because its priority is lowest

#### Scenario: Ordering within a Today group

- **WHEN** a priority group in the Today tab contains several tasks
- **THEN** they are listed oldest first by creation timestamp

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

The "Recalculate today" action SHALL be reachable from the Today tab. Its effect on the plan is defined by the daily-plan capability.

#### Scenario: The action is reachable

- **WHEN** the user is viewing the Today tab
- **THEN** a "Recalculate today" action is available
