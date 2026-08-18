# task-management Specification

## Purpose

Defines the task entity and everything a user can do to a single task: what a task is made of, the fixed set of durations and priority levels it may take, and how tasks are created, edited, deleted, and completed.

## Requirements

### Requirement: Task attributes

A task SHALL consist of a name, a duration, a priority level, a creation timestamp, and a completion state. The creation timestamp SHALL be recorded when the task is created and SHALL NOT change thereafter.

#### Scenario: A created task carries all attributes

- **WHEN** a task is created with name "Review the PR", duration 30 minutes, and priority high
- **THEN** the task has that name, duration, and priority
- **AND** the task is in the pending state
- **AND** the task records the moment it was created

#### Scenario: Editing does not alter the creation timestamp

- **WHEN** an existing task's name, duration, or priority is edited
- **THEN** the task's creation timestamp remains the value it had before the edit
- **AND** the task's position among tasks of the same priority is therefore unchanged

### Requirement: Duration is chosen from a fixed set

Task duration SHALL be selected from exactly nine options: 5, 10, 15, 20, 30, 45, 60, 90, and 120 minutes. The system SHALL NOT accept a duration outside this set, and SHALL NOT offer free-text entry of a duration.

#### Scenario: The nine options are offered

- **WHEN** the user is creating or editing a task
- **THEN** exactly nine duration choices are presented — 5m, 10m, 15m, 20m, 30m, 45m, 1h, 1.5h, and 2h
- **AND** the user selects one of them rather than typing a value

### Requirement: Five priority levels with a defined order

A task SHALL carry exactly one of five priority levels. The levels, from most to least important, SHALL be: urgent, high, medium, low, very low. This ordering SHALL be used wherever tasks are sorted or selected by priority.

#### Scenario: Priority ordering is total and fixed

- **WHEN** tasks of every priority level are ordered by importance
- **THEN** the resulting order is urgent, then high, then medium, then low, then very low
- **AND** no two levels are treated as equally important

### Requirement: Creating a task

Creating a task SHALL require a non-empty name, a selected duration, and a selected priority. The system SHALL reject a creation attempt that is missing any of the three.

#### Scenario: Creating a complete task

- **WHEN** the user submits a task with a non-empty name, a selected duration, and a selected priority
- **THEN** the task is created in the pending state
- **AND** the task becomes visible in the All tab

#### Scenario: Name is missing or blank

- **WHEN** the user attempts to create a task whose name is empty or contains only whitespace
- **THEN** the task is not created
- **AND** the user is shown that a name is required

#### Scenario: Duration or priority not selected

- **WHEN** the user attempts to create a task without selecting a duration, or without selecting a priority
- **THEN** the task is not created
- **AND** the user is shown which selection is missing

### Requirement: Editing a task

The user SHALL be able to change an existing task's name, duration, and priority. An edit SHALL take effect immediately everywhere the task is displayed.

#### Scenario: Editing a task's duration

- **WHEN** the user changes a task's duration from 30 minutes to 15 minutes
- **THEN** every view that displays the task shows 15 minutes

#### Scenario: Editing a task's priority regroups it

- **WHEN** the user changes a task's priority from medium to low
- **AND** that task is displayed in a view that groups tasks by priority
- **THEN** the task appears under the low group and no longer under the medium group

#### Scenario: An edit cannot produce an invalid task

- **WHEN** the user attempts to save an edit that clears the name
- **THEN** the edit is rejected and the task keeps its previous value

### Requirement: Deleting a task

The user SHALL be able to delete a task. A deleted task SHALL disappear from every tab and SHALL NOT be counted in any daily plan.

#### Scenario: A deleted task disappears everywhere

- **WHEN** the user deletes a task
- **THEN** the task is no longer shown in the Today, All, or Completed tab

#### Scenario: Deleting a task that is part of today's plan

- **WHEN** the user deletes a task that is currently shown in the Today tab
- **THEN** the task is removed from the Today tab immediately
- **AND** no replacement task is pulled into the Today tab to fill the freed time

### Requirement: Completing a task

The user SHALL be able to mark a pending task as completed. Completion SHALL record when it happened, and a completed task SHALL appear in the Completed tab. Completion SHALL be the same state change regardless of which tab it was performed from; only the resulting display differs, as defined by the task-views capability.

#### Scenario: Completing a pending task

- **WHEN** the user marks a pending task as completed
- **THEN** the task is recorded as completed with the time of completion
- **AND** the task appears in the Completed tab

#### Scenario: A completed task is no longer eligible for a daily plan

- **WHEN** a daily plan is computed
- **THEN** tasks already marked completed are not considered for selection
