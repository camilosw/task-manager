## Context

See proposal.md - Why for motivation. Relevant current state:

- A `git remote` now exists: `camilosw/task-manager` was created on GitHub (public) and the
  existing `main` history was pushed to it directly by the user, ahead of the rest of this
  plan (the commit/release tooling, the `apply-by-section` rewrite, and the Vercel import
  below are all still pending).
- Commits are free-form (e.g. `Apply section 9: Integration and verification`,
  `Propose redesign-ui: interface redesign from the reference mockup`) — nothing enforces a
  format, and nothing generates a changelog or version tag.
- `package.json` has no release tooling and `version` is still `0.0.0`.
- `.claude/commands/apply-by-section.md` step 5 hardcodes the commit message template
  `Apply section N: <title>` and commits directly on whatever branch is checked out — today
  that's always `main`. No other skill in this repo (`openspec-archive-change`,
  `openspec-new-change`, onboarding) hardcodes a commit message.
- The reference pattern, `camilosw/groceries`, commits nothing Vercel-specific (no
  `vercel.json`) and relies entirely on Vercel's Vite auto-detection; its build
  (`tsc -b && vite build` → `dist/`) is structurally identical to this repo's.

## Goals / Non-Goals

**Goals:**
- Every local commit in this repo passes Conventional Commits validation.
- `commit-and-tag-version` can walk commit history to bump the version, generate a
  changelog, and cut a tag, starting from a clean baseline.
- OpenSpec change application produces one branch and one PR per change instead of commits
  landing directly on `main`.
- Vercel serves the current `main` in production and a preview for every open PR, with zero
  committed Vercel configuration.

**Non-Goals** (see proposal.md - Impact for the full deferred list):
- No mandatory, enforced multi-phase process in `CLAUDE.md`.
- No CI workflow files.
- No automatic release-on-merge.

## Decisions

**1. commitlint gates every local commit, via a husky `commit-msg` hook.**
Matches groceries' `.husky/commit-msg` exactly, and matches the user's explicit choice over
the lighter alternative. Alternative considered: gate only the PR-title/squash commit that
lands on `main`, leaving section-by-section commits on the branch informally formatted —
rejected because the user chose the stricter option even knowing it requires reworking
`apply-by-section`'s commit template.

**2. Branch name = OpenSpec change name, one-to-one.**
E.g. change `redesign-ui` → branch `redesign-ui`. Alternative considered: groceries' type-
prefixed branch names (`feat/short-description`, `fix/short-description`) — rejected because
OpenSpec changes already carry a stable, unique, descriptive name; a second parallel naming
scheme for the same unit of work would only invite drift between the two.

**3. Section commit format: `<type>(<change-name>): section N — <title>`.**
`<type>` is chosen once, at the start of a change, and reused for every section commit and
for the eventual PR title / squash commit. It is inferred from the change's `proposal.md`:
introduces a new capability → `feat`; fixes existing behavior → `fix`; no spec deltas
(tooling, process, refactor) → `chore` or `refactor` as fits. Alternative considered: a
single fixed type (e.g. always `chore`) for every section commit regardless of the change —
rejected because it would make the type meaningless for `commit-and-tag-version`'s bump
logic and mismatch the squash commit's own type.

**4. `apply-by-section` gains a branch step before section 1 and a PR step after the last
section; merging stays manual.**
Step 0 checks out (or creates) the branch named for the change before finding the first
pending section. After the last section — and after `openspec-archive-change` has run on
that same branch (see Decision 5) — the workflow pushes the branch and opens a PR with
`gh pr create`, titled with the same `<type>(<change-name>): <summary>` used for section
commits. Squash-merging the PR remains a manual, user-approved step, not automated.
Alternative considered: open the PR as a draft immediately when the branch is created, so a
Vercel preview exists from section 1 onward — rejected as unnecessary ceremony for a change
whose sections are being reviewed locally as they land; can be revisited if watching an
early preview turns out to matter in practice.

**5. `openspec-archive-change` runs on the change's branch, before the PR is opened.**
Archiving (moving the change's specs into `openspec/specs/`) is part of finishing the
change, so it belongs in the same PR as the implementation. Alternative considered:
archive as a separate follow-up commit to `main` after merge — rejected, it would split one
logical unit of work across two PRs and reintroduce a direct-to-main commit.

**6. Vercel is connected via dashboard import (or `vercel link`), no `vercel.json` committed.**
Vite is one of Vercel's auto-detected frameworks, and this repo's build
(`tsc -b && vite build` → `dist/`) needs no override. Alternative considered: commit an
explicit `vercel.json` pinning build/install/output — rejected as unneeded config for a
build that's already a stock Vite build, and it would diverge from the groceries pattern
this change is following.

**7. Releases are a manual, explicit step — not automatic on merge.**
`npm run release` (or `release:first` for the very first tag) is run locally after one or
more PRs have merged to `main`, then `git push --follow-tags`. Alternative considered:
auto-release on every push to `main` via CI — rejected; no CI is being introduced (see
Non-Goals), and batching several merged PRs into one release avoids a version bump per
small PR.

## Risks / Trade-offs

- [Risk] An agent forgets the new commit format mid-section and the `commit-msg` hook
  rejects the commit, stalling a subagent mid-task. → Mitigation: rewrite
  `apply-by-section.md` step 5 with the exact template and a worked example, so the format
  is copied rather than recalled.
- [Risk] The first `commit-and-tag-version` run walks all ~30 existing non-conventional
  commits on `main` and produces a nonsensical changelog or version bump. → Mitigation: use
  `release:first` for the very first tag, which seeds a baseline without parsing prior
  history — the same reason groceries has that script.
- [Risk] Moving change-application to branch+PR adds a manual merge step that can be
  forgotten, leaving a change fully implemented but stuck on an un-merged branch. →
  Mitigation: `apply-by-section`'s final summary explicitly surfaces the PR URL and states
  that the change isn't done until it's merged, mirroring how it already surfaces a summary
  per section today.

## Migration Plan

1. ~~Confirm `.gitignore` already excludes build output and local artifacts (`dist`,
   `node_modules` are already covered), create `camilosw/task-manager` on GitHub (public),
   push the existing `main`.~~ **Done** — completed manually by the user before the rest of
   this plan was implemented.
2. Add `@commitlint/cli`, `@commitlint/config-conventional`, `commit-and-tag-version` as
   devDependencies; add the `commitlint` config block, `release`/`release:first` scripts,
   and the husky `commit-msg` hook.
3. Rewrite `.claude/commands/apply-by-section.md`: add the branch-creation step, the new
   section commit message template, and the archive-then-PR step at the end.
4. Import the repository into Vercel; confirm the first deploy succeeds and serves the same
   build `npm run build` produces locally.
5. Seed the first tag with `npm run release:first`, then `git push --follow-tags`.

Each step is independent and reversible on its own (unlink the Vercel project, revert the
`package.json`/husky changes, revert `apply-by-section.md`) without touching application
code or stored task data.

**Bootstrapping note** (revised after implementing section 2): this change's own
implementation still runs direct-to-main — the branch+PR mechanics don't exist until
section 3 builds them, so sections 2-5 of this change land as regular commits on `main`,
not on a branch. The commit *message format* assumption was wrong, though: the
`commit-msg` hook added in section 2 starts enforcing Conventional Commits on every commit
the moment that section lands — including section 2's own commit — not just from section 3
onward as originally assumed. In practice this meant section 2 had to commit itself as
`chore(adopt-release-and-deploy-workflow): section 2 - ...` rather than the old
`Apply section 2: ...` template. Sections 3-5 follow the same corrected format.
