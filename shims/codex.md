---
name: quark-{{STEP}}
description: "Quark {{STEP}} step (Codex)"
---

# Quark {{STEP}} — OpenAI Codex

You are running the Quark `{{STEP}}` step in **OpenAI Codex**.

- Your engine: Codex. Review runs natively here — no headless call to another
  engine. For an optional second opinion from a different model, run the same
  review skill in Claude Code on the same `.work/` artifacts.
- Ticket / input: the ticket id or description you were invoked with
  (e.g. `$quark-{{STEP}} RAY-123`). If none was given, ask the developer.
