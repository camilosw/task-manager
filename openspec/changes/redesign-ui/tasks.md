> Sequencing note: this change has no domain logic, so "domain before UI" reads here as **pure modules before providers before views**, and **persistence before what reads it** — `themeStorage` lands before `ThemeProvider`, which lands before the header control.
>
> Sections 1 and 8 are the two groups whose tasks carry no failing test. Section 1 is test infrastructure — its verification is that the existing suite still passes and that the tests in section 2 can now run at all. Section 8 is stylesheet work, which design.md's Non-Goals deliberately excludes from automated testing; it is verified by the manual pass in 9.4. Every other task states the test written first and the scenario it pins down.

## 1. Test environment

- [x] 1.1 Add `vitest.setup.ts` and register it as `test.setupFiles` in `vite.config.ts`. It installs a controllable `window.matchMedia` stub with a `setSystemTheme('light' | 'dark')` helper, and shims `HTMLDialogElement.prototype.showModal`/`close` to toggle `open` (design.md decisions 5 and 6 — both are `undefined` in this jsdom). Verify by running `npm test`: all 2,369 lines of existing tests still pass, unchanged.

## 2. Theme — pure modules

- [x] 2.1 Test first: `src/ui/systemTheme.test.ts` — `readSystemTheme()` returns `'dark'` when the stub reports dark, `'light'` when it reports light, and `'light'` when `window.matchMedia` is absent. Pins decision 5's guard, which is what keeps every other component from crashing under test. Then write `src/ui/systemTheme.ts`.
- [x] 2.2 Test first: `subscribeToSystemTheme(cb)` calls `cb` with the new theme when the stub changes, returns a working unsubscribe, and is a no-op returning a no-op when `matchMedia` is absent. Pins appearance "The system preference changes with no explicit choice recorded".
- [x] 2.3 Test first: `src/ui/themeStorage.test.ts` — `readStoredTheme()` returns `null` when nothing is stored, round-trips `'dark'` and `'light'` through `storeTheme()`, and returns `null` (rather than throwing) when `localStorage` access throws. Pins decision 4 and the `localStorage`-can-throw risk. Then write `src/ui/themeStorage.ts`.

## 3. Theme — provider, toggle, and document wiring

- [x] 3.1 Test first: `src/ui/ThemeProvider.test.tsx` — with nothing stored and the system reporting dark, `<html>` carries **no** `data-theme` attribute and `useTheme()` reports a resolved theme of `'dark'`; with the system reporting light it reports `'light'`. Pins appearance "First launch on a device set to dark" / "set to light" and decision 2's absent-attribute state. Then write `src/ui/ThemeProvider.tsx` and `src/ui/useTheme.ts`.
- [x] 3.2 Test first: toggling writes `data-theme="dark"` to `<html>` and stores the choice; remounting with the system set to light still resolves dark. Pins "The override survives a reload" and "An explicit choice outranks a later system change".
- [x] 3.3 Test first: with no explicit choice stored, driving the `matchMedia` stub from light to dark updates the resolved theme without any attribute being written. Pins the system-follows scenario end to end.
- [x] 3.4 Test first: the header's theme control exposes an accessible name stating it toggles light and dark, is reachable from the keyboard, and switching does not change the active tab. Pins appearance "The control is identifiable without sight of its icon" and part of "Switching the theme preserves the current context" — the open-sheet half of that scenario is finished in 9.2, once the sheet exists.
- [x] 3.5 Test first: changing the theme updates the `content` of the single `<meta name="theme-color">` tag. Pins appearance "The browser and installed application chrome match the active theme" via decision 12.

## 4. Action feedback

- [x] 4.1 Test first: `src/ui/useActionFeedback.test.ts` — `show(msg)` exposes the message; with fake timers it clears itself after the interval; a second `show` replaces the first message and restarts the interval rather than stacking. Pins action-feedback "The confirmation disappears on its own" and "A second action replaces the first confirmation". Then write `src/ui/useActionFeedback.ts`.
- [x] 4.2 Test first: the feedback region is in the document **before** any action, is empty, carries `role="status"` and `aria-live="polite"`, and its text changes in place rather than the element being inserted. Pins decision 7's always-mounted region — the reason it exists is that a region inserted with its text is announced unreliably.
- [x] 4.3 Test first, in `TaskManagerApp.test.tsx`: creating shows "Task added", completing shows "Task completed", deleting shows "Task deleted", recalculating shows "Today recalculated" — and a creation rejected for a blank name shows the validation message with no "Task added". Pins action-feedback "A confirmation follows every completed action" and "A rejected action produces no confirmation". Wire `useActionFeedback` at the call site in `TaskManagerApp`; `AppStateProvider` is not edited.
- [x] 4.4 Test first: completing a task from the Today tab and from the All tab produces the identical message with the tab in view unchanged, and completing from the keyboard leaves focus on the checkbox. Pins "The confirmation is identical from every tab" and "Focus stays where the user left it".

## 5. Creation moves behind a control

- [ ] 5.1 Re-anchor the three view suites' shared helpers before touching the components: `waitForLoaded` in `TaskManagerApp.test.tsx`, `TaskViews.test.tsx`, and `Rollover.test.tsx` currently resolves on `findByLabelText('Name')`, which stops existing once the form is behind a trigger; re-anchor it on the add-task control, and make `createTaskViaForm` open the sheet first. Run them and confirm they fail against the current always-visible form for that reason and no other.
- [ ] 5.2 Test first: an add-task control with an accessible name identifying it as the way to add a task is present and keyboard-reachable on the Today, All, and Completed tabs. Pins task-management "The control is available on every tab".
- [ ] 5.3 Test first: activating it from the All tab renders the creation form over the All tab, leaves All as the tab in view, moves focus into the form, and shows an empty name with no duration or priority selected — every time it is opened. Pins "Opening the form" and "The form starts empty every time it is opened", including the decision to keep duration and priority unselected rather than adopting the mockup's defaults.
- [ ] 5.4 Test first: cancelling closes the form, creates nothing, returns focus to the trigger, and discards the draft; Escape closes it; a valid submission closes it and returns focus; a submission rejected for a blank name keeps it open with the chosen duration and priority still selected. Pins the four dismissal scenarios plus "A rejected creation keeps the form open".
- [ ] 5.5 Write `src/ui/CreateTaskSheet.tsx` as a native `<dialog>` with focus movement and Escape handled in React (decision 6), and remove the always-visible `CreateTaskForm` from the shell. Confirm 5.1's helpers now pass.

## 6. Task row controls

- [ ] 6.1 Test first: a pending task's row carries an unchecked checkbox that completes the task when checked, and the checkbox's accessible name is the task's name via `aria-labelledby` on the existing name element — not a duplicated string. Pins task-management "Completing a task from its checkbox" and "The checkbox is identifiable per task", and decision 8.
- [ ] 6.2 Test first: a completed task's checkbox is checked and not interactive, and activating it leaves the task completed; in the Today tab a pending and a completed row show the two states side by side; every All-tab checkbox is unchecked and interactive; every Completed-tab checkbox is checked and not interactive. Pins "A completed task's checkbox cannot be unchecked" and "The checkbox in each tab".
- [ ] 6.3 Replace the seven `getByRole('button', { name: 'Complete' })` interactions in `TaskViews.test.tsx` and `Rollover.test.tsx` with the checkbox. The behavior each test asserts does not change — only the control it drives. Then remove the "Complete" button from `TaskItem`.
- [ ] 6.4 Test first: every task row in every tab exposes controls with the accessible names "Edit" and "Delete", both keyboard-reachable, with deletion taking effect immediately and no confirmation step; editing replaces the row with a form pre-filled from the task and cancelling restores it unchanged. Pins task-management "Editing and deleting are named controls on every task row". The existing suites already query these names, so this is mostly a guard that the icon rewrite in 8.3 does not remove them.

## 7. What a task row and the Today tab show

- [ ] 7.1 Test first: a 45-minute Urgent task renders "45m" and "Urgent" as two separate elements, neither readable only as part of the name, in all three tabs — and a completed task still shows both. Pins task-views "Duration and priority are separately identifiable", "Priority survives the removal of color", and "A completed task still shows its duration and priority".
- [ ] 7.2 Test first: a Today group of very-low tasks has a heading reading "Very low" as text, identifiable without its color. Pins task-views "A heading names its level in text".
- [ ] 7.3 Test first: "Recalculate today" appears after the last priority group rather than above the first, is still available when the Today tab shows its empty state, and is absent from the All and Completed tabs. Pins the modified "Recalculate today is available from the Today tab" — the action moves from its current position above the groups.

## 8. Stylesheets

- [ ] 8.1 Replace `src/index.css` with a reset and base layer, deleting the scaffold's `#root` 1126px column, `h1`/`h2` sizing, and `code`/`.counter` rules outright rather than overriding them (design.md Migration Plan).
- [ ] 8.2 Write `src/styles/tokens.css`: the complete light palette on bare `:root`, the dark overrides in both `@media (prefers-color-scheme: dark) :root:not([data-theme='light'])` and `:root[data-theme='dark']`, and the thirty priority values from decision 3. No color may be declared only inside a media or attribute block.
- [ ] 8.3 Write the per-component stylesheets consuming only those tokens: shell and header, tab bar, task row with its priority badge and duration chip, form fields and duration/priority chips, the creation sheet, the add-task control, the feedback region, group headings, and the empty state. Replace the icons with the inline SVG module from decision 14, keeping every `aria-label` intact.
- [ ] 8.4 Apply the responsive shell — full-bleed to a 480px centered cap with 16px gutters — plus the add-task control's `right: max(16px, calc(50% - 240px + 16px))` placement, its `env(safe-area-inset-bottom)` offset, and the 96px bottom spacer that keeps the last row and the recalculate action scrollable clear of it (decision 9).
- [ ] 8.5 Add the global `prefers-reduced-motion` block from decision 10.

## 9. Integration and verification

- [ ] 9.1 Add the inline anti-flash script to `index.html` that sets `data-theme` from the stored key before React mounts, add the single `theme-color` meta tag it pairs with, and update the manifest's static `theme_color` in `vite.config.ts` to the light background. Cross-reference the duplicated storage key in both `index.html` and `themeStorage.ts` with a comment naming the other site (design.md risk).
- [ ] 9.2 Test first: with the creation sheet open and a name partially entered on the All tab, switching the theme leaves the All tab in view, the sheet open, and the entered name intact. Completes appearance "Switching the theme preserves the current context", deferred from 3.4 until the sheet existed.
- [ ] 9.3 Run the full suite. Confirm it passes, and confirm with `git diff --stat` that `src/domain/`, `src/persistence/`, and `src/ui/AppStateProvider.test.tsx` are untouched — that is the evidence this change stayed inside the presentation layer. Report any failure left unresolved rather than adjusting a test to match the code.
- [ ] 9.4 Manual pass in a real browser, covering what jsdom cannot: both themes on every tab and on every empty state; viewport widths 320, 402, 512, and 1440 with no horizontal scrolling; a reload with an explicit dark choice showing no light flash; `prefers-reduced-motion` suppressing the sheet and confirmation transitions; and the browser chrome matching an explicit choice that disagrees with the system preference.
- [ ] 9.5 Run `npm run lint`, `npm run format:check`, and `npm run build`, and fix anything they report.
