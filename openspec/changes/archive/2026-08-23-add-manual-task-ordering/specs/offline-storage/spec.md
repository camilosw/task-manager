## MODIFIED Requirements

### Requirement: Tasks persist on the device

Tasks and their state SHALL be stored on the device and SHALL survive closing and reopening the application, reloading the page, and restarting the browser or device. The order the user has arranged tasks in SHALL be stored alongside them and SHALL survive the same events.

#### Scenario: Tasks survive a reload

- **WHEN** the user creates several tasks and then reloads the application
- **THEN** every task is still present with its name, duration, priority, and completion state
- **AND** every task is still present in the order the user arranged it in

#### Scenario: Edits and deletions persist

- **WHEN** the user edits or deletes a task and then reopens the application
- **THEN** the edit or deletion is still in effect

#### Scenario: A reordering persists

- **WHEN** the user reorders tasks within a priority group and then reopens the application
- **THEN** the tasks appear in the arranged order in both the All tab and the Today tab
- **AND** the order is unchanged by the reopening itself

## ADDED Requirements

### Requirement: Data stored before manual ordering keeps the order it already showed

Tasks stored by a version of the application that recorded no arranged order SHALL be given one when they are next read, and that order SHALL be the order those tasks were already being displayed in — oldest first within each priority level. The upgrade SHALL NOT reshuffle a user's tasks, and SHALL NOT change which tasks the stored daily plan contains.

The upgrade SHALL run once against the stored data and SHALL leave subsequent reads unaffected. Data already carrying an arranged order SHALL be left untouched.

#### Scenario: Upgrading preserves the order the user last saw

Given stored tasks written before this change, carrying no arranged order:

| Task | Priority | Created |
| ---- | -------- | ------- |
| A    | medium   | 09:00   |
| B    | urgent   | 11:00   |
| C    | medium   | 08:00   |
| D    | very low | 07:00   |
| E    | high     | 12:00   |

- **WHEN** the application is opened for the first time after the upgrade
- **THEN** the All tab shows B, E, C, A, D — the same order it showed before the upgrade
- **AND** every task holds a distinct place in the order
- **AND** the places follow creation order, so a task later promoted to a higher priority level appears among its new peers oldest first

#### Scenario: The upgrade does not disturb the stored daily plan

- **WHEN** stored data written before this change is upgraded
- **THEN** the stored plan's date is unchanged
- **AND** the Today tab contains exactly the tasks it contained before the upgrade
- **AND** no recomputation is triggered by the upgrade itself

#### Scenario: Reopening after the upgrade changes nothing further

- **WHEN** the application is closed and reopened after the upgrade has run
- **THEN** the arranged order is the one recorded at the upgrade, or whatever the user has since arranged
- **AND** it is not recomputed from creation timestamps again

#### Scenario: First launch with no stored data needs no upgrade

- **WHEN** the application is opened on a device with no stored data
- **THEN** no upgrade is attempted
- **AND** the application starts with no tasks
