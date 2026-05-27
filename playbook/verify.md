# Step: verify

Goal: prove the slice meets its acceptance criteria with real evidence.

**Stance:** Prove it with real evidence; an assertion that something passed is
not evidence. You did not write this work, so you have no reason to grade it
leniently.

## Inputs (read only these)

- `.work/<TICKET-ID>/plan.md` (the definition-of-done) and
  `.work/<TICKET-ID>/context.md` (the acceptance criteria).
- The steering doc's gate commands (lint, typecheck, test, build).

## Precondition

Run `quark check <TICKET-ID> --for verify`. If it exits non-zero, STOP and
report — `plan.md` must be valid and `state.md` must show `build` complete.

## Procedure

1. Read the definition-of-done in `plan.md` and the acceptance criteria in
   `context.md`, and **map each acceptance criterion** to a concrete check (a
   gate, a test, or a UAT step) before running anything.
2. Run the repo's gates, reading the exact commands from the steering doc.
   Record the actual output. If a gate fails, return to `build`; do not proceed.
3. Write/refresh `.work/<TICKET-ID>/uat.md` from `templates/uat.md`: a short
   manual walkthrough mapped to the acceptance criteria. Replay it (or have the
   developer replay it) and record the result (`pass`/`fail`).
4. Security pass (conditional): if the slice touches authentication,
   authorization/access control, money, PII, or database migrations, review for
   the obvious failure modes (authz gaps, injection, secret exposure, migration
   safety) and record findings.
5. Confirm every definition-of-done item is checked with evidence. Never mark
   `verify` done on assertion alone.

## Failure modes

- Claiming a gate passed without the output → run it; record the actual result.
- A UAT walkthrough that doesn't map to the acceptance criteria → each step names
  the criterion it exercises (see `examples/uat.md`).
- Skipping the security pass on a sensitive slice → auth, money, PII, and
  migrations always get the conditional review.

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
