---
name: "Apply By Section"
description: "Implement an OpenSpec change one section at a time, each section in its own subagent, pausing for review and commit approval before moving on"
allowed-tools: Bash(openspec:*)
category: "Workflow"
tags: ["workflow", "openspec", "subagents", "review"]
---

Implement an OpenSpec change one section at a time. Each section is handed
to a fresh, isolated subagent so this conversation's own context stays
small. After every section, stop and wait for the user to review the diff;
only commit and move on once the user explicitly approves.

**Input**: Optionally specify a change name (e.g. `/apply-by-section
add-task-manager-app`). If omitted, infer it from conversation context, or
if ambiguous run `openspec list --json` and ask the user to choose.

**You act as an orchestrator, not an implementer.** Never write code
yourself in this command — always delegate a section's implementation to a
subagent via the Agent tool, and never batch more than one section into a
single subagent call.

**Steps**

1. **Select the change** and announce "Using change: <name>" and how to
   override it (e.g. `/apply-by-section <other>`).

2. **Check out the change's branch and choose a commit type.** Run once, at
   the start of the run, before finding the first pending section:
   - Create or check out a git branch named exactly after the change (e.g.
     change `redesign-ui` → branch `redesign-ui`). If the branch already
     exists — e.g. this run is resuming a partially-applied change — check
     it out instead of erroring; do not recreate it.
   - Read the change's `proposal.md` and determine the Conventional Commits
     `<type>` for this run: a "New Capabilities" entry under Capabilities →
     `feat`; a "Modified Capabilities" entry describing a fix to existing
     behavior → `fix`; `skip_specs: true` or no capability changes (tooling,
     process work) → `chore`, or `refactor` if it's a pure code
     restructuring with no behavior or tooling change.
   - State both the branch name and the chosen `<type>` once, and reuse
     that same `<type>` for every section's commit message and for the PR
     title at the end of the run — do not re-derive it per section.

3. **Commit the planning artifacts.** Run once, immediately after the
   branch exists and before the first section's subagent is launched:
   - Stage only the change's own directory —
     `git add openspec/changes/<change-name>` — which picks up
     `proposal.md`, `design.md`, `specs/`, `tasks.md` and `.openspec.yaml`,
     including any of them still untracked. Never stage anything outside
     that directory here; unrelated working-tree changes are not this
     command's to commit.
   - If that stages nothing, the artifacts are already committed — the
     normal case when resuming a partially-applied change. Say so and move
     on to step 4.
   - Otherwise commit with `docs(<change-name>): plan <short summary>`,
     e.g. `git commit -m "docs(add-thing): plan manual reordering"`.
   - **Use `docs` here, not the `<type>` chosen in step 2.** The release
     tooling builds the CHANGELOG from Conventional Commits, so a `feat:`
     commit carrying only planning documents would announce a feature that
     has not been implemented yet. The step 2 `<type>` belongs to the
     section commits and the PR title, never to this one.
   - The same 100-character commitlint cap applies — shorten the summary
     if the header would exceed it.

   This commit needs no user approval: it contains no code, only artifacts
   the user already reviewed as they were written. Landing them on the
   branch before any implementation exists is what keeps the eventual PR
   self-contained — the specs that justify the code travel with it instead
   of being stranded on the base branch.

4. **Find the next pending section.** Run `openspec instructions apply
   --change "<name>" --json` and read the tasks file(s) listed under
   `contextFiles`. Parse the `## N. <Title>` headings and find the first
   section that still has unchecked `- [ ]` items.

   If every section is already complete, report "All sections complete"
   and move on to the archive-then-PR flow below. If `state` is
   `"blocked"`, report that and stop instead of guessing.

5. **Launch exactly one subagent for that section**, using the Agent tool
   with:
   - `subagent_type: "general-purpose"`
   - `run_in_background: false` (the next step depends on its result)
   - no worktree isolation — it must edit the current working tree, since
     the section depends on code already written by prior sections
   - a fully self-contained prompt (the subagent has no memory of this
     conversation), including:
     - the change name
     - an instruction to run `openspec instructions apply --change
       "<name>" --json`, read every file listed under `contextFiles`, and
       honor any `context`/`operationGuidance` it returns
     - the exact heading and task lines of the one section to implement,
       copied verbatim from the tasks file
     - an explicit instruction to implement ONLY that section, following
       TDD as each line describes, mark each finished line `- [x]` in the
       tasks file, run the project's test command, and STOP — it must not
       touch any other section
     - a request to report back concisely: what changed, which files were
       touched, and the test result

6. **When the subagent reports back**, show the user a short summary
   (section name, files changed, test result) and run `git diff --stat`
   so the user can see the shape of the change. Then STOP and wait for the
   user's explicit approval. Do not commit, and do not launch the next
   section's subagent, until the user approves this specific section.

   - If the user asks for changes, address them (directly, or by giving
     the subagent another turn) and show the result again before asking
     for approval again.
   - If the subagent reported a blocker, an unclear task, or scope beyond
     what the tasks/specs describe, relay that to the user verbatim instead
     of asking for approval, and wait for guidance.

7. **On approval**, stage and commit exactly the files touched by that
   section, with a message in the format
   `<type>(<change-name>): section N — <title>`, using the `<type>` chosen
   in step 2, e.g.:
   `git commit -m "feat(add-thing): section 2 — domain model"`.
   commitlint caps the header at 100 characters — if `<change-name>` is
   long, shorten `<title>` (or drop it) so the header fits; don't let the
   commit fail the hook over a header length.
   Then return to step 4 for the next pending section.

8. **After the last section, once `openspec-archive-change` (or
   `/opsx:archive`) has completed on this same branch**, finish the
   change's workflow:
   - Push the branch: `git push -u origin <branch-name>`.
   - Open a pull request: `gh pr create --title
     "<type>(<change-name>): <summary>" --body "..."`, using the same
     `<type>` chosen in step 2 and a short summary of the change.
   - Report the PR URL to the user.

   This step only runs after archiving has happened on the same branch —
   archiving is a separate command/skill this one does not invoke itself,
   but the PR should not be opened until it's done, since the archived
   specs belong in the same PR as the implementation. Opening the PR does
   not merge it: squash-merging remains a manual, user-approved step that
   this command never performs.

**Guardrails**
- One section per subagent call, never more — and never let a subagent
  continue past the section it was assigned.
- Never commit without an explicit approval from the user for that
  section's diff, even if the diff looks trivial or obviously correct.
  The planning-artifact commit in step 3 is the sole exception, and only
  because it contains no code.
- Never start a section before the planning artifacts are on the branch —
  a run that implements code first leaves the PR describing changes whose
  specs live somewhere else.
- Never skip the pause-and-review step.
- Keep your own orchestrator messages short: the point of this workflow is
  to keep this conversation's context small, so let the subagent do the
  heavy lifting and only surface summaries here.
- If a subagent pauses on an unclear task or a design issue, relay that to
  the user verbatim rather than resolving it yourself.
- Sections are sequential and dependent — never launch a section's
  subagent before the previous section has been reviewed, approved, and
  committed.

**Output per section**

```
## Section <N>: <title>

Files changed:
- <path>
- ...

Tests: <pass/fail summary>

Waiting for your review — reply to approve and commit, or describe the
changes needed.
```

**On completion**

When the last section is committed:

```
## All sections complete

<name> is fully implemented and committed section by section on branch
<branch-name>.
Suggested next step: /opsx:archive
```

Once `/opsx:archive` (or `openspec-archive-change`) has completed on that
same branch, carry out step 8 above (push the branch, open the PR) and
report:

```
## Change ready for review

<name> is implemented, archived, and pushed on branch <branch-name>.
Pull request: <PR URL>

This change is not done until that PR is reviewed and merged — sections
complete and archiving complete are not the same as finished.
```
