# Quark

A thin, self-owned development harness that runs the same issue-level loop
natively on both Claude Code and OpenAI Codex. Its primary job is to remove
ambiguity before any code is written — confirm scope, close open questions,
and produce a reliable, reviewed plan — then execute that plan faithfully,
confirm acceptance criteria, strip the ephemeral planning docs, and open a PR.

Status: active — v0.1.0. Installable and dogfooded.

## Layout

- `playbook/` — the six step instructions plus `_shared.md` (the product).
- `shims/` — per-engine command templates (`claude.md`, `codex.md`).
- `src/lib.mjs`, `bin/quark-install` — the zero-dependency installer.
- `templates/` — `.work/<TICKET>/` artifact skeletons.
- `test/` — `node:test` suites.

## Requirements

- Node.js ≥ 18.
- The `claude` (Claude Code) and/or `codex` (OpenAI Codex) CLIs for whichever
  engines you drive. Cross-engine review degrades gracefully to a labeled
  self-review when the other CLI is absent.

## Install

```bash
node bin/quark-install        # writes commands for both engines
node bin/quark-install --claude   # only Claude Code
node bin/quark-install --codex    # only Codex
node bin/quark-install --dry-run  # preview, write nothing
```

Run it from a repo you want to work in: it also adds `.work/` to that repo's
`.gitignore` and symlinks `AGENTS.md` to `CLAUDE.md` so Codex shares your
steering doc.

## The loop

Per ticket, in either engine: `/quark-frame <ticket>` → `/quark-plan` →
(`/quark-review`) → `/quark-build` → `/quark-verify` → `/quark-ship`. Planning
artifacts live in `.work/<TICKET>/` and are stripped before the PR. Switch
engines any time — `state.md` is the handoff.

## Development

Run `node --test` for the full suite. Zero runtime dependencies. MIT licensed.
