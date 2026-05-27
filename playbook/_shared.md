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
---
ticket: <TICKET-ID>
current_step: <frame|plan|review|build|verify|ship>
status: <in-progress|blocked|done>
driving_engine: <Claude Code | Codex>
updated: <ISO-8601 timestamp>
---

# State: <TICKET-ID>

## Completed
- <step> — <one-line outcome> (<commit hash if any>)

## Decisions & deviations
- <decision or deviation from plan, with reason>

## Next action
- <the single next concrete action>

## Gotchas for the next runner
- <anything non-obvious needed to continue on the other engine>
```

## Cold start: orient before you act

Each Quark step is built to run in a fresh session. Assume no memory of earlier
steps — the `.work/<TICKET-ID>/` files are the only source of truth. Before
doing the step's own work:

1. No `.work/<TICKET-ID>/` or `state.md` yet → this is a new ticket; you should
   be running `frame`. Proceed.
2. Otherwise read `state.md` and compare its `current_step` / `status` /
   `## Next action` to the step you were invoked as:
   - On track (you are the expected next step) → proceed to this step's
     Precondition.
   - Already complete (state shows this step done) → you are re-running it;
     confirm with the developer before overwriting prior artifacts.
   - Ahead (an upstream step is incomplete) → the Precondition gate will fail;
     stop and report. Do not work from missing or invalid upstream artifacts.
3. Re-read this step's named Inputs every time; never rely on remembered
   content.

## Eliciting decisions (frame and plan)

When you need the developer, spend their attention only where judgment is
required:

- Ask only what the code and the tracker cannot answer. If you can determine it
  by reading the repo, determine it — don't ask.
- Batch the open questions; don't drip them one at a time.
- For each, propose a default (your recommendation), so the developer confirms
  or redirects rather than authoring from scratch.
- Genuinely blocking questions stop progress; everything else gets a proposed
  default and proceeds.

## Principles (apply in every step)

- **One step per session.** Each step is a cold start; when one finishes, the
  next runs in a fresh session — the closing handoff tells the developer to
  start one.
- **Think before you write.** Orient and reason first — name the change surface
  and the unknowns — before producing an artifact. Don't emit a draft you'll
  have to re-derive.
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

## The check gate and artifact conventions

Quark ships a `quark check` CLI; install it globally so it is on `PATH`
(`npm i -g github:robbell5/quark`). It structurally validates the
`.work/<TICKET-ID>/` artifacts. Every step uses it twice:

- **Precondition gate** — `quark check <TICKET-ID> --for <step>` answers "is the
  work ready to enter this step?" Run it first; if it exits non-zero, STOP and
  report rather than work from a malformed upstream artifact.
- **Self-check** — `quark check <TICKET-ID>` answers "are the artifacts I just
  wrote structurally valid?" Run it before declaring a step done.

Two conventions keep artifacts machine-checkable:

- A `<…>` placeholder means **unfilled** — replace every one before the check.
- Write `None` (never a blank line) in a section that is genuinely empty, so an
  intentional empty is distinct from an omission.

The filled `examples/` artifacts (`context.md`, `plan.md`, `state.md`) show the
target an agent should imitate; `examples/plan-too-vague.md` shows the failure
mode to avoid.

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
