# action-feedback Specification

## Purpose

Defines the transient confirmation the application shows after a task is created, completed, or deleted and after the day's plan is recalculated: what each one says, how long it stays on screen, and how it reaches a user who is not watching the screen.

## Requirements

### Requirement: A confirmation follows every completed action

After an action succeeds, the application SHALL display a short confirmation message naming what happened. The four actions and their messages SHALL be:

| Action                          | Message              |
| ------------------------------- | -------------------- |
| A task is created               | "Task added"         |
| A pending task is completed     | "Task completed"     |
| A task is deleted               | "Task deleted"       |
| The day's plan is recalculated  | "Today recalculated" |

This list SHALL be exhaustive. Reordering a task is deliberately absent from it: a completed reordering SHALL NOT display a confirmation, because the task visibly moving to its new position already reports the change, and a message after every adjustment in a run of them would be noise rather than confirmation. A reordering that is rejected or abandoned SHALL likewise display nothing.

The confirmation SHALL be informational only: it SHALL NOT offer an undo, and dismissing it SHALL NOT reverse anything.

#### Scenario: Creating a task confirms

- **WHEN** the user submits a valid new task
- **THEN** "Task added" is displayed

#### Scenario: Completing a task confirms

- **WHEN** the user marks a pending task as completed
- **THEN** "Task completed" is displayed

#### Scenario: Deleting a task confirms

- **WHEN** the user deletes a task
- **THEN** "Task deleted" is displayed

#### Scenario: Recalculating confirms

- **WHEN** the user triggers "Recalculate today"
- **THEN** "Today recalculated" is displayed
- **AND** the message appears whether or not the recomputed plan differs from the previous one

#### Scenario: Reordering a task confirms nothing

- **WHEN** the user moves a task to a new position within its priority group, by drag or by keyboard
- **THEN** no confirmation message is displayed
- **AND** the task is shown at its new position
- **AND** a confirmation already on screen from an earlier action is not replaced by the reordering

#### Scenario: A rejected reordering confirms nothing either

- **WHEN** the user releases a dragged task over a different priority group, or abandons a drag
- **THEN** no confirmation message is displayed
- **AND** no validation message is displayed, because nothing was rejected that the user needs to correct

### Requirement: The confirmation is identical from every tab

Completing and deleting are reachable from more than one tab. The confirmation SHALL be the same message, shown the same way, regardless of which tab the action was performed from, and SHALL NOT change the tab in view.

#### Scenario: Completing from the Today tab

- **WHEN** the user completes a task from the Today tab
- **THEN** "Task completed" is displayed
- **AND** the Today tab is still the tab in view

#### Scenario: Completing from the All tab

- **WHEN** the user completes a task from the All tab
- **THEN** "Task completed" is displayed, exactly as it is from the Today tab
- **AND** the All tab is still the tab in view

#### Scenario: Deleting from the Completed tab

- **WHEN** the user deletes a task from the Completed tab
- **THEN** "Task deleted" is displayed
- **AND** the Completed tab is still the tab in view

### Requirement: The confirmation disappears on its own

The confirmation SHALL disappear without user action after a short interval, and SHALL NOT require dismissing. It SHALL NOT block interaction: the user SHALL be able to continue working while it is visible, and SHALL be able to reach every control it might overlap.

#### Scenario: The message clears itself

- **WHEN** a confirmation is displayed and the user does nothing
- **THEN** the message disappears after a short interval
- **AND** no trace of it remains on screen

#### Scenario: Work continues while a confirmation is visible

- **WHEN** a confirmation is visible
- **THEN** the user can switch tabs, open the creation form, and act on a task without waiting for it to clear

### Requirement: A second action replaces the first confirmation

At most one confirmation SHALL be visible at a time. When an action occurs while a confirmation is still on screen, the new message SHALL replace the old one and the interval SHALL restart from that moment. Confirmations SHALL NOT accumulate into a stack.

#### Scenario: Two actions in quick succession

- **WHEN** the user completes a task and then immediately deletes another
- **THEN** only "Task deleted" is displayed
- **AND** "Task completed" is no longer visible
- **AND** the message disappears a full interval after the deletion, not after the completion

#### Scenario: Repeating the same action

- **WHEN** the user deletes two tasks in quick succession
- **THEN** a single "Task deleted" message is displayed, not two

### Requirement: The confirmation reaches assistive technology without stealing focus

The confirmation SHALL be announced to assistive technology when it appears, politely rather than interrupting. It SHALL NOT move keyboard focus, and its disappearance SHALL NOT be announced.

#### Scenario: A confirmation is announced

- **WHEN** a confirmation appears
- **THEN** its text is announced to assistive technology
- **AND** the announcement waits for any speech already in progress rather than interrupting it

#### Scenario: Focus stays where the user left it

- **WHEN** the user completes a task using the keyboard
- **THEN** the confirmation appears
- **AND** keyboard focus remains on the control the user was operating

### Requirement: A rejected action produces no confirmation

A confirmation SHALL be shown only for an action that actually took effect. An attempt rejected by validation SHALL produce its validation message instead, and no confirmation.

#### Scenario: A creation rejected for a blank name

- **WHEN** the user submits the creation form with a blank name
- **THEN** the message stating that a name is required is displayed
- **AND** "Task added" is not displayed

#### Scenario: A creation rejected for a missing selection

- **WHEN** the user submits the creation form without selecting a duration
- **THEN** the message naming the missing selection is displayed
- **AND** "Task added" is not displayed

#### Scenario: An edit rejected for a cleared name

- **WHEN** the user attempts to save an edit that clears the task's name
- **THEN** the message stating that a name is required is displayed
- **AND** no confirmation is displayed

### Requirement: The confirmation does not replace the state change it reports

The confirmation SHALL be redundant with what the tabs already show. The underlying change SHALL be visible in the tabs whether or not the message is noticed, and SHALL remain after the message has cleared.

#### Scenario: The first task created from an empty state

- **WHEN** the user creates the first task on a fresh installation, with every tab showing its empty state
- **THEN** "Task added" is displayed
- **AND** the task is listed in the All tab
- **AND** the task is still listed after the message has disappeared

#### Scenario: The change outlives the message

- **WHEN** the user deletes a task and waits for "Task deleted" to disappear
- **THEN** the task is still absent from the Today, All, and Completed tabs
