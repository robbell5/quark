# Step: verify

Goal: prove the slice meets its acceptance criteria with real evidence.

**Stance:** Prove it with real evidence; an assertion that something passed is
not evidence. You did not write this work, so you have no reason to grade it
leniently.

## Inputs (read only these)

- `.work/<TICKET-ID>/plan.md` (the definition-of-done) and
  `.work/<TICKET-ID>/context.md` (the acceptance criteria).
- The steering doc's gate commands (lint, typecheck, test, build).
- The implementation diff — `git diff` against the base branch — which the
  security pass reads.

## Precondition

Run `quark check <TICKET-ID> --for verify`. If it exits non-zero, STOP and
report — `plan.md` must be valid and `state.md` must show `build` complete.

## Procedure

1. Read the definition-of-done in `plan.md` and the acceptance criteria in
   `context.md`, and **map each acceptance criterion** (`ACn`) to a concrete
   check — a gate, a test, or a UAT step — before running anything.
2. Run the repo's gates, reading the exact commands from the steering doc.
   Record the actual output. If a gate fails, return to `build`; do not proceed.
3. Review the implementation diff yourself (`git diff` against the base) — the
   same critique the plan review applied, now against real code: does the diff
   match the plan, are there correctness or quality gaps, untested paths, or
   drift? Record findings; route real problems back to `build`. For a large
   diff, dispatch the read-only explorer worker to read the diff against the
   plan and return discrepancies (see **Delegating to workers** in the Shared
   Conventions); you judge and record them.
4. Write/refresh `.work/<TICKET-ID>/uat.md` from `templates/uat.md`: a short
   manual walkthrough where each step cites the `(ACn)` it exercises. Replay it
   (or have the developer replay it) and record the result (`pass`/`fail`).
5. Security pass: if `context.md`'s `## Sensitivity` is not `None`, review the
   diff for the failure modes implied by its categories — authz gaps, injection,
   secret exposure, migration safety — and record findings. Skip only when
   Sensitivity is `None`.
6. Confirm every definition-of-done item is checked with evidence, and that the
   UAT covers every acceptance criterion by id (the `--for ship` gate enforces
   this next). Never mark `verify` done on assertion alone.

## Failure modes

- Claiming a gate passed without the output → run it; record the actual result.
- A UAT walkthrough that doesn't map to the acceptance criteria → each step
  cites the `(ACn)` it exercises (see `examples/uat.md`).
- Skipping the security pass on a sensitive slice → when `## Sensitivity` ≠
  `None`, the security pass is required; skip only when Sensitivity is `None`.

## Output

- `.work/<TICKET-ID>/uat.md` from `templates/uat.md`, replayed, with a `pass`
  result; recorded gate output; and (if relevant) a security note.

## Self-check

Run `quark check <TICKET-ID>` and confirm `uat.md` reports OK — this validates
its *structure*, not the verdict. Separately confirm you recorded a `pass`
result and that every definition-of-done item has evidence; the structural check
does not judge pass/fail (the `--for ship` gate enforces the pass next). Do not
declare `verify` done until both hold.

## Handoff

Update `.work/<TICKET-ID>/state.md`: current step `verify`, status `done`, next
action `ship`.

Then tell the developer: `verify` is done — start a new session and run
`quark-ship`.
