# Quark Dual-Engine Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Quark — a zero-dependency, self-owned harness that installs an
identical six-step issue loop (frame → plan → review → build → verify → ship)
into both Claude Code and OpenAI Codex, using ephemeral on-disk
`.work/<TICKET>/` artifacts as the cross-engine handoff.

**Architecture:** A small Node (ESM) installer generates per-engine command
files from two shim templates, substituting an absolute path to a shared
`playbook/` of Markdown step instructions. The playbooks are the product; the
installer is plumbing. Zero runtime dependencies (supply-chain safety); tests
use Node's built-in `node:test`. Per-ticket planning artifacts live in a
gitignored `.work/` and are stripped before every PR.

**Tech Stack:** Node.js ≥ 18 (ESM, `node:test`, `node:fs`, `node:path`,
`node:os`), Markdown prompt files, Claude Code (`claude -p`) and OpenAI Codex
(`codex exec` / `codex review`) CLIs.

---

## Design Decisions Locked In

These resolve the "open items" from the spec. Honor them while executing.

- **Generated resolved shims, not raw symlinks.** The installer renders command
  files into each engine's command dir with the absolute playbook path baked in.
  This makes path resolution bulletproof (no `~` expansion, no second symlink)
  and is npm-ready. Playbook edits stay live because the generated shim points
  at the playbook files by absolute path; only adding/renaming commands needs a
  reinstall. (This is a deliberate refinement of the original "symlinks for now"
  idea — same local-wiring intent, correct path handling.)
- **One shim template per engine, six commands generated.** `shims/claude.md`
  and `shims/codex.md` are templates with `{{QUARK_ROOT}}` and `{{STEP}}`
  placeholders. The installer loops the six step names. DRY.
- **Zero runtime dependencies.** The installer uses only Node built-ins. Tests
  use `node:test`. This is the concrete form of the anti-supply-chain lesson.
- **Engine identity is baked into each shim template,** so no runtime engine
  detection: the Claude template names Codex as reviewer; the Codex template
  names Claude as reviewer.
- **`package.json` is `private: true` for v1** so the local-only package can be
  named `quark` without colliding with the taken npm name. Flip `private` and
  scope the name (`@<scope>/quark`) or rename (`quarkflow`) before publishing.

## File Structure

Files created by this plan:

- `package.json` — package metadata, `bin`, `scripts.test`, ESM, `private`.
- `LICENSE` — MIT.
- `src/lib.mjs` — pure, testable installer functions (the logic).
- `bin/quark-install` — Node CLI entry that parses args and calls `src/lib.mjs`.
- `shims/claude.md` — Claude command template.
- `shims/codex.md` — Codex prompt template.
- `playbook/_shared.md` — artifact schema, `state.md` format, principles,
  reviewer invocations.
- `playbook/frame.md` `plan.md` `review.md` `build.md` `verify.md` `ship.md` —
  the six step playbooks.
- `templates/context.md` `plan.md` `state.md` `uat.md` — `.work/` skeletons.
- `test/lib.test.mjs` — unit tests for the installer logic.
- `test/content.test.mjs` — structural tests for shims/playbooks.

Already present (created during repo scaffolding — do not recreate):
`README.md`, `CLAUDE.md`, `.gitignore`, `.markdownlint.json`, and the design
spec under `docs/superpowers/specs/`.

The six step names are the single source of truth for the loop. Define them
once in `src/lib.mjs` as `STEPS` and reuse everywhere.

---

## Task 1: Project scaffolding and test harness

**Files:**

- Create: `package.json`
- Create: `LICENSE`
- Create: `test/smoke.test.mjs`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "quark",
  "version": "0.1.0",
  "private": true,
  "description": "A dual-engine (Claude Code + Codex) issue-level dev harness.",
  "type": "module",
  "bin": {
    "quark-install": "bin/quark-install"
  },
  "scripts": {
    "test": "node --test",
    "install:local": "node bin/quark-install"
  },
  "engines": {
    "node": ">=18"
  },
  "license": "MIT"
}
```

- [ ] **Step 2: Write `LICENSE` (MIT)**

```text
MIT License

Copyright (c) 2026 Rob Bell

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 3: Write a smoke test to confirm the runner works**

Create `test/smoke.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";

test("test runner is wired up", () => {
  assert.equal(1 + 1, 2);
});
```

- [ ] **Step 4: Run the test suite**

Run: `node --test`
Expected: 1 test passes, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add package.json LICENSE test/smoke.test.mjs
git commit -m "chore: scaffold package, license, and test harness"
```

---

## Task 2: Confirm engine invocations and write `playbook/_shared.md`

`_shared.md` is referenced by every playbook and shim. It must record the
exact, verified read-only review invocations for each engine. Confirm the flags
on this machine first, then write the file with the confirmed commands.

**Files:**

- Create: `playbook/_shared.md`

- [ ] **Step 1: Confirm the Claude headless review invocation**

Run: `claude --help`
Confirm these flags exist: `-p`/`--print`, `--output-format`, `--allowedTools`,
`--permission-mode`. The intended read-only reviewer call is:

```bash
claude -p "<review prompt>" --output-format text \
  --allowedTools "Read Grep Glob Bash(git diff:*) Bash(git log:*)"
```

If a flag name differs in the installed version, use the installed equivalent
and note it in `_shared.md`.

- [ ] **Step 2: Confirm the Codex review invocations**

Run: `codex exec --help` and `codex review --help`
Confirm `codex exec` supports a read-only sandbox and a no-approval mode, and
that `codex review` runs non-interactively. The intended calls are:

```bash
codex exec --sandbox read-only --ask-for-approval never "<review prompt>"
codex review "<diff review prompt>"
```

Also confirm how Codex custom prompts (`~/.codex/prompts/*.md`) receive
arguments (e.g. `$ARGUMENTS`) and whether YAML frontmatter is ignored. Record
the confirmed argument token; use it in the Codex shim template (Task 4).

- [ ] **Step 3: Write `playbook/_shared.md`**

Use the commands confirmed above in the "Reviewer invocations" section.

````markdown
# Quark — Shared Conventions

Every Quark step reads this file first. It defines where artifacts live, the
`state.md` format, the cross-cutting principles, and how to invoke the other
engine for review.

## Working directory

All per-ticket artifacts live in a **gitignored** directory and never reach the
PR:

```text
<repo>/.work/<TICKET-ID>/
  context.md   # intent, acceptance criteria, files in play, risks, out-of-scope
  plan.md      # file-by-file approach, test strategy, definition-of-done
  review.md    # the other engine's plan and diff critique, plus resolutions
  state.md     # running progress log — the resume point ("the baton")
  uat.md       # manual acceptance steps
  pr.md        # draft PR body (written by ship)
```

`<TICKET-ID>` is the tracker id (e.g. `RAY-123`) or a short kebab slug if there
is no ticket.

## `state.md` format (the baton)

`state.md` is what lets either engine resume mid-ticket. Keep it current.

```markdown
# State: <TICKET-ID>

- **Current step:** <frame|plan|review|build|verify|ship>
- **Status:** <in-progress|blocked|done>
- **Driving engine:** <Claude Code | Codex>

## Completed
- <step> — <one-line outcome> (<commit hash if any>)

## Decisions & deviations
- <decision or deviation from plan, with reason>

## Next action
- <the single next concrete action>

## Gotchas for the next runner
- <anything non-obvious needed to continue on the other engine>
```

## Principles (apply in every step)

- **Ambiguity is closed before code.** Confirm scope and resolve open questions
  before planning; do not start `build` until the plan is solid.
- **Ephemeral docs.** `.work/` is scratch; it is gitignored and stripped/
  leak-checked before the PR.
- **Focused diffs.** No unrelated cleanup or refactoring; stay inside the slice.
- **Behavior over implementation.** Tests assert behavior tied to acceptance
  criteria, not internal details.
- **Stop on drift.** If scope, architecture, or acceptance criteria change,
  pause and reconcile with the developer before continuing.
- **Real evidence.** Never claim a gate passed without running it and seeing the
  output.

## Reviewer invocations (cross-engine, read-only)

The reviewing engine reads the relevant `.work/` files **by path** and returns
concerns by severity (blocking / important / minor). It must not modify the
tree. Capture its output into `review.md`.

When **Claude Code** is driving, the reviewer is **Codex**:

```bash
codex exec --sandbox read-only --ask-for-approval never \
  "Review the Quark plan for <TICKET-ID>. Read .work/<TICKET-ID>/context.md and
   .work/<TICKET-ID>/plan.md. List concerns by severity
   (blocking/important/minor) with concrete reasoning. Do not modify files."
# Diff review (post-build):
codex review \
  "Review the working git diff against .work/<TICKET-ID>/plan.md and
   .work/<TICKET-ID>/context.md. List concerns by severity."
```

When **Codex** is driving, the reviewer is **Claude Code**:

```bash
claude -p "Review the Quark plan for <TICKET-ID>. Read
  .work/<TICKET-ID>/context.md and .work/<TICKET-ID>/plan.md. List concerns by
  severity (blocking/important/minor) with concrete reasoning." \
  --output-format text \
  --allowedTools "Read Grep Glob Bash(git diff:*) Bash(git log:*)"
```

**Fallback:** if the other engine's CLI is not installed or not authenticated
(the command errors), record that in `review.md` and perform a same-engine
self-review instead, clearly labeled as a weaker substitute.
````

- [ ] **Step 4: Commit**

```bash
git add playbook/_shared.md
git commit -m "docs(playbook): add shared conventions and reviewer invocations"
```

---

## Task 3: Write the six step playbooks

Each playbook is a self-contained instruction file the driving engine follows.
All assume `_shared.md` has already been read.

**Files:**

- Create: `playbook/frame.md`
- Create: `playbook/plan.md`
- Create: `playbook/review.md`
- Create: `playbook/build.md`
- Create: `playbook/verify.md`
- Create: `playbook/ship.md`

- [ ] **Step 1: Write `playbook/frame.md`**

````markdown
# Step: frame

Goal: turn a ticket into a clear, scoped `context.md` and **close ambiguity
before planning**.

1. Determine `<TICKET-ID>`. If a tracker id was given, fetch the ticket:
   prefer the Linear MCP if available, else `gh issue view <id>`; if neither is
   available, ask the developer to paste the ticket text. If there is no
   ticket, derive a short kebab `<TICKET-ID>` from the description.
2. Create `.work/<TICKET-ID>/` if it does not exist.
3. Read the steering doc (`CLAUDE.md` / `AGENTS.md`) and the actual code the
   ticket touches — find the real files, modules, and patterns involved. Do not
   guess; open the files.
4. Write `.work/<TICKET-ID>/context.md` from `templates/context.md`, filling:
   intent, acceptance criteria, the specific files/modules in play, known
   constraints, risks, and explicit out-of-scope items.
5. **Confirm scope** with the developer in one or two sentences: what this
   ticket does and does not include.
6. **Surface open questions and gaps** as a list in `context.md`, and resolve
   them with the developer now. Unresolved blocking questions stop progress —
   do not move on to `plan` until they are answered.
7. Initialize `.work/<TICKET-ID>/state.md` from `templates/state.md` with
   current step `frame`, status `done` (or `blocked` if questions remain).

Output: `context.md` with no unresolved blocking questions; `state.md` started.
````

- [ ] **Step 2: Write `playbook/plan.md`**

````markdown
# Step: plan

Goal: produce a reliable, reviewable `plan.md` that removes ambiguity about
*what* changes and *how* it is verified. This is the human review **gate**.

1. Read `context.md` and the code paths it names.
2. Write `.work/<TICKET-ID>/plan.md` from `templates/plan.md`, including:
   - A file-by-file list of changes (exact paths, what changes in each).
   - The test strategy: which behaviors get tests, and whether to use TDD
     (required for logic-heavy or financial slices — ownership math, money,
     derivations, auth).
   - A definition-of-done checklist derived directly from the acceptance
     criteria in `context.md`.
   - Risks and how the plan mitigates them.
3. Keep the plan concrete: an engineer should be able to execute it without
   re-deriving decisions. No "handle edge cases" hand-waving — name them.
4. **Gate:** present the plan for developer review. Implementation does not
   begin until the plan is solid and `context.md`'s open questions are closed.
5. Update `state.md`: current step `plan`, next action = review or build.

Output: a concrete `plan.md`; developer has the chance to review before code.
````

- [ ] **Step 3: Write `playbook/review.md`**

````markdown
# Step: review (conditional)

Goal: have the **other engine** critique the work. Run on sensitive slices
(auth, money, ownership, data integrity); optional for trivial ones. Runs in
two modes.

1. Determine mode:
   - **Plan review** (pre-build): if no implementation diff exists yet.
   - **Diff review** (post-build): if there is a working diff to assess.
2. Identify the reviewing engine from this shim's declared identity (Claude
   drives → Codex reviews; Codex drives → Claude reviews). Use the exact
   read-only invocation from `_shared.md`.
3. Run the reviewer against the relevant files by path:
   - Plan review: `context.md` + `plan.md`.
   - Diff review: the working git diff + `plan.md` + `context.md`.
4. Capture the reviewer's output into `.work/<TICKET-ID>/review.md`, grouped by
   severity (blocking / important / minor), with the mode and a timestamp.
5. Triage: for each blocking/important item, decide and record a resolution
   (fold into the plan, fix in build, or consciously reject with a reason).
   Surface blocking items to the developer.
6. If the other engine's CLI is unavailable, follow the `_shared.md` fallback
   (labeled self-review).
7. Update `state.md` with the review outcome.

Output: `review.md` with triaged concerns; plan or diff adjusted as needed.
````

- [ ] **Step 4: Write `playbook/build.md`**

````markdown
# Step: build

Goal: implement `plan.md` faithfully in small steps, keeping `state.md` current
so the other engine can resume.

1. Read `plan.md`, `review.md` (if present), and `state.md`.
2. Work the plan one unit at a time. Where the plan calls for TDD: write the
   failing test, run it to confirm it fails, implement the minimum to pass, run
   it to confirm it passes.
3. Keep the diff focused — only what the plan calls for. No unrelated cleanup.
4. Make frequent small commits. After each meaningful unit, update `state.md`:
   completed item (+ commit hash), any decision/deviation, the next action.
5. **Stop on drift:** if you discover the plan is wrong or scope must change,
   pause, update `context.md`/`plan.md`, and reconcile with the developer
   before continuing. Do not silently expand scope.
6. When the plan's units are complete, set `state.md` step to `build`, status
   `done`, next action `verify`.

Output: focused implementation with passing tests; `state.md` resumable.
````

- [ ] **Step 5: Write `playbook/verify.md`**

````markdown
# Step: verify

Goal: prove the slice meets its acceptance criteria with real evidence.

1. Read the definition-of-done checklist in `plan.md` and the acceptance
   criteria in `context.md`.
2. Run the repo's gates, reading the exact commands from the steering doc
   (lint, typecheck, test, build). Record the actual output. If a gate fails,
   return to `build`; do not proceed.
3. Write/refresh `.work/<TICKET-ID>/uat.md` from `templates/uat.md`: a short
   manual walkthrough mapped to the acceptance criteria. Replay it (or have the
   developer replay it) and record the result.
4. **Security pass (conditional):** if the slice touches authentication,
   authorization/access control, money, PII, or database migrations, review
   for the obvious failure modes (authz gaps, injection, secret exposure,
   migration safety) and record findings.
5. Confirm every definition-of-done item is checked with evidence. Never mark
   verify done on assertion alone.
6. Update `state.md`: step `verify`, status `done`, next action `ship`.

Output: recorded gate output, a replayed `uat.md`, and (if relevant) a security
note — all tied to the acceptance criteria.
````

- [ ] **Step 6: Write `playbook/ship.md`**

````markdown
# Step: ship

Goal: hand off a clean, reviewable PR with no ephemeral scaffolding in it.

1. **Leak check:** confirm `.work/` is gitignored and that no `.work/` files
   (or other scratch) appear in the diff: `git status` and
   `git diff --name-only origin/HEAD...HEAD`. If anything leaked, remove it.
2. Self-review the full diff for focus and quality. Trim stray changes.
3. Write `.work/<TICKET-ID>/pr.md`: a reviewer-friendly body — what changed,
   why, and the verification evidence (gate results, UAT outcome).
4. Open a **draft** PR (`gh pr create --draft`) using `pr.md` as the body.
5. Tell the developer it is a draft; they publish after their own review.
6. Update `state.md`: step `ship`, status `done`.

Output: a draft PR with a clear body and a diff free of ephemeral docs.
````

- [ ] **Step 7: Commit**

```bash
git add playbook/frame.md playbook/plan.md playbook/review.md \
  playbook/build.md playbook/verify.md playbook/ship.md
git commit -m "docs(playbook): add the six step playbooks"
```

---

## Task 4: Write the shim templates

Two templates, one per engine. The installer substitutes `{{QUARK_ROOT}}` and
`{{STEP}}`. The Claude template carries frontmatter; the Codex template is plain
(per the confirmation in Task 2 — adjust the argument token if Task 2 found a
different one than `$ARGUMENTS`).

**Files:**

- Create: `shims/claude.md`
- Create: `shims/codex.md`

- [ ] **Step 1: Write `shims/claude.md`**

````markdown
---
description: "Quark {{STEP}} step (Claude Code driver; Codex reviews)"
argument-hint: "<ticket-id-or-description>"
---

You are running the Quark `{{STEP}}` step in **Claude Code**.

- Your engine: Claude Code. The review engine is **Codex**, invoked via the
  `codex` CLI as described in `_shared.md`.
- Read and follow these files, in order:
  1. `{{QUARK_ROOT}}/playbook/_shared.md`
  2. `{{QUARK_ROOT}}/playbook/{{STEP}}.md`
- Ticket / input: $ARGUMENTS
````

- [ ] **Step 2: Write `shims/codex.md`**

````markdown
You are running the Quark `{{STEP}}` step in **OpenAI Codex**.

- Your engine: Codex. The review engine is **Claude Code**, invoked via the
  `claude -p` CLI as described in `_shared.md`.
- Read and follow these files, in order:
  1. `{{QUARK_ROOT}}/playbook/_shared.md`
  2. `{{QUARK_ROOT}}/playbook/{{STEP}}.md`
- Ticket / input: $ARGUMENTS
````

- [ ] **Step 3: Commit**

```bash
git add shims/claude.md shims/codex.md
git commit -m "feat(shims): add Claude and Codex command templates"
```

---

## Task 5: Installer core — `STEPS`, `resolveQuarkRoot`, `renderShim`

Build the pure logic first, test-driven.

**Files:**

- Create: `src/lib.mjs`
- Create: `test/lib.test.mjs`

- [ ] **Step 1: Write failing tests for `renderShim` and `STEPS`**

Create `test/lib.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { STEPS, renderShim } from "../src/lib.mjs";

test("STEPS is the canonical six-step loop in order", () => {
  assert.deepEqual(STEPS, [
    "frame",
    "plan",
    "review",
    "build",
    "verify",
    "ship",
  ]);
});

test("renderShim substitutes QUARK_ROOT and STEP", () => {
  const template = "root={{QUARK_ROOT}} step={{STEP}} step2={{STEP}}";
  const out = renderShim(template, { root: "/abs/quark", step: "plan" });
  assert.equal(out, "root=/abs/quark step=plan step2=plan");
});

test("renderShim leaves unknown placeholders untouched", () => {
  const out = renderShim("{{OTHER}}", { root: "/x", step: "frame" });
  assert.equal(out, "{{OTHER}}");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/lib.test.mjs`
Expected: FAIL — cannot find module `../src/lib.mjs`.

- [ ] **Step 3: Implement `src/lib.mjs` (this slice)**

```javascript
import path from "node:path";
import { fileURLToPath } from "node:url";

export const STEPS = ["frame", "plan", "review", "build", "verify", "ship"];

/**
 * Resolve the Quark repo root from a module URL inside src/.
 * src/lib.mjs lives one level below the repo root.
 */
export function resolveQuarkRoot(moduleUrl) {
  const here = path.dirname(fileURLToPath(moduleUrl));
  return path.resolve(here, "..");
}

/** Substitute {{QUARK_ROOT}} and {{STEP}} in a shim template. */
export function renderShim(template, { root, step }) {
  return template
    .replaceAll("{{QUARK_ROOT}}", root)
    .replaceAll("{{STEP}}", step);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/lib.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib.mjs test/lib.test.mjs
git commit -m "feat(install): add STEPS, resolveQuarkRoot, renderShim"
```

---

## Task 6: Installer core — `installEngine` (generate command files)

**Files:**

- Modify: `src/lib.mjs`
- Modify: `test/lib.test.mjs`

- [ ] **Step 1: Add failing tests for `installEngine`**

Append to `test/lib.test.mjs`:

```javascript
import { installEngine } from "../src/lib.mjs";
import fs from "node:fs";
import os from "node:os";

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "quark-test-"));
}

test("installEngine writes one resolved command per step", () => {
  const outDir = path.join(tmp(), "commands");
  const written = installEngine({
    template: "root={{QUARK_ROOT}} step={{STEP}}",
    outDir,
    root: "/abs/quark",
    prefix: "quark-",
  });
  assert.equal(written.length, STEPS.length);
  const frame = fs.readFileSync(
    path.join(outDir, "quark-frame.md"),
    "utf8",
  );
  assert.equal(frame, "root=/abs/quark step=frame");
  assert.ok(fs.existsSync(path.join(outDir, "quark-ship.md")));
});

test("installEngine creates the output dir if missing", () => {
  const outDir = path.join(tmp(), "nested", "commands");
  installEngine({
    template: "{{STEP}}",
    outDir,
    root: "/x",
    prefix: "quark-",
  });
  assert.ok(fs.existsSync(path.join(outDir, "quark-plan.md")));
});

test("installEngine is idempotent", () => {
  const outDir = path.join(tmp(), "commands");
  const args = {
    template: "{{STEP}}",
    outDir,
    root: "/x",
    prefix: "quark-",
  };
  installEngine(args);
  installEngine(args);
  const files = fs
    .readdirSync(outDir)
    .filter((f) => f.startsWith("quark-"));
  assert.equal(files.length, STEPS.length);
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `node --test test/lib.test.mjs`
Expected: FAIL — `installEngine` is not exported.

- [ ] **Step 3: Implement `installEngine` in `src/lib.mjs`**

Add the imports at the top of `src/lib.mjs` (keep the existing ones):

```javascript
import fs from "node:fs";
```

Then add:

```javascript
/**
 * Generate one command file per STEP into outDir by rendering `template`.
 * Returns the list of absolute paths written. Idempotent: overwrites only
 * files named `${prefix}${step}.md`, never touching anything else.
 */
export function installEngine({ template, outDir, root, prefix = "quark-" }) {
  fs.mkdirSync(outDir, { recursive: true });
  const written = [];
  for (const step of STEPS) {
    const target = path.join(outDir, `${prefix}${step}.md`);
    fs.writeFileSync(target, renderShim(template, { root, step }));
    written.push(target);
  }
  return written;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/lib.test.mjs`
Expected: PASS (all `installEngine` tests green).

- [ ] **Step 5: Commit**

```bash
git add src/lib.mjs test/lib.test.mjs
git commit -m "feat(install): generate resolved command files per engine"
```

---

## Task 7: Installer core — `.gitignore` and `AGENTS.md` helpers

**Files:**

- Modify: `src/lib.mjs`
- Modify: `test/lib.test.mjs`

- [ ] **Step 1: Add failing tests for `ensureGitignoreEntry` and
  `ensureAgentsSymlink`**

Append to `test/lib.test.mjs`:

```javascript
import { ensureGitignoreEntry, ensureAgentsSymlink } from "../src/lib.mjs";

test("ensureGitignoreEntry appends the entry once", () => {
  const repo = tmp();
  const gi = path.join(repo, ".gitignore");
  fs.writeFileSync(gi, "node_modules/\n");
  assert.equal(ensureGitignoreEntry(repo, ".work/"), true);
  assert.equal(ensureGitignoreEntry(repo, ".work/"), false);
  const lines = fs
    .readFileSync(gi, "utf8")
    .split("\n")
    .filter((l) => l.trim() === ".work/");
  assert.equal(lines.length, 1);
});

test("ensureGitignoreEntry creates .gitignore if absent", () => {
  const repo = tmp();
  assert.equal(ensureGitignoreEntry(repo, ".work/"), true);
  assert.ok(fs.readFileSync(path.join(repo, ".gitignore"), "utf8")
    .includes(".work/"));
});

test("ensureAgentsSymlink links AGENTS.md to CLAUDE.md when absent", () => {
  const repo = tmp();
  fs.writeFileSync(path.join(repo, "CLAUDE.md"), "# steering\n");
  assert.equal(ensureAgentsSymlink(repo), "linked");
  const link = path.join(repo, "AGENTS.md");
  assert.equal(fs.readlinkSync(link), "CLAUDE.md");
});

test("ensureAgentsSymlink does not clobber an existing real AGENTS.md", () => {
  const repo = tmp();
  fs.writeFileSync(path.join(repo, "CLAUDE.md"), "# steering\n");
  fs.writeFileSync(path.join(repo, "AGENTS.md"), "# existing\n");
  assert.equal(ensureAgentsSymlink(repo), "skipped-exists");
  assert.equal(
    fs.readFileSync(path.join(repo, "AGENTS.md"), "utf8"),
    "# existing\n",
  );
});

test("ensureAgentsSymlink skips when CLAUDE.md is missing", () => {
  const repo = tmp();
  assert.equal(ensureAgentsSymlink(repo), "skipped-no-claude");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/lib.test.mjs`
Expected: FAIL — functions not exported.

- [ ] **Step 3: Implement the helpers in `src/lib.mjs`**

```javascript
/**
 * Ensure `entry` is present on its own line in <repoDir>/.gitignore.
 * Returns true if it added the entry, false if it was already present.
 */
export function ensureGitignoreEntry(repoDir, entry) {
  const giPath = path.join(repoDir, ".gitignore");
  let current = "";
  if (fs.existsSync(giPath)) current = fs.readFileSync(giPath, "utf8");
  const present = current
    .split("\n")
    .some((line) => line.trim() === entry);
  if (present) return false;
  const sep = current.length && !current.endsWith("\n") ? "\n" : "";
  fs.appendFileSync(giPath, `${sep}${entry}\n`);
  return true;
}

/**
 * Symlink <repoDir>/AGENTS.md -> CLAUDE.md so Codex shares the steering doc.
 * Returns one of: "linked", "skipped-exists", "skipped-no-claude",
 * "already-linked".
 */
export function ensureAgentsSymlink(repoDir) {
  const claude = path.join(repoDir, "CLAUDE.md");
  const agents = path.join(repoDir, "AGENTS.md");
  if (!fs.existsSync(claude)) return "skipped-no-claude";
  if (fs.existsSync(agents) || fs.lstatSafe(agents)) {
    const stat = fs.lstatSync(agents);
    if (stat.isSymbolicLink() && fs.readlinkSync(agents) === "CLAUDE.md") {
      return "already-linked";
    }
    return "skipped-exists";
  }
  fs.symlinkSync("CLAUDE.md", agents);
  return "linked";
}
```

Note: `fs.lstatSafe` is not a real API — replace the existence check with a
`try/catch` around `fs.lstatSync(agents)`:

```javascript
export function ensureAgentsSymlink(repoDir) {
  const claude = path.join(repoDir, "CLAUDE.md");
  const agents = path.join(repoDir, "AGENTS.md");
  if (!fs.existsSync(claude)) return "skipped-no-claude";
  let stat = null;
  try {
    stat = fs.lstatSync(agents);
  } catch {
    stat = null;
  }
  if (stat) {
    if (stat.isSymbolicLink() && fs.readlinkSync(agents) === "CLAUDE.md") {
      return "already-linked";
    }
    return "skipped-exists";
  }
  fs.symlinkSync("CLAUDE.md", agents);
  return "linked";
}
```

(Use the second version; delete the first. It exists only to explain the fix.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/lib.test.mjs`
Expected: PASS (all helper tests green).

- [ ] **Step 5: Commit**

```bash
git add src/lib.mjs test/lib.test.mjs
git commit -m "feat(install): add gitignore and AGENTS.md symlink helpers"
```

---

## Task 8: CLI entry — `bin/quark-install`

**Files:**

- Modify: `src/lib.mjs`
- Modify: `test/lib.test.mjs`
- Create: `bin/quark-install`

- [ ] **Step 1: Add a failing test for `parseArgs`**

Append to `test/lib.test.mjs`:

```javascript
import { parseArgs } from "../src/lib.mjs";

test("parseArgs defaults to both engines", () => {
  const opts = parseArgs([]);
  assert.deepEqual(opts.engines, ["claude", "codex"]);
  assert.equal(opts.dryRun, false);
});

test("parseArgs honors --claude, --codex, --dry-run", () => {
  assert.deepEqual(parseArgs(["--claude"]).engines, ["claude"]);
  assert.deepEqual(parseArgs(["--codex"]).engines, ["codex"]);
  assert.equal(parseArgs(["--dry-run"]).dryRun, true);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/lib.test.mjs`
Expected: FAIL — `parseArgs` not exported.

- [ ] **Step 3: Implement `parseArgs` in `src/lib.mjs`**

```javascript
/** Parse argv flags: --claude, --codex (default both), --dry-run. */
export function parseArgs(argv) {
  const wantClaude = argv.includes("--claude");
  const wantCodex = argv.includes("--codex");
  const engines =
    wantClaude || wantCodex
      ? [wantClaude && "claude", wantCodex && "codex"].filter(Boolean)
      : ["claude", "codex"];
  return { engines, dryRun: argv.includes("--dry-run") };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/lib.test.mjs`
Expected: PASS.

- [ ] **Step 5: Add engine target resolution to `src/lib.mjs`**

```javascript
import os from "node:os";

/** Default command directory for each engine. */
export function engineTargets(home = os.homedir()) {
  return {
    claude: {
      template: "shims/claude.md",
      outDir: path.join(home, ".claude", "commands"),
    },
    codex: {
      template: "shims/codex.md",
      outDir: path.join(home, ".codex", "prompts"),
    },
  };
}
```

- [ ] **Step 6: Write `bin/quark-install`**

```javascript
#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  STEPS,
  resolveQuarkRoot,
  installEngine,
  ensureGitignoreEntry,
  ensureAgentsSymlink,
  parseArgs,
  engineTargets,
} from "../src/lib.mjs";

const opts = parseArgs(process.argv.slice(2));
const root = resolveQuarkRoot(import.meta.url);
const targets = engineTargets();

console.log(`Quark install — root: ${root}`);
for (const engine of opts.engines) {
  const { template, outDir } = targets[engine];
  const templateText = fs.readFileSync(path.join(root, template), "utf8");
  if (opts.dryRun) {
    console.log(`[dry-run] ${engine}: would write ${STEPS.length} commands ` +
      `to ${outDir}`);
    continue;
  }
  const written = installEngine({ template: templateText, outDir, root });
  console.log(`${engine}: wrote ${written.length} commands to ${outDir}`);
}

if (!opts.dryRun) {
  const cwd = process.cwd();
  if (ensureGitignoreEntry(cwd, ".work/")) {
    console.log(`Added .work/ to ${path.join(cwd, ".gitignore")}`);
  }
  const agents = ensureAgentsSymlink(cwd);
  console.log(`AGENTS.md: ${agents}`);
}
```

- [ ] **Step 7: Make it executable and smoke-test dry-run**

Run:

```bash
chmod +x bin/quark-install
node bin/quark-install --dry-run
```

Expected: prints the resolved root and, for each engine, a `[dry-run] ... would
write 6 commands to <dir>` line. No files written.

- [ ] **Step 8: Commit**

```bash
git add src/lib.mjs test/lib.test.mjs bin/quark-install
git commit -m "feat(install): add quark-install CLI with dry-run"
```

---

## Task 9: Write the `.work/` templates

**Files:**

- Create: `templates/context.md`
- Create: `templates/plan.md`
- Create: `templates/state.md`
- Create: `templates/uat.md`

- [ ] **Step 1: Write `templates/context.md`**

```markdown
# Context: <TICKET-ID>

## Intent
<what the ticket is for, in one or two sentences>

## Acceptance criteria
- <criterion>

## Files / modules in play
- <path> — <why it is involved>

## Constraints
- <constraint>

## Risks
- <risk>

## Out of scope
- <explicitly not included>

## Open questions
- [ ] <question to resolve with the developer before planning>
```

- [ ] **Step 2: Write `templates/plan.md`**

```markdown
# Plan: <TICKET-ID>

## Approach
<short description of the implementation approach>

## Changes (file by file)
- <path> — <what changes>

## Test strategy
- <behavior> — <test type; TDD yes/no>

## Definition of done
- [ ] <checks derived from the acceptance criteria>

## Risks & mitigations
- <risk> — <mitigation>
```

- [ ] **Step 3: Write `templates/state.md`**

```markdown
# State: <TICKET-ID>

- **Current step:** frame
- **Status:** in-progress
- **Driving engine:** <Claude Code | Codex>

## Completed
- <step> — <outcome> (<commit>)

## Decisions & deviations
- <none yet>

## Next action
- <the single next concrete action>

## Gotchas for the next runner
- <none yet>
```

- [ ] **Step 4: Write `templates/uat.md`**

```markdown
# UAT: <TICKET-ID>

Manual acceptance walkthrough, mapped to the acceptance criteria.

- [ ] <step the developer performs> → <expected result>

## Result
<pass/fail + notes after replay>
```

- [ ] **Step 5: Commit**

```bash
git add templates/context.md templates/plan.md templates/state.md \
  templates/uat.md
git commit -m "feat(templates): add .work artifact skeletons"
```

---

## Task 10: Structural content tests

Guard the prompt files against regressions: confirm the templates and playbooks
have the pieces the installer and engines rely on.

**Files:**

- Create: `test/content.test.mjs`

- [ ] **Step 1: Write the content tests**

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STEPS } from "../src/lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

test("a playbook file exists for every step, plus _shared", () => {
  assert.ok(fs.existsSync(path.join(root, "playbook/_shared.md")));
  for (const step of STEPS) {
    assert.ok(
      fs.existsSync(path.join(root, `playbook/${step}.md`)),
      `missing playbook/${step}.md`,
    );
  }
});

test("each shim template has both placeholders and references", () => {
  for (const engine of ["claude", "codex"]) {
    const tpl = read(`shims/${engine}.md`);
    assert.ok(tpl.includes("{{QUARK_ROOT}}"), `${engine}: no QUARK_ROOT`);
    assert.ok(tpl.includes("{{STEP}}"), `${engine}: no STEP`);
    assert.ok(tpl.includes("_shared.md"), `${engine}: no _shared ref`);
    assert.ok(
      tpl.includes("playbook/{{STEP}}.md"),
      `${engine}: no step playbook ref`,
    );
    assert.ok(tpl.includes("$ARGUMENTS"), `${engine}: no argument token`);
  }
});

test("claude shim names Codex reviewer; codex shim names Claude", () => {
  assert.ok(/Codex/.test(read("shims/claude.md")));
  assert.ok(/Claude Code/.test(read("shims/codex.md")));
});

test("_shared.md documents both reviewer invocations and the fallback", () => {
  const shared = read("playbook/_shared.md");
  assert.ok(shared.includes("codex exec"));
  assert.ok(shared.includes("claude -p"));
  assert.ok(/fallback/i.test(shared));
});
```

- [ ] **Step 2: Run the full suite**

Run: `node --test`
Expected: PASS — smoke, lib, and content tests all green.

- [ ] **Step 3: Commit**

```bash
git add test/content.test.mjs
git commit -m "test: add structural tests for shims and playbooks"
```

---

## Task 11: End-to-end install into a throwaway HOME

Prove the installer writes correct, resolved command files for both engines.

**Files:**

- Create: `test/e2e.test.mjs`

- [ ] **Step 1: Write the end-to-end test**

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STEPS, installEngine, engineTargets } from "../src/lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("end-to-end: resolved commands land in both engine dirs", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "quark-home-"));
  const targets = engineTargets(home);
  for (const engine of ["claude", "codex"]) {
    const { template, outDir } = targets[engine];
    const templateText = fs.readFileSync(path.join(root, template), "utf8");
    installEngine({ template: templateText, outDir, root });
    for (const step of STEPS) {
      const body = fs.readFileSync(
        path.join(outDir, `quark-${step}.md`),
        "utf8",
      );
      assert.ok(body.includes(`${root}/playbook/${step}.md`),
        `${engine}/${step}: playbook path not resolved`);
      assert.ok(!body.includes("{{"), `${engine}/${step}: placeholder left`);
    }
  }
});
```

- [ ] **Step 2: Run the full suite**

Run: `node --test`
Expected: PASS — all suites green.

- [ ] **Step 3: Commit**

```bash
git add test/e2e.test.mjs
git commit -m "test: end-to-end install into a throwaway HOME"
```

---

## Task 12: Finalize the README usage section and lint everything

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Replace the "Building it" section of `README.md` with usage**

Replace the `## Building it` section with:

````markdown
## Install

```bash
node bin/quark-install        # writes commands for both engines
node bin/quark-install --claude   # only Claude Code
node bin/quark-install --codex    # only Codex
node bin/quark-install --dry-run  # preview, write nothing
```

Run it from a repo you want to work in: it also adds `.work/` to that repo's
`.gitignore` and symlinks `AGENTS.md` to `CLAUDE.md` so Codex shares your
steering doc.

## The loop

Per ticket, in either engine: `/quark-frame <ticket>` → `/quark-plan` →
(`/quark-review`) → `/quark-build` → `/quark-verify` → `/quark-ship`. Planning
artifacts live in `.work/<TICKET>/` and are stripped before the PR. Switch
engines any time — `state.md` is the handoff.

````

- [ ] **Step 2: Lint all Markdown**

Run: `npx --yes markdownlint-cli2 "**/*.md"`
Expected: `0 error(s)`. Fix any reported issues.

- [ ] **Step 3: Run the full test suite one last time**

Run: `node --test`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document install and the per-ticket loop"
```

---

## Self-Review (completed during planning)

- **Spec coverage:** six commands (Tasks 3, 4, 8), cross-engine review with
  confirmed flags (Tasks 2, 3), `state.md` handoff (Tasks 2, 3), ephemeral
  `.work/` + leak check (Tasks 2, 3, 9), generated resolved shims (Tasks 4–8),
  install + `.gitignore` + `AGENTS.md` (Tasks 7, 8), zero-dependency stance
  (Task 1), publishable layout (Tasks 1, 12). Brownfield/correctness emphasis is
  carried in `frame`/`plan`/`verify` playbooks (Task 3).
- **Placeholder scan:** the only `<...>` tokens are intentional fill-ins inside
  the `.work/` skeletons and example prompts, not plan gaps.
- **Type consistency:** `STEPS`, `renderShim`, `installEngine`,
  `ensureGitignoreEntry`, `ensureAgentsSymlink`, `parseArgs`, `engineTargets`,
  and `resolveQuarkRoot` are named identically across `src/lib.mjs`, the tests,
  and `bin/quark-install`.

## Deferred to publish time

- Final npm package name (npm `quark` is taken; scope as `@<scope>/quark` or
  rename, and flip `private: false`).
- An `npx`-friendly entry once distribution is built; the current `bin` already
  supports it.
