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

2. **Find the next pending section.** Run `openspec instructions apply
   --change "<name>" --json` and read the tasks file(s) listed under
   `contextFiles`. Parse the `## N. <Title>` headings and find the first
   section that still has unchecked `- [ ]` items.

   If every section is already complete, report "All sections complete"
   and suggest `/opsx:archive`. If `state` is `"blocked"`, report that and
   stop instead of guessing.

3. **Launch exactly one subagent for that section**, using the Agent tool
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

4. **When the subagent reports back**, show the user a short summary
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

5. **On approval**, stage and commit exactly the files touched by that
   section, with a message naming the section, e.g.:
   `git commit -m "Apply section 2: Domain — task model"`.
   Then return to step 2 for the next pending section.

**Guardrails**
- One section per subagent call, never more — and never let a subagent
  continue past the section it was assigned.
- Never commit without an explicit approval from the user for that
  section's diff, even if the diff looks trivial or obviously correct.
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

```
## All sections complete

<name> is fully implemented and committed section by section.
Suggested next step: /opsx:archive
```
