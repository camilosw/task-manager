## 1. GitHub repository

- [x] 1.1 Confirm `.gitignore` already excludes build output and local artifacts (`dist`,
      `node_modules`) before the first push
- [x] 1.2 Create `camilosw/task-manager` on GitHub (public)
- [x] 1.3 Add the GitHub remote and push the existing `main` history

## 2. Conventional Commits + release tooling

- [x] 2.1 Add `@commitlint/cli` and `@commitlint/config-conventional` as devDependencies
- [x] 2.2 Add a `commitlint` config block to `package.json` extending
      `@commitlint/config-conventional`
- [x] 2.3 Add a husky `commit-msg` hook that runs commitlint, alongside the existing
      `pre-commit` hook
- [x] 2.4 Add `commit-and-tag-version` as a devDependency
- [x] 2.5 Add `release` and `release:first` npm scripts
- [x] 2.6 Verify the hook: confirm a non-conventional commit message is rejected and a
      conventional one (e.g. `chore: test commit hook`) is accepted, then remove the test
      commit

## 3. Branch-and-PR workflow for OpenSpec change application

- [ ] 3.1 In `.claude/commands/apply-by-section.md`, add a step before section 1 that
      creates or checks out a branch named exactly after the change (design.md, decision 2)
- [ ] 3.2 Update the section commit step (currently step 5, `Apply section N: <title>`) to
      the format `<type>(<change-name>): section N — <title>`, with `<type>` chosen once at
      the start of the run from the change's `proposal.md` (new capability → `feat`, fix →
      `fix`, no spec deltas → `chore`/`refactor`) and reused for every section (design.md,
      decision 3)
- [ ] 3.3 Add a step after the last section — run after `openspec-archive-change` has
      completed on the same branch — that pushes the branch and opens a PR with
      `gh pr create`, titled `<type>(<change-name>): <summary>` using the same type as the
      section commits (design.md, decisions 4 and 5)
- [ ] 3.4 Update the command's final output/summary to surface the PR URL and state the
      change isn't complete until the PR is merged
- [ ] 3.5 Re-check that no other command or skill in `.claude/commands` or `.claude/skills`
      hardcodes a conflicting commit message template (confirmed clear during exploration;
      re-verify at implementation time in case it's changed)

## 4. Vercel deployment

- [ ] 4.1 Import `camilosw/task-manager` into Vercel (dashboard import or `vercel link`);
      confirm the Vite framework preset is auto-detected and no `vercel.json` is committed
- [ ] 4.2 Trigger the first production deploy and confirm the served build matches what
      `npm run build` produces locally
- [ ] 4.3 Open a pull request (this change's own, once section 3 lands, or a throwaway one)
      and confirm Vercel posts a preview deployment for it

## 5. First release

- [ ] 5.1 Run `npm run release:first` to seed the initial tag without generating a
      changelog from the existing non-conventional history
- [ ] 5.2 Push the tag with `git push --follow-tags`
- [ ] 5.3 Verify `CHANGELOG.md` was created and `package.json` `version` was updated as
      expected
