# CLAUDE.md — Quark

This file orients a fresh Claude Code (or Codex) session working in this repo.

## What this repo is

Quark is a thin, self-owned development harness that runs the same issue-level
loop natively on both Claude Code and OpenAI Codex, treats planning docs as
ephemeral (stripped before the PR), and lets the developer switch primary
engines mid-ticket without losing context. Its core goal is to remove ambiguity
and produce a reliable, reviewed plan before any code is written.

## Status

Pre-implementation. The design is approved and complete; this repo is built by
executing the implementation plan. No harness code exists yet.

## Source of truth

- Design spec — what to build and why, including the framework-evaluation
  decision record:
  `docs/superpowers/specs/2026-05-24-quark-dual-engine-harness-design.md`
- Implementation plan — how, task-by-task:
  `docs/superpowers/plans/2026-05-24-quark-dual-engine-harness.md`

Read the spec first, then the plan. The spec is authoritative; if the plan and
spec disagree, reconcile before proceeding.

## How to build it

Work through the implementation plan task-by-task using the superpowers
`executing-plans` or `subagent-driven-development` skill. For each task: follow
test-driven development where the plan calls for it, keep commits small and
focused, and run the relevant gates before marking a task done. Do not skip the
plan's verification steps, and do not invent scope beyond the spec.

## Conventions

- Markdown must pass markdownlint. There is no config here, so the strict
  80-character default applies — keep prose lines wrapped and avoid wide tables
  in long-form docs.
- This is a Node/TypeScript CLI project intended for later npm distribution.
  The published package name is deferred: npm `quark` is taken, so scope it as
  `@<scope>/quark` or use an available name such as `quarkflow`. The CLI binary
  and slash-command prefix stay `quark` / `/quark-*` regardless.
- Commits: clear and professional; no AI-attribution footers.
