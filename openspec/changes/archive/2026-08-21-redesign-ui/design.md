## Context

The behavior is finished and specified; the presentation never was. `src/index.css` is still the project scaffold's stylesheet — a fixed 1126px centered column, 56px headings, rules for `code` and `.counter` elements this app does not render — and no component carries a single class name. Priority reaches the user as the bare word "Medium" in an unstyled `<span>`.

See proposal.md — Why for motivation, and the four spec deltas for the behavior this change must produce. The constraints that shape the approach:

- **No new runtime dependency.** Styling, icons, the modal layer, and the confirmation region are all built from what React and the platform already provide.
- **Offline-first.** Nothing may be fetched at runtime, which rules out the reference design's Google-hosted webfont.
- **Test-first, and the existing suite is the safety net.** 2,369 lines of tests exist. The domain, persistence, and `AppStateProvider` suites (1,404 lines) assert behavior this change does not touch and must keep passing **unmodified** — that is the signal the redesign stayed inside the presentation layer. The three view suites break by construction and are rewritten to the new controls.
- **The test environment is thinner than the browser.** Probed directly against this project's jsdom (`jsdom@^29.1.1`): `HTMLDialogElement.prototype.showModal` is **undefined**, and `window.matchMedia` is **undefined**. Both decisions below account for that rather than discovering it during implementation.

The reference design at `mockups/task-manager.html` is a design-canvas export. Its markup, its full token palette, and its per-priority color formula were extracted and are the source of the values below.

## Goals / Non-Goals

**Goals:**

- One token layer, declared once, that every component consumes — so the theme is a property of the document, not of each component.
- Presentation changes stay in `src/ui/` and the stylesheets. `src/domain/`, `src/persistence/`, and `AppStateProvider` are not edited.
- Every behavior the spec deltas pin down is reachable from a test in jsdom, without asserting against a stub that cannot fail.

**Non-Goals:**

- No CSS architecture beyond what nine components need. No utility framework, no theming abstraction over the custom properties, no component library.
- No visual regression or screenshot testing. Assertions are on structure, accessible names, and state — not on computed pixels.
- No change to the tab control's semantics (see decision 11), to task ordering, or to the wording of the empty state.

## Decisions

### 1. Plain CSS with prefixed class names, not CSS Modules and not inline styles

Styles live in `src/styles/` (tokens, reset, base) plus one stylesheet per component, imported by that component. Class names are prefixed by their component: `.task-row`, `.task-row__name`, `.task-row__meta`.

- **Inline styles, as the mockup uses** — rejected. The mockup recomputes every style object on every render because a canvas prototype has no cascade available. Inline styles cannot express `:hover`, `:focus-visible`, `@media (prefers-color-scheme)`, or `@media (prefers-reduced-motion)`, all four of which this change requires.
- **CSS Modules** (zero-config in Vite, so no dependency cost) — rejected. It solves collisions, which a nine-component app with a prefix convention does not have, and it costs a `.module.css` indirection plus hashed class names in every DOM dump a failing test prints.

### 2. Theming is three-state CSS custom properties, driven by one `data-theme` attribute

`src/styles/tokens.css` declares the complete light palette on bare `:root`. Only the tokens that differ are redeclared twice:

```css
:root { /* complete light palette */ }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) { /* dark overrides */ }
}
:root[data-theme='dark'] { /* the same dark overrides */ }
```

This is exactly the three states the appearance spec requires, expressed in the cascade rather than in JavaScript:

| `data-theme` on `<html>` | System preference | Active theme | Spec scenario                                    |
| ------------------------ | ----------------- | ------------ | ------------------------------------------------ |
| absent                   | light             | light        | "First launch on a device set to light"          |
| absent                   | dark              | dark         | "First launch on a device set to dark"           |
| absent                   | changes           | follows      | "The system preference changes with no choice"   |
| `light`                  | dark              | light        | "An explicit choice outranks a later system change" |
| `dark`                   | light             | dark         | "The override survives a reload"                 |

React's only job is to set or remove one attribute. The alternative — reading the preference in JS and always writing an explicit `data-theme` — was rejected because it makes "follow the system" a value that must be recomputed and re-listened to, and because with `matchMedia` absent under test it would resolve every jsdom test to a hardcoded default.

Tokens are ported verbatim from the mockup, including its oklch values:

| Token            | Light                  | Dark                   |
| ---------------- | ---------------------- | ---------------------- |
| `--bg`           | `oklch(0.985 .003 250)`| `oklch(0.19 .012 260)` |
| `--surface`      | `#ffffff`              | `oklch(0.235 .014 260)`|
| `--surface-2`    | `oklch(0.965 .006 250)`| `oklch(0.28 .016 260)` |
| `--border`       | `oklch(0.885 .008 250)`| `oklch(0.34 .018 260)` |
| `--text`         | `oklch(0.2 .02 260)`   | `oklch(0.95 .006 260)` |
| `--text-muted`   | `oklch(0.5 .018 260)`  | `oklch(0.68 .014 260)` |
| `--text-faint`   | `oklch(0.64 .012 260)` | `oklch(0.5 .012 260)`  |
| `--accent`       | `oklch(0.5 .16 258)`   | `oklch(0.72 .135 258)` |
| `--accent-text`  | `#ffffff`              | `oklch(0.15 .03 258)`  |
| `--danger`       | `oklch(0.53 .19 25)`   | `oklch(0.68 .16 25)`   |

### 3. Priority colors are thirty declared values, not a runtime formula

The mockup derives each priority's three colors from a hue/chroma pair through a function called on every render. Here they are flattened into declared tokens — `--priority-urgent-marker`, `--priority-urgent-bg`, `--priority-urgent-fg`, and the same triple for the other four levels — declared in both theme blocks. Five levels are a closed set fixed by the domain; a function that computes what could be written down buys nothing and moves color into JavaScript, where the theme switch would have to recompute it.

Hue and chroma per level, carried over from the mockup: urgent `22/0.17`, high `55/0.15`, medium `95/0.13`, low `178/0.10`, very low `260/0.015`. Lightness follows the mockup's rule — marker `0.55` light / `0.72` dark, badge background `0.94` / `0.28`, badge text `0.38` / `0.86`.

### 4. Theme state lives in its own provider and persists to `localStorage`, not the repository

A `ThemeProvider` and `useTheme` hook, independent of `AppStateProvider`. The preference is stored under one key by a single module, `src/ui/themeStorage.ts`.

- **Storing it in the existing repository** — rejected. The repository is asynchronous and IndexedDB-backed; the theme must be known before the first paint or the app flashes the wrong one. It would also change the repository's persisted shape, breaking the contract tests in `src/persistence/` that this change must leave untouched. The theme is not task data.
- **Keeping it in React state only** — rejected outright: the spec requires it to survive a reload.

`localStorage` is synchronous and same-origin, so nothing leaves the device and the offline-storage capability's guarantees are unaffected.

To prevent a flash of the wrong theme before React mounts, a small inline script in `index.html` reads the key and sets `data-theme` on `<html>`. It is inline and synchronous by necessity — a deferred module would run after first paint, which is the thing being avoided.

### 5. `matchMedia` is accessed through one guarded module

`window.matchMedia` does not exist in this project's jsdom. Every read goes through `src/ui/systemTheme.ts`, which feature-detects it and reports `'light'` when it is absent, so no component crashes under test. A `vitest.setup.ts` (registered as `test.setupFiles` in `vite.config.ts`) installs a controllable `matchMedia` stub, letting the "first launch on a device set to dark" and "system preference changes" scenarios be tested for real rather than skipped.

### 6. The creation sheet is a native `<dialog>` with focus and Escape handled explicitly in React

`<dialog>` gives the top layer, the backdrop, and background inertness in real browsers for free, with no focus-trap library.

`showModal` is undefined in this jsdom, so `vitest.setup.ts` also shims `showModal`/`close` to toggle the `open` property. That shim is deliberately dumb, which is why the two behaviors the spec actually pins — focus moves into the form on open, focus returns to the trigger on close — are implemented in React with a ref and an effect rather than left to the browser. Testing them against the shim would otherwise assert nothing. Escape is likewise handled by an explicit `onKeyDown` on the dialog rather than relying on the native `cancel` event, for the same reason.

- **A hand-rolled `div role="dialog" aria-modal="true"` with a focus trap** — rejected. It would be fully testable in jsdom but reimplements inertness and top-layer stacking that the platform already gets right, and a hand-written focus trap is the kind of code that is subtly wrong for years.

Note the spec requires focus movement and Escape, not a full focus trap; the trap is a bonus the platform provides in the browser and its absence under test is therefore not a coverage gap.

### 7. Confirmations are one always-mounted live region, driven by a UI-level hook

`src/ui/useActionFeedback.ts` holds `{ message }` plus a timer, and exposes `show(message)`. Each call clears the pending timer and starts a new one, which is what makes "a second action replaces the first" and "the interval restarts" fall out of the implementation rather than needing special cases.

The region is rendered **always**, empty when there is no message, with `aria-live="polite"` and `role="status"`. A live region inserted into the DOM at the same moment as its text is announced unreliably across screen readers; a region that is already present and whose text changes is announced dependably. This is the reason the empty element exists, and it is worth a comment in the code.

The hook wraps the store's actions **at the call site in `TaskManagerApp`** — not inside `AppStateProvider`.

- **Emitting feedback from `AppStateProvider`** — rejected. It would couple the state layer to a presentation concern and force edits to a provider whose 448-line test suite must keep passing unmodified. Wrapping at the boundary keeps the store ignorant of the UI, and makes the "a rejected action produces no confirmation" rule a plain `if (result.ok)` at the one place the result is already inspected.

The interval is **3000 ms**. The mockup uses 1800 ms, which is brisk for a message a screen reader has to finish announcing; 3000 ms is long enough to read and still short enough to be transient. It is a single named constant, so it is one edit if it proves wrong.

### 8. The completion checkbox is labelled by the task name, not by a duplicated string

`<input type="checkbox">` with `aria-labelledby` pointing at the `id` of the element already rendering the task's name (generated with `useId`). This satisfies "the checkbox is associated with the name" without putting the name in the DOM twice, where the two copies would drift after an edit.

A completed task's checkbox is `disabled`, matching the mockup. The trade-off: `disabled` removes it from the tab order, so a keyboard user tabbing through the Completed tab passes over the checkboxes. That is correct here — there is no action to take, since completion cannot be undone — and the state is still readable to a screen reader. `aria-disabled` with a suppressed handler was considered and rejected as the worse option: it keeps a control in the tab order that does nothing.

### 9. The responsive shell, and where the floating control sits

The shell is `width: 100%; max-width: 480px; margin-inline: auto` with a 16px gutter — the arithmetic traced in the appearance spec. No device frame, no fixed height, no inner scroll region: the page itself scrolls, which is what an installed PWA should do.

The add-task control is `position: fixed` so it stays reachable while the list scrolls, but it must stay glued to the column rather than to the viewport on a wide screen. Its horizontal placement is therefore `right: max(16px, calc(50% - 240px + 16px))` — 16px from the viewport edge while the column is full-bleed, and 16px inside the column's right edge once the 480px cap engages. Vertically it clears the home indicator on installed iOS with `bottom: calc(22px + env(safe-area-inset-bottom))`.

Because it floats over the content, the scroll area ends with a 96px spacer so the last task row and the "Recalculate today" action can always be scrolled clear of it.

### 10. Motion is declared once and disabled once

Transitions are short (120–220 ms) and confined to the sheet's entrance, the confirmation's entrance, and control hover/active states. A single global block disables them:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
  }
}
```

Nothing conveys information through motion, so suppressing it removes no meaning — which is what makes a blanket rule safe here rather than lazy.

### 11. Tabs stay `<button aria-pressed>` rather than becoming a `role="tablist"`

A true tablist would be more semantically precise, but it brings requirements — arrow-key navigation between tabs, `aria-selected`, `tabindex` roving — that none of the specs state, and it would rewrite the `switchTab` helper in all three view suites for no behavior the user gains. Deferred deliberately; the visual tab bar from the mockup is reproduced with the existing semantics.

### 12. Browser chrome color is set from JavaScript, not from media-scoped meta tags

A single `<meta name="theme-color">` whose `content` the theme hook updates. The usual trick — two meta tags scoped with `media="(prefers-color-scheme: ...)"` — resolves against the *system* preference, so it would show light chrome around a user who explicitly chose dark on a light-set device, contradicting the spec scenario. The manifest's static `theme_color` is updated to the light background as the install-time default, since a manifest value cannot vary.

### 13. The mockup's Today-group ordering is not adopted

The mockup sorts completed tasks to the bottom of each priority group. `task-views` requires oldest-first by creation timestamp within a group, with no completion term. The mockup's sort is a demo-data artifact; the spec wins, and `TodayTab`'s existing comparator is unchanged.

### 14. Icons are inline SVG in one module

`src/ui/icons.tsx` exports the seven icons the mockup uses (sun, moon, edit, trash, refresh, plus, close) as components rendering inline SVG with `aria-hidden="true"` and `focusable="false"`. Their accessible names come from the `aria-label` on the enclosing button, per the task-management delta. No icon package, and no sprite sheet to keep in sync.

## Risks / Trade-offs

- **Existing view tests break the moment the creation form moves behind a trigger** → This is intended and is sequenced explicitly: the three view suites are updated in their own task, before the components change, so each rewritten test is seen failing against the old UI for the right reason. `waitForLoaded` in all three suites currently anchors on `findByLabelText('Name')`, which no longer resolves; it is re-anchored on the add-task control.
- **The `showModal` shim could let a broken sheet pass** → Mitigated by decision 6: the behaviors under test (focus in, focus back, Escape) are implemented in React and asserted directly, so no assertion depends on the shim doing anything but toggling `open`.
- **`oklch` has no fallback** → Accepted. It is supported by every browser that supports the service worker and IndexedDB features this app already requires, so a fallback would guard a combination that cannot occur.
- **`localStorage` can throw** (Safari private mode, storage disabled) → Every read and write in `themeStorage.ts` is wrapped; on failure the app falls back to the system preference and the toggle still works for the session. A theme that fails to persist must never prevent the app from loading.
- **The inline anti-flash script duplicates the storage key** → The key is defined in `themeStorage.ts` and the inline script repeats the literal, since it cannot import. Both sites carry a comment naming the other; a mismatch shows up as a theme flash, which the manual check in the final task looks for specifically.
- **`prefers-reduced-motion` cannot be exercised in jsdom** (no `matchMedia`, and jsdom does not evaluate media queries in stylesheets) → Accepted as a manual verification step. Asserting it in jsdom would require testing the stylesheet as text, which pins the implementation rather than the behavior.
- **A 480px cap will look narrow to someone expecting a desktop layout** → It is the deliberate reading of a mobile-first reference design for an installable PWA, confirmed with the user before this design was written. It is one token if it changes.

## Migration Plan

No data migration: nothing about the persisted task or snapshot shape changes, and the new `localStorage` key is additive — its absence is the well-defined "no explicit choice" state. An existing installation opens after this change with every task intact and the theme following the device.

The scaffold's `src/index.css` is replaced rather than extended, so the removal of `#root`'s 1126px column and the `h1`/`h2`/`code` rules is a single reviewable step. Rollback is reverting the commit; no stored state would need undoing.

## Open Questions

None. The three questions that would have changed the specs — whether to reproduce the phone frame, whether to adopt the mockup's preselected form defaults, and whether to vendor the webfont — were resolved with the user before these artifacts were written, and their answers are recorded in the proposal and in decisions 9 and 2.
