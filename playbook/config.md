# Command: config

Goal: verify — and, with the developer's consent, fix — that the current repo is
configured to run Quark well. This is a one-shot utility, not part of the
per-ticket loop.

Operating principle: **report first; mutate only with the developer's consent;
never clobber a divergent file; safe to re-run.** Inspect everything, propose
changes, and apply only what the developer approves.

1. **Gitignore ephemerals.** Quark's per-ticket artifacts live in an ephemeral
   working directory, `.work/` (Quark's canonical ephemeral working directory).
   Confirm `.work/` is gitignored in this repo. If it is not, propose adding
   `.work/` to `.gitignore` and apply on consent. This is the proactive
   counterpart to the defensive leak-check in `ship.md`.
2. **Steering-doc aliasing.** Both engines should read identical guidance —
   Claude Code reads `CLAUDE.md`, Codex reads `AGENTS.md`. Inspect both files
   and reason from the repo's context:
   - already the same file (one is a symlink to the other, or they are
     byte-identical) → report OK and change nothing;
   - exactly one exists → propose aliasing the other to it, choosing the method
     from context (a symlink by default; a small pointer file if the repo avoids
     symlinks), explain the reasoning, and apply on consent;
   - both exist and differ → do **not** clobber either; surface the divergence
     and ask the developer how to reconcile.
3. **Scaffold if missing.** If neither `CLAUDE.md` nor `AGENTS.md` exists, offer
   to create a minimal steering doc — a short description of the repo and how to
   work in it — so the `frame` step has a real file to read, then alias it per
   step 2.
4. **Pre-authorize the check command (optional, consented).** Quark's steps run
   `quark check` at each gate; pre-authorizing the one command removes a per-run
   approval prompt (otherwise developers tend to approve-all, a worse posture).
   Propose a narrow allow-rule for *this* engine, explain it, apply only on
   consent, never clobber an existing rule, and skip if it is already present:
   - **Claude Code:** add `Bash(quark check:*)` to the `permissions.allow` array
     in the repo's gitignored `.claude/settings.local.json` (create the file if
     absent; offer global `~/.claude/settings.json` as an alternative).
   - **Codex:** append an execpolicy rule to `~/.codex/rules/default.rules`:
     `prefix_rule(pattern = ["quark", "check"], decision = "allow", justification = "Quark read-only verification check")`. Note this runs the command outside
     the sandbox; it is read-only, so that is acceptable.
   Re-running this step is a no-op when the rule is already present.
5. **Report.** Summarize what was already correct, what changed (with consent),
   and anything still needing a developer decision.

Output: a short report covering gitignore, steering-doc aliasing, and any
scaffold — with no surprise mutations.
