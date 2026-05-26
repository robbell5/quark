---
name: quark-{{STEP}}
description: "Quark {{STEP}} step (Codex driver; Claude Code reviews)"
---

# Quark {{STEP}} — OpenAI Codex

You are running the Quark `{{STEP}}` step in **OpenAI Codex**.

- Your engine: Codex. The review engine is **Claude Code**, invoked via the
  `claude -p` CLI as described in the Shared Conventions below.
- Ticket / input: the ticket id or description you were invoked with
  (e.g. `$quark-{{STEP}} RAY-123`). If none was given, ask the developer.
