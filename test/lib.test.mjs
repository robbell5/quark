import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  STEPS,
  UTILITIES,
  renderShim,
  installEngine,
  parseArgs,
  engineTargets,
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

test("UTILITIES is the non-loop command list", () => {
  assert.deepEqual(UTILITIES, ["config"]);
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

test("installEngine renders an explicit list of command names", () => {
  const outDir = path.join(tmp(), "commands");
  const written = installEngine({
    template: "x={{STEP}}",
    outDir,
    root: "/x",
    steps: ["config"],
    prefix: "quark-",
  });
  assert.equal(written.length, 1);
  assert.equal(
    fs.readFileSync(path.join(outDir, "quark-config.md"), "utf8"),
    "x=config",
  );
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

test("engineTargets exposes loop and config templates per engine", () => {
  const t = engineTargets("/home/x");
  assert.equal(t.claude.loopTemplate, "shims/claude.md");
  assert.equal(t.claude.configTemplate, "shims/claude-config.md");
  assert.equal(t.codex.loopTemplate, "shims/codex.md");
  assert.equal(t.codex.configTemplate, "shims/codex-config.md");
  assert.ok(t.claude.outDir.endsWith(path.join(".claude", "commands")));
  assert.ok(t.codex.outDir.endsWith(path.join(".codex", "prompts")));
});
