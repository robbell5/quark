# Quark

A thin, self-owned development harness that runs the same issue-level loop
natively on both Claude Code and OpenAI Codex. Its primary job is to remove
ambiguity before any code is written — confirm scope, close open questions,
and produce a reliable, reviewed plan — then execute that plan faithfully,
confirm acceptance criteria, strip the ephemeral planning docs, and open a PR.

Status: active — v0.3.0. Installable and dogfooded.

## Layout

- `playbook/` — the six loop steps plus `config.md` and `_shared.md` (the
  product).
- `shims/` — per-engine command templates: loop (`claude.md`, `codex.md`) and
  config (`claude-config.md`, `codex-config.md`).
- `src/lib.mjs`, `bin/quark` — the zero-dependency installer.
- `templates/` — `.work/<TICKET>/` artifact skeletons.
- `test/` — `node:test` suites.

## Requirements

- Node.js ≥ 18.
- The `claude` (Claude Code) and/or `codex` (OpenAI Codex) CLIs for whichever
  engines you drive. Cross-engine review degrades gracefully to a labeled
  self-review when the other CLI is absent.

## Install

```bash
npx github:robbell5/quark install            # commands for both engines
npx github:robbell5/quark install --claude   # only Claude Code
npx github:robbell5/quark install --codex    # only Codex
npx github:robbell5/quark install --dry-run  # preview, write nothing
```

This writes self-contained command files into each engine's command directory
(`~/.claude/commands`, `~/.codex/prompts`). Nothing else is placed on disk and
no project is touched. To remove them later:

```bash
npx github:robbell5/quark uninstall
```

Pin a version with a git ref, e.g. `npx github:robbell5/quark#v0.3.0 install`.
From a local clone the same commands are `node bin/quark install` /
`node bin/quark uninstall`.

## Publishing to npm (later)

Quark installs straight from GitHub today. Publishing to npm later needs no code
changes — only packaging metadata:

1. Remove `"private": true` from `package.json`.
2. Set `"name"` to an available scoped name, e.g. `@robbell5/quark`.
3. `npm publish --access public`.

The `files` allowlist already scopes the published tarball. Once published,
`npx @robbell5/quark install` works exactly like the GitHub form.

## Configure a repo

Inside a repo you want to use Quark in, run `/quark-config`. It checks the
repo's setup and, with your consent, fixes it: ensures `.work/` is gitignored,
aliases `CLAUDE.md` and `AGENTS.md` so both engines read identical guidance, and
scaffolds a steering doc if neither exists. Safe to re-run.

## The loop

Per ticket, in either engine: `/quark-frame <ticket>` → `/quark-plan` →
(`/quark-review`) → `/quark-build` → `/quark-verify` → `/quark-ship`. Planning
artifacts live in `.work/<TICKET>/` and are stripped before the PR. Switch
engines any time — `state.md` is the handoff.

## Development

Run `node --test` for the full suite. Zero runtime dependencies. MIT licensed.

Editing any `playbook/*.md`, `templates/*.md`, or shim requires re-running the
installer (`node bin/quark install`) to regenerate the self-contained command
files.
