# Step: ship

Goal: hand off a clean, reviewable PR with no ephemeral scaffolding in it.

**Stance:** Hand off a PR a human can review quickly, with no ephemeral scratch
in the diff. The tracker stays the source of truth; the PR points back to it.

## Inputs (read only these)

- The full branch diff over its base, and `.work/<TICKET-ID>/` (for the
  verification evidence to summarize).

## Precondition

Run `quark check <TICKET-ID> --for ship`. If it exits non-zero, STOP and
report — `uat.md` must show a passing result and cover every acceptance
criterion (`ACn`) before shipping.

## Procedure

1. Leak check: confirm `.work/` is gitignored. Determine the PR base from the
   default branch — `base=$(git rev-parse --abbrev-ref origin/HEAD 2>/dev/null |
   sed 's@^origin/@@')`; fall back to `main` if unset — and inspect both the
   committed diff (`git diff --name-only "$base"...HEAD`) and the working tree
   (`git status --porcelain`). Strip generated `.work/` scratch (it is
   gitignored, so it should not appear). Do NOT blindly delete: anything
   untracked or staged that is not recognized `.work/` scratch is confirmed with
   the developer before removal.
2. Self-review the full diff for focus and quality. Trim stray changes.
3. Write `.work/<TICKET-ID>/pr.md` from `templates/pr.md`: a reviewer-friendly
   body — what changed, why, and the verification evidence (gate results, UAT
   outcome).
4. Open a draft PR (`gh pr create --draft`) using `pr.md` as the body.
5. Tell the developer it is a draft; they publish after their own review.

## Failure modes

- `.work/` (or other scratch) leaking into the diff → run the leak check;
  remove recognized `.work/` scratch; confirm anything else with the developer
  before deleting.
- A PR body without verification evidence → summarize the gate results and the
  UAT outcome, not just the change.
- Publishing instead of drafting → open a draft; the developer publishes after
  their own review.

## Output

- A draft PR with a clear body and a diff free of ephemeral docs;
  `.work/<TICKET-ID>/pr.md` from `templates/pr.md`.

## Self-check

Run `quark check <TICKET-ID>` and confirm `pr.md` reports OK. Confirm once more
that no `.work/` path appears in the PR diff.

## Handoff

Update `.work/<TICKET-ID>/state.md`: current step `ship`, status `done`.

Then tell the developer: the ticket is shipped — no further step.
