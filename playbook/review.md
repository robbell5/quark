# Step: review (conditional)

Goal: have the other engine critique the work. Run on sensitive slices (auth,
money, ownership, data integrity); optional for trivial ones. Two modes.

**Stance:** You orchestrate a read-only critique from the other engine and
triage it honestly — fold it in, fix it in build, or reject it *with a reason*.
A review you rubber-stamp is worse than none.

## Inputs (read only these)

- `.work/<TICKET-ID>/context.md` and `.work/<TICKET-ID>/plan.md`.
- For a diff review: the working git diff as well.
- This shim's declared engine identity (it names the reviewing engine).

## Precondition

Run `quark check <TICKET-ID> --for review`. If it exits non-zero, STOP and
report — `context.md` and `plan.md` must be valid before review.

## Procedure

1. Routing: run a review when `context.md`'s `## Sensitivity` is not `None`
   (auth, money, ownership, PII, data-integrity, migrations); it is optional for
   trivial, non-sensitive slices. Skipping a warranted review is a failure mode.
2. Determine mode: plan review (pre-build, no diff yet) or diff review
   (post-build, a working diff exists).
3. Identify the reviewing engine from this shim's identity (Claude drives →
   Codex reviews; Codex drives → Claude reviews). Use the exact read-only
   invocation from the Shared Conventions above.
4. Run the reviewer by path: plan review → `context.md` + `plan.md`; diff
   review → the working git diff + `plan.md` + `context.md`.
5. If the other engine's CLI is unavailable, follow the Shared Conventions
   fallback (a clearly-labeled same-engine self-review).
6. Triage every blocking/important item: fold into the plan, fix in build, or
   consciously reject with a reason. Surface blocking items to the developer.
7. Record the verdict: `quark gate <TICKET-ID> review --verdict
   <passed|resolved>`. If the other engine's CLI was unavailable and you fell
   back to a same-engine self-review on a sensitive slice, the developer must
   consciously accept the weaker control: record `quark gate <TICKET-ID> review
   --verdict fallback-approved --by "<name>"`.
8. If triage folds a reviewer's change back into the plan, the plan has changed:
   re-record approval (and, on a sensitive slice, the review) — the hash gate in
   `quark check --for build` will otherwise block.

## Failure modes

- Rubber-stamping — accepting the reviewer's output without triage → every
  Blocking/Important item gets an explicit Resolution (fold / fix / reject +
  reason). See `examples/review.md`.
- Letting the reviewer modify the tree → use only the read-only invocation from
  the Shared Conventions.
- Dropping a Blocking item silently → unresolved Blocking items STOP progress and
  are surfaced to the developer.
- Skipping a warranted review → if `## Sensitivity` ≠ None, a review is required;
  `quark check --for build` blocks without a recorded verdict.

## Output

- `.work/<TICKET-ID>/review.md` from `templates/review.md`: the reviewer's
  findings grouped by severity (Blocking / Important / Minor) with the mode and
  a timestamp, plus a `## Resolutions` entry for each blocking/important item.
  See `examples/review.md`.

## Self-check

Run `quark check <TICKET-ID>` and confirm `review.md` reports OK and that no
Blocking item is left without a resolution.

## Handoff

Update `.work/<TICKET-ID>/state.md`: current step `review`, status `done` (or
`blocked` if blocking items are unresolved), next action `build`.

Then tell the developer: `review` is done — start a new session and run
`quark-build`.
