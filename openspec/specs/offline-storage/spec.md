# offline-storage Specification

## Purpose

Defines how the application behaves as an installable, offline-first product: tasks and the current day's plan survive between visits, everything works with no network available, and no data leaves the device.

## Requirements

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

### Requirement: Data stored before recurring tasks remains one-off work

Tasks stored by a version of the application that had no notion of recurrence SHALL be read as one-off tasks, keeping the priority, duration, name, completion state, and arranged order they already had. The upgrade SHALL NOT turn any stored task into a recurring one, SHALL NOT alter any stored value a user can see, and SHALL NOT change which tasks the stored daily plan contains.

The upgrade SHALL run once against the stored data and SHALL leave subsequent reads unaffected. Data already carrying the recurrence fields SHALL be left untouched.

#### Scenario: Upgrading changes nothing the user can see

Given stored tasks written before this change:

| Task | Priority | Duration | Completion state |
| ---- | -------- | -------- | ----------------- |
| A    | medium   | 30m      | pending           |
| B    | urgent   | 15m      | pending           |
| C    | high     | 45m      | completed         |

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

### Requirement: The daily plan persists on the device

The current day's plan SHALL be stored on the device together with the date it was computed for, so that reopening the application during the same day restores the same frozen plan rather than computing a new one.

#### Scenario: Reloading mid-day restores the same plan

- **WHEN** the user reloads the application on the same day the plan was computed
- **THEN** the Today tab shows the same non-urgent selection as before the reload
- **AND** no recomputation occurs

#### Scenario: Completions made earlier in the day are still reflected

- **WHEN** the user completes a task in the Today tab and later reloads the application on the same day
- **THEN** the task is still shown in the Today tab, struck through

#### Scenario: A stored plan from an earlier date triggers recomputation

- **WHEN** the application is opened and the stored plan's date is earlier than the current date
- **THEN** a new plan is computed for the current date and stored in place of the old one

### Requirement: The application works without a network connection

All functionality — viewing tabs, creating, editing, deleting, and completing tasks, and computing the daily plan — SHALL work with no network connection available. The application SHALL NOT require a server, an account, or a sign-in.

#### Scenario: Full use while offline

- **WHEN** the device has no network connection
- **THEN** the user can open the application and use every tab
- **AND** the user can create, edit, delete, and complete tasks
- **AND** the daily plan is computed normally

#### Scenario: No account is required

- **WHEN** a new user opens the application for the first time
- **THEN** they can create a task without signing in or registering

### Requirement: The application is installable

The application SHALL be installable on the device as a standalone application, and SHALL launch from the device's normal application entry point without browser navigation.

#### Scenario: Installing and launching

- **WHEN** the user installs the application from a supported browser
- **THEN** it can be launched as a standalone application
- **AND** it opens on the Today tab with the user's existing tasks intact

### Requirement: Data stays on the device

Task data SHALL NOT be transmitted off the device. The application SHALL NOT synchronize data between devices in this change.

#### Scenario: No data is sent anywhere

- **WHEN** the user creates, edits, completes, or deletes tasks
- **THEN** no task data is sent to any server

#### Scenario: A second device starts empty

- **WHEN** the user opens the application on a different device
- **THEN** none of the tasks from the first device are present

### Requirement: First launch with no stored data

The application SHALL open successfully when no data has ever been stored, presenting empty states rather than an error.

#### Scenario: Opening a fresh installation

- **WHEN** the application is opened for the first time on a device
- **THEN** it opens on the Today tab showing an empty state
- **AND** the All and Completed tabs also show empty states
- **AND** the user can immediately create a task
