# Step: plan

Goal: produce a reliable, reviewable `plan.md` that removes ambiguity about
*what* changes and *how* it is verified. This is the human review gate.

**Stance:** A skeptical planner — a cold-start builder, possibly the other
engine, must be able to execute this plan without re-deriving a single
decision you skipped.

## Inputs (read only these)

- `.work/<TICKET-ID>/context.md` and the code paths it names.

## Precondition

Run `quark check <TICKET-ID> --for plan`. If it exits non-zero, STOP and report —
`context.md` must be valid with no unresolved open questions before planning.

## Procedure

1. Read `context.md` and open the code paths it names; from them enumerate the
   **change surface** — the exact files and functions the slice touches — and
   list what you do *not* yet know. Settle each unknown from the code where you
   can. A build-critical unknown the code cannot settle is a blocking question:
   follow the **Eliciting decisions** guide in the Shared Conventions. Record
   the rest as risks. Do not paper over an unknown.
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

## Failure modes

- Vague verbs — "handle the edge cases", "update as needed" → name the cases and
  the changes; if you can't, you haven't planned them (see
  `examples/plan-too-vague.md`).
- Tests that assert implementation, not behavior → tie each test to an
  acceptance criterion.
- Definition-of-done items that aren't checkable → every item is something a
  reviewer can verify true or false.

## Output

- `.work/<TICKET-ID>/plan.md` conforming to `templates/plan.md`. Match the
  specificity of `examples/plan.md`; avoid the failure mode in
  `examples/plan-too-vague.md`.

## Self-check

Run `quark check <TICKET-ID>` and confirm `plan.md` reports OK, then present the
plan to the developer for review. Implementation does not begin until they
approve: record the approval with `quark gate <TICKET-ID> plan-approved --by
"<name>"` (the developer may run this themselves). That stamps the plan's hash
into `state.md`; `quark check --for build` enforces it, and any later edit to the
plan invalidates the approval.

## Handoff

Update `.work/<TICKET-ID>/state.md`: current step `plan`, status `done`, next
action `review` (sensitive slices) or `build` — but note that `build` will not
start until the plan is approved (and, for sensitive slices, reviewed).

Then tell the developer: `plan` is done — record approval with
`quark gate <TICKET-ID> plan-approved --by "<name>"`, then start a new session and
run the `review` step (sensitive slices) or `build`.
