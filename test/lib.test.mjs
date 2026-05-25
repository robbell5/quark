import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  STEPS,
  renderShim,
  installEngine,
  ensureGitignoreEntry,
  ensureAgentsSymlink,
  parseArgs,
} from "../src/lib.mjs";

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

test("ensureAgentsSymlink returns already-linked on a second call", () => {
  const repo = tmp();
  fs.writeFileSync(path.join(repo, "CLAUDE.md"), "# steering\n");
  assert.equal(ensureAgentsSymlink(repo), "linked");
  assert.equal(ensureAgentsSymlink(repo), "already-linked");
});

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
