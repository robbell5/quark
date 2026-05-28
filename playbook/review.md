# Step: review

Goal: critique the plan against the actionability bar and record structured,
addressable gaps, so a cold-start builder can execute it without re-deciding.

**Stance:** A fresh, skeptical reader. You did not write this plan — judge it on
its face. Name gaps that are specific and fixable; a vague gap with no fix is
noise, and a rubber-stamp is worse than no review.

## Inputs (read only these)

- `.work/<TICKET-ID>/context.md` — intent and acceptance criteria (`ACn`).
- `.work/<TICKET-ID>/plan.md` — the plan under review.

## Precondition

Run `quark check <TICKET-ID> --for review`. It validates `context.md` +
`plan.md` and checks that every acceptance criterion is covered by a
Definition-of-done item (and that every `(ACn)` resolves). If it exits
non-zero, STOP and report — fix the plan's structure before reviewing prose.

## Procedure

1. Read `context.md`, then `plan.md`. Hold the acceptance criteria in mind: the
   plan exists to satisfy them.
2. Critique the plan for the gaps a structural gate cannot catch:
   - **Ambiguity** — vague verbs ("handle", "update as needed") a builder would
     have to re-decide. Name the specific decision left open.
   - **Coverage of intent** — does each AC's Definition-of-done item actually
     establish that criterion, or only gesture at it?
   - **Missing edge cases / risks** — inputs, failure paths, or migrations the
     plan ignores.
   - **Test adequacy** — does the test strategy tie to behavior (the ACs), or
     assert implementation detail?
   - **Sequencing / change surface** — files or steps that are wrong, missing,
     or out of order.
3. Write each finding as an actionable gap: what is missing, where, and what
   would close it — not just "this is unclear".
4. Record a verdict (see Output). The loop: if there are Blocking/Important
   gaps, hand back to `plan` to close them, then re-review; exit when the plan
   is clean (`passed`/`resolved`) or the developer consciously accepts the
   remaining gaps (`accepted`).

**Optional second model.** For a genuinely different model's perspective (most
valuable on a sensitive slice — auth, money, PII, data-integrity, migrations),
open the other engine's CLI and run this same review skill on the same `.work/`
artifacts. Optional, never required.

## Failure modes

- A vague gap with no fix ("the plan is unclear") → name the specific decision
  left open and what would close it. See `examples/review.md`.
- Rubber-stamping — a clean verdict without real critique → every Blocking /
  Important finding gets a `## Resolutions` entry (fold / fix / reject + reason).
- Accepting Blocking gaps with no logged rationale → record the decision with
  `quark gate <TICKET-ID> review --verdict accepted --note "<why>"`; the note is
  the audit trail.
- Editing the implementation → review is read-only; you change `review.md` and
  the verdict only, never the tree.

## Output

- `.work/<TICKET-ID>/review.md` from `templates/review.md`: findings grouped by
  severity (Blocking / Important / Minor) with a `## Resolutions` entry for each
  Blocking/Important item. See `examples/review.md`.
- A recorded verdict: `quark gate <TICKET-ID> review --verdict
  <passed|resolved|accepted> [--by "<name>"] [--note "<why>"]`. `passed` = no
  gaps; `resolved` = gaps closed via the plan ⇄ review loop; `accepted` = gaps
  consciously accepted (note required). The verdict binds to the current plan
  hash, so a later plan edit forces a re-review.

## Self-check

Run `quark check <TICKET-ID>` and confirm `review.md` reports OK and that no
Blocking item is left without a Resolution.

## Handoff

Update `.work/<TICKET-ID>/state.md`: current step `review`, status `done` (or
`blocked` if Blocking gaps stand), next action `build` — or back to `plan` if
gaps need closing.

Then tell the developer: `review` is done — start a fresh session and run
`quark-build` (or `quark-plan` to close gaps first).
