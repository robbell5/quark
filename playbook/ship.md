# Step: ship

Goal: hand off a clean, reviewable PR with no ephemeral scaffolding in it.

## Inputs (read only these)

- The full branch diff over its base, and `.work/<TICKET-ID>/` (for the
  verification evidence to summarize).

## Precondition

Run `quark check <TICKET-ID> --for ship`. If it exits non-zero, STOP and
report — `uat.md` must show a passing result before shipping.

## Procedure

1. Leak check: confirm `.work/` is gitignored and that no `.work/` files (or
   other scratch) appear in the diff — `git status` and
   `git diff --name-only $(git merge-base origin/HEAD HEAD)..HEAD`. If anything
   leaked, remove it.
2. Self-review the full diff for focus and quality. Trim stray changes.
3. Write `.work/<TICKET-ID>/pr.md` from `templates/pr.md`: a reviewer-friendly
   body — what changed, why, and the verification evidence (gate results, UAT
   outcome).
4. Open a draft PR (`gh pr create --draft`) using `pr.md` as the body.
5. Tell the developer it is a draft; they publish after their own review.

## Output

- A draft PR with a clear body and a diff free of ephemeral docs;
  `.work/<TICKET-ID>/pr.md` from `templates/pr.md`.

## Self-check

Run `quark check <TICKET-ID>` and confirm `pr.md` reports OK. Confirm once more
that no `.work/` path appears in the PR diff.

## Handoff

Update `.work/<TICKET-ID>/state.md`: current step `ship`, status `done`.

Then tell the developer: the ticket is shipped — no further step.
