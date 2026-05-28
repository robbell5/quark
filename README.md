# Quark

A thin, self-owned development harness that runs the same issue-level loop
natively on both Claude Code and OpenAI Codex. Its primary job is to remove
ambiguity before any code is written — confirm scope, close open questions,
and produce a reliable, reviewed plan — then execute that plan faithfully,
confirm acceptance criteria, strip the ephemeral planning docs, and open a PR.

Status: active — v0.12.0. Installable and dogfooded.

## Why Quark

- **Context rot is the enemy.** Output quality decays as a context window fills.
  Each step runs in a *fresh session* and hands off through files, so every step
  wakes clean.
- **Planning docs are ephemeral.** Artifacts live in `.work/<TICKET>/`, are
  gitignored, and are stripped before the PR. Your tracker stays the source of
  truth — not in-repo spec files.
- **One loop, two engines.** The same steps run natively on Claude Code and
  Codex; switch engines mid-ticket without losing context. Either engine alone
  is enough.
- **Self-owned.** Zero runtime dependencies; each installed skill is
  self-contained. No external harness that can be abandoned or compromised.

See [`docs/PHILOSOPHY.md`](docs/PHILOSOPHY.md) for the full reasoning.

## Requirements

- Node.js ≥ 18.
- The `claude` (Claude Code) or `codex` (OpenAI Codex) CLI — **either one is
  enough**. Review runs natively in whichever engine you drive; a second engine
  is optional, for an independent model's review on the same artifacts.
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

Pin a version with a git ref. Only `v0.1.0` is tagged today, so pin to a commit
SHA, e.g. `npx github:robbell5/quark#<commit-sha> install`.
From a local clone the same commands are `node bin/quark install` /
`node bin/quark uninstall`.

## Configure a repo

Inside a repo you want to use Quark in, run `/quark-config` (Claude Code) or
`$quark-config` (Codex). It checks the repo's setup and, with your consent,
fixes it: ensures `.work/` is gitignored, aliases `CLAUDE.md` and `AGENTS.md`
so both engines read identical guidance, and scaffolds a steering doc if
neither exists. It can also (with consent) pre-authorize `quark check` in the
engine's permission config (Claude `permissions.allow`; Codex execpolicy rule).
Safe to re-run.

## The loop

Per ticket: `/quark-frame <ticket>` → `/quark-plan` → `/quark-review` →
`/quark-build` → `/quark-verify` → `/quark-ship` on Claude Code; the same steps
are `$quark-frame <ticket>` … `$quark-ship` on Codex.

**Run each step in a fresh session.** Every step is a cold start: it wakes with
no memory of the previous one and re-grounds from `.work/<TICKET>/`. A fresh
session per step is what keeps context clean — the whole point of the handoff
files. Running several steps in one session still works (each step re-reads the
files), it just spends context you did not need to. Switch engines any time —
`state.md` is the handoff.

Each step reads the previous step's artifact, does its job, and writes the next.
A `quark check <ticket> --for <step>` gate runs first (and `quark check` again as
a self-check at the end), so a step refuses to start from — or finish with — a
malformed artifact.

- **frame** — Turn a ticket into a scoped `context.md`: intent, acceptance
  criteria (each with a stable `ACn` id), the files in play, sensitivity, and
  open questions. Blocking questions are resolved here before any planning.
- **plan** — Turn `context.md` into a reviewable `plan.md`: a file-by-file list
  of changes, a test strategy, and a definition-of-done that covers every
  acceptance criterion. This is the human review gate.
- **review** — A fresh, skeptical reader critiques the plan, writing actionable
  gaps and a verdict to `review.md`. The loop runs `plan ⇄ review` until the plan
  is clean (or you consciously accept the remaining gaps).
- **build** — Implement `plan.md` faithfully in small commits, keeping
  `state.md` current so the other engine could resume cold from it.
- **verify** — Prove each acceptance criterion with real evidence: run the
  repo's gates, replay a UAT walkthrough (`uat.md`), and run a security pass when
  the slice is sensitive.
- **ship** — Strip the ephemeral `.work/` scratch and open a draft PR whose body
  summarizes the change and its verification evidence, pointing back to the
  tracker.

**Resume.** Forgotten where a ticket stands? Run `quark check <TICKET>`: it
prints the `state.md` baton (current step, status, driver, updated, next
action) and validates the artifacts. Then open a fresh session and run the
next step.

## Contributing

Hacking on Quark itself — repo layout, running the tests, publishing — lives in
[`CONTRIBUTING.md`](CONTRIBUTING.md).

License: MIT.
