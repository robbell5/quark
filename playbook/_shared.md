# Quark — Shared Conventions

Every Quark step reads this file first. It defines where artifacts live, the
`state.md` format, the cross-cutting principles, and how the native review
works.

## Working directory

All per-ticket artifacts live in a **gitignored** directory and never reach the
PR:

```text
<repo>/.work/<TICKET-ID>/
  context.md   # intent, acceptance criteria (ACn ids), files, risks, scope
  plan.md      # file-by-file approach, test strategy, DoD (each item cites ACn)
  review.md    # native plan critique — structured gaps + resolutions
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

Two optional gate fields are stamped by `quark gate` (never hand-edited); each
carries the plan hash it cleared, so a later plan edit invalidates them:

- `gate_plan_approved: <name> @ <ts> hash=<h>` — the developer's plan approval.
  Required by `quark check --for build`.
- `gate_review: <passed|resolved|accepted> … hash=<h>` — the review outcome:
  `passed` (no gaps), `resolved` (gaps closed via the plan ⇄ review loop), or
  `accepted` (gaps consciously accepted, with a note). Required by
  `quark check --for build` for every slice.

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
`.work/<TICKET-ID>/` artifacts. Most steps use it twice (`frame`, the entry
step, has no precondition gate):

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

**Acceptance-criterion linkage.** Each acceptance criterion in `context.md`
carries a stable id (`- AC1: …`). Plan Definition-of-done items and UAT steps
cite the criterion they satisfy as `(AC1)` / `(AC1, AC2)`. The gate enforces the
*linkage* — every AC is covered, every `(ACn)` resolves — not prose quality;
judging whether a covering item is genuinely executable is the planner's
self-check and the reviewer's job.

## Review is native (single-engine by default)

Review runs in **the engine you are already driving** — a fresh, cold-start
session, with no headless call to the other engine. The reviewer reads
`context.md` + `plan.md` (and, in `verify`, the working git diff) and writes
structured, actionable gaps into `review.md`. It is read-only with respect to
the implementation: it changes `review.md` and the recorded verdict, nothing
else.

Build is gated on a recorded review verdict (`passed` / `resolved` / `accepted`)
whose plan hash matches the current plan, so a later plan edit forces a
re-review. The independence comes from the cold start — the reviewer has not
seen the planning rationale and judges the plan on its face — not from running a
different model. This keeps Quark fully usable with **only one engine
installed**; nothing in the loop depends on both being present.

**Optional second model.** To add a genuinely different model's perspective
(most valuable on a sensitive slice — auth, money, PII, data-integrity,
migrations), open the *other* engine's CLI and run the same review skill on the
same `.work/` artifacts; it reads the portable files and appends its findings.
This is a choice, never a requirement.
