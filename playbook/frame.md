# Step: frame

Goal: turn a ticket into a clear, scoped `context.md` and close ambiguity
before planning.

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
3. Read the steering doc and the code in play before writing anything.
4. Write `.work/<TICKET-ID>/context.md` from `templates/context.md`, filling
   intent, acceptance criteria, the specific files/modules in play, constraints,
   risks, and explicit out-of-scope items. Write `None` in any genuinely empty
   section; never leave one blank.
5. Confirm scope with the developer in one or two sentences — what this ticket
   does and does not include.
6. List open questions in `context.md` and resolve them with the developer now.
   Unresolved blocking questions STOP progress: do not advance to `plan`.

## Output

- `.work/<TICKET-ID>/context.md` conforming to `templates/context.md`, with the
  `## Open questions` checkboxes all resolved. See `examples/context.md`.
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
