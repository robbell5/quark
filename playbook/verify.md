# Step: verify

Goal: prove the slice meets its acceptance criteria with real evidence.

1. Read the definition-of-done checklist in `plan.md` and the acceptance
   criteria in `context.md`.
2. Run the repo's gates, reading the exact commands from the steering doc
   (lint, typecheck, test, build). Record the actual output. If a gate fails,
   return to `build`; do not proceed.
3. Write/refresh `.work/<TICKET-ID>/uat.md` from `templates/uat.md`: a short
   manual walkthrough mapped to the acceptance criteria. Replay it (or have the
   developer replay it) and record the result.
4. **Security pass (conditional):** if the slice touches authentication,
   authorization/access control, money, PII, or database migrations, review
   for the obvious failure modes (authz gaps, injection, secret exposure,
   migration safety) and record findings.
5. Confirm every definition-of-done item is checked with evidence. Never mark
   verify done on assertion alone.
6. Update `state.md`: step `verify`, status `done`, next action `ship`.

Output: recorded gate output, a replayed `uat.md`, and (if relevant) a security
note — all tied to the acceptance criteria.
