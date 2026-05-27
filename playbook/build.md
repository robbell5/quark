# Step: build

Goal: implement `plan.md` faithfully in small steps, keeping `state.md` current
so the other engine can resume.

## Inputs (read only these)

- `.work/<TICKET-ID>/plan.md`, `.work/<TICKET-ID>/review.md` (if present),
  `.work/<TICKET-ID>/state.md`, and the code paths the plan names.

## Precondition

Run `quark check <TICKET-ID> --for build`. If it exits non-zero, STOP and
report — the plan must be valid, `context.md`'s open questions closed, and any
Blocking review items resolved before building.

## Procedure

1. Read `plan.md`, `review.md` (if present), and `state.md`.
2. Work the plan one unit at a time. Where the plan calls for TDD: write the
   failing test, run it to confirm it fails, implement the minimum to pass, run
   it to confirm it passes.
3. Keep the diff focused — only what the plan calls for. No unrelated cleanup.
4. Make frequent small commits. After each meaningful unit, update `state.md`
   (keep it to the shape of `examples/state.md` — Completed / Decisions &
   deviations / Next action / Gotchas): the completed item (+ commit hash), any
   decision/deviation, the next action.
5. STOP on drift: if the plan is wrong or scope must change, pause, update
   `context.md`/`plan.md`, and reconcile with the developer before continuing.
   Do not silently expand scope.

## Output

- A focused implementation with passing tests, committed in small steps; a
  current, resumable `.work/<TICKET-ID>/state.md`.

## Self-check

Run `quark check <TICKET-ID>` and confirm it reports OK — a valid `state.md` is
what lets the other engine resume. Do not declare `build` done until the plan's
units are complete and the check passes.

## Handoff

Update `.work/<TICKET-ID>/state.md`: current step `build`, status `done`, next
action `verify`.

Then tell the developer: `build` is done — start a new session and run
`quark-verify`.
