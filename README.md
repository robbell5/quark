# Quark

A thin, self-owned development harness that runs the same issue-level loop
natively on both Claude Code and OpenAI Codex. Its primary job is to remove
ambiguity before any code is written — confirm scope, close open questions,
and produce a reliable, reviewed plan — then execute that plan faithfully,
confirm acceptance criteria, strip the ephemeral planning docs, and open a PR.

Status: active — v0.5.0. Installable and dogfooded.

## Layout

- `playbook/` — the six loop steps plus `config.md` and `_shared.md` (the
  product).
- `shims/` — per-engine `SKILL.md` headers: loop (`claude.md`, `codex.md`) and
  config (`claude-config.md`, `codex-config.md`), plus `codex-openai.yaml` (the
  Codex explicit-only sidecar).
- `src/lib.mjs` — the zero-dependency installer; `src/check.mjs` holds the
  `quark check` validator (`SCHEMAS` contract + check functions).
- `bin/quark` — the CLI entry (`install`, `uninstall`, `check` subcommands).
- `templates/` — `.work/<TICKET>/` artifact skeletons.
- `examples/` — filled worked-example artifacts, inlined into the step skills
  as few-shot anchors.
- `test/` — `node:test` suites.

## Requirements

- Node.js ≥ 18.
- The `claude` (Claude Code) and/or `codex` (OpenAI Codex) CLIs for whichever
  engines you drive. Cross-engine review degrades gracefully to a labeled
  self-review when the other CLI is absent.
- A global install (`npm i -g github:robbell5/quark`) puts `quark` on `PATH`
  so the `quark check` precondition gate works inside each step.

## Install

```bash
npx github:robbell5/quark install            # commands for both engines
npx github:robbell5/quark install --claude   # only Claude Code
npx github:robbell5/quark install --codex    # only Codex
npx github:robbell5/quark install --dry-run  # preview, write nothing
```

This writes a self-contained skill directory per command into each engine's
skill root: `~/.claude/skills/quark-*/SKILL.md` (Claude Code) and
`~/.agents/skills/quark-*/SKILL.md` (Codex, which also gets an
`agents/openai.yaml` sidecar). All seven skills are explicit-only — you invoke
them; the model never auto-fires them. Install (and uninstall) also sweep any
leftover v0.3.0 command files from `~/.claude/commands` / `~/.codex/prompts`, so
the old flat commands can't shadow the new skills. To remove them later:

```bash
npx github:robbell5/quark uninstall
```

Pin a version with a git ref, e.g. `npx github:robbell5/quark#v0.4.0 install`.
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

Inside a repo you want to use Quark in, run `/quark-config` (Claude Code) or
`$quark-config` (Codex). It checks the repo's setup and, with your consent,
fixes it: ensures `.work/` is gitignored, aliases `CLAUDE.md` and `AGENTS.md`
so both engines read identical guidance, and scaffolds a steering doc if
neither exists. It can also (with consent) pre-authorize `quark check` in the
engine's permission config (Claude `permissions.allow`; Codex execpolicy rule).
Safe to re-run.

## The loop

Per ticket: `/quark-frame <ticket>` → `/quark-plan` → (`/quark-review`) →
`/quark-build` → `/quark-verify` → `/quark-ship` on Claude Code; the same steps
are `$quark-frame <ticket>` … `$quark-ship` on Codex.

**Run each step in a fresh session.** Every step is a cold start: it wakes with
no memory of the previous one and re-grounds from `.work/<TICKET>/`. A fresh
session per step is what keeps context clean — the whole point of the handoff
files. Running several steps in one session still works (each step re-reads the
files), it just spends context you did not need to. Switch engines any time —
`state.md` is the handoff.

**Resume.** Forgotten where a ticket stands? Run `quark check <TICKET>`: it
prints the `state.md` baton (current step, status, driver, updated, next
action) and validates the artifacts. Then open a fresh session and run the
next step.

Planning artifacts live in `.work/<TICKET>/` and are stripped before the PR.
Each step also runs `quark check <ticket> --for <step>` as a precondition gate
and `quark check <ticket>` as a self-check, so a step refuses to start from a
malformed upstream artifact.

## Development

Run `node --test` for the full suite. Zero runtime dependencies. MIT licensed.

Editing any `playbook/*.md`, `templates/*.md`, shim, or `shims/codex-openai.yaml`
requires re-running the installer (`node bin/quark install`) to regenerate the
self-contained skill files.
