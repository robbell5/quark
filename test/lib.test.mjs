import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  STEPS,
  UTILITIES,
  installEngine,
  uninstallEngine,
  parseArgs,
  engineTargets,
  composeCommand,
  install,
  uninstall,
} from "../src/lib.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "quark-test-"));
}

test("installEngine composes one self-contained command per name", () => {
  const outDir = path.join(tmp(), "commands");
  const header = fs.readFileSync(path.join(repoRoot, "shims/claude.md"), "utf8");
  const written = installEngine({
    headerTemplate: header,
    outDir,
    root: repoRoot,
    names: STEPS,
    includeShared: true,
  });
  assert.equal(written.length, STEPS.length);
  const frame = fs.readFileSync(path.join(outDir, "quark-frame.md"), "utf8");
  assert.ok(frame.includes("Quark frame — Claude Code"), "header rendered");
  assert.ok(frame.includes("Shared Conventions"), "_shared inlined");
  assert.ok(frame.includes("Step: frame"), "step body inlined");
  assert.ok(frame.includes("# Context: <TICKET-ID>"), "context template inlined");
  assert.ok(!frame.includes("{{"), "no placeholders remain");
  assert.ok(fs.existsSync(path.join(outDir, "quark-ship.md")));
});

test("installEngine omits _shared for utilities (includeShared:false)", () => {
  const outDir = path.join(tmp(), "commands");
  const header = fs.readFileSync(
    path.join(repoRoot, "shims/claude-config.md"),
    "utf8",
  );
  installEngine({
    headerTemplate: header,
    outDir,
    root: repoRoot,
    names: UTILITIES,
    includeShared: false,
  });
  const config = fs.readFileSync(path.join(outDir, "quark-config.md"), "utf8");
  assert.ok(config.includes("Command: config"), "config body inlined");
  assert.ok(!config.includes("Shared Conventions"), "utilities omit _shared");
});

test("installEngine creates the output dir if missing", () => {
  const outDir = path.join(tmp(), "nested", "commands");
  const header = fs.readFileSync(path.join(repoRoot, "shims/claude.md"), "utf8");
  installEngine({
    headerTemplate: header,
    outDir,
    root: repoRoot,
    names: ["plan"],
    includeShared: true,
  });
  assert.ok(fs.existsSync(path.join(outDir, "quark-plan.md")));
});

test("installEngine is idempotent", () => {
  const outDir = path.join(tmp(), "commands");
  const header = fs.readFileSync(path.join(repoRoot, "shims/claude.md"), "utf8");
  const args = {
    headerTemplate: header,
    outDir,
    root: repoRoot,
    names: STEPS,
    includeShared: true,
  };
  installEngine(args);
  installEngine(args);
  const files = fs.readdirSync(outDir).filter((f) => f.startsWith("quark-"));
  assert.equal(files.length, STEPS.length);
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

test("composeCommand renders the header and inlines shared + step", () => {
  const out = composeCommand({
    header: "# H {{STEP}}\n$ARGUMENTS",
    step: "frame",
    sharedText: "SHARED-CONTENT",
    stepText: "STEP-CONTENT",
    templates: {},
  });
  assert.ok(out.includes("# H frame"), "{{STEP}} should be substituted");
  assert.ok(out.includes("$ARGUMENTS"), "$ARGUMENTS preserved verbatim");
  assert.ok(out.includes("SHARED-CONTENT"));
  assert.ok(out.includes("STEP-CONTENT"));
  assert.ok(!out.includes("{{"), "no placeholders should remain");
});

test("composeCommand omits shared content when sharedText is empty", () => {
  const out = composeCommand({
    header: "{{STEP}}",
    step: "config",
    sharedText: "",
    stepText: "CONFIG-CONTENT",
    templates: {},
  });
  assert.ok(out.includes("CONFIG-CONTENT"));
  assert.ok(!out.includes("SHARED"), "nothing shared should leak in");
});

test("composeCommand appends only the templates the step references", () => {
  const out = composeCommand({
    header: "{{STEP}}",
    step: "frame",
    sharedText: "S",
    stepText: "write from templates/context.md and templates/state.md",
    templates: {
      context: "CONTEXT-SKELETON",
      state: "STATE-SKELETON",
      uat: "UAT-SKELETON",
    },
  });
  assert.ok(out.includes("CONTEXT-SKELETON"));
  assert.ok(out.includes("STATE-SKELETON"));
  assert.ok(!out.includes("UAT-SKELETON"), "unreferenced template not appended");
  assert.ok(out.includes("## Templates"));
  assert.ok(
    out.indexOf("CONTEXT-SKELETON") < out.indexOf("STATE-SKELETON"),
    "templates appended in first-seen order",
  );
});

test("uninstallEngine removes only the prefixed files it owns", () => {
  const outDir = path.join(tmp(), "commands");
  fs.mkdirSync(outDir, { recursive: true });
  for (const n of ["frame", "config"]) {
    fs.writeFileSync(path.join(outDir, `quark-${n}.md`), "x");
  }
  fs.writeFileSync(path.join(outDir, "keep-me.md"), "keep");
  const removed = uninstallEngine({ outDir, names: ["frame", "config"] });
  assert.equal(removed.length, 2);
  assert.ok(!fs.existsSync(path.join(outDir, "quark-frame.md")));
  assert.ok(!fs.existsSync(path.join(outDir, "quark-config.md")));
  assert.ok(fs.existsSync(path.join(outDir, "keep-me.md")), "non-quark untouched");
});

test("uninstallEngine tolerates already-absent files", () => {
  const outDir = path.join(tmp(), "commands");
  fs.mkdirSync(outDir, { recursive: true });
  const removed = uninstallEngine({ outDir, names: ["frame"] });
  assert.deepEqual(removed, []);
});

test("parseArgs defaults the command to install", () => {
  assert.equal(parseArgs([]).command, "install");
  assert.equal(parseArgs(["--claude"]).command, "install");
});

test("parseArgs reads the uninstall subcommand with flags", () => {
  assert.equal(parseArgs(["uninstall"]).command, "uninstall");
  const opts = parseArgs(["uninstall", "--codex"]);
  assert.equal(opts.command, "uninstall");
  assert.deepEqual(opts.engines, ["codex"]);
});

test("install writes self-contained commands into a temp home", () => {
  const home = tmp();
  const results = install({ engines: ["claude"], root: repoRoot, home });
  assert.equal(results.length, 1);
  assert.equal(results[0].count, STEPS.length + UTILITIES.length);
  const frame = path.join(home, ".claude", "commands", "quark-frame.md");
  assert.ok(fs.existsSync(frame));
  assert.ok(fs.readFileSync(frame, "utf8").includes("Shared Conventions"));
});

test("uninstall removes the commands install wrote", () => {
  const home = tmp();
  install({ engines: ["claude", "codex"], root: repoRoot, home });
  const results = uninstall({ engines: ["claude", "codex"], home });
  assert.ok(
    !fs.existsSync(path.join(home, ".claude", "commands", "quark-frame.md")),
  );
  assert.ok(
    !fs.existsSync(path.join(home, ".codex", "prompts", "quark-frame.md")),
  );
  const total = results.reduce((n, r) => n + r.count, 0);
  assert.equal(total, 2 * (STEPS.length + UTILITIES.length));
});
