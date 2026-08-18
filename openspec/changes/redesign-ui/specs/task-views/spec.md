## MODIFIED Requirements

### Requirement: Every task display shows name, duration, and priority

Wherever a task is listed, its name and duration SHALL be visible, and its priority SHALL be identifiable. Duration and priority SHALL each be shown as their own labelled element on the row, distinct from the name and from each other.

The priority level's name — Urgent, High, Medium, Low, or Very low — SHALL be present as text on every task row in every tab. Color MAY be used to reinforce the level and SHALL follow the appearance capability's assignment, but SHALL NOT be the only means of conveying it: with color removed, the priority of every listed task SHALL still be determinable.

#### Scenario: A listed task is legible at a glance

- **WHEN** a task is shown in any tab
- **THEN** its name and its duration are visible
- **AND** its priority level can be determined from the display

#### Scenario: Duration and priority are separately identifiable

- **WHEN** a task lasting 45 minutes with priority Urgent is shown in any tab
- **THEN** "45m" is displayed as its own element
- **AND** "Urgent" is displayed as its own element
- **AND** neither is only readable as part of the task's name

#### Scenario: Priority survives the removal of color

- **WHEN** tasks of all five priority levels are listed and color is disregarded
- **THEN** each task's priority is still readable as text on its row
- **AND** no two levels become indistinguishable

#### Scenario: A completed task still shows its duration and priority

- **WHEN** a completed task is shown in the Today tab, struck through, or in the Completed tab
- **THEN** its duration and its priority name are still visible
- **AND** the priority name is not struck through into illegibility

### Requirement: The Today tab groups tasks by priority

The Today tab SHALL group its tasks under headings by priority level, ordered urgent, high, medium, low, very low. A group with no tasks SHALL NOT be displayed, including its heading. Each heading SHALL name its priority level as text and MAY carry a color marker for that level; the color marker SHALL NOT be the only thing distinguishing one heading from another.

#### Scenario: Tasks are shown under their priority headings

- **WHEN** the Today tab contains two urgent tasks and one high-priority task
- **THEN** an urgent heading is shown with both urgent tasks beneath it
- **AND** a high heading is shown with the single high-priority task beneath it
- **AND** the urgent group appears above the high group

#### Scenario: Empty priority groups are hidden

- **WHEN** the Today tab contains no task of a given priority level
- **THEN** neither that group's heading nor an empty placeholder is displayed

#### Scenario: A heading names its level in text

- **WHEN** the Today tab shows a group of very low priority tasks
- **THEN** the heading reads "Very low"
- **AND** it is identifiable as the very low group without relying on its color

### Requirement: Recalculate today is available from the Today tab

The "Recalculate today" action SHALL be reachable from the Today tab. Its effect on the plan is defined by the daily-plan capability. The action SHALL be positioned after the priority groups it acts on, SHALL be present whether or not the plan currently contains any task, and SHALL NOT appear on the All or Completed tabs.

#### Scenario: The action is reachable

- **WHEN** the user is viewing the Today tab
- **THEN** a "Recalculate today" action is available

#### Scenario: The action sits below the groups

- **WHEN** the Today tab shows one or more priority groups
- **THEN** the "Recalculate today" action appears after the last group rather than above the first

#### Scenario: The action is available on an empty plan

- **WHEN** the Today tab shows its empty state because no task qualifies for the plan
- **THEN** the "Recalculate today" action is still available

#### Scenario: The action is confined to the Today tab

- **WHEN** the user is viewing the All tab or the Completed tab
- **THEN** no "Recalculate today" action is presented
