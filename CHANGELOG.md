# Changelog

All notable changes to Quark are documented in this file.

The format is based on [Keep a Changelog][kac], and this project adheres to
[Semantic Versioning][semver].

## [0.5.0] - 2026-05-27

### Added

- **`quark check <TICKET>` validator.** A zero-dependency structural validator
  for the per-ticket `.work/` artifacts: `quark check <TICKET>` validates every
  artifact present; `quark check <TICKET> --for <step>` is the readiness gate
  for entering a step. Exit 0 pass / 1 validation failure / 2 usage error.
  Backed by a `SCHEMAS` contract and check functions in `src/check.mjs`.
- **Cold-start step contract.** Every loop playbook is rewritten to a uniform
  skeleton — inputs → precondition gate (`quark check --for <step>`) →
  procedure → output schema → self-check → handoff — so each step is a
  self-contained function a fresh session (or the other engine) runs from
  `.work/` alone.
- **Worked-example artifacts** in `examples/` (filled `context.md` /
  `plan.md` / `state.md` plus a `plan-too-vague.md` anti-example), inlined
  into the relevant step skills as few-shot anchors.
- `templates/review.md` and `templates/pr.md`; `templates/state.md` gains a
  frontmatter baton. A no-drift test ties every template to its schema.
- `/quark-config` can now, with consent, pre-authorize `quark check` in the
  engine's permission config (Claude `permissions.allow`; Codex execpolicy
  rule).

### Changed

- `composeCommand` also inlines referenced `examples/<name>.md` (parallel to
  `templates/<name>.md`); `parseArgs` gains `ticket` + `--for <step>`.
- Quark now expects a global install (`npm i -g github:robbell5/quark`) so
  `quark check` is on `PATH` for the gate.

## [0.4.0] - 2026-05-26

### Changed

- **Install model → Agent Skills on both engines.** Quark now installs a
  self-contained skill *directory* per command into each engine's skill root —
  `~/.claude/skills/quark-*/SKILL.md` (Claude Code) and
  `~/.agents/skills/quark-*/SKILL.md` (Codex) — replacing the v0.3.0 flat
  command files in `~/.claude/commands` and `~/.codex/prompts`. Invoke with
  `/quark-*` (Claude) or `$quark-*` (Codex). This follows the official guidance
  that custom commands/prompts are superseded by skills.
- All seven skills are **explicit-invocation only**: Claude headers carry
  `disable-model-invocation: true`; Codex skills carry an `agents/openai.yaml`
  sidecar with `policy.allow_implicit_invocation: false`.
- Codex headers gain the required `SKILL.md` frontmatter (`name`,
  `description`) they lacked as prompts, and reference the invocation text
  instead of `$ARGUMENTS` (Codex does not substitute it).
- `install` and `uninstall` now sweep leftover v0.3.0 flat command files from
  `~/.claude/commands` / `~/.codex/prompts`, so a stale command can't shadow the
  new skill.

### Added

- `shims/codex-openai.yaml` — the Codex explicit-only sidecar, copied verbatim
  into every Codex skill dir.
- `sweepLegacy` in `src/lib.mjs` — removes the v0.3.0 flat command files.

## [0.3.0] - 2026-05-26

### Changed

- The installer now writes **self-contained** command files: each `/quark-*`
  command embeds the shared conventions, the step body, and any referenced
  templates, instead of pointing at an absolute clone path. This enables
  `npx github:robbell5/quark install` with no clone and nothing left on disk
  beyond the command files. `composeCommand` replaces `renderShim`.
- The CLI binary is now `bin/quark` with `install` (default) and `uninstall`
  subcommands. `--claude` / `--codex` / `--dry-run` are unchanged.

### Added

- `uninstall` — removes the `quark-*` command files Quark owns from both engine
  directories.
- `files` allowlist in `package.json`, readying a future npm publish.

### Removed

- `renderShim` and the `{{QUARK_ROOT}}` placeholder — commands no longer
  reference any external path.

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
[0.5.0]: https://github.com/robbell5/quark/releases/tag/v0.5.0
[0.4.0]: https://github.com/robbell5/quark/releases/tag/v0.4.0
[0.3.0]: https://github.com/robbell5/quark/releases/tag/v0.3.0
[0.2.0]: https://github.com/robbell5/quark/releases/tag/v0.2.0
[0.1.0]: https://github.com/robbell5/quark/releases/tag/v0.1.0
