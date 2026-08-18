## Purpose

Defines how the application presents itself: the light and dark themes, how the initial theme is chosen and how the user overrides it, how that choice survives a restart, how each priority level is colored, and how the layout adapts from a narrow phone to a wide desktop viewport.

## ADDED Requirements

### Requirement: The application has a light theme and a dark theme

The application SHALL present exactly two themes, light and dark. Every element the application can display — headings, tab bar, task rows, group headings, priority indicators, duration indicators, form fields, buttons, the creation sheet, empty states, validation messages, and transient confirmations — SHALL be rendered legibly in both. No element SHALL be visible in one theme and invisible in the other.

#### Scenario: Every surface renders in both themes

- **WHEN** the application is displayed in the light theme and then in the dark theme
- **THEN** every heading, tab, task row, group heading, priority indicator, duration indicator, form field, button, empty state, validation message, and confirmation is legible in both
- **AND** no text is rendered in the same color as the surface behind it in either theme

#### Scenario: Empty states render in both themes

- **WHEN** the Today, All, or Completed tab has nothing to list
- **THEN** its empty state is legible in the light theme
- **AND** it is legible in the dark theme

#### Scenario: The browser and installed application chrome match the active theme

- **WHEN** the active theme is dark
- **THEN** the surrounding chrome the platform draws around the application is dark
- **AND** it is light when the active theme is light

### Requirement: The initial theme follows the device's system preference

When no theme has been explicitly chosen by the user on this device, the application SHALL open in the theme matching the device's system color-scheme preference, and SHALL follow that preference if it changes while the application is open.

#### Scenario: First launch on a device set to dark

- **WHEN** the application is opened for the first time on a device whose system preference is dark
- **THEN** the application opens in the dark theme
- **AND** no theme choice is recorded on the device

#### Scenario: First launch on a device set to light

- **WHEN** the application is opened for the first time on a device whose system preference is light
- **THEN** the application opens in the light theme

#### Scenario: The system preference changes with no explicit choice recorded

- **WHEN** the user has never overridden the theme
- **AND** the device's system preference switches from light to dark while the application is open
- **THEN** the application switches to the dark theme

### Requirement: The user can override the theme

A control SHALL be available on the main screen that switches the application between the light and dark themes. The control SHALL carry an accessible name describing what it does, and SHALL be reachable by keyboard. Switching the theme SHALL NOT change which tab is displayed, SHALL NOT close an open creation sheet, and SHALL NOT discard values already entered in a form.

#### Scenario: Switching from light to dark

- **WHEN** the application is showing the light theme and the user activates the theme control
- **THEN** the application switches to the dark theme immediately

#### Scenario: Switching back to light

- **WHEN** the application is showing the dark theme and the user activates the theme control
- **THEN** the application switches to the light theme immediately

#### Scenario: Switching the theme preserves the current context

- **WHEN** the user is on the All tab with the creation sheet open and a partially entered task name
- **AND** the user switches the theme
- **THEN** the All tab is still displayed
- **AND** the creation sheet is still open with the entered name intact

#### Scenario: The control is identifiable without sight of its icon

- **WHEN** the theme control is presented
- **THEN** it has an accessible name stating that it toggles between light and dark
- **AND** it can be activated from the keyboard

### Requirement: An explicit theme choice persists on the device

Once the user has overridden the theme, that choice SHALL be stored on the device, SHALL survive reloading and reopening the application, and SHALL take precedence over the device's system preference until it is changed again.

#### Scenario: The override survives a reload

- **WHEN** the user switches to the dark theme on a device whose system preference is light
- **AND** the application is reloaded
- **THEN** the application opens in the dark theme

#### Scenario: An explicit choice outranks a later system change

- **WHEN** the user has explicitly chosen the light theme
- **AND** the device's system preference then switches to dark
- **THEN** the application stays in the light theme

#### Scenario: A fresh installation has no stored choice

- **WHEN** the application is opened on a device where nothing has ever been stored
- **THEN** no theme choice is present
- **AND** the system preference decides the theme

### Requirement: Each priority level has its own color in both themes

Each of the five priority levels SHALL be assigned a distinct color, used consistently wherever that level appears — the priority indicator on a task row, the priority choices in a form, and the group headings in the Today tab. The five colors SHALL be distinguishable from one another within a theme, and each SHALL meet a legible contrast against the surface it is drawn on in both themes. Color SHALL reinforce the priority level, never replace its name; the task-views capability governs that requirement.

#### Scenario: The five levels are visually distinct

- **WHEN** tasks of all five priority levels are listed together
- **THEN** each level's indicator is drawn in a color distinct from the other four
- **AND** this holds in both the light and the dark theme

#### Scenario: A level's color is the same everywhere it appears

- **WHEN** a task is high priority
- **THEN** the color used for its indicator on the row, for the "High" choice in the form when selected, and for the "High" group heading in the Today tab is the same color

### Requirement: The layout adapts to the viewport width

The application SHALL be laid out mobile-first: on a narrow viewport it SHALL occupy the full width, and on a wide viewport it SHALL be constrained to a centered column rather than stretching across the screen. The application SHALL NOT render a simulated device frame around itself at any width. Content SHALL reflow without horizontal scrolling down to a viewport width of 320 pixels.

Traced against representative widths, where the column is capped at 480 pixels and the shell keeps a 16-pixel gutter on each side:

| Viewport width | Gutters | Width available | Column width | Result             |
| -------------- | ------- | --------------- | ------------ | ------------------ |
| 320            | 32      | 288             | 288          | full bleed         |
| 402            | 32      | 370             | 370          | full bleed         |
| 512            | 32      | 480             | 480          | capped, centered   |
| 1440           | 32      | 1408            | 480          | capped, centered   |

#### Scenario: A narrow viewport uses the full width

- **WHEN** the application is displayed at a viewport width of 402 pixels
- **THEN** the content spans the available width inside the shell's gutters
- **AND** no horizontal scrolling is required

#### Scenario: A wide viewport centers a capped column

- **WHEN** the application is displayed at a viewport width of 1440 pixels
- **THEN** the content is constrained to the capped column width and centered horizontally
- **AND** it does not stretch to the full 1440 pixels

#### Scenario: No simulated device frame is drawn

- **WHEN** the application is displayed at any viewport width
- **THEN** it is not enclosed in a rounded, bordered frame imitating a phone
- **AND** it does not scroll inside a fixed-height inner region while the page itself stays still

#### Scenario: The narrowest supported viewport

- **WHEN** the application is displayed at a viewport width of 320 pixels
- **THEN** every task row, form control, and button remains reachable
- **AND** no horizontal scrolling is required to read a task's name, duration, or priority

### Requirement: Motion honors the platform's reduced-motion preference

Any transition or animation this interface introduces SHALL be suppressed or reduced to an instant state change when the device requests reduced motion. No information SHALL be conveyed only through motion.

#### Scenario: Reduced motion is requested

- **WHEN** the device's system preference requests reduced motion
- **AND** the user opens the creation sheet, triggers a confirmation message, or switches the theme
- **THEN** the resulting state is applied without an animated transition
- **AND** the same content is present as it would be with animation enabled
