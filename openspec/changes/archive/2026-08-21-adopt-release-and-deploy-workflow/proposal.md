## Why

The repository had no GitHub remote, no version history, and no hosted deployment when this
change was proposed — every commit lands straight on `main` with a free-form message, and
there is no way to see the app running anywhere but locally. A GitHub remote now exists
(`camilosw/task-manager`, public, with `main` pushed to it), created manually ahead of the
rest of this change; version history and hosted deployment are still missing. The user
validated a lightweight version of this pattern
in another personal project (`camilosw/groceries`): Conventional Commits, tag-based
releases with a generated changelog, a branch-and-PR habit, and a zero-config Vercel
deployment with no committed Vercel configuration. This change brings that same pattern to
this repository, adapted where this project's existing workflow calls for it.

## What Changes

- Create a new public GitHub repository, `camilosw/task-manager`, and push the existing
  history to it.
- Add Conventional Commits enforcement (commitlint + a husky `commit-msg` hook) that gates
  every local commit, not only a final squash-merge commit.
- Add `commit-and-tag-version` release tooling: a `release` script (version bump + CHANGELOG
  + git tag from commit history since the last tag) and a `release:first` script to seed the
  first tag without generating a changelog from the existing non-conventional history.
- Move OpenSpec change application (the `apply-by-section` command, and any other flow that
  commits on behalf of a change) from committing directly to `main` to one branch per
  change, landed via a squash-merge pull request.
- Update `apply-by-section`'s hardcoded commit message template (currently
  `Apply section N: <title>`) to a Conventional Commits–compliant format, since it commits
  locally on every section and must pass the new `commit-msg` hook.
- Import the repository into Vercel with zero-config Vite detection (no `vercel.json`
  committed, matching the groceries pattern) — production deploys automatically on push to
  `main`, and pull requests get preview deployments.

## Capabilities

No spec-level application behavior changes. This is entirely contributor/agent workflow
and deployment tooling — the task manager's observable behavior (task creation, the daily
plan, priorities, offline storage) is untouched. `skip_specs: true` is set in this change's
`.openspec.yaml` accordingly.

### New Capabilities
None.

### Modified Capabilities
None.

## Impact

- **`package.json`**: new devDependencies (`@commitlint/cli`, `@commitlint/config-conventional`,
  `commit-and-tag-version`), new `release` / `release:first` scripts, a `commitlint` config
  block.
- **`.husky/`**: a new `commit-msg` hook, alongside the existing `pre-commit` hook.
- **`.claude/commands/apply-by-section.md`**: the commit step changes from a fixed message
  template to a Conventional Commits–compliant one, and the workflow gains a
  branch-per-change step before section 1 and a PR step after the last section.
- **GitHub**: a new repository, `camilosw/task-manager` (public).
- **Vercel**: a new project linked to that repository, no committed Vercel-specific
  configuration.
- **Deliberately out of scope / deferred**:
  - No hard-coded mandatory process gates in `CLAUDE.md` (e.g. groceries' required
    `EnterPlanMode`-before-any-edit, PR-approval-before-merge rules). This change adds the
    tooling and habit only, not an enforced multi-phase process.
  - No rewrite of existing git history's commit messages.
  - No GitHub Actions / CI workflow file — Vercel builds and deploys on its own, same as
    groceries.
  - No custom domain configuration for Vercel — the default `*.vercel.app` domain only.
  - No change to how `openspec-archive-change` sequences relative to the PR beyond noting it
    happens on the change's branch before the PR is opened (see design.md).
