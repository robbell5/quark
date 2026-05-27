# Step: plan

Goal: produce a reliable, reviewable `plan.md` that removes ambiguity about
*what* changes and *how* it is verified. This is the human review gate.

## Inputs (read only these)

- `.work/<TICKET-ID>/context.md` and the code paths it names.

## Precondition

Run `quark check <TICKET-ID> --for plan`. If it exits non-zero, STOP and report —
`context.md` must be valid with no unresolved open questions before planning.

## Procedure

1. Read `context.md` and open the code paths it names.
2. Write `.work/<TICKET-ID>/plan.md` from `templates/plan.md`:
   - a file-by-file list of changes (exact paths, what changes in each);
   - the test strategy — which behaviors get tests, and whether to use TDD
     (required for logic-heavy or financial slices: ownership math, money,
     derivations, auth);
   - a definition-of-done checklist derived directly from `context.md`'s
     acceptance criteria;
   - risks and how the plan mitigates them.
3. Keep the plan concrete — an engineer should execute it without re-deriving
   decisions. No "handle edge cases" hand-waving: name them.

## Output

- `.work/<TICKET-ID>/plan.md` conforming to `templates/plan.md`. Match the
  specificity of `examples/plan.md`; avoid the failure mode in
  `examples/plan-too-vague.md`.

## Self-check

Run `quark check <TICKET-ID>` and confirm `plan.md` reports OK, then present the
plan for developer review. Implementation does not begin until the plan is solid
and the check passes.

## Handoff

Update `.work/<TICKET-ID>/state.md`: current step `plan`, status `done`, next
action `review` (sensitive slices) or `build`.
