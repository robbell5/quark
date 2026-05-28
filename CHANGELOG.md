# Changelog

All notable changes to Quark are documented in this file.

The format is based on [Keep a Changelog][kac], and this project adheres to
[Semantic Versioning][semver].

## [0.12.0] - 2026-05-28

### Added

- **`SECURITY.md` disclosure policy.** Private vulnerability reporting via
  GitHub Security Advisories, a latest-only support stance, and install-integrity
  guidance (pin `npx`/`npm i` installs to a tag or commit SHA rather than
  tracking the default branch).
- **Untrusted-input convention.** `playbook/_shared.md` (inherited by every
  step) and the `quark-explorer` worker now frame ticket / issue / PR / diff
  text and worker digests as data to summarize, never instructions to obey —
  closing a prompt-injection path for downstream users of the harness.

### Security

- **Gate-write sanitization.** `setFrontmatterField` rejects newline-bearing
  values and inserts the value through a replacer function, so an agent-derived
  `--note` / `--by` can no longer forge other `state.md` gate fields (e.g. stamp
  `gate_plan_approved` during a `review` gate) or corrupt the frontmatter via
  `$`-replacement patterns. `runGate` rejects multi-line flag values up front.
- **`.work/` path containment.** `runGate` and `runCheck` resolve the ticket id
  through a `workDir` helper that refuses a `<TICKET-ID>` resolving outside the
  `.work/` root (e.g. `../../etc`), removing a path-traversal primitive.
- **Defensive `.gitignore`.** Added secret-file patterns (`.env*`, `*.pem`,
  `*.key`, …) and `.claude/settings.local.json`, so a fork or fresh clone cannot
  stage them without relying on a maintainer's machine-local global ignore.

## [0.11.1] - 2026-05-28

### Fixed

- **`agents/` now ships in the published package.** `package.json`'s `files`
  allowlist omitted the `agents/` directory added in 0.10.0, so the explorer
  sub-agent spec never made it into the tarball and
  `npx github:robbell5/quark install` failed with `ENOENT … agents/explorer.md`.
  Added `agents/` to the allowlist, plus a packaging guard in
  `test/e2e.test.mjs` that runs the installer against a tree containing only the
  `files`-allowlisted paths, so any future asset directory the installer reads
  but forgets to ship fails the suite.

## [0.11.0] - 2026-05-28

### Added

- **Acceptance-criterion quality bar in `frame`.** A five-criterion standard —
  Atomic, Observable, Outcome-shaped, Traceable, Bounded — taught in
  `playbook/frame.md`, anchored by a new `examples/context-vague-acs.md`
  anti-example and three new failure modes. The acceptance criteria are the
  spine the rest of the loop keys off, so this hardens the loop's load-bearing
  input.
- **Advisory AC-quality warnings in `quark check`.** `acQualityWarnings` in
  `src/check.mjs` nudges (never blocks) on two mechanical smells — a compound AC
  (joined by "and"/";") and a bare subjective term ("robust", "clean", …) —
  surfaced through the existing warnings channel, never the `--for` readiness
  gates. Outcome-shape is taught, not gated; the hard AC-linkage contract is
  unchanged.
- **AC-soundness critique in `review`.** `playbook/review.md` gains a bullet so a
  cold-start reviewer judges whether the acceptance criteria themselves are
  atomic, observable, and traceable, marking a vague load-bearing AC Blocking and
  routing it back to `frame`.

## [0.10.0] - 2026-05-28

### Added

- **Read-only `explorer` sub-agent.** A worker authored once as shared Markdown
  (`agents/explorer.md`) and composed per-engine by the installer into
  `~/.claude/agents/quark-explorer.md` and `~/.codex/agents/quark-explorer.toml`.
  The `frame`, `plan`, and `verify` steps can dispatch it to do context-isolated
  reading and return a fixed-shape digest (relevant files, patterns, risks,
  ruled-out, open-for-human), keeping the orchestrator's session clear of context
  rot. Read-only and leaf-only; it never elicits. The code-writing build-unit
  executor and parallel `build` dispatch remain deferred.

## [0.9.0] - 2026-05-28

### Added

- **Acceptance-criterion traceability spine.** Each criterion in `context.md`
  carries a stable id (`- AC1: …`); plan Definition-of-done items and UAT steps
  cite the criterion they satisfy as `(AC1)` / `(AC1, AC2)`. `quark check`
  enforces the linkage — every AC covered, every `(ACn)` resolves — at the
  `review`/`build` gates (plan) and the `ship` gate (UAT). It checks linkage,
  not prose; semantic judgment stays with the planner and the reviewer.
- **`accepted` review verdict.** Records consciously-accepted plan gaps (with a
  note) so the plan ⇄ review loop has an explicit exit. `runGate` validates the
  verdict against `REVIEW_VERDICTS` and rejects typos with exit 2.

### Changed

- **Review is native and single-engine.** The `review` step no longer shells out
  headlessly to the other engine (`codex exec` / `claude -p`). It runs a fresh,
  cold-start critique in whichever engine is driving and writes structured,
  actionable gaps to `review.md`. Quark is now fully usable with only one engine
  installed; a second engine is an optional second-model pass on the same
  artifacts. The post-build diff critique folds natively into `verify`.
- **Review verdict required for every build**, not just sensitive slices (review
  is cheap now, and the `accepted` verdict keeps it low-friction).

### Removed

- **`fallback-approved` verdict** and the cross-engine reviewer-fallback rule —
  obsolete once review is always native.

## [0.8.0] - 2026-05-28

### Added

- **Plan-approval gate.** `quark gate <TICKET> plan-approved` stamps a plan hash
  into `state.md`; `quark check --for build` blocks an unapproved or changed
  plan.
- **Sensitivity classification.** One `## Sensitivity` section in `context.md`
  (set at `frame`) drives review routing, the verify security pass, and the
  reviewer-fallback control.
- **Sensitive-slice review gate.** Sensitive slices require a recorded,
  hash-matching review before build; a same-engine fallback must be
  developer-approved (`--verdict fallback-approved`).
- **Build-drift routing.** Build drift now routes back through plan/review;
  verify reads the diff; ship cleans `.work/` scratch safely and computes its
  diff base robustly.
- **`quark gate` subcommand.** New CLI entry; backed by `planHash`,
  `setFrontmatterField`, and `runGate` in `src/check.mjs`. Zero new runtime
  dependencies.

## [0.7.0] - 2026-05-27

### Added

- **`docs/PHILOSOPHY.md`** — the durable "why": self-owned (born from the GSD
  rug-pull), ephemeral ticket-scoped artifacts (the tracker is the source of
  truth — the deliberate anti-`.planning/` stance), context rot as the enemy,
  one loop / two engines, and the prime directive to port GSD's principles, not
  its machinery. Linked from `CLAUDE.md` / `AGENTS.md` so both engines load it
  on cold start.
- **`docs/PROMPT-AUTHORING.md`** — the author-facing house style every step
  playbook follows (objective, stance, orient→reason→act, named failure modes,
  engineered elicitation, few-shot, voice).
- **Per-step Stance and `## Failure modes`.** Every loop step now states its
  disposition and the 1–3 ways it characteristically drifts (symptom →
  guardrail), generalizing the `plan-too-vague` anti-example to all six steps.
- **Engineered elicitation.** `_shared.md` gains an "Eliciting decisions" guide
  (ask only what needs judgment, batch, propose a default) and a "think before
  you write" principle; `frame` and `plan` route through it.
- **Few-shot anchors for the judgment moments** — `examples/open-questions.md`
  (elicitation, good vs. over-asking), `examples/review.md` (triage
  resolutions), `examples/uat.md` (acceptance-criteria-mapped walkthrough).

### Changed

- The six step playbooks reworked to the prompt-authoring standard; content
  tests extended to enforce its structural elements.

## [0.6.0] - 2026-05-27

### Added

- **Cold-start orientation.** `_shared.md` now opens every step with an
  orient-before-you-act routine: re-ground from `.work/<TICKET>/`, read
  `state.md` to confirm the step's position in the loop, and catch a re-run
  before it overwrites. Steps stay correct even outside a fresh session;
  context hygiene is what a fresh session buys.
- **Fresh-session handoffs.** Each step's handoff now tells the developer to
  start a new session and run the next step; a new "One step per session"
  principle states the convention.
- **`quark check <TICKET>` baton.** The no-`--for` form prints the `state.md`
  baton (current step, status, driver, updated, next action) before the
  artifact report — a deterministic answer to "where am I?" when resuming.
  Backed by `batonSummary` in `src/check.mjs`.

### Changed

- README "The loop" now documents running each step in a fresh session and the
  `quark check <TICKET>` resume surface.

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
[0.8.0]: https://github.com/robbell5/quark/releases/tag/v0.8.0
[0.7.0]: https://github.com/robbell5/quark/releases/tag/v0.7.0
[0.6.0]: https://github.com/robbell5/quark/releases/tag/v0.6.0
[0.5.0]: https://github.com/robbell5/quark/releases/tag/v0.5.0
[0.4.0]: https://github.com/robbell5/quark/releases/tag/v0.4.0
[0.3.0]: https://github.com/robbell5/quark/releases/tag/v0.3.0
[0.2.0]: https://github.com/robbell5/quark/releases/tag/v0.2.0
[0.1.0]: https://github.com/robbell5/quark/releases/tag/v0.1.0
