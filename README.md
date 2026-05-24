# Quark

A thin, self-owned development harness that runs the same issue-level loop
natively on both Claude Code and OpenAI Codex. Its primary job is to remove
ambiguity before any code is written — confirm scope, close open questions,
and produce a reliable, reviewed plan — then execute that plan faithfully,
confirm acceptance criteria, strip the ephemeral planning docs, and open a PR.

Status: pre-implementation. The design is approved; the build is driven by the
implementation plan.

## Where things are

- Design spec —
  `docs/superpowers/specs/2026-05-24-quark-dual-engine-harness-design.md`
- Implementation plan —
  `docs/superpowers/plans/2026-05-24-quark-dual-engine-harness.md`

## Building it

This repo is built by executing the implementation plan task-by-task. Start a
Claude Code session in this directory and use the superpowers executing-plans
or subagent-driven-development skill to work through the plan. See `CLAUDE.md`
for orientation.
