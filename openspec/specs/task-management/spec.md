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

### Requirement: Task creation is opened on demand from a persistent control

The creation form SHALL NOT occupy the main screen when it is not in use. A persistent control labelled for adding a task SHALL be available on the main screen, and activating it SHALL open the creation form as a layer over the current tab. The control SHALL be present and behave identically on all three tabs — Today, All, and Completed — and opening the form SHALL NOT change which tab is displayed.

The form SHALL close when the user cancels it, when the user dismisses it, and when a creation succeeds. It SHALL stay open when a creation is rejected.

#### Scenario: The control is available on every tab

- **WHEN** the user is on the Today tab, the All tab, or the Completed tab
- **THEN** a control for adding a task is available
- **AND** it has an accessible name identifying it as the way to add a task
- **AND** it can be reached and activated from the keyboard

#### Scenario: Opening the form

- **WHEN** the user activates the add-task control from the All tab
- **THEN** the creation form is displayed over the All tab
- **AND** the All tab is still the tab in view behind it
- **AND** keyboard focus moves into the form

#### Scenario: The form starts empty every time it is opened

- **WHEN** the user opens the creation form
- **THEN** the name is empty
- **AND** no duration is selected
- **AND** no priority is selected

#### Scenario: Cancelling closes the form and discards the draft

- **WHEN** the user has entered a name and selected a duration, and then cancels
- **THEN** the form closes
- **AND** no task is created
- **AND** keyboard focus returns to the add-task control
- **AND** reopening the form shows an empty name with no selections

#### Scenario: Dismissing the form without the cancel control

- **WHEN** the creation form is open and the user presses Escape or activates the area outside the form
- **THEN** the form closes
- **AND** no task is created

#### Scenario: A successful creation closes the form

- **WHEN** the user submits a valid task
- **THEN** the task is created
- **AND** the form closes
- **AND** keyboard focus returns to the add-task control

#### Scenario: A rejected creation keeps the form open

- **WHEN** the user submits the form with a blank name but a duration and priority selected
- **THEN** the form stays open
- **AND** the message stating that a name is required is displayed inside it
- **AND** the selected duration and priority are still selected

#### Scenario: The form does not hide the tab permanently

- **WHEN** the creation form has been opened and then closed
- **THEN** the tab that was in view is fully visible and usable again

### Requirement: A pending task is completed through a checkbox on its row

Every task row SHALL carry a checkbox reflecting that task's completion state: unchecked while the task is pending, checked once it is completed. Checking the box of a pending task SHALL complete it. The checkbox of an already-completed task SHALL NOT be interactive, so completion cannot be undone by unchecking it. The checkbox SHALL be reachable and operable from the keyboard, and SHALL be associated with its task's name so that its purpose is unambiguous when the row is read out of context.

#### Scenario: Completing a task from its checkbox

- **WHEN** the user checks the checkbox on a pending task's row
- **THEN** the task is marked completed with the time of completion
- **AND** the checkbox is shown checked

#### Scenario: A completed task's checkbox cannot be unchecked

- **WHEN** a completed task's row is displayed
- **THEN** its checkbox is shown checked
- **AND** the checkbox is not interactive
- **AND** activating it leaves the task completed

#### Scenario: The checkbox is identifiable per task

- **WHEN** a row for the task "Submit quarterly report" is displayed
- **THEN** that row's checkbox is associated with the name "Submit quarterly report"

#### Scenario: The checkbox in each tab

- **WHEN** the Today tab shows a pending task and a task completed earlier today
- **THEN** the pending task's checkbox is unchecked and interactive
- **AND** the completed task's checkbox is checked and not interactive
- **AND** every checkbox in the All tab is unchecked and interactive, because that tab lists only pending tasks
- **AND** every checkbox in the Completed tab is checked and not interactive

#### Scenario: Completing from the keyboard

- **WHEN** the user moves focus to a pending task's checkbox and activates it from the keyboard
- **THEN** the task is completed

### Requirement: Editing and deleting are named controls on every task row

Each task row SHALL offer a control to edit the task and a control to delete it. Where these controls are drawn as icons without visible text, each SHALL carry an accessible name — "Edit" and "Delete" respectively — so the action is identifiable without seeing the icon. Both SHALL be reachable and operable from the keyboard. Deletion SHALL take effect immediately, with no intermediate confirmation step.

#### Scenario: The controls are named

- **WHEN** a task row is displayed
- **THEN** it offers a control with the accessible name "Edit"
- **AND** it offers a control with the accessible name "Delete"
- **AND** both are reachable from the keyboard

#### Scenario: The controls are present in every tab

- **WHEN** a task is shown in the Today, All, or Completed tab
- **THEN** the edit and delete controls are available on its row in each of them

#### Scenario: Deletion is immediate

- **WHEN** the user activates the delete control on a task row
- **THEN** the task is deleted straight away
- **AND** no confirmation step is presented

#### Scenario: Editing opens the form in place of the row

- **WHEN** the user activates the edit control on a task row
- **THEN** the row is replaced by a form pre-filled with the task's current name, duration, and priority
- **AND** cancelling the edit restores the row unchanged
