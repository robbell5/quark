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
   the rest as risks. Do not paper over an unknown. If the change surface is
   large, dispatch the read-only explorer worker to enumerate it (see
   **Delegating to workers** in the Shared Conventions); its digest mirrors
   `examples/explore-digest.md`. Write the plan from the digest.
2. Write `.work/<TICKET-ID>/plan.md` from `templates/plan.md`:
   - a file-by-file list of changes (exact paths, what changes in each);
   - the test strategy — which behaviors get tests (cite the `(ACn)` each
     exercises), and whether to use TDD (required for logic-heavy or financial
     slices: ownership math, money, derivations, auth);
   - a definition-of-done checklist that covers every acceptance criterion: each
     item that satisfies a criterion cites it as `(ACn)`, and every `ACn` in
     `context.md` is covered by at least one item (general quality gates such as
     "node --test passes" need no citation);
   - risks and how the plan mitigates them.
3. Keep the plan concrete — an engineer should execute it without re-deriving
   decisions. No "handle edge cases" hand-waving: name them. Then self-check:
   re-read each Definition-of-done item — is it checkable, and does it cite the
   `(ACn)` it satisfies? Is every acceptance criterion covered? Scan Approach and
   Changes for vague verbs ("handle", "manage", "as needed") and replace each
   with a concrete action.

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

Run `quark check <TICKET-ID>` and confirm `plan.md` reports OK, then run
`quark check <TICKET-ID> --for review` to confirm every acceptance criterion is
covered by a Definition-of-done item and every `(ACn)` resolves. Present the
plan to the developer for review. Implementation does not begin until they
approve: record the approval with `quark gate <TICKET-ID> plan-approved --by
"<name>"` (the developer may run this themselves). That stamps the plan's hash
into `state.md`; `quark check --for build` enforces it, and any later edit to the
plan invalidates the approval.

## Handoff

Update `.work/<TICKET-ID>/state.md`: current step `plan`, status `done`, next
action `review` — but note that `build` will not start until the plan is
approved and a review verdict is recorded.

Then tell the developer: `plan` is done — record approval with
`quark gate <TICKET-ID> plan-approved --by "<name>"`, then start a new session
and run the `review` step.
