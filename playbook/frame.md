# Step: frame

Goal: turn a ticket into a clear, scoped `context.md` and **close ambiguity
before planning**.

1. Determine `<TICKET-ID>`. If a tracker id was given, fetch the ticket:
   prefer the Linear MCP if available, else `gh issue view <id>`; if neither is
   available, ask the developer to paste the ticket text. If there is no
   ticket, derive a short kebab `<TICKET-ID>` from the description.
2. Create `.work/<TICKET-ID>/` if it does not exist.
3. Read the steering doc (`CLAUDE.md` / `AGENTS.md`) and the actual code the
   ticket touches — find the real files, modules, and patterns involved. Do not
   guess; open the files.
4. Write `.work/<TICKET-ID>/context.md` from `templates/context.md`, filling:
   intent, acceptance criteria, the specific files/modules in play, known
   constraints, risks, and explicit out-of-scope items.
5. **Confirm scope** with the developer in one or two sentences: what this
   ticket does and does not include.
6. **Surface open questions and gaps** as a list in `context.md`, and resolve
   them with the developer now. Unresolved blocking questions stop progress —
   do not move on to `plan` until they are answered.
7. Initialize `.work/<TICKET-ID>/state.md` from `templates/state.md` with
   current step `frame`, status `done` (or `blocked` if questions remain),
   next action `plan`.

Output: `context.md` with no unresolved blocking questions; `state.md` started.
