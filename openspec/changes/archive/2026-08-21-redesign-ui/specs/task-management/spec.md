## ADDED Requirements

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
