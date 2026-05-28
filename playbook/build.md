# Step: build

Goal: implement `plan.md` faithfully in small steps, keeping `state.md` current
so the other engine can resume.

**Stance:** Implement the plan exactly — you are not re-deciding scope. Keep
`state.md` current enough that the other engine could resume cold from it.

## Inputs (read only these)

- `.work/<TICKET-ID>/plan.md`, `.work/<TICKET-ID>/review.md` (if present),
  `.work/<TICKET-ID>/state.md`, and the code paths the plan names.

## Precondition

Run `quark check <TICKET-ID> --for build`. If it exits non-zero, STOP and report —
the plan must be valid, its open questions closed, the plan **approved with a
hash that still matches** (`quark gate … plan-approved`), and — on a sensitive
slice — a review recorded with a matching hash. Any Blocking review item must be
resolved.

## Procedure

1. Read `plan.md`, `review.md` (if present), and `state.md`; identify the next
   unit from `state.md`'s `## Next action`, and note the plan's risks and scope
   boundary (the drift triggers) before editing any code.
2. Work the plan one unit at a time. Where the plan calls for TDD: write the
   failing test, run it to confirm it fails, implement the minimum to pass, run
   it to confirm it passes.
3. Keep the diff focused — only what the plan calls for. No unrelated cleanup.
4. Make frequent small commits. After each meaningful unit, update `state.md`
   (keep it to the shape of `examples/state.md` — Completed / Decisions &
   deviations / Next action / Gotchas): the completed item (+ commit hash), any
   decision/deviation, the next action.
5. STOP on drift: if the plan is wrong or scope must change, do not continue in
   place. Update `context.md`/`plan.md`, then route back through `plan`
   (re-approval) and, for sensitive slices, `review` — changing the plan
   invalidates the approval hash, so `quark check --for build` will block until
   it is re-approved. Reconcile with the developer before resuming.

## Failure modes

- Silent scope expansion → STOP on drift: pause, update context/plan, and route
  back through plan/review; do not continue on a changed plan.
- A stale `state.md` → update it after each meaningful unit; it is the resume
  point for the other engine.
- An unfocused diff → only what the plan calls for; no drive-by cleanup or
  refactoring.

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
