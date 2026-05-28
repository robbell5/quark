# Contributing to Quark

The product is the Markdown in `playbook/`; the installer is plumbing. This doc
is for hacking on Quark itself. For the agent-oriented deep dive — how a Claude
Code or Codex session should work in this repo — see [`CLAUDE.md`](CLAUDE.md).

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

## Development

Run `node --test` for the full suite. Zero runtime dependencies (Node built-ins
only) — keep it that way; it is the deliberate anti-supply-chain stance.

The six step names in `STEPS` (`src/lib.mjs`) are the single source of truth for
the loop. To add or rename a step, change `STEPS`, add the matching
`playbook/<step>.md`, and reinstall so the per-engine skill files regenerate.
Non-loop utilities live in `UTILITIES` (currently just `config`) and are added
the same way.

Editing any `playbook/*.md`, `templates/*.md`, `examples/*.md`, shim, or
`shims/codex-openai.yaml` requires re-running the installer (`node bin/quark
install`) to regenerate the self-contained skill files — they no longer point
back at this repo. `composeCommand` inlines both `templates/<name>.md` and
`examples/<name>.md` references found in the playbook source.

Follow test-driven development for logic changes; keep commits small and
focused, and run `node --test` before marking work done. Markdown must pass
markdownlint (`.markdownlint.json` disables hard line length, but wrap prose at
~80 columns to match the existing style). Integrate finished feature branches
into `main` with a squash merge (one commit per feature), then delete the
branch.

## Publishing to npm (later)

Quark installs straight from GitHub today. Publishing to npm later needs no code
changes — only packaging metadata:

1. Remove `"private": true` from `package.json`.
2. Set `"name"` to an available scoped name, e.g. `@robbell5/quark`.
3. `npm publish --access public`.

The `files` allowlist already scopes the published tarball. Once published,
`npx @robbell5/quark install` works exactly like the GitHub form.
