# Step: review (conditional)

Goal: have the **other engine** critique the work. Run on sensitive slices
(auth, money, ownership, data integrity); optional for trivial ones. Runs in
two modes.

1. Determine mode:
   - **Plan review** (pre-build): if no implementation diff exists yet.
   - **Diff review** (post-build): if there is a working diff to assess.
2. Identify the reviewing engine from this shim's declared identity (Claude
   drives → Codex reviews; Codex drives → Claude reviews). Use the exact
   read-only invocation from `_shared.md`.
3. Run the reviewer against the relevant files by path:
   - Plan review: `context.md` + `plan.md`.
   - Diff review: the working git diff + `plan.md` + `context.md`.
4. Capture the reviewer's output into `.work/<TICKET-ID>/review.md`, grouped by
   severity (blocking / important / minor), with the mode and a timestamp.
5. Triage: for each blocking/important item, decide and record a resolution
   (fold into the plan, fix in build, or consciously reject with a reason).
   Surface blocking items to the developer.
6. If the other engine's CLI is unavailable, follow the `_shared.md` fallback
   (labeled self-review).
7. Update `state.md`: current step `review`, status `done` (or `blocked` if
   blocking items are unresolved), next action `build`.

Output: `review.md` with triaged concerns; plan or diff adjusted as needed.
