# Step: plan

Goal: produce a reliable, reviewable `plan.md` that removes ambiguity about
*what* changes and *how* it is verified. This is the human review **gate**.

1. Read `context.md` and the code paths it names.
2. Write `.work/<TICKET-ID>/plan.md` from `templates/plan.md`, including:
   - A file-by-file list of changes (exact paths, what changes in each).
   - The test strategy: which behaviors get tests, and whether to use TDD
     (required for logic-heavy or financial slices — ownership math, money,
     derivations, auth).
   - A definition-of-done checklist derived directly from the acceptance
     criteria in `context.md`.
   - Risks and how the plan mitigates them.
3. Keep the plan concrete: an engineer should be able to execute it without
   re-deriving decisions. No "handle edge cases" hand-waving — name them.
4. **Gate:** present the plan for developer review. Implementation does not
   begin until the plan is solid and `context.md`'s open questions are closed.
5. Update `state.md`: current step `plan`, status `done`, next action
   `review` or `build`.

Output: a concrete `plan.md`; developer has the chance to review before code.
