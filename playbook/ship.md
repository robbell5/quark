# Step: ship

Goal: hand off a clean, reviewable PR with no ephemeral scaffolding in it.

1. **Leak check:** confirm `.work/` is gitignored and that no `.work/` files
   (or other scratch) appear in the diff: `git status` and
   `git diff --name-only $(git merge-base origin/HEAD HEAD)..HEAD` (the files
   this branch adds over its base). If anything leaked, remove it.
2. Self-review the full diff for focus and quality. Trim stray changes.
3. Write `.work/<TICKET-ID>/pr.md`: a reviewer-friendly body — what changed,
   why, and the verification evidence (gate results, UAT outcome).
4. Open a **draft** PR (`gh pr create --draft`) using `pr.md` as the body.
5. Tell the developer it is a draft; they publish after their own review.
6. Update `state.md`: step `ship`, status `done`.

Output: a draft PR with a clear body and a diff free of ephemeral docs.
