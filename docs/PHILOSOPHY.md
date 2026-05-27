# Why Quark

Quark is shaped by a few hard commitments. This doc records *why*, so future
iterations inherit the reasoning rather than re-deriving (or eroding) it. It
documents the **tool**; it is not a per-ticket artifact. (Generated ticket
artifacts live in `.work/<TICKET>/`, are gitignored, and are stripped before the
PR — see "Ephemeral, ticket-scoped artifacts" below.)

## Self-owned

Quark is modeled on GSD ("Get Shit Done"), a spec-driven harness whose
principles it admires. But GSD's original maintainer vanished in April 2026,
deleted their accounts, and the project's `$GSD` token was tied to a rug-pull;
`get-shit-done-redux` is a community continuity fork. Depending on an external
harness that can be abandoned or compromised is a risk Quark refuses.

Consequences:

- Zero runtime dependencies (Node built-ins only) — the deliberate
  anti-supply-chain stance.
- Self-contained skills — each installed `SKILL.md` inlines everything it needs
  and does not point back at this repo.
- The product is the Markdown in `playbook/`; the installer is plumbing.

## Ephemeral, ticket-scoped artifacts

Quark's generated docs are scratch for the *current pass on one ticket*, not
long-living documentation. `.work/<TICKET>/` is gitignored and stripped before
the PR. **The tracker (Linear) is the source of truth — never in-repo spec
files.**

This is a deliberate divergence from GSD, which committed long-living planning
docs (`PROJECT.md`, `ROADMAP.md`, `STATE.md`, …) to the repo. In a multi-team,
multi-branch codebase those files collide across branches, go stale, and blur
the line between "the plan for this change" and "permanent project docs."

Consequence: continuity across people and machines flows through the tracker,
not through committed artifacts. `.work/` is local and disposable by design — if
it is gone, you re-derive it from the ticket. (Quark's *own* repo docs — this
file, `PROMPT-AUTHORING.md`, the README — live long, because they document the
tool, not a ticket.)

## Context rot is the enemy

The reason for the whole loop: output quality degrades as a context window
fills. Quark fights it with a fresh session per step and a file-based handoff
(`.work/<TICKET>/`). Each step wakes cold, reads only what it needs, and writes
the baton the next step reads. The session boundary *is* the context-isolation
mechanism.

## One loop, two engines

The same loop runs natively on Claude Code and Codex. The developer can switch
the primary engine mid-ticket without losing context (the handoff is on disk),
and the *other* engine performs the read-only review. Anything that ties the
loop to one engine's dispatch primitive is rejected for breaking this.

## Prime directive: port principles, not machinery

GSD's principles — context engineering, spec-first, mandatory verification,
fresh curated contexts — are worth borrowing. Its *machinery* is not: model
profiles, debug agents, structural-analysis passes, an SDK, fifteen runtime
adapters. That heft is what "self-owned" and "thin" exist to avoid. When a
GSD-inspired improvement is on the table, ask: *is this a principle or a
mechanism?* Prefer Markdown and Node built-ins; keep it cross-engine by
construction (the filesystem plus the `quark` CLI).
