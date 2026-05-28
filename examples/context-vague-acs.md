# Context: SIGNUP-12 (ANTI-EXAMPLE — do not imitate)

## Intent

Add email validation to the signup form so users can't submit a bad address.

## Acceptance criteria

- AC1: Email validation works properly.
- AC2: Users can sign up and see errors when something is wrong.
- AC3: Add a `validateEmail()` helper to the signup form component.

## Files / modules in play

- src/signup/form.jsx — the signup form.

## Constraints

- No new dependencies.

## Risks

- None.

## Out of scope

- Password-strength rules.

## Sensitivity

None

## Open questions

- [x] None.

---

> **Why this is bad:** every AC violates the quality bar. **AC1** ("works
> properly") is subjective and unobservable — there is no test or UAT step for
> "properly"; name the observable behavior instead. **AC2** is compound ("sign up
> *and* see errors") and vague ("when something is wrong") — split it and name the
> specific invalid inputs. **AC3** is solution-shaped — it dictates a
> `validateEmail()` helper instead of the outcome a user can see. Across all
> three, the negative/edge space is unstated (which *exact* inputs are rejected?),
> so the spec is happy-path only. A plan can satisfy every one of these and still
> ship the wrong thing — and `quark check` emits advisory compound/subjective
> warnings on AC2 and AC1. Compare `examples/context.md`, where each AC is atomic,
> observable, and bounded.
