# Step: build

Goal: implement `plan.md` faithfully in small steps, keeping `state.md` current
so the other engine can resume.

1. Read `plan.md`, `review.md` (if present), and `state.md`.
2. Work the plan one unit at a time. Where the plan calls for TDD: write the
   failing test, run it to confirm it fails, implement the minimum to pass, run
   it to confirm it passes.
3. Keep the diff focused — only what the plan calls for. No unrelated cleanup.
4. Make frequent small commits. After each meaningful unit, update `state.md`:
   completed item (+ commit hash), any decision/deviation, the next action.
5. **Stop on drift:** if you discover the plan is wrong or scope must change,
   pause, update `context.md`/`plan.md`, and reconcile with the developer
   before continuing. Do not silently expand scope.
6. When the plan's units are complete, set `state.md` step to `build`, status
   `done`, next action `verify`.

Output: focused implementation with passing tests; `state.md` resumable.
