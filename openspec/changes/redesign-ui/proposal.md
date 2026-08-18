## Why

The application's behavior is complete but its interface has never been designed: it renders unstyled semantic markup inherited from the project scaffold, with the creation form permanently occupying the top of the screen and priority conveyed only as a bare word. A reference design now exists at `mockups/task-manager.html`, and adopting it turns a working prototype into something that reads as a product — priorities legible at a glance, the day's plan scannable without effort, and a mobile-first surface appropriate for an installable PWA.

## What Changes

- A visual design system is introduced: a token layer for color, typography, spacing, and radius, expressed once and consumed everywhere, so the interface has a single source of truth for its appearance.
- The application gains **light and dark themes**. The initial theme follows the device's system preference; a control in the header lets the user override it, and that choice is remembered on the device.
- The app shell becomes **mobile-first and responsive**: full-bleed on narrow viewports, a centered column on wide ones. The reference design's phone frame is treated as a presentation device for the mockup and is deliberately **not** reproduced.
- **BREAKING (interaction)**: task creation moves out of an always-visible form at the top of the screen. A persistent add-task control opens the form on demand as a modal sheet, which dismisses on cancel or on a successful creation.
- **BREAKING (interaction)**: a pending task is completed through a checkbox on its row rather than a "Complete" button. Edit and delete become icon controls, each carrying an accessible name so the actions remain reachable without sight of the icon.
- Every task row shows its duration and its priority as distinct labelled elements, with priority carrying a color derived from its level. Color is a reinforcement, never the sole carrier of meaning — the priority's name stays present as text.
- Today's priority group headings are restyled with a color marker per level, and the "Recalculate today" action is repositioned below the groups it acts on.
- Completing, deleting, creating a task, and recalculating the day each produce a **transient confirmation message** that appears briefly and then disappears on its own.
- Typography uses the platform's system font stack rather than the reference design's webfont, so the interface renders identically on first launch with no network available and no font assets to vendor in.
- Task creation keeps its current validation: duration and priority start unselected, and submitting without them is rejected with a message naming what is missing. The reference design's preselected defaults are deliberately not adopted, because they would make that rejection unreachable.

### Deliberately out of scope

- No change to the selection algorithm, the 60-minute budget, the day-boundary rules, or what is persisted about a task. This change is presentation and interaction only.
- No new runtime dependency — no component library, styling framework, animation library, or icon package.
- No per-task user-chosen colors, no reordering by drag, no task search or filtering, no settings screen beyond the theme control.
- No translation or localization: all user-facing text stays English.
- No high-contrast or reduced-motion theme variants beyond honoring the platform's reduced-motion preference for the transitions this change introduces.

## Capabilities

### New Capabilities

- `appearance`: how the application presents itself — the light and dark themes, how the initial theme is chosen, how the user overrides it, how that override survives a restart, and how the app shell adapts to viewport width.
- `action-feedback`: the transient confirmation shown after a task is created, completed, or deleted, and after the day is recalculated — when it appears, how long it stays, and how it reaches assistive technology.

### Modified Capabilities

- `task-management`: creating a task changes from an always-visible form to one opened on demand from a persistent control and dismissed on success or cancel; completing a pending task changes from a button to a checkbox; edit and delete become icon controls that must carry accessible names. What a valid task is, and the validation rules for creating and editing one, are unchanged.
- `task-views`: adds the requirement that a task's priority remain identifiable without relying on color — the level's name is always present as text — and pins the placement of the "Recalculate today" action relative to the priority groups.

## Impact

- The entire UI layer is restyled, and three of its pieces change shape: the creation form becomes a dismissible sheet behind a trigger, the task row gains a checkbox and icon actions, and the app shell gains a header control and a feedback region.
- The global stylesheet is replaced. The scaffold's inherited styles — the fixed 1126px centered column, the oversized headings, the code/counter rules — are removed rather than overridden.
- Existing UI tests break by construction and are updated as part of this change: they query a "Complete" button that becomes a checkbox, and a creation form that is no longer on screen until its trigger is used. The behavior they assert is unchanged, so each is rewritten to the new controls, not weakened.
- Domain, persistence, and daily-plan logic are untouched. Their tests must keep passing without modification, which is the signal that this change stayed within presentation.
- No dependency is added or removed. The document shell gains theme-aware metadata so the browser and installed app render their own chrome to match the active theme.
