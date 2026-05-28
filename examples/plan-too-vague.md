# Plan: RAY-001 (ANTI-EXAMPLE — do not imitate)

## Approach

Add JSON support to status. Handle the edge cases and update the tests.

## Changes (file by file)

- Update the status command and the formatter as needed.

## Test strategy

- Add tests for the new behavior.

## Definition of done

- [ ] It works.

## Risks & mitigations

- None.

---

> **Why this is bad:** "handle the edge cases" names none; "as needed" and "the
> new behavior" force the build agent to re-derive every decision; "It works" is
> not a checkable criterion; there are no real file paths. And the single
> Definition-of-done item cites no `(ACn)`, so it covers none of AC1–AC3 —
> `quark check --for review` rejects it on coverage before a human even reads it.
> A cold-start build agent handed this plan will drift. Compare `examples/plan.md`.
