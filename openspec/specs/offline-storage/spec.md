# offline-storage Specification

## Purpose

Defines how the application behaves as an installable, offline-first product: tasks and the current day's plan survive between visits, everything works with no network available, and no data leaves the device.

## Requirements

### Requirement: Tasks persist on the device

Tasks and their state SHALL be stored on the device and SHALL survive closing and reopening the application, reloading the page, and restarting the browser or device.

#### Scenario: Tasks survive a reload

- **WHEN** the user creates several tasks and then reloads the application
- **THEN** every task is still present with its name, duration, priority, and completion state

#### Scenario: Edits and deletions persist

- **WHEN** the user edits or deletes a task and then reopens the application
- **THEN** the edit or deletion is still in effect

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
