# Step: review (conditional)

Goal: have the other engine critique the work. Run on sensitive slices (auth,
money, ownership, data integrity); optional for trivial ones. Two modes.

## Inputs (read only these)

- `.work/<TICKET-ID>/context.md` and `.work/<TICKET-ID>/plan.md`.
- For a diff review: the working git diff as well.
- This shim's declared engine identity (it names the reviewing engine).

## Precondition

Run `quark check <TICKET-ID> --for review`. If it exits non-zero, STOP and
report — `context.md` and `plan.md` must be valid before review.

## Procedure

1. Determine mode: plan review (pre-build, no diff yet) or diff review
   (post-build, a working diff exists).
2. Identify the reviewing engine from this shim's identity (Claude drives →
   Codex reviews; Codex drives → Claude reviews). Use the exact read-only
   invocation from the Shared Conventions above.
3. Run the reviewer by path: plan review → `context.md` + `plan.md`; diff
   review → the working git diff + `plan.md` + `context.md`.
4. If the other engine's CLI is unavailable, follow the Shared Conventions
   fallback (a clearly-labeled same-engine self-review).
5. Triage every blocking/important item: fold into the plan, fix in build, or
   consciously reject with a reason. Surface blocking items to the developer.

## Output

- `.work/<TICKET-ID>/review.md` from `templates/review.md`: the reviewer's
  findings grouped by severity (Blocking / Important / Minor) with the mode and
  a timestamp, plus a `## Resolutions` entry for each blocking/important item.

## Self-check

Run `quark check <TICKET-ID>` and confirm `review.md` reports OK and that no
Blocking item is left without a resolution.

## Handoff

Update `.work/<TICKET-ID>/state.md`: current step `review`, status `done` (or
`blocked` if blocking items are unresolved), next action `build`.

Then tell the developer: `review` is done — start a new session and run
`quark-build`.
