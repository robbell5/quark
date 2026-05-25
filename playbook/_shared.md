# Quark — Shared Conventions

Every Quark step reads this file first. It defines where artifacts live, the
`state.md` format, the cross-cutting principles, and how to invoke the other
engine for review.

## Working directory

All per-ticket artifacts live in a **gitignored** directory and never reach the
PR:

```text
<repo>/.work/<TICKET-ID>/
  context.md   # intent, acceptance criteria, files in play, risks, out-of-scope
  plan.md      # file-by-file approach, test strategy, definition-of-done
  review.md    # the other engine's plan and diff critique, plus resolutions
  state.md     # running progress log — the resume point ("the baton")
  uat.md       # manual acceptance steps
  pr.md        # draft PR body (written by ship)
```

`<TICKET-ID>` is the tracker id (e.g. `RAY-123`) or a short kebab slug if there
is no ticket.

## `state.md` format (the baton)

`state.md` is what lets either engine resume mid-ticket. Keep it current.

```markdown
# State: <TICKET-ID>

- **Current step:** <frame|plan|review|build|verify|ship>
- **Status:** <in-progress|blocked|done>
- **Driving engine:** <Claude Code | Codex>

## Completed
- <step> — <one-line outcome> (<commit hash if any>)

## Decisions & deviations
- <decision or deviation from plan, with reason>

## Next action
- <the single next concrete action>

## Gotchas for the next runner
- <anything non-obvious needed to continue on the other engine>
```

## Principles (apply in every step)

- **Ambiguity is closed before code.** Confirm scope and resolve open questions
  before planning; do not start `build` until the plan is solid.
- **Ephemeral docs.** `.work/` is scratch; it is gitignored and stripped/
  leak-checked before the PR.
- **Focused diffs.** No unrelated cleanup or refactoring; stay inside the slice.
- **Behavior over implementation.** Tests assert behavior tied to acceptance
  criteria, not internal details.
- **Stop on drift.** If scope, architecture, or acceptance criteria change,
  pause and reconcile with the developer before continuing.
- **Real evidence.** Never claim a gate passed without running it and seeing the
  output.

## Reviewer invocations (cross-engine, read-only)

The reviewing engine reads the relevant `.work/` files **by path** and returns
concerns by severity (blocking / important / minor). It must not modify the
tree. Capture its output into `review.md`.

> Flags below were confirmed on 2026-05-24 against Codex CLI 0.133.0 and Claude
> Code 2.1.150. Two Codex flags differ from the early draft and are noted inline.

When **Claude Code** is driving, the reviewer is **Codex**:

```bash
# Plan review (pre-build). codex exec is non-interactive and read-only here;
# it has no --ask-for-approval flag (that is interactive-only), so the
# read-only sandbox is the safety mechanism.
codex exec --sandbox read-only \
  "Review the Quark plan for <TICKET-ID>. Read .work/<TICKET-ID>/context.md and
   .work/<TICKET-ID>/plan.md. List concerns by severity
   (blocking/important/minor) with concrete reasoning. Do not modify files."

# Diff review (post-build). codex review is non-interactive and read-only;
# --uncommitted reviews staged, unstaged, and untracked working changes.
codex review --uncommitted \
  "Review the working git diff against .work/<TICKET-ID>/plan.md and
   .work/<TICKET-ID>/context.md. List concerns by severity."
```

When **Codex** is driving, the reviewer is **Claude Code**:

```bash
# Read-only: -p is non-interactive and --allowedTools whitelists read and
# git-inspection tools only, so the reviewer cannot edit, write, run other
# commands, or be prompted for approval (non-interactive mode auto-denies
# anything not whitelisted, so no --permission-mode is needed). Two prompts,
# mirroring the Codex block.

# Plan review (pre-build):
claude -p "Review the Quark plan for <TICKET-ID>. Read
  .work/<TICKET-ID>/context.md and .work/<TICKET-ID>/plan.md. List concerns by
  severity (blocking/important/minor) with concrete reasoning." \
  --output-format text \
  --allowedTools "Read Grep Glob Bash(git diff:*) Bash(git log:*)"

# Diff review (post-build):
claude -p "Review the working git diff (git diff) against
  .work/<TICKET-ID>/plan.md and .work/<TICKET-ID>/context.md. List concerns by
  severity (blocking/important/minor)." \
  --output-format text \
  --allowedTools "Read Grep Glob Bash(git diff:*) Bash(git log:*)"
```

**Fallback:** if the other engine's CLI is not installed or not authenticated
(the command errors), record that in `review.md` and perform a same-engine
self-review instead, clearly labeled as a weaker substitute.
