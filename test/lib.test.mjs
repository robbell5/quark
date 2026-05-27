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
  sweepLegacy,
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

test("installEngine writes one self-contained SKILL.md per skill dir", () => {
  const outDir = path.join(tmp(), "skills");
  const header = fs.readFileSync(path.join(repoRoot, "shims/claude.md"), "utf8");
  const written = installEngine({
    headerTemplate: header,
    outDir,
    root: repoRoot,
    names: STEPS,
    includeShared: true,
  });
  assert.equal(written.length, STEPS.length);
  const frame = fs.readFileSync(
    path.join(outDir, "quark-frame", "SKILL.md"),
    "utf8",
  );
  assert.ok(frame.includes("Quark frame — Claude Code"), "header rendered");
  assert.ok(frame.includes("Shared Conventions"), "_shared inlined");
  assert.ok(frame.includes("Step: frame"), "step body inlined");
  assert.ok(frame.includes("# Context: <TICKET-ID>"), "context template inlined");
  assert.ok(!frame.includes("{{"), "no placeholders remain");
  assert.ok(fs.existsSync(path.join(outDir, "quark-ship", "SKILL.md")));
});

test("installEngine omits _shared for utilities (includeShared:false)", () => {
  const outDir = path.join(tmp(), "skills");
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
  const config = fs.readFileSync(
    path.join(outDir, "quark-config", "SKILL.md"),
    "utf8",
  );
  assert.ok(config.includes("Command: config"), "config body inlined");
  assert.ok(!config.includes("Shared Conventions"), "utilities omit _shared");
});

test("installEngine creates the skill dir if missing", () => {
  const outDir = path.join(tmp(), "nested", "skills");
  const header = fs.readFileSync(path.join(repoRoot, "shims/claude.md"), "utf8");
  installEngine({
    headerTemplate: header,
    outDir,
    root: repoRoot,
    names: ["plan"],
    includeShared: true,
  });
  assert.ok(fs.existsSync(path.join(outDir, "quark-plan", "SKILL.md")));
});

test("installEngine is idempotent", () => {
  const outDir = path.join(tmp(), "skills");
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
  const dirs = fs.readdirSync(outDir).filter((f) => f.startsWith("quark-"));
  assert.equal(dirs.length, STEPS.length);
});

test("installEngine writes the sidecar into each skill dir when given", () => {
  const outDir = path.join(tmp(), "skills");
  const header = fs.readFileSync(path.join(repoRoot, "shims/codex.md"), "utf8");
  installEngine({
    headerTemplate: header,
    outDir,
    root: repoRoot,
    names: ["plan"],
    includeShared: true,
    sidecar: {
      dest: "agents/openai.yaml",
      content: "policy:\n  allow_implicit_invocation: false\n",
    },
  });
  const sidecar = fs.readFileSync(
    path.join(outDir, "quark-plan", "agents", "openai.yaml"),
    "utf8",
  );
  assert.ok(sidecar.includes("allow_implicit_invocation: false"));
});

test("installEngine omits the sidecar when none is given", () => {
  const outDir = path.join(tmp(), "skills");
  const header = fs.readFileSync(path.join(repoRoot, "shims/claude.md"), "utf8");
  installEngine({
    headerTemplate: header,
    outDir,
    root: repoRoot,
    names: ["plan"],
    includeShared: true,
  });
  assert.ok(!fs.existsSync(path.join(outDir, "quark-plan", "agents")));
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

test("engineTargets exposes skill roots, sidecar, and legacy dirs per engine", () => {
  const t = engineTargets("/home/x");
  assert.equal(t.claude.loopTemplate, "shims/claude.md");
  assert.equal(t.claude.configTemplate, "shims/claude-config.md");
  assert.equal(t.codex.loopTemplate, "shims/codex.md");
  assert.equal(t.codex.configTemplate, "shims/codex-config.md");
  assert.ok(t.claude.outDir.endsWith(path.join(".claude", "skills")));
  assert.ok(t.codex.outDir.endsWith(path.join(".agents", "skills")));
  assert.equal(t.claude.sidecar, null);
  assert.deepEqual(t.codex.sidecar, {
    src: "shims/codex-openai.yaml",
    dest: "agents/openai.yaml",
  });
  assert.ok(t.claude.legacyDir.endsWith(path.join(".claude", "commands")));
  assert.ok(t.codex.legacyDir.endsWith(path.join(".codex", "prompts")));
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

test("uninstallEngine removes only the skill dirs it owns", () => {
  const outDir = path.join(tmp(), "skills");
  fs.mkdirSync(outDir, { recursive: true });
  for (const n of ["frame", "config"]) {
    fs.mkdirSync(path.join(outDir, `quark-${n}`), { recursive: true });
    fs.writeFileSync(path.join(outDir, `quark-${n}`, "SKILL.md"), "x");
  }
  fs.mkdirSync(path.join(outDir, "keep-me"), { recursive: true });
  const removed = uninstallEngine({ outDir, names: ["frame", "config"] });
  assert.equal(removed.length, 2);
  assert.ok(!fs.existsSync(path.join(outDir, "quark-frame")));
  assert.ok(!fs.existsSync(path.join(outDir, "quark-config")));
  assert.ok(fs.existsSync(path.join(outDir, "keep-me")), "non-quark untouched");
});

test("uninstallEngine tolerates already-absent skill dirs", () => {
  const outDir = path.join(tmp(), "skills");
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

test("install writes self-contained skills into a temp home", () => {
  const home = tmp();
  const results = install({ engines: ["claude"], root: repoRoot, home });
  assert.equal(results.length, 1);
  assert.equal(results[0].count, STEPS.length + UTILITIES.length);
  assert.equal(results[0].legacyRemoved, 0);
  const frame = path.join(home, ".claude", "skills", "quark-frame", "SKILL.md");
  assert.ok(fs.existsSync(frame));
  assert.ok(fs.readFileSync(frame, "utf8").includes("Shared Conventions"));
});

test("uninstall removes the skills install wrote", () => {
  const home = tmp();
  install({ engines: ["claude", "codex"], root: repoRoot, home });
  const results = uninstall({ engines: ["claude", "codex"], home });
  assert.ok(!fs.existsSync(path.join(home, ".claude", "skills", "quark-frame")));
  assert.ok(!fs.existsSync(path.join(home, ".agents", "skills", "quark-frame")));
  const total = results.reduce((n, r) => n + r.count, 0);
  assert.equal(total, 2 * (STEPS.length + UTILITIES.length));
});

test("sweepLegacy removes only the flat quark-*.md files it owns", () => {
  const legacyDir = path.join(tmp(), "commands");
  fs.mkdirSync(legacyDir, { recursive: true });
  for (const n of ["frame", "config"]) {
    fs.writeFileSync(path.join(legacyDir, `quark-${n}.md`), "x");
  }
  fs.writeFileSync(path.join(legacyDir, "keep-me.md"), "keep");
  const removed = sweepLegacy({ legacyDir, names: ["frame", "config"] });
  assert.equal(removed.length, 2);
  assert.ok(!fs.existsSync(path.join(legacyDir, "quark-frame.md")));
  assert.ok(!fs.existsSync(path.join(legacyDir, "quark-config.md")));
  assert.ok(fs.existsSync(path.join(legacyDir, "keep-me.md")), "non-quark untouched");
});

test("sweepLegacy tolerates an absent legacy dir", () => {
  const legacyDir = path.join(tmp(), "does-not-exist");
  const removed = sweepLegacy({ legacyDir, names: ["frame"] });
  assert.deepEqual(removed, []);
});

test("install and uninstall sweep v0.3.0 legacy flat files", () => {
  const home = tmp();
  const claudeCmd = path.join(home, ".claude", "commands");
  const codexPrompts = path.join(home, ".codex", "prompts");
  fs.mkdirSync(claudeCmd, { recursive: true });
  fs.mkdirSync(codexPrompts, { recursive: true });
  fs.writeFileSync(path.join(claudeCmd, "quark-frame.md"), "old");
  fs.writeFileSync(path.join(codexPrompts, "quark-frame.md"), "old");

  const installed = install({ engines: ["claude", "codex"], root: repoRoot, home });
  assert.ok(
    !fs.existsSync(path.join(claudeCmd, "quark-frame.md")),
    "install sweeps the legacy claude file",
  );
  assert.ok(
    !fs.existsSync(path.join(codexPrompts, "quark-frame.md")),
    "install sweeps the legacy codex file",
  );
  const sweptOnInstall = installed.reduce((n, r) => n + r.legacyRemoved, 0);
  assert.equal(sweptOnInstall, 2);

  fs.writeFileSync(path.join(claudeCmd, "quark-plan.md"), "old");
  const removed = uninstall({ engines: ["claude"], home });
  assert.ok(!fs.existsSync(path.join(claudeCmd, "quark-plan.md")));
  assert.equal(removed.find((r) => r.engine === "claude").legacyRemoved, 1);
});

test("every installed skill's frontmatter name equals its directory", () => {
  const home = tmp();
  install({ engines: ["claude", "codex"], root: repoRoot, home });
  const roots = [
    path.join(home, ".claude", "skills"),
    path.join(home, ".agents", "skills"),
  ];
  for (const skillRoot of roots) {
    for (const dir of fs.readdirSync(skillRoot)) {
      const skill = fs.readFileSync(
        path.join(skillRoot, dir, "SKILL.md"),
        "utf8",
      );
      const m = skill.match(/^name:\s*(\S+)/m);
      assert.ok(m, `${dir}: no name in frontmatter`);
      assert.equal(m[1], dir, `${dir}: frontmatter name must equal dir name`);
    }
  }
});

test("parseArgs reads the check ticket and --for step", () => {
  const opts = parseArgs(["check", "RAY-001", "--for", "build"]);
  assert.equal(opts.command, "check");
  assert.equal(opts.ticket, "RAY-001");
  assert.equal(opts.forStep, "build");
});

test("parseArgs check without --for leaves forStep null", () => {
  const opts = parseArgs(["check", "RAY-001"]);
  assert.equal(opts.command, "check");
  assert.equal(opts.ticket, "RAY-001");
  assert.equal(opts.forStep, null);
});

test("parseArgs still defaults command and engines unchanged", () => {
  const opts = parseArgs([]);
  assert.equal(opts.command, "install");
  assert.deepEqual(opts.engines, ["claude", "codex"]);
  assert.equal(opts.ticket, null);
});

test("parseArgs --for with no value leaves forStep null", () => {
  const opts = parseArgs(["check", "RAY-1", "--for"]);
  assert.equal(opts.forStep, null);
  assert.equal(opts.ticket, "RAY-1");
});

test("composeCommand appends only the examples the step references", () => {
  const out = composeCommand({
    header: "{{STEP}}",
    step: "plan",
    sharedText: "S",
    stepText: "see examples/plan.md and examples/plan-too-vague.md",
    templates: {},
    examples: {
      plan: "GOOD-PLAN",
      "plan-too-vague": "BAD-PLAN",
      context: "CTX-EXAMPLE",
    },
  });
  assert.ok(out.includes("GOOD-PLAN"));
  assert.ok(out.includes("BAD-PLAN"));
  assert.ok(!out.includes("CTX-EXAMPLE"), "unreferenced example not appended");
  assert.ok(out.includes("## Examples"));
  assert.ok(
    out.indexOf("GOOD-PLAN") < out.indexOf("BAD-PLAN"),
    "examples appended in first-seen order",
  );
});

test("composeCommand keeps Templates and Examples as separate appendices", () => {
  const out = composeCommand({
    header: "{{STEP}}",
    step: "frame",
    sharedText: "S",
    stepText: "write templates/context.md; see examples/context.md",
    templates: { context: "CTX-TEMPLATE" },
    examples: { context: "CTX-EXAMPLE" },
  });
  assert.ok(out.includes("## Templates"));
  assert.ok(out.includes("## Examples"));
  assert.ok(out.includes("CTX-TEMPLATE"));
  assert.ok(out.includes("CTX-EXAMPLE"));
  assert.ok(
    out.indexOf("## Templates") < out.indexOf("## Examples"),
    "Templates appendix precedes Examples",
  );
});

test("composeCommand omits Examples when none are referenced", () => {
  const out = composeCommand({
    header: "{{STEP}}",
    step: "build",
    sharedText: "S",
    stepText: "no example refs here",
    templates: {},
    examples: { plan: "GOOD-PLAN" },
  });
  assert.ok(!out.includes("## Examples"));
  assert.ok(!out.includes("GOOD-PLAN"));
});
