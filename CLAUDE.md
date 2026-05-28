# CLAUDE.md — Quark

This file orients a fresh Claude Code (or Codex) session working in this repo.
`AGENTS.md` is a symlink to this file, so both engines read identical guidance.

## What this repo is

Quark is a thin, self-owned development harness that runs the same issue-level
loop natively on both Claude Code and OpenAI Codex, treats planning docs as
ephemeral (stripped before the PR), and lets the developer switch primary
engines mid-ticket without losing context. Its core goal is to remove ambiguity
and produce a reliable, reviewed plan before any code is written.

See `docs/PHILOSOPHY.md` for *why* Quark is shaped this way — read it before
proposing structural changes — and `docs/PROMPT-AUTHORING.md` for the house
style every step playbook follows.

## Status

Active — v0.12.0. The harness is built, tested (`node --test`), and installable
via `npx github:robbell5/quark install` (or `node bin/quark install` from a
clone). It installs as **Agent Skills** on both engines —
`~/.claude/skills/quark-*/` and `~/.agents/skills/quark-*/`, explicit-invocation
only. The product is the Markdown in `playbook/`; the installer is plumbing.

## Layout

- `playbook/` — the product. `_shared.md` (artifact schema, `state.md` format,
  cold-start orientation, principles, native review) plus the six step
  files: `frame.md`,
  `plan.md`, `review.md`, `build.md`, `verify.md`, `ship.md`. Plus `config.md`,
  the `/quark-config` utility playbook.
- `shims/claude.md`, `shims/codex.md` — per-engine `SKILL.md` header templates
  (engine identity + frontmatter, `name: quark-{{STEP}}`) with the `{{STEP}}`
  placeholder. Claude headers carry `disable-model-invocation: true`; Codex
  headers are minimal (`name` + `description`) and become explicit-only via the
  `shims/codex-openai.yaml` sidecar (`policy.allow_implicit_invocation: false`),
  copied into each Codex skill dir as `agents/openai.yaml`. The installer
  composes each `SKILL.md` from the header plus `_shared.md`, the step body, and
  any referenced templates. `shims/claude-config.md`, `shims/codex-config.md`
  are the reviewer-free headers for the `config` utility.
- `src/lib.mjs` — installer logic: `STEPS`, `UTILITIES`, `AGENTS`,
  `resolveQuarkRoot`, `composeCommand`, `composeAgent`, `parseAgentSpec`,
  `installEngine`, `installEngineAgents`, `uninstallEngine`,
  `uninstallEngineAgents`, `sweepLegacy`, `engineTargets`, `parseArgs`,
  `install`, `uninstall`.
- `src/check.mjs` — the `quark check` validator: `SCHEMAS` contract,
  `REVIEW_VERDICTS`, `parseSections`, `parseFrontmatter`, `validateArtifact`,
  `parseAcIds`, `collectAcRefs`, `acCoverage` (the AC linkage spine), `planHash`,
  `setFrontmatterField`, `checkReadiness`, `runCheck`, `runGate`,
  `batonSummary`.
- `bin/quark` — the CLI entry (`install` / `uninstall` / `check` / `gate`) that
  wires `src/lib.mjs` and `src/check.mjs` to argv.
- `templates/` — `.work/<TICKET>/` skeletons (`context.md`, `plan.md`,
  `state.md`, `uat.md`, `review.md`, `pr.md`). `state.md` carries a
  frontmatter baton.
- `examples/` — filled worked-example artifacts (`context.md`, `plan.md`,
  `state.md`, `plan-too-vague.md` anti-example, plus `open-questions.md`,
  `review.md`, `uat.md`), inlined into the step skills as few-shot anchors.
- `agents/` — shared sub-agent specs (`explorer.md`), composed per-engine like
  skills. `shims/claude-agent.md` and `shims/codex-agent.toml` are the agent
  header templates (`{{AGENT}}`/`{{DESCRIPTION}}`/`{{ACCESS}}`/`{{BODY}}`); the
  installer composes them into `~/.claude/agents/` and `~/.codex/agents/`.
- `test/` — `node:test` suites: `lib`, `content` (structural), `e2e`, `smoke`.
- Each playbook in `playbook/` follows the **cold-start skeleton**: inputs →
  precondition gate (`quark check --for <step>`) → procedure → output schema →
  self-check → handoff. Each step is a self-contained function a fresh session
  (or the other engine) can run from `.work/` alone.

The original design spec and implementation plan are kept locally under
`docs/superpowers/` (gitignored) as historical reference. They are no longer the
source of truth — the playbooks and code are.

## How to work in it

- Run the suite with `node --test`. There are zero runtime dependencies (Node
  built-ins only); keep it that way — it is the deliberate anti-supply-chain
  stance.
- The six step names in `STEPS` (`src/lib.mjs`) are the single source of truth
  for the loop. To add or rename a step, change `STEPS`, add the matching
  `playbook/<step>.md`, and reinstall so the per-engine skill files
  regenerate.
- Non-loop utility commands live in `UTILITIES` (currently just `config`),
  generated from the reviewer-free `shims/<engine>-config.md` templates. Add one
  the same way: extend `UTILITIES`, add `playbook/<name>.md`, and reinstall.
- Editing any `playbook/*.md`, `templates/*.md`, `examples/*.md`, shim, or
  `shims/codex-openai.yaml` requires re-running `node bin/quark install` to
  regenerate the self-contained skill files (they no longer point back at this
  repo). `composeCommand` inlines both `templates/<name>.md` and
  `examples/<name>.md` references found in the playbook source.
- The `quark check` gate (run inside each step) expects the global `quark` CLI
  on `PATH`. Install globally with `npm i -g github:robbell5/quark`.
  `quark check <TICKET>` (no `--for`) also prints the `state.md` baton — the
  resume surface for a fresh session.
- Follow test-driven development for logic changes; keep commits small and
  focused, and run `node --test` before marking work done.

## Conventions

- Markdown must pass markdownlint. `.markdownlint.json` disables hard line
  length (MD013), but wrap prose at ~80 columns to match the existing style.
- This is a Node (ESM) JavaScript CLI (`.mjs`), zero runtime dependencies, no
  build step. It is intended for later npm distribution: the package is
  `private` for now, and the published name is deferred (npm `quark` is taken —
  scope as `@<scope>/quark` or use an available name such as `quarkflow`). The
  CLI binary stays `quark`; skills are invoked `/quark-*` (Claude Code) and
  `$quark-*` (Codex).
- Commits: clear and professional; no AI-attribution footers.
- Integrate finished feature branches into `main` with a **squash merge** (one
  commit per feature), then delete the branch.
