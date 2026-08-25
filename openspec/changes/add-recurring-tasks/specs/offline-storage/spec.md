## MODIFIED Requirements

### Requirement: Tasks persist on the device

Tasks and their state SHALL be stored on the device and SHALL survive closing and reopening the application, reloading the page, and restarting the browser or device. The order the user has arranged tasks in SHALL be stored alongside them and SHALL survive the same events.

A recurring task's repetition rule and the date it was last completed SHALL be stored alongside it and SHALL survive the same events. Because whether a recurring task is due is worked out from its rule, its creation date, and the date it was last completed, storing those three SHALL be sufficient for the task to reappear on the correct dates after any restart, with no other record kept.

#### Scenario: Tasks survive a reload

- **WHEN** the user creates several tasks and then reloads the application
- **THEN** every task is still present with its name, duration, priority, and completion state
- **AND** every task is still present in the order the user arranged it in

#### Scenario: A recurring task survives a reload

- **WHEN** the user creates a recurring task and then reloads the application
- **THEN** the task is still present with its name, duration, and repetition rule
- **AND** it carries no priority
- **AND** it is still in the order the user arranged it in

#### Scenario: A recurring task's cycle survives a restart

- **WHEN** the user completes a recurring task and then closes and reopens the application on the same day
- **THEN** the task is still at rest
- **AND** it does not reappear in the Today tab merely because the application was restarted
- **AND** it becomes due again at its next occurrence, as the recurring-tasks capability defines

#### Scenario: Edits and deletions persist

- **WHEN** the user edits or deletes a task and then reopens the application
- **THEN** the edit or deletion is still in effect

#### Scenario: A reordering persists

- **WHEN** the user reorders tasks within a priority group and then reopens the application
- **THEN** the tasks appear in the arranged order in both the All tab and the Today tab
- **AND** the order is unchanged by the reopening itself

## ADDED Requirements

### Requirement: Data stored before recurring tasks remains one-off work

Tasks stored by a version of the application that had no notion of recurrence SHALL be read as one-off tasks, keeping the priority, duration, name, completion state, and arranged order they already had. The upgrade SHALL NOT turn any stored task into a recurring one, SHALL NOT alter any stored value a user can see, and SHALL NOT change which tasks the stored daily plan contains.

The upgrade SHALL run once against the stored data and SHALL leave subsequent reads unaffected. Data already carrying the recurrence fields SHALL be left untouched.

#### Scenario: Upgrading changes nothing the user can see

Given stored tasks written before this change:

| Task | Priority | Duration | Completion state |
| ---- | -------- | -------- | ---------------- |
| A    | medium   | 30m      | pending          |
| B    | urgent   | 15m      | pending          |
| C    | high     | 45m      | completed        |

- **WHEN** the application is opened for the first time after this change
- **THEN** A, B, and C are all present, with the same names, priorities, durations, and completion states
- **AND** none of them carries a repetition rule
- **AND** none of them records a date of last completion
- **AND** they appear in the same order the user last saw

#### Scenario: The stored daily plan is unaffected by the upgrade

- **WHEN** the application is opened for the first time after this change and the stored plan is dated today
- **THEN** the Today tab shows exactly the tasks it showed before
- **AND** no Recurring group is displayed, because no stored task is recurring

#### Scenario: A fresh install runs no upgrade

- **WHEN** the application is opened on a device that has never stored any data
- **THEN** no upgrade of stored tasks is performed
- **AND** the application starts with no tasks, as it does on any first launch
