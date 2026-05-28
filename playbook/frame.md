# Step: frame

Goal: turn a ticket into a clear, scoped `context.md` and close ambiguity
before planning.

**Stance:** Linear (the tracker) is canonical; you are producing a *derived*
working context for this pass, not a new source of truth. Assume the ticket
underspecifies — close ambiguity before any planning.

## Inputs (read only these)

- The ticket: a tracker id (prefer the Linear MCP if available, else
  `gh issue view <id>`), or the description you were invoked with. If neither
  is available, ask the developer to paste the ticket text.
- The steering doc (`CLAUDE.md` / `AGENTS.md`) and the actual code the ticket
  touches — open the real files, modules, and patterns. Do not guess.

## Precondition

None — `frame` is the entry step.

## Procedure

1. Determine `<TICKET-ID>`: the tracker id (e.g. `RAY-123`), or a short kebab
   slug derived from the description if there is no ticket.
2. Create `.work/<TICKET-ID>/` if it does not exist.
3. Read the steering doc and the code in play before writing anything. If the
   area is large or unfamiliar, dispatch the read-only explorer worker to map it
   (see **Delegating to workers** in the Shared Conventions) and write
   `context.md` from its digest; keep developer questions in this session.
4. Write `.work/<TICKET-ID>/context.md` from `templates/context.md`, filling
   intent, acceptance criteria, the specific files/modules in play, constraints,
   risks, and explicit out-of-scope items. Give each acceptance criterion a
   stable id — `- AC1: …`, `- AC2: …`, sequential from 1 — so the plan and UAT
   can cite it; downstream artifacts reference these ids, so don't renumber them
   later. Write each acceptance criterion to the **Acceptance-criterion quality**
   bar below; when the ticket is too ambiguous to make one observable or bounded
   without guessing, don't invent — raise it as an open question (step 7). Write
   `None` in any genuinely empty section; never leave one blank.
5. Confirm scope with the developer in one or two sentences — what this ticket
   does and does not include.
6. Classify sensitivity: fill `## Sensitivity` in `context.md` with the
   categories this slice touches — auth, authorization, money, PII,
   data-integrity, migrations — or `None`. This one classification drives review
   routing and the verify security pass downstream, so do not leave it implicit.
7. List open questions in `context.md`, following the **Eliciting decisions**
   guide in the Shared Conventions: ask only what the code and tracker cannot
   answer, batch them, and propose a default for each. See
   `examples/open-questions.md`. Resolve blocking questions with the developer
   now; unresolved blocking questions STOP progress — do not advance to `plan`.

## Acceptance-criterion quality

Each `ACn` is the spine the rest of the loop keys off — plan covers it, review
checks it, verify proves it — so a vague AC corrupts everything downstream.
Write each to this bar:

- **Atomic** — one verifiable outcome per AC. Split "logs in *and* resets the
  password" into two criteria.
- **Observable** — confirmable true/false by behavior or output, implying its
  own check. Not "error handling is robust" but "an empty email shows an inline
  'Email required' error and blocks submit".
- **Outcome-shaped** — state what is true when done, not the mechanism. Not "add
  a `validateEmail` helper" but "`foo@` is rejected with a validation message".
- **Traceable** — maps to ticket text or a recorded developer answer; nothing
  invented.
- **Bounded** — state the negative/edge case, or defer it to `## Out of scope`
  on purpose. Not just "valid input saves" but also "a missing required field is
  rejected and nothing is saved".

`quark check` nudges (advisory, never blocking) on two mechanical smells — a
compound AC ("… and …") and a bare subjective term ("robust", "clean") — but
most of this bar is your judgment, not the gate's. See the anti-example in
`examples/context-vague-acs.md`, then compare `examples/context.md`.

## Failure modes

- Inventing requirements not traceable to the ticket → every acceptance
  criterion maps to ticket text or an explicit developer answer.
- An acceptance criterion that can't be checked → write each as something a
  later UAT step or test can reproduce, since plan and verify must cover it by
  `(ACn)`.
- A compound acceptance criterion (one AC doing two jobs) → split it so each AC
  names one outcome; a compound AC breaks the 1:1 plan/UAT coverage mapping.
- A solution-shaped acceptance criterion (names a mechanism or code symbol) →
  restate it as the observable result a user or test can see.
- Happy-path-only criteria → state the negative/edge behavior, or defer it to
  `## Out of scope` deliberately.
- Asking what you could read → reserve open questions for genuine judgment
  calls; determine the rest from the code (see Eliciting decisions).
- Silent scope creep → fill `## Out of scope` deliberately, not as an
  afterthought.
- Leaving sensitivity implicit → always fill `## Sensitivity` (write `None`
  only when no category truly applies); review routing keys off it.

## Output

- `.work/<TICKET-ID>/context.md` conforming to `templates/context.md`, with the
  `## Open questions` checkboxes all resolved and `## Sensitivity` filled. See
  `examples/context.md`.
- `.work/<TICKET-ID>/state.md` initialized from `templates/state.md` (see
  `examples/state.md`): `current_step: frame`, status `done` (or `blocked` if
  questions remain).

## Self-check

Run `quark check <TICKET-ID>` and confirm `context.md` reports OK; once the open
questions are resolved, `quark check <TICKET-ID> --for plan` should also pass.
Do not declare `frame` done until it does.

## Handoff

Update `.work/<TICKET-ID>/state.md`: current step `frame`, status `done` (or
`blocked`), next action `plan`, and any gotchas for the next runner.

Then tell the developer: `frame` is done — start a new session and run
`quark-plan`.
