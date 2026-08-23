## MODIFIED Requirements

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
