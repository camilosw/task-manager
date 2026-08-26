# task-management Specification

## Purpose

Defines the task entity and everything a user can do to a single task: what a task is made of, the fixed set of durations and priority levels it may take, and how tasks are created, edited, deleted, and completed.

## Requirements

### Requirement: Task attributes

A task SHALL consist of a name, a duration, either a priority level or a repetition rule, a creation timestamp, a place in the order the user has arranged, and a completion state. A task SHALL carry exactly one of a priority level or a repetition rule, never both and never neither; the recurring-tasks capability defines what a repetition rule is. A task carrying a repetition rule SHALL additionally record the date it was last completed, which SHALL be absent until it has been completed at least once.

The creation timestamp SHALL be recorded when the task is created and SHALL NOT change thereafter. The place in the order SHALL be assigned when the task is created and SHALL change only when the user reorders tasks.

Every task SHALL hold a distinct place, so the order of any two tasks is always defined. The creation timestamp SHALL NOT determine where a task is displayed or in what order it is considered for the daily plan; that is the place's role alone.

#### Scenario: A created task carries all attributes

- **WHEN** a task is created with name "Review the PR", duration 30 minutes, and priority high
- **THEN** the task has that name, duration, and priority
- **AND** the task carries no repetition rule
- **AND** the task is in the pending state
- **AND** the task records the moment it was created
- **AND** the task holds a place in the order, distinct from every other task's

#### Scenario: A created recurring task carries all attributes

- **WHEN** a task is created with name "Weekly review", duration 30 minutes, and a rule of every Monday
- **THEN** the task has that name, duration, and repetition rule
- **AND** the task carries no priority level
- **AND** the task records the moment it was created
- **AND** the task holds a place in the order, distinct from every other task's
- **AND** the task records no date of last completion until it is first completed

#### Scenario: Editing does not alter the creation timestamp

- **WHEN** an existing task's name, duration, priority, or repetition rule is edited
- **THEN** the task's creation timestamp remains the value it had before the edit
- **AND** the task's place in the order remains the one it had before the edit
- **AND** the date a recurring task was last completed remains the value it had before the edit

### Requirement: A new task takes the last place in the order

A newly created task SHALL take a place after every existing task, so it appears last among the tasks it is grouped with — the tasks of its own priority level for a one-off task, or the recurring tasks for a recurring one. This SHALL hold regardless of how the existing tasks have been arranged.

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

#### Scenario: A new recurring task appears last among the recurring tasks

- **WHEN** the user creates a recurring task while other recurring tasks already exist
- **THEN** the new task takes a place after every existing task
- **AND** it appears last among the recurring tasks
- **AND** the order of every priority level is unchanged

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

### Requirement: Duration is chosen from a fixed set

Task duration SHALL be selected from exactly nine options: 5, 10, 15, 20, 30, 45, 60, 90, and 120 minutes. The system SHALL NOT accept a duration outside this set, and SHALL NOT offer free-text entry of a duration.

#### Scenario: The nine options are offered

- **WHEN** the user is creating or editing a task
- **THEN** exactly nine duration choices are presented — 5m, 10m, 15m, 20m, 30m, 45m, 1h, 1.5h, and 2h
- **AND** the user selects one of them rather than typing a value

### Requirement: Five priority levels with a defined order

A task that is not recurring SHALL carry exactly one of five priority levels. The levels, from most to least important, SHALL be: urgent, high, medium, low, very low. This ordering SHALL be used wherever one-off tasks are sorted or selected by priority.

A recurring task SHALL NOT carry a priority level and SHALL NOT be placed on this ordering. It SHALL NOT be treated as more important than urgent, as less important than very low, or as equal to any level; it is grouped and ordered ahead of the priority ordering entirely, as the task-views and daily-plan capabilities define.

#### Scenario: Priority ordering is total and fixed

- **WHEN** one-off tasks of every priority level are ordered by importance
- **THEN** the resulting order is urgent, then high, then medium, then low, then very low
- **AND** no two levels are treated as equally important

#### Scenario: A recurring task is not placed on the priority ordering

- **WHEN** a recurring task and one-off tasks of every priority level are listed together
- **THEN** the recurring task is not compared against any priority level by importance
- **AND** it is presented in a group of its own rather than within any priority group

### Requirement: Creating a task

Creating a task SHALL require a non-empty name, a selected duration, and either a selected priority or a complete repetition rule. The system SHALL reject a creation attempt that is missing the name, the duration, or the priority-or-rule choice, and SHALL report every missing part rather than only the first.

#### Scenario: Creating a complete task

- **WHEN** the user submits a task with a non-empty name, a selected duration, and a selected priority
- **THEN** the task is created in the pending state
- **AND** the task becomes visible in the All tab

#### Scenario: Creating a complete recurring task

- **WHEN** the user submits a task with a non-empty name, a selected duration, and a complete repetition rule
- **THEN** the task is created as a recurring task
- **AND** the task becomes visible in the All tab
- **AND** it carries no priority level

#### Scenario: Name is missing or blank

- **WHEN** the user attempts to create a task whose name is empty or contains only whitespace
- **THEN** the task is not created
- **AND** the user is shown that a name is required

#### Scenario: Duration or priority not selected

- **WHEN** the user attempts to create a one-off task without selecting a duration, or without selecting a priority
- **THEN** the task is not created
- **AND** the user is shown which selection is missing

#### Scenario: Repetition rule incomplete

- **WHEN** the user attempts to create a recurring task without completing its repetition rule
- **THEN** the task is not created
- **AND** the user is shown that the rule is incomplete
- **AND** no priority is required of them, because the task is recurring

### Requirement: Editing a task

The user SHALL be able to change an existing task's name, duration, and either its priority or its repetition rule. The user SHALL also be able to convert a task between one-off and recurring. An edit SHALL take effect immediately everywhere the task is displayed.

#### Scenario: Editing a task's duration

- **WHEN** the user changes a task's duration from 30 minutes to 15 minutes
- **THEN** every view that displays the task shows 15 minutes

#### Scenario: Editing a task's priority regroups it

- **WHEN** the user changes a task's priority from medium to low
- **AND** that task is displayed in a view that groups tasks by priority
- **THEN** the task appears under the low group and no longer under the medium group

#### Scenario: Editing a recurring task's rule

- **WHEN** the user changes a recurring task's repetition rule
- **THEN** every view that displays the task shows the new rule
- **AND** which dates the task is due on changes as the recurring-tasks capability defines

#### Scenario: An edit cannot produce an invalid task

- **WHEN** the user attempts to save an edit that clears the name
- **THEN** the edit is rejected and the task keeps its previous value

#### Scenario: An edit cannot leave a task with neither a priority nor a rule

- **WHEN** the user attempts to save an edit that would leave a task without a priority and without a complete repetition rule
- **THEN** the edit is rejected and the task keeps its previous values
- **AND** the user is shown what is missing

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

The user SHALL be able to mark a pending task as completed. Completion SHALL record when it happened. Completion SHALL be the same state change regardless of which tab it was performed from; only the resulting display differs, as defined by the task-views capability.

For a one-off task, completion SHALL be final: the task SHALL appear in the Completed tab and SHALL never again be eligible for a daily plan.

For a recurring task, completion SHALL NOT be final. It SHALL additionally record the date of the completion and put the task at rest until its rule produces a later occurrence, as the recurring-tasks capability defines. A completed recurring task SHALL NOT appear in the Completed tab.

#### Scenario: Completing a pending task

- **WHEN** the user marks a pending one-off task as completed
- **THEN** the task is recorded as completed with the time of completion
- **AND** the task appears in the Completed tab

#### Scenario: Completing a recurring task

- **WHEN** the user marks a due recurring task as completed
- **THEN** the task is recorded as completed with the time of completion
- **AND** the date of the completion is recorded
- **AND** the task does not appear in the Completed tab
- **AND** the task becomes due again at its next occurrence

#### Scenario: A completed task is no longer eligible for a daily plan

- **WHEN** a daily plan is computed
- **THEN** one-off tasks already marked completed are not considered for selection
- **AND** recurring tasks that are at rest are not considered either

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
- **AND** the task type is set to one-off
- **AND** no priority is selected
- **AND** no repetition rule is built

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

#### Scenario: A rejected recurring creation keeps the rule that was built

- **WHEN** the user submits the form with a blank name, a duration selected, and a complete repetition rule built
- **THEN** the form stays open
- **AND** the task type is still set to recurring
- **AND** the repetition rule the user built is still in place

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

### Requirement: The creation and edit form offers a task type and a rule builder

The form used to create a task and to edit one SHALL offer an explicit choice of task type — one-off or recurring — and SHALL default to one-off when creating. Choosing one-off SHALL present the priority choices; choosing recurring SHALL present a repetition rule builder in their place. The two SHALL NOT be presented at the same time, so the exclusion between a priority and a rule is visible in the form rather than only enforced on submission.

The rule builder SHALL let the user choose between the two rule kinds the recurring-tasks capability defines, and then supply that kind's details: one or more days of the week for a weekly rule, or a position and a single day of the week for a monthly rule.

The form SHALL display the rule being built as a plain-language sentence, so the user can confirm the rule means what they intended before saving.

Switching the task type SHALL NOT discard the name or the duration already entered.

#### Scenario: The type choice is offered and defaults to one-off

- **WHEN** the user opens the creation form
- **THEN** a choice between a one-off task and a recurring task is presented
- **AND** one-off is the selected type
- **AND** the priority choices are presented
- **AND** no repetition rule builder is presented

#### Scenario: Choosing recurring replaces priority with the rule builder

- **WHEN** the user selects the recurring task type
- **THEN** the priority choices are no longer presented
- **AND** a repetition rule builder is presented in their place

#### Scenario: Building a weekly rule on several days

- **WHEN** the user chooses a weekly rule and selects Monday and Wednesday
- **THEN** both days are shown as selected
- **AND** the plain-language sentence describes a rule repeating every Monday and Wednesday

#### Scenario: Building a monthly rule

- **WHEN** the user chooses a monthly rule, selects the position "first", and selects Monday
- **THEN** the plain-language sentence describes a rule repeating on the first Monday of every month

#### Scenario: Switching type keeps the name and duration

- **WHEN** the user enters a name, selects a duration, and then switches the task type
- **THEN** the name and the duration are still in place
- **AND** only the priority-or-rule part of the form has changed

#### Scenario: The rule builder is operable from the keyboard

- **WHEN** the user reaches the task type choice and the rule builder from the keyboard
- **THEN** each choice can be reached and activated without a pointer
- **AND** the plain-language sentence is available to assistive technology

### Requirement: Converting a task between one-off and recurring

Editing a task SHALL be able to convert it from one-off to recurring and back. Converting SHALL replace the task's priority with its repetition rule, or its repetition rule with a priority, so the task always carries exactly one of the two.

Converting SHALL NOT change the task's name, duration, creation timestamp, or place in the order. Converting a recurring task to a one-off task SHALL NOT clear the date it was last completed, so converting it back does not make it due for an occurrence it had already completed.

A conversion's effect on the day's plan is defined by the daily-plan capability.

#### Scenario: Converting a one-off task to recurring

- **WHEN** the user edits a high-priority task and changes its type to recurring with a rule of every Monday
- **THEN** the task carries the rule and no priority
- **AND** its name, duration, creation timestamp, and place are unchanged
- **AND** it is presented in the Recurring group rather than the high group

#### Scenario: Converting a recurring task to a one-off task

- **WHEN** the user edits a recurring task and changes its type to one-off with priority medium
- **THEN** the task carries priority medium and no repetition rule
- **AND** it is presented in the medium group
- **AND** it is no longer due or at rest, because those states apply only to recurring tasks

#### Scenario: Converting back does not re-open a completed occurrence

A task with a rule of every Monday, last completed on Monday 24 August 2026, converted to a one-off task on Tuesday 25 August and converted back to the same rule on Wednesday 26 August.

| Current date | Most recent occurrence | Last completed | Due? |
| ------------ | ---------------------- | -------------- | ---- |
| Wed 26 Aug | 24 Aug | 24 Aug | no — 24 Aug is on or after 24 Aug |
| Mon 31 Aug | 31 Aug | 24 Aug | **yes** |

- **WHEN** the task is converted back to recurring on Wednesday 26 August
- **THEN** it is not due that day
- **AND** it becomes due again on Monday 31 August
