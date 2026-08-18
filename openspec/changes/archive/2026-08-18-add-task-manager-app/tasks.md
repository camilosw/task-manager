## 1. Project setup

- [x] 1.1 Scaffold a Vite React + TypeScript project at the repository root, leaving `openspec/` and `.claude/` untouched
- [x] 1.2 Add Vitest with the jsdom environment, React Testing Library, and `fake-indexeddb`; add a `test` script, then prove the harness can go red with a deliberately failing placeholder test before deleting it
- [x] 1.3 Create the layer directories `src/domain/`, `src/persistence/`, and `src/ui/`
- [x] 1.4 Add an import-boundary lint rule that fails the build if anything under `src/domain/` imports React or a storage API, and verify it fails on a deliberate violation before reverting

## 2. Domain — task model

- [x] 2.1 Write a failing test pinning the five priority levels and their order — urgent, high, medium, low, very low — then implement the priority type and its comparator
- [x] 2.2 Write a failing test pinning the nine allowed durations and rejecting any value outside them, then implement the duration type and its guard
- [x] 2.3 Write a failing test for duration display formatting (5 → "5m", 60 → "1h", 90 → "1.5h", 120 → "2h"), then implement the formatter
- [x] 2.4 Write a failing test that creating a task requires a non-empty trimmed name, a duration and a priority, then implement task creation, recording the creation timestamp from the injected `now`
- [x] 2.5 Write a failing test that editing preserves the creation timestamp and rejects a cleared name, then implement editing
- [x] 2.6 Write a failing test that completing a task records the completion time from the injected `now`, then implement completion

## 3. Domain — daily plan selection

- [x] 3.1 Write a failing test for the selection ordering — priority first, oldest first within a level, never reordered by duration — then implement the comparator
- [x] 3.2 Write a failing test for the overshoot example from the spec (urgent 15m, high 30m, medium 20m, low 10m → first three, total 65), then implement the selection function
- [x] 3.3 Add the exact-boundary example as a test (high 30m, medium 30m, low 5m → first two only); if it passes without a code change, confirm it can fail before moving on
- [x] 3.4 Add the urgent-only example as a test (urgent 45m, urgent 30m, high 5m → both urgent tasks, total 75); if it passes without a code change, confirm it can fail before moving on
- [x] 3.5 Write a failing test that completed tasks are never selected and that an empty task list yields an empty plan

## 4. Domain — day boundary

- [x] 4.1 Write a failing test that the local calendar date is derived from an injected `now` as `YYYY-MM-DD`, then implement the conversion
- [x] 4.2 Write a failing test covering all three comparisons — stored date earlier recomputes, equal does not, later does not — then implement the check using strict less-than

## 5. Domain — snapshot membership

- [x] 5.1 Write a failing test that membership is `plannedIds ∪ admittedIds` resolved against existing tasks, with unresolved IDs skipped, then implement resolution
- [x] 5.2 Write a failing test that a task becoming urgent is appended to `admittedIds` and that nothing is evicted to make room, then implement admission
- [x] 5.3 Write a failing test for the asymmetry — a task in `admittedIds` that stops being urgent is removed, while a task in `plannedIds` that goes urgent and back is kept — then implement removal
- [x] 5.4 Write a failing test that deleting a task prunes its ID from both lists, and that membership resolves correctly even when pruning has not happened, then implement pruning
- [x] 5.5 Write a failing test that recomputation replaces both lists wholesale rather than extending them, then implement recomputation

## 6. Persistence

- [x] 6.1 Define the repository port: load everything, save tasks, save the snapshot
- [x] 6.2 Write the shared contract suite against the port — round-trip tasks and snapshot, absent data yields empty state, timestamps survive serialization — then implement the in-memory repository until it passes
- [x] 6.3 Run the same contract suite unchanged against the IndexedDB implementation over `fake-indexeddb`, and implement it until green
- [x] 6.4 Write a failing test that reopening the database at the same version preserves existing data, then pin the database name and version

## 7. Application state

- [x] 7.1 Write a failing hook test that the store exposes a loading state which resolves once the repository has loaded, then implement the context provider
- [x] 7.2 Write a failing test that every mutation passes through a domain function and is persisted afterwards, then implement the reducer and the persistence effect
- [x] 7.3 Write a failing test that a plan is computed on first ever load when no snapshot exists, then wire it

## 8. UI — creating, editing and deleting

- [x] 8.1 Integration test and implement: the create form offers exactly nine duration buttons and five priority choices, and submitting a complete task adds it to the All tab
- [x] 8.2 Integration test and implement: a blank name is rejected with a visible message, and a missing duration or priority is rejected with a message naming what is missing
- [x] 8.3 Integration test and implement: editing a task updates it everywhere it is displayed, and clearing the name is rejected
- [x] 8.4 Integration test and implement: deleting a task removes it from every tab and pulls no replacement into Today

## 9. UI — the three tabs

- [x] 9.1 Integration test and implement: three tabs exist and Today is shown on open
- [x] 9.2 Integration test and implement: Today groups by priority in order, hides empty groups including their headings, and orders oldest first within a group
- [x] 9.3 Integration test and implement: All lists every pending task ordered by priority then age, and excludes completed tasks
- [x] 9.4 Integration test and implement: Completed lists completed tasks, most recently completed first
- [x] 9.5 Integration test and implement: completing from Today leaves the task struck through in place and removes it from All
- [x] 9.6 Integration test and implement: completing from All removes it from All, and strikes it through in Today when it is part of the plan
- [x] 9.7 Integration test and implement: every listed task shows its name, its duration, and an identifiable priority
- [x] 9.8 Integration test and implement: each tab shows "empty" when it has nothing to list

## 10. Rollover and recalculation

- [x] 10.1 Integration test and implement: returning to the foreground with a stored plan dated earlier recomputes the plan, and an equal date does not
- [x] 10.2 Integration test and implement: reopening after several days away produces a single plan for today, with no plans for the intervening days
- [x] 10.3 Integration test and implement: the plan is not replaced while the application stays in the foreground
- [x] 10.4 Integration test and implement: "Recalculate today" rebuilds the plan from scratch, admitting newly created tasks and dropping completed ones
- [x] 10.5 Integration test and implement: an urgent task created mid-day appears in Today immediately, and remains struck through after being completed
- [x] 10.6 Integration test and implement: a completed task in Today survives a reload still struck through, and the frozen selection is restored unchanged

## 11. PWA

- [x] 11.1 Add the SVG icon defined in design.md as the source artwork, and generate the 192×192, 512×512 and maskable PNG variants from it
- [x] 11.2 Configure `vite-plugin-pwa` with the manifest — name, icons, standalone display — and a service worker precaching the application shell
- [x] 11.3 Request persistent storage on first run, tolerating a refusal without failing the load

## 12. Manual verification

- [x] 12.1 Install the application on a device from a supported browser and confirm it launches standalone on the Today tab with existing tasks intact
- [x] 12.2 With the network disabled, confirm the application loads and that creating, editing, completing and deleting all work
- [x] 12.3 Record the outcome of both checks; if either fails, report it rather than marking the change complete

Outcome: both checks passed — install launched standalone on Today with existing tasks intact; offline mode loaded and create/edit/complete/delete all worked with the network disabled.
