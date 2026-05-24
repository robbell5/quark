---
status: approved-design
created: 2026-05-24
last-reviewed: 2026-05-24
aliases:
  - quark
  - quark-harness
  - dual-engine-harness
tags:
  - quark
  - workflow
  - development-process
  - agentic
  - tooling
  - claude-code
  - codex
---

# Quark — Dual-Engine Issue-Level Development Harness (Design)

## Purpose

Quark is a thin, self-owned development harness for **correctness-critical
brownfield work**. Its primary job is to **remove ambiguity before any code is
written** — confirm scope, close open questions and gaps, and produce a
reliable, reviewed plan — then execute that plan faithfully, confirm the
acceptance criteria are met, strip the ephemeral planning docs, and open a PR.
It runs the same loop on **both** Claude Code and OpenAI Codex, and lets the
developer switch primary engines mid-ticket without losing context.

It replaces the author's prior GSD workflow, which was abandoned after its
maintainer disappeared and the npm packages were left under an unreachable
account (a live supply-chain risk). Quark keeps the load-bearing parts of that
loop while removing the dependency on any third-party maintainer.

## Core Goal

The reason to run this loop instead of an agent's built-in plan mode is
**ambiguity elimination and plan reliability**. A refined ticket becomes a
de-risked plan *before* implementation, and the agent is held to that plan
through execution and verification. The steps are ordered so each one removes
uncertainty the next depends on:

1. **Confirm scope** — what this ticket does, and explicitly does not, include.
2. **Close gaps and open questions** — surface unknowns and resolve them with
   the developer before planning, not mid-implementation.
3. **Produce a reliable plan** — a concrete, reviewed, file-level plan with a
   test strategy and an explicit definition of done.
4. **Execute faithfully** — implement the plan in small steps without drifting
   into unplanned scope or architecture.
5. **Confirm acceptance criteria** — verify behavior against the criteria with
   real evidence, not assertion.
6. **Clean up and ship** — strip the ephemeral docs and open a reviewable PR.

This is not one-shotting and not vibe-coding. For brownfield work that must be
correct — auth, money, ownership math, data migration — the plan is the artifact
the developer reviews, and code begins only once the plan is solid and the open
questions are closed.

## Problem and Reframe

The triggering need looks like "switch spec-driven development (SDD)
frameworks," but the real requirement is the opposite of mainstream SDD. Spec
Kit, OpenSpec, and BMAD all treat the spec as **durable, committed
institutional memory** — that is their core value. The author wants a
**transient planning scaffold** that drives the agent and is then discarded.

That is *spec-driven execution*, not spec-driven documentation. Forcing a
persistent-spec framework into ephemeral mode pays full setup cost for a
fraction of the value (OpenSpec is the extreme case: its `archive` step exists
to merge specs into a committed living spec). Quark embraces ephemerality as a
first-class property instead of fighting a tool that resists it.

## Constraints

Hard constraints:

- **Ephemeral docs.** Planning artifacts are generated during the work and
  removed before the PR. Reviewers see code, not scaffolding.
- **Dual primary driver.** Claude Code is the main driver, but Codex must work
  as a *full* primary driver for hours or days (e.g. when the Claude Code
  5-hour limit is hit, or during Anthropic outages) — not merely as a reviewer.
- **Brownfield.** Work happens in existing codebases (e.g. the Zeus TypeScript
  monorepo), not greenfield scaffolding.
- **Anti-instability.** No reliance on an external maintainer who can vanish or
  ship a breaking change. The harness is owned and version-controlled by the
  author.

Soft constraints / context:

- **Solo workflow.** Built for one developer; no team-onboarding tax.
- **Ticket-sized scope.** Typical work is 0.5–3 day vertical slices and infra
  tasks (e.g. "Admins edit an existing Owner," "AngelList Portfolio vintage
  drilldown," "Add admin-mediated password reset flow," "Resolve Dependabot
  alerts"). Several slices touch auth, money, and ownership math, where
  correctness matters.
- **Token usage is not a constraint.** Paid Claude and Codex plans.

## Why a Self-Built Harness (Decision Record)

Off-the-shelf options were evaluated against the constraints:

- **OpenSpec** — best brownfield fit, but its entire model is persistent,
  cumulative living specs; ephemeral use throws away its reason to exist.
  Rejected.
- **BMAD** — heavyweight, whole-project orientation, persistent PRD/architecture
  docs. Overkill for ticket-sized work. Rejected.
- **GitHub Spec Kit** — most stable governance (GitHub-backed), dual-tool, but
  greenfield-biased, persistent-spec by design, and its Codex integration has
  documented syntax churn that hurts frequent engine switching. Not selected.
- **cc-sdd** — closest off-the-shelf fit (lightweight, brownfield-first,
  natively dual-tool, feature-scoped specs), but a young, small-maintainer
  project — the same governance-risk profile that just failed. Viable only if
  vendored, at which point building a purpose-fit harness is comparable effort
  with a better fit.
- **Superpowers** — excellent ephemeral, Claude-native loop, but Claude-only.
  It cannot be the cross-engine execution loop without porting and maintaining
  a Codex copy. Retained for Claude-only work (it produced this design), not as
  the dual-engine loop.

The dual-*primary*-driver requirement plus ephemerality plus the
anti-instability lesson points to a small, owned, plain-Markdown harness
authored for both engines. The durable fix for the supply-chain failure that
sank GSD is **vendoring**: own the prompt files, pin them, and upgrade
deliberately. A self-built harness is vendored by definition.

## Core Principles

- **Ambiguity is closed before code.** The loop exists to produce a de-risked,
  reviewed plan: scope is confirmed and open questions resolved before
  implementation, and execution is held to the plan. This is the reason to use
  Quark over an agent's built-in plan mode.
- **Ephemeral by default.** All per-ticket docs live in a gitignored working
  directory and never reach the PR. `ship` leak-checks the diff.
- **The disk is the handoff.** Artifacts are engine-neutral Markdown on disk.
  Either engine can resume from them, so switching CC ↔ Codex mid-ticket is a
  non-event.
- **One source of truth, two thin shims.** The substance of each step lives in a
  single shared playbook file. Per-engine command files are tiny shims that
  delegate to it, so the two engines never drift.
- **Owned and pinned.** Lives in its own repository; no runtime dependency on a
  third-party maintainer.
- **Thin by default, rigor when warranted.** A trivial ticket runs five steps;
  sensitive slices add cross-engine review and a security pass.

## Architecture

### Where it lives

Quark is its **own git repository**, structured to be publishable to npm later.
Version 1 installs by symlinking command files into both engines' command
directories. A later `npx` installer runs the same logic.

### Shim + shared playbook (the drift-killer)

Each step's real instructions live once in `playbook/<step>.md`. The Claude
command file and the Codex prompt file are short shims that say, in effect:
"read this playbook file plus `_shared.md` and execute it for the current
ticket." Editing a playbook file updates both engines at once.

Engine identity is **baked into the shim**, not detected at runtime. The Claude
shim declares "you are Claude; the reviewer is Codex via `codex`." The Codex
shim declares "you are Codex; the reviewer is Claude via `claude -p`." The
shared playbook stays engine-neutral.

### Ephemeral artifacts

All per-ticket documents live in a gitignored working directory; both engines
read and write the same files:

```text
<repo>/.work/<TICKET-ID>/
  context.md   # intent, acceptance criteria, real files/modules in play, risks
  plan.md      # file-by-file approach, test strategy, definition-of-done checklist
  review.md    # the other engine's plan and diff critique, plus resolutions
  state.md     # running progress log — the resume point ("the baton")
  uat.md       # manual acceptance steps
```

`.work/` is added to the target repo's `.gitignore` at install time, and `ship`
re-checks that nothing leaked into the diff.

### The one persistent document

A per-repo steering document is the only non-ephemeral piece. `CLAUDE.md` is
canonical; `AGENTS.md` is symlinked to it so Codex reads identical guidance. It
holds the run/test/lint/build commands, the definition of done, architecture
gotchas, and a short "Quark conventions" block. Durable context lives here,
which is what keeps each ticket's `.work/` documents thin.

## The Loop — Six Commands

### `/quark-frame <ticket>`

- **Reads:** the ticket, the steering doc, and the code the ticket touches.
- **Produces:** `context.md`.
- **Notes:** scaffolds `.work/<TICKET-ID>/`. The ticket comes from the Linear
  MCP or `gh` CLI when available, else pasted text (the Codex path). Captures
  intent, acceptance criteria, the files in play, risks, and what is out of
  scope. Critically, it **confirms scope and surfaces open questions and
  gaps**, and resolves them with the developer before planning begins.

### `/quark-plan`

- **Reads:** `context.md` and the code.
- **Produces:** `plan.md`.
- **Notes:** a file-by-file approach, the test strategy, and an explicit
  definition-of-done checklist from the acceptance criteria. The plan must be
  concrete enough to remove ambiguity about *what* changes and *how* it is
  verified. This is the human review **gate**: code begins only once the plan
  is solid and `context.md`'s open questions are closed.

### `/quark-review` (conditional)

- **Reads:** `context.md` + `plan.md` (pre-build), and the diff (post-build).
- **Produces:** `review.md`.
- **Notes:** the other engine critiques the plan and, after build, the diff.
  Run it on auth, money, ownership, and data-integrity slices; skip it for
  trivial ones.

### `/quark-build`

- **Reads:** `plan.md`, `review.md`, and `state.md`.
- **Produces:** code and tests; updates `state.md`.
- **Notes:** implements in small steps, TDD where the plan calls for it, with
  a focused diff and no unrelated cleanup. Updates `state.md` after each step.

### `/quark-verify`

- **Reads:** the `plan.md` checklist and the steering doc's gate commands.
- **Produces:** `uat.md` and recorded results.
- **Notes:** runs the repo's lint, typecheck, test, and build; replays a short
  manual UAT; and runs a security pass on sensitive slices. Records the real
  command output.

### `/quark-ship`

- **Reads:** the diff and `context.md`.
- **Produces:** a draft PR (and an optional `pr.md`).
- **Notes:** leak-checks that `.work/` stayed out of the diff, self-reviews
  the full diff, drafts a reviewer-friendly PR body (what, why, evidence), and
  opens a draft PR. You publish after your own review.

### Two paths, same six commands

- **Thin ticket** (most work): `frame → plan → build → verify → ship`.
- **Sensitive slice** (auth, password reset, role assignment, ownership math,
  data import): add `review` after `plan`, the security pass inside `verify`,
  and a second `review` on the diff before `ship`.

### Resumability is a property of every command

Every command reads `context.md` + `state.md` first, so it re-grounds itself
whether starting fresh, resuming on the other engine, or returning days later.
There is no separate "resume" step. An optional `/quark-status` helper prints
the resume summary without doing work; it is a convenience, not a seventh loop
step.

### Mapping from the prior GSD loop

`context.md` ← CONTEXT, `plan.md` ← PLAN, `review.md` ← the `--codex` pass (now
symmetric), `verify` ← verify-work + secure-phase, `ship` ← PR hygiene +
strip-planning. GSD artifacts that did not earn their keep at ticket scale
(PROJECT, ROADMAP, separate VALIDATION/VERIFICATION, UI-SPEC) are dropped.

## Mechanisms

### Cross-engine review

The reviewing engine reads the relevant `.work/` files **by path** (no content
pasting) and returns concerns by severity, captured to `review.md`. The driving
engine then triages; the developer decides what to fold in.

- **Plan review (pre-build):** the other engine critiques `plan.md` against
  `context.md`.
- **Diff review (post-build):** the other engine critiques the working diff
  against `plan.md`. The Codex side can use its non-interactive `codex review`
  subcommand; the Claude side uses `claude -p` with read access to the diff.
- **Read-only reviewer.** The reviewer cannot modify the tree: Claude side via
  restricted `--allowedTools` (read + `git diff` only); Codex side via a
  read-only sandbox with approvals disabled.
- **Graceful fallback.** If the other CLI is not installed or authenticated,
  the playbook reports this and offers a same-engine self-review (a weaker
  substitute) rather than failing.

Confirmed CLI support: Claude Code exposes `-p/--print` non-interactive output
with `--allowedTools`, `--permission-mode`, `--output-format`, and
`--max-budget-usd`; Codex exposes `codex exec` (non-interactive) and a dedicated
`codex review` subcommand, with sandbox and approval-policy flags.

### Resume / handoff (`state.md` is the baton)

`state.md` records: the current step and status, completed steps, key decisions
and deviations, the next action, gotchas for whoever picks it up, and recent
commit hashes. `build` updates it after each meaningful step and favors frequent
small commits so the other engine inherits a clean tree. Together, the git
working tree plus `state.md` are a complete handoff: hit the Claude Code wall
mid-`build`, open Codex, run `/quark-build`, and it continues from disk.

## Repository Layout and Install

```text
quark/                         # its own git repo, npm-ready
  playbook/   frame.md plan.md review.md build.md verify.md ship.md  _shared.md
  shims/
    claude/   quark-*.md        # symlinked into ~/.claude/commands/
    codex/    quark-*.md        # symlinked into ~/.codex/prompts/
  templates/  context.md plan.md state.md uat.md
  bin/quark-install   # symlinks both engines; offers .gitignore + AGENTS.md
  package.json   README.md   LICENSE
```

- **Shims** carry frontmatter (description, argument hint) plus one delegating
  line referencing the playbook by absolute path; install resolves that path.
- **`_shared.md`** holds the artifact schema, the `state.md` format, and the
  cross-cutting principles (ephemeral docs, focused diffs, behavior-level tests,
  stop-on-scope-drift), referenced by all six steps so they never drift.
- **Install v1** (`bin/quark-install`) is idempotent: it symlinks shims into
  both engines, offers to add `.work/` to the target repo's `.gitignore`, and
  offers to create the `AGENTS.md` → `CLAUDE.md` symlink.
- **npm later:** the same installer runs behind `npx`. Because `quark` is taken
  on npm (v1.0.1), the package publishes as a scoped name (`@<scope>/quark`,
  recommended) or an unscoped fallback (`quarkflow` is available). The CLI
  binary and slash-command prefix remain `quark` / `/quark-*` regardless of the
  published package name.

## Quality and Verification

- Gate commands (lint, typecheck, test, build) are read from the steering
  document, not hard-coded, so Quark adapts per repo.
- TDD is used in `build` for logic-heavy or financial slices (ownership math,
  derivation rules); lighter for pure UI.
- The security pass in `verify` triggers on sensitive slices: authentication,
  authorization/access control, money, PII, and database migrations.
- Tests assert behavior tied to acceptance criteria, not implementation details.
- `verify` records actual command output; it never reports success without
  running the gates.

## Open Items to Confirm at Build Time

These are implementation details, not unresolved design questions:

1. The exact read-only reviewer flags for each CLI (`claude -p` allowed-tools
   set; `codex` sandbox/approval flags for `exec` and `review`).
2. Whether to symlink `AGENTS.md` → `CLAUDE.md` (preferred default) or generate
   `AGENTS.md`, accounting for how each engine resolves the file.
3. How shims embed or resolve the absolute playbook path at install time.
4. Final npm package name, deferred to publish time.

## Out of Scope

- A persistent or cumulative spec store (the opposite of this design's intent).
- Multi-repository orchestration.
- Team onboarding, shared conventions, or role/persona agents (solo workflow).
- Greenfield project scaffolding.
- Replacing or wrapping the underlying CLIs beyond thin command files.

## Approval

The purpose, constraints, framework evaluation, six-command loop, cross-engine
review and handoff mechanisms, naming (`quark`), and publishable repository
layout were approved during brainstorming on 2026-05-24.
