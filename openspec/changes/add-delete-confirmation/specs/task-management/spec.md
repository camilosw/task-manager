## MODIFIED Requirements

### Requirement: Editing and deleting are named controls on every task row

Each task row SHALL offer a control to edit the task and a control to delete it. Where these controls are drawn as icons without visible text, each SHALL carry an accessible name — "Edit" and "Delete" respectively — so the action is identifiable without seeing the icon. Both SHALL be reachable and operable from the keyboard. Activating the delete control SHALL NOT delete the task immediately: it SHALL first present a confirmation step naming the task and offering a control to confirm the deletion and a control to cancel it. The task SHALL be deleted only once the user confirms; cancelling, or otherwise dismissing the confirmation step without confirming, SHALL leave the task unchanged. The confirmation step's confirm and cancel controls SHALL be reachable and operable from the keyboard.

#### Scenario: The controls are named

- **WHEN** a task row is displayed
- **THEN** it offers a control with the accessible name "Edit"
- **AND** it offers a control with the accessible name "Delete"
- **AND** both are reachable from the keyboard

#### Scenario: The controls are present in every tab

- **WHEN** a task is shown in the Today, All, or Completed tab
- **THEN** the edit and delete controls are available on its row in each of them

#### Scenario: Deleting a task requires confirmation

- **WHEN** the user activates the delete control on a task row
- **THEN** a confirmation step is presented naming the task
- **AND** the task is not deleted yet

#### Scenario: Deletion is immediate

- **WHEN** the user confirms the deletion in the confirmation step
- **THEN** the task is deleted straight away, with no further step
- **AND** the confirmation step closes

#### Scenario: Cancelling the deletion

- **WHEN** the user cancels the confirmation step, including by dismissing it without choosing confirm
- **THEN** the task is not deleted
- **AND** the confirmation step closes
- **AND** the task row is unchanged

#### Scenario: The confirmation step is reachable from the keyboard

- **WHEN** the confirmation step is presented
- **THEN** its confirm and cancel controls are reachable and operable from the keyboard

#### Scenario: Editing opens the form in place of the row

- **WHEN** the user activates the edit control on a task row
- **THEN** the row is replaced by a form pre-filled with the task's current name, duration, and either its priority or its repetition rule
- **AND** the form shows the task type the task currently has
- **AND** cancelling the edit restores the row unchanged

#### Scenario: Deleting a recurring task ends it for good

- **WHEN** the user deletes a recurring task and confirms the deletion
- **THEN** the task is gone from every tab
- **AND** it does not return at its next occurrence
