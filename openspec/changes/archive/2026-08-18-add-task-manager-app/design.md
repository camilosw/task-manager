## Context

See `proposal.md` — Why. The behavior contract lives in `specs/`; this document covers how it is built.

Three constraints shape everything below:

1. **The daily plan is stateful, not derived.** Because the non-urgent selection is frozen while urgent tasks are admitted live, the Today tab cannot be recomputed from the task list on every render. Something must be persisted.
2. **The day boundary depends on a clock the tests must control.** Rollover happens when the local calendar date advances, and no test can wait for midnight.
3. **There is no server.** Every decision about consistency, durability, and conflict resolution is a client-side decision, and there is nothing to fall back on when local data is lost.

## Goals / Non-Goals

**Goals:**

- Keep the selection algorithm and the day-boundary logic in pure functions that can be tested without rendering a component or touching storage.
- Make every scenario in `specs/daily-plan/spec.md` expressible as a direct unit test with no test doubles beyond a fixed clock.
- Keep persisted state minimal and explicit, so it is obvious what survives a reload and what is recomputed.

**Non-Goals:**

- Cross-tab or cross-window coordination. A single active instance is assumed.
- Any abstraction that anticipates a future backend. There is no server in this change, and designing a sync seam now would be speculative.
- A generic scheduling engine. The selection rule is fixed and small; it is implemented directly rather than parameterized.

## Decisions

### 1. Three layers, with a dependency-free domain core

The code is split into a domain layer (plain TypeScript), a persistence layer, and a React UI. The domain layer imports neither React nor any storage API, and holds the task rules, the selection algorithm, and the day-boundary logic.

```
   ┌──────────────────────────────────────┐
   │  UI (React)                          │  renders, dispatches intents
   ├──────────────────────────────────────┤
   │  Persistence (repository port)       │  load / save
   ├──────────────────────────────────────┤
   │  Domain (pure TypeScript)            │  ← all the rules live here
   │    selectDailyPlan, admitUrgent,     │
   │    needsRecompute, ordering, …       │
   └──────────────────────────────────────┘
```

**Why:** the risk in this change is concentrated in selection and rollover, and both are pure input-to-output transformations. Testing them through the UI would mean rendering components and simulating clicks to verify arithmetic, which is slower to write, slower to run, and worse at pinpointing failures.

**Alternative rejected — the rules live in React hooks:** fewer files, and no mapping between domain types and component state. Testability alone does not settle this: React Testing Library's `renderHook` makes a hook directly testable with no additional dependency, so "hooks are hard to test" is not a reason.

It is rejected because the selection rule has no React-shaped concerns — it is inputs to outputs, with no lifecycle, no effects, and no state of its own — and running it through the reconciler adds failure modes that belong to React rather than to the rule: stale closures, `act()` boundaries, effect ordering, dependency arrays. An assertion about "65 minutes, T4 excluded" should fail for exactly one reason. Test-first work is also cleaner: writing the first failing test for `selectDailyPlan` requires deciding only its signature, whereas a hook forces its React contract — what triggers recomputation, what is memoized, what state it holds — to be decided before the algorithm is understood.

The boundary this draws is **rules versus wiring**, not logic versus components. The visibility listener, the loading state, and the reducer plumbing are hook concerns and belong in hooks, where `renderHook` is the right tool to test them.

### 2. The current time is a parameter, never a global read

Domain functions that need the time take it as an argument (`now: Date`). No domain module calls `Date.now()` or `new Date()` with no argument. The UI layer is the only place that reads the real clock, and it passes the value inward.

**Why:** rollover is defined by the local date advancing. With an injected clock, "reopening three days later" is a function call with a different argument. Without it, that scenario needs global mocking of `Date`, which leaks between tests and is easy to get subtly wrong.

**Alternative rejected — a module-level clock singleton, swapped in tests:** less argument-passing, but it reintroduces shared mutable state and makes a function's result depend on something not visible in its signature.

### 3. The snapshot stores two separate ID lists

```ts
type DaySnapshot = {
  date: string; // local calendar date, YYYY-MM-DD
  plannedIds: string[]; // chosen by the algorithm when the plan was computed
  admittedIds: string[]; // added later because the task became urgent
};
```

Today's membership is `plannedIds ∪ admittedIds`, filtered to tasks that still exist. Becoming urgent appends to `admittedIds`; ceasing to be urgent removes from `admittedIds` only.

**Why two lists rather than one.** The specs demand two behaviors that a single list cannot distinguish:

| Spec scenario                                  | Needs                                |
| ---------------------------------------------- | ------------------------------------ |
| A task completed in Today stays struck through | membership survives completion       |
| An urgent task created mid-day is admitted     | membership can grow during the day   |
| A task that stops being urgent leaves the plan | _admitted_ membership can shrink     |
| A frozen task edited to urgent and back stays  | _planned_ membership must not shrink |

The third and fourth rows are the crux: the same edit — urgent to non-urgent — must remove one task and keep another. The only thing that separates them is how they got in, so that origin has to be recorded.

**Alternative rejected — derive the urgent section live** (`plannedIds` plus a query for currently-urgent pending tasks): appealing, since it needs no write on admission. It breaks as soon as an urgent task admitted mid-day is completed — it stops matching "pending and urgent", vanishes from Today, and violates the struck-through rule. Patching the query to also match "completed after the plan was computed" reintroduces the same origin-tracking through a more obscure route.

**Alternative rejected — one flat `taskIds` list:** cannot express the third and fourth rows at once. Either no task ever leaves Today, or de-prioritizing evicts frozen tasks that should stay.

**Storing IDs rather than copied task values** follows from the specs too: an edit must show up immediately in Today, and a deletion must remove the task from it. Copies would freeze the displayed name and duration along with the membership.

**Stale IDs are filtered on read, and pruned on delete.** Because the lists hold references, deleting a task can leave an ID pointing at nothing. Two mechanisms handle this, and they are not interchangeable:

- **Filtering on read is mandatory.** Membership is always resolved against the tasks that currently exist, and unresolved IDs are skipped. This is the correctness guarantee, and it is required regardless of anything else: writing the task record and writing the snapshot are two operations, so a crash between them leaves an orphaned ID that only the read path can absorb.
- **Pruning on delete is hygiene.** Deleting a task also removes its ID from both lists, so the persisted state does not assert something untrue. This is one line on the delete path, not a correctness mechanism.

The read filter SHALL NOT be removed on the grounds that pruning exists. Nothing may treat the length of either list as a count of visible tasks; the resolved membership is the only source for that.

### 4. The day is a local `YYYY-MM-DD` string, compared with strict less-than

The snapshot's date is derived from the injected clock in the device's local time zone and stored as `YYYY-MM-DD`. Recomputation is triggered when `snapshot.date < today`, never on inequality.

**Why strict less-than:** the specs require that moving to a time zone where it is still the previous day keeps the plan. An `!==` comparison would regenerate the plan on a backward date change and discard a day's work in progress. The string form makes the comparison lexicographic and therefore chronological, with no time-of-day component to accidentally compare.

### 5. IndexedDB behind a repository port

Persistence is defined as a small interface — load everything, save tasks, save snapshot — with an IndexedDB implementation for the app and an in-memory implementation for tests.

**Why IndexedDB over `localStorage`:** this is an offline-first PWA whose local copy is the only copy. Browsers, iOS Safari in particular, evict `localStorage` for web content more readily than IndexedDB, and `localStorage` writes block the main thread. The cost is that loading is asynchronous and the UI needs an initial loading state.

**Why a port at all:** it keeps the storage choice out of the domain and lets every test run against the in-memory implementation without a fake browser database.

The app requests persistent storage (`navigator.storage.persist()`) on first run. It is advisory — the browser may refuse — so it reduces the chance of eviction without eliminating it.

### 6. React state: one context with a reducer, no state library

Tasks and the snapshot live in a single context, updated through a reducer whose cases delegate to domain functions. Every mutation follows the same path: dispatch → domain function computes new state → persist → re-render.

**Why:** the whole dataset is a list of tasks and one snapshot, and every view is a pure projection of it. A state library would add a dependency and a second way to express the same thing.

**Alternative rejected — one context per concern (tasks, plan, UI):** more separation, but the plan depends on the tasks, so the two would need to be kept in step by hand across contexts.

### 7. Rollover is checked on mount and on becoming visible

The date check runs when the app mounts and on `visibilitychange` when the document becomes visible. No timer, no background worker.

**Why:** a PWA has no guaranteed execution at midnight, and the specs explicitly require that the plan not be replaced while the user is looking at it. Both events are moments where a change is expected rather than intrusive.

### 8. Persisted versus derived

Persisted: tasks with all their fields, and the snapshot. Nothing else.

Derived on every render, never stored: the grouping of Today by priority, hidden empty groups, the ordering of every list, which tabs show a task, and every empty state. Storing any of these would create a second source of truth that could disagree with the tasks themselves.

### 9. Toolchain

Vite with the React and TypeScript templates, `vite-plugin-pwa` for the manifest and service worker, Vitest for tests, React Testing Library for component and hook tests, and `fake-indexeddb` so the repository contract suite can run in Node. Vitest runs in the `jsdom` environment. This is the full set of runtime and test dependencies this change introduces; anything beyond it is a decision to raise rather than assume.

**Why Vitest over Jest:** it shares Vite's transform pipeline, so TypeScript and ESM work with no extra configuration.

### 10. Application icon and empty-state copy

The icon is authored as a single SVG and lives in the repository as the source of truth:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Task Manager">
  <rect width="512" height="512" rx="112" fill="#1E1B4B"/>
  <rect x="128" y="150" width="256" height="40" rx="20" fill="#F97316"/>
  <rect x="128" y="236" width="200" height="40" rx="20" fill="#E0E7FF"/>
  <rect x="128" y="322" width="144" height="40" rx="20" fill="#7C83B8"/>
</svg>
```

Three bars of decreasing width read as a task list at small sizes, and the accented top bar carries the idea of priority without any glyph that would blur below 32px. All artwork sits within the central 60% of the canvas, so the same file works as a maskable icon without being clipped by a platform's mask.

The manifest additionally needs raster sizes — at minimum 192×192 and 512×512, plus a maskable variant — because Android and Chrome do not reliably accept SVG for installed-app icons. Those are generated from this file rather than drawn separately, so the SVG stays the only artwork that is edited by hand.

Every empty state uses the single word **"empty"**. Deliberately flat: the three tabs are empty for different reasons, and inventing distinct encouraging copy for each would put three strings in the product that nobody decided on. A specific message can be written later if one turns out to be worth it.

## Testing Strategy

Testing is part of the definition of done here, and the work is test-first. Once the domain layer is separate, where a given test belongs stops being obvious, so this section fixes the split.

### Three tiers

| Tier            | Covers                                                                                                                                       | Runs against                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **Unit**        | Pure domain functions: selection arithmetic, ordering and grouping, `needsRecompute`, admission and removal, validation, duration formatting | Nothing else — plain calls with an explicit `now` |
| **Contract**    | The repository port: round-tripping tasks and snapshots, absent data, upgrade path                                                           | Both implementations, in-memory and IndexedDB     |
| **Integration** | Scenarios that cross a layer boundary: reload, day rollover, completion routing between tabs, empty states                                   | The rendered app over a fake IndexedDB            |

### Routing a spec scenario to a tier

If a scenario can be stated as the inputs and outputs of a function, it is a unit test. If it mentions reloading, the day changing, switching tabs, or something _remaining_ visible, it crosses a boundary and is an integration test.

By capability:

- **daily-plan** — the arithmetic tables are unit tests, one per worked example. `needsRecompute` is a unit test. Rollover on returning to the foreground, mid-day admission, and recalculation are integration tests, because each spans the clock, the stored snapshot, and what is rendered.
- **task-management** — validation rules are unit tests; the feedback the user sees when a name is blank is an integration test.
- **task-views** — grouping and ordering are unit tests on the projection functions; struck-through rendering, hidden empty groups, and which tab a task appears in are integration tests.
- **offline-storage** — entirely contract and integration. It has no unit-testable surface: none of its requirements is a statement about a function.

### One contract suite, two implementations

The repository suite is written once against the port interface and executed against both the in-memory double and the IndexedDB adapter.

Without this, the in-memory double is the only implementation any test ever exercises and the adapter that actually ships never runs — the failure mode where the entire suite is green and the application cannot load. Running one suite against both also keeps the double honest: if it drifts from the real adapter's behavior, every test built on it is measuring the wrong thing.

### What is not automated

Two `offline-storage` requirements cannot be verified in jsdom: **installability**, and **operation with the network genuinely unavailable**. Neither a simulated DOM nor a fake IndexedDB runs a service worker.

These are verified by hand, and `tasks.md` records the manual check explicitly rather than leaving the impression that the suite covers them. A browser-driving runner would close the gap, but adding one to cover two requirements is not proportionate in this change. It is worth revisiting if the PWA surface grows.

### Consequence for task sizing

A unit test's red-green cycle spans one function. An integration test's spans a component, its wiring, and sometimes the repository. Tasks that introduce integration-tested behavior therefore group the test with everything it needs to pass, instead of splitting them — a task whose test cannot go green until two tasks later is not a red-green cycle.

## Risks / Trade-offs

- **Local data is the only copy** → No backend means an evicted or cleared browser store loses everything with no recovery. Mitigated by requesting persistent storage, but not solved; accepted as the cost of the no-server constraint.
- **Two open instances can overwrite each other** → Both hold their own in-memory state and write the whole record set; the last write wins and the other instance's changes are lost silently. Not mitigated in this change. Adding a `BroadcastChannel` or reacting to storage events would close it, and the port-based design keeps that a local change.
- **The device clock is trusted** → A user who moves the clock forward and back can produce a plan they did not expect. The strict less-than comparison prevents a backward jump from discarding a plan, which is the damaging direction; a forward jump simply produces tomorrow's plan early.
- **The frozen day can feel broken** → A user who creates several non-urgent tasks sees nothing change in Today. Mitigated by the "Recalculate today" action, which is the deliberate escape hatch.
- **Admitted IDs accumulate** → `admittedIds` grows through the day and can reference deleted tasks. Membership is filtered against existing tasks on read, and both lists are replaced wholesale on recomputation, so the growth is bounded by one day.
- **Asynchronous storage adds a loading state** → Chosen deliberately over `localStorage`; the cost is one extra UI state that must not flash on fast loads.

All open questions raised during design have been resolved and folded into the decisions above.
