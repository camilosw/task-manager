## ADDED Requirements

### Requirement: Recurring tasks have their own color in both themes

Recurring tasks SHALL be assigned a distinct color of their own, used consistently wherever recurrence appears — the recurrence indicator on a task row, the recurring choice in a form when selected, and the Recurring group heading in the Today and All tabs.

That color SHALL be distinguishable from each of the five priority colors within a theme, so a recurring task is never mistakable for a priority level, and SHALL meet a legible contrast against the surface it is drawn on in both the light and the dark theme.

Color SHALL reinforce a task's recurrence, never replace the text that conveys it; the task-views capability governs that requirement.

#### Scenario: The recurring color is distinct from all five priority colors

- **WHEN** a recurring task and tasks of all five priority levels are listed together
- **THEN** the recurring indicator is drawn in a color distinct from each of the five priority colors
- **AND** this holds in both the light and the dark theme

#### Scenario: The recurring color is the same everywhere it appears

- **WHEN** a recurring task is displayed
- **THEN** the color used for its indicator on the row, for the recurring choice in the form when selected, and for the "Recurring" group heading is the same color

#### Scenario: The recurring color is legible in both themes

- **WHEN** the application is displayed in the light theme and again in the dark theme
- **THEN** the recurring color meets a legible contrast against the surface it is drawn on in each
