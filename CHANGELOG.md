# Changelog

All notable changes to Quark are documented in this file.

The format is based on [Keep a Changelog][kac], and this project adheres to
[Semantic Versioning][semver].

## [0.2.0] - 2026-05-26

### Changed

- `quark-install` no longer mutates the repo it is run from. It only renders
  the `/quark-*` command files into each engine's command directory. Repo
  configuration moved to the new `/quark-config` command.

### Added

- `/quark-config` — an LLM-driven command that checks (and, with consent,
  fixes) a repo's Quark setup: `.work/` gitignored, `CLAUDE.md`/`AGENTS.md`
  aliased so both engines read identical guidance, and a steering doc
  scaffolded if neither exists. Generated from reviewer-free per-engine
  templates (`shims/claude-config.md`, `shims/codex-config.md`).
- `UTILITIES` list in `src/lib.mjs` for non-loop commands, kept separate from
  the six-step `STEPS` loop.

### Removed

- `ensureGitignoreEntry` and `ensureAgentsSymlink` (and their tests). The
  judgment they encoded now lives in the `/quark-config` playbook.

## [0.1.0] - 2026-05-24

Initial release: the dual-engine issue-level harness.

### Added

- Six-step loop playbooks (`frame`, `plan`, `review`, `build`, `verify`,
  `ship`) plus `playbook/_shared.md` — the artifact schema, the `state.md`
  handoff format, the cross-cutting principles, and the read-only cross-engine
  reviewer invocations.
- Per-engine command templates (`shims/claude.md`, `shims/codex.md`) with
  engine identity baked in: Claude drives with Codex reviewing, and vice versa.
- `quark-install` CLI (`bin/quark-install`, `src/lib.mjs`) — generates resolved
  per-step command files for both engines, with `--claude`, `--codex`, and
  `--dry-run` flags. It also appends `.work/` to the target repo's `.gitignore`
  and symlinks `AGENTS.md` to `CLAUDE.md`.
- `.work/<TICKET>/` artifact templates (`context.md`, `plan.md`, `state.md`,
  `uat.md`).
- `node:test` suites covering installer logic, shim and playbook structure, and
  an end-to-end install into a throwaway HOME.

[kac]: https://keepachangelog.com/en/1.1.0/
[semver]: https://semver.org/spec/v2.0.0.html
[0.2.0]: https://github.com/robbell5/quark/releases/tag/v0.2.0
[0.1.0]: https://github.com/robbell5/quark/releases/tag/v0.1.0
