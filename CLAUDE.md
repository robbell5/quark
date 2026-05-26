# CLAUDE.md — Quark

This file orients a fresh Claude Code (or Codex) session working in this repo.
`AGENTS.md` is a symlink to this file, so both engines read identical guidance.

## What this repo is

Quark is a thin, self-owned development harness that runs the same issue-level
loop natively on both Claude Code and OpenAI Codex, treats planning docs as
ephemeral (stripped before the PR), and lets the developer switch primary
engines mid-ticket without losing context. Its core goal is to remove ambiguity
and produce a reliable, reviewed plan before any code is written.

## Status

Active — v0.3.0. The harness is built, tested (`node --test`, 31 passing), and
installable via `npx github:robbell5/quark install` (or `node bin/quark install`
from a clone). The product is the Markdown in `playbook/`;
the installer is plumbing.

## Layout

- `playbook/` — the product. `_shared.md` (artifact schema, `state.md` format,
  principles, reviewer invocations) plus the six step files: `frame.md`,
  `plan.md`, `review.md`, `build.md`, `verify.md`, `ship.md`. Plus `config.md`,
  the `/quark-config` utility playbook.
- `shims/claude.md`, `shims/codex.md` — per-engine header templates (engine
  identity + Claude frontmatter) with the `{{STEP}}` placeholder. The installer
  composes each command from the header plus `_shared.md`, the step body, and
  any referenced templates. `shims/claude-config.md`, `shims/codex-config.md`
  are the reviewer-free headers for the `config` utility.
- `src/lib.mjs` — installer logic: `STEPS`, `UTILITIES`, `resolveQuarkRoot`,
  `composeCommand`, `installEngine`, `uninstallEngine`, `engineTargets`,
  `parseArgs`, `install`, `uninstall`.
- `bin/quark` — the CLI entry (`install` / `uninstall`) that wires
  `src/lib.mjs` to argv.
- `templates/` — `.work/<TICKET>/` skeletons (`context.md`, `plan.md`,
  `state.md`, `uat.md`).
- `test/` — `node:test` suites: `lib`, `content` (structural), `e2e`, `smoke`.

The original design spec and implementation plan are kept locally under
`docs/superpowers/` (gitignored) as historical reference. They are no longer the
source of truth — the playbooks and code are.

## How to work in it

- Run the suite with `node --test`. There are zero runtime dependencies (Node
  built-ins only); keep it that way — it is the deliberate anti-supply-chain
  stance.
- The six step names in `STEPS` (`src/lib.mjs`) are the single source of truth
  for the loop. To add or rename a step, change `STEPS`, add the matching
  `playbook/<step>.md`, and reinstall so the per-engine command files
  regenerate.
- Non-loop utility commands live in `UTILITIES` (currently just `config`),
  generated from the reviewer-free `shims/<engine>-config.md` templates. Add one
  the same way: extend `UTILITIES`, add `playbook/<name>.md`, and reinstall.
- Editing any `playbook/*.md`, `templates/*.md`, or shim requires re-running
  `node bin/quark install` to regenerate the self-contained command files (they
  no longer point back at this repo).
- Follow test-driven development for logic changes; keep commits small and
  focused, and run `node --test` before marking work done.

## Conventions

- Markdown must pass markdownlint. `.markdownlint.json` disables hard line
  length (MD013), but wrap prose at ~80 columns to match the existing style.
- This is a Node (ESM) JavaScript CLI (`.mjs`), zero runtime dependencies, no
  build step. It is intended for later npm distribution: the package is
  `private` for now, and the published name is deferred (npm `quark` is taken —
  scope as `@<scope>/quark` or use an available name such as `quarkflow`). The
  CLI binary and slash-command prefix stay `quark` / `/quark-*` regardless.
- Commits: clear and professional; no AI-attribution footers.
