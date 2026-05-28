import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STEPS } from "../src/lib.mjs";
import { SCHEMAS, parseSections, parseFrontmatter } from "../src/check.mjs";

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

test("loop shims carry STEP and no clone path; only Claude uses $ARGUMENTS", () => {
  for (const engine of ["claude", "codex"]) {
    const tpl = read(`shims/${engine}.md`);
    assert.ok(tpl.includes("{{STEP}}"), `${engine}: no STEP`);
    assert.ok(!tpl.includes("{{QUARK_ROOT}}"), `${engine}: clone path leaked`);
    assert.ok(!tpl.includes("playbook/"), `${engine}: stale playbook pointer`);
  }
  assert.ok(read("shims/claude.md").includes("$ARGUMENTS"), "claude keeps $ARGUMENTS");
  assert.ok(
    !read("shims/codex.md").includes("$ARGUMENTS"),
    "codex skills don't substitute $ARGUMENTS",
  );
});

test("loop shims mention the optional cross-engine second opinion", () => {
  assert.ok(/Codex/.test(read("shims/claude.md")), "claude shim names Codex");
  assert.ok(
    /Claude Code/.test(read("shims/codex.md")),
    "codex shim names Claude Code",
  );
});

test("claude loop frontmatter: name, description, argument-hint, explicit-only", () => {
  const tpl = read("shims/claude.md");
  assert.ok(tpl.startsWith("---"), "claude: frontmatter must open at the top");
  assert.ok(tpl.includes("name: quark-{{STEP}}"), "claude: no templated name");
  assert.ok(tpl.includes("description:"), "claude: no description");
  assert.ok(tpl.includes("argument-hint:"), "claude: no argument-hint");
  assert.ok(
    tpl.includes("disable-model-invocation: true"),
    "claude: not explicit-only",
  );
});

test("codex loop frontmatter is minimal: name + description, no Claude-only fields", () => {
  const tpl = read("shims/codex.md");
  assert.ok(tpl.startsWith("---"), "codex: frontmatter must open at the top");
  assert.ok(tpl.includes("name: quark-{{STEP}}"), "codex: no templated name");
  assert.ok(tpl.includes("description:"), "codex: no description");
  assert.ok(
    !tpl.includes("disable-model-invocation"),
    "codex: must not carry the Claude-only field",
  );
  assert.ok(!tpl.includes("argument-hint:"), "codex: no argument-hint");
});

test("_shared.md describes native review, not headless cross-engine calls", () => {
  const shared = read("playbook/_shared.md");
  assert.ok(!shared.includes("codex exec"), "no headless codex exec");
  assert.ok(!shared.includes("claude -p"), "no headless claude -p");
  assert.ok(/native/i.test(shared), "must describe native review");
  assert.ok(
    /only one engine\s+installed/i.test(shared),
    "must state single-engine usability",
  );
});

test("_shared.md carries the cold-start orientation block", () => {
  const shared = read("playbook/_shared.md");
  assert.ok(/## Cold start/i.test(shared), "missing the Cold start section");
  assert.ok(/fresh session/i.test(shared), "must frame steps as fresh sessions");
  assert.ok(
    shared.includes("state.md") && /re-running|already complete/i.test(shared),
    "orientation must read state.md and handle a re-run",
  );
});

test("_shared.md states the one-step-per-session principle", () => {
  assert.ok(/one step per session/i.test(read("playbook/_shared.md")));
});

test("config.md does not inherit the orientation block (it omits _shared)", () => {
  assert.ok(!/## Cold start/i.test(read("playbook/config.md")));
});

test("config shims: STEP, no clone path, reviewer-free; only Claude uses $ARGUMENTS", () => {
  for (const engine of ["claude", "codex"]) {
    const tpl = read(`shims/${engine}-config.md`);
    assert.ok(tpl.includes("{{STEP}}"), `${engine}-config: no STEP`);
    assert.ok(!tpl.includes("{{QUARK_ROOT}}"), `${engine}-config: clone path leaked`);
    assert.ok(!tpl.includes("playbook/"), `${engine}-config: stale pointer`);
  }
  assert.ok(
    read("shims/claude-config.md").includes("$ARGUMENTS"),
    "claude-config keeps $ARGUMENTS",
  );
  assert.ok(
    !read("shims/codex-config.md").includes("$ARGUMENTS"),
    "codex-config: no $ARGUMENTS",
  );
  assert.ok(
    !/Codex/.test(read("shims/claude-config.md")),
    "claude-config must not name the Codex reviewer",
  );
  assert.ok(
    !/Claude Code/.test(read("shims/codex-config.md")),
    "codex-config must not name the Claude Code reviewer",
  );
});

test("claude-config frontmatter: name, description, explicit-only, no argument-hint", () => {
  const tpl = read("shims/claude-config.md");
  assert.ok(tpl.startsWith("---"), "claude-config: frontmatter must open at top");
  assert.ok(tpl.includes("name: quark-{{STEP}}"), "claude-config: no templated name");
  assert.ok(tpl.includes("description:"), "claude-config: no description");
  assert.ok(
    tpl.includes("disable-model-invocation: true"),
    "claude-config: not explicit-only",
  );
  assert.ok(
    !tpl.includes("argument-hint:"),
    "claude-config: should omit argument-hint (no required arg)",
  );
});

test("codex-config frontmatter is minimal: name + description only", () => {
  const tpl = read("shims/codex-config.md");
  assert.ok(tpl.startsWith("---"), "codex-config: frontmatter must open at top");
  assert.ok(tpl.includes("name: quark-{{STEP}}"), "codex-config: no templated name");
  assert.ok(tpl.includes("description:"), "codex-config: no description");
  assert.ok(
    !tpl.includes("disable-model-invocation"),
    "codex-config: Claude-only field leaked",
  );
});

test("codex sidecar declares explicit-only invocation", () => {
  const yaml = read("shims/codex-openai.yaml");
  assert.ok(
    yaml.includes("allow_implicit_invocation: false"),
    "sidecar must disable implicit invocation",
  );
});

test("the config utility has a playbook", () => {
  assert.ok(fs.existsSync(path.join(root, "playbook/config.md")));
});

test("config.md does not reference _shared.md (it is not inlined there)", () => {
  assert.ok(
    !read("playbook/config.md").includes("_shared.md"),
    "config command does not bundle _shared.md, so it must not name it",
  );
});

test("every template structurally matches its schema (no drift)", () => {
  for (const [name, schema] of Object.entries(SCHEMAS)) {
    assert.ok(
      fs.existsSync(path.join(root, `templates/${name}.md`)),
      `templates/${name}.md is missing (a SCHEMAS entry has no template)`,
    );
    const text = read(`templates/${name}.md`);
    const { h1, sections } = parseSections(text);
    if (schema.h1) {
      assert.ok(
        h1 && h1.startsWith(schema.h1),
        `templates/${name}.md H1 must start with "${schema.h1}"`,
      );
    }
    for (const sec of schema.sections ?? []) {
      assert.ok(sec in sections, `templates/${name}.md missing "## ${sec}"`);
    }
    if (schema.frontmatter) {
      const fm = parseFrontmatter(text);
      assert.ok(fm, `templates/${name}.md needs frontmatter`);
      for (const key of schema.frontmatter) {
        assert.ok(key in fm, `templates/${name}.md frontmatter missing "${key}"`);
      }
    }
  }
});

test("every loop playbook follows the cold-start skeleton", () => {
  for (const step of STEPS) {
    const body = read(`playbook/${step}.md`);
    for (const marker of ["## Inputs", "## Output", "## Self-check", "## Handoff"]) {
      assert.ok(body.includes(marker), `playbook/${step}.md missing "${marker}"`);
    }
    assert.ok(
      body.includes("quark check"),
      `playbook/${step}.md must call quark check`,
    );
  }
});

test("frame references the context and state examples; plan references the plan examples", () => {
  const frame = read("playbook/frame.md");
  assert.ok(frame.includes("examples/context.md"));
  assert.ok(frame.includes("examples/state.md"));
  const plan = read("playbook/plan.md");
  assert.ok(plan.includes("examples/plan.md"));
  assert.ok(plan.includes("examples/plan-too-vague.md"));
});

test("each step handoff sets up the next session (ship signals completion)", () => {
  for (const step of STEPS) {
    const body = read(`playbook/${step}.md`);
    if (step === "ship") {
      assert.ok(
        /shipped|no further step/i.test(body),
        "ship handoff must signal completion",
      );
    } else {
      assert.ok(
        /(fresh|new) session/i.test(body),
        `playbook/${step}.md handoff must nudge a new session`,
      );
    }
  }
});

test("README teaches fresh sessions and the resume surface", () => {
  const readme = read("README.md");
  assert.ok(/fresh session/i.test(readme), "README must teach fresh sessions");
  assert.ok(/resume/i.test(readme) && readme.includes("quark check"),
    "README must document resume via quark check");
});

test("config.md documents the consented quark check permission grant", () => {
  const cfg = read("playbook/config.md");
  assert.ok(cfg.includes("Bash(quark check:*)"), "Claude allow-rule");
  assert.ok(
    cfg.includes("prefix_rule") && cfg.includes('"quark", "check"'),
    "Codex execpolicy rule",
  );
  assert.ok(cfg.includes(".claude/settings.local.json"), "Claude target file");
  assert.ok(cfg.includes(".codex/rules"), "Codex target file");
  assert.ok(/never clobber/i.test(cfg) && /consent/i.test(cfg), "consent framing");
});

test("the philosophy and authoring docs exist", () => {
  assert.ok(fs.existsSync(path.join(root, "docs/PHILOSOPHY.md")));
  assert.ok(fs.existsSync(path.join(root, "docs/PROMPT-AUTHORING.md")));
});

test("CLAUDE.md links the philosophy and authoring docs", () => {
  const md = read("CLAUDE.md");
  assert.ok(md.includes("docs/PHILOSOPHY.md"), "must link PHILOSOPHY.md");
  assert.ok(
    md.includes("docs/PROMPT-AUTHORING.md"),
    "must link PROMPT-AUTHORING.md",
  );
});

test("_shared.md teaches think-before-you-write and how to elicit decisions", () => {
  const shared = read("playbook/_shared.md");
  assert.ok(/think before you write/i.test(shared), "missing reasoning principle");
  assert.ok(/## Eliciting decisions/i.test(shared), "missing elicitation guide");
  assert.ok(/judgment/i.test(shared), "elicitation must scope to judgment calls");
});

test("every loop step declares a Stance and a Failure modes section", () => {
  for (const step of STEPS) {
    const body = read(`playbook/${step}.md`);
    assert.ok(body.includes("**Stance:**"), `playbook/${step}.md missing **Stance:**`);
    assert.ok(
      body.includes("## Failure modes"),
      `playbook/${step}.md missing "## Failure modes"`,
    );
  }
});

test("the config utility does not carry step-only Failure modes", () => {
  assert.ok(!read("playbook/config.md").includes("## Failure modes"));
});

test("plan and verify open their procedure with a reasoning beat", () => {
  assert.ok(
    /change surface/i.test(read("playbook/plan.md")),
    "plan must enumerate the change surface before writing",
  );
  assert.ok(
    /map each acceptance criterion/i.test(read("playbook/verify.md")),
    "verify must map each acceptance criterion to a check first",
  );
});

test("frame and plan route elicitation through the shared guide", () => {
  assert.ok(
    /Eliciting decisions/.test(read("playbook/frame.md")),
    "frame must reference the Eliciting decisions guide",
  );
  assert.ok(
    /Eliciting decisions/.test(read("playbook/plan.md")),
    "plan must reference the Eliciting decisions guide",
  );
});

test("judgment steps reference their few-shot examples, and the files exist", () => {
  assert.ok(read("playbook/frame.md").includes("examples/open-questions.md"));
  assert.ok(read("playbook/review.md").includes("examples/review.md"));
  assert.ok(read("playbook/verify.md").includes("examples/uat.md"));
  for (const ex of ["open-questions", "review", "uat"]) {
    assert.ok(
      fs.existsSync(path.join(root, `examples/${ex}.md`)),
      `missing examples/${ex}.md`,
    );
  }
});

test("frame classifies sensitivity into context", () => {
  assert.ok(/Sensitivity/.test(read("playbook/frame.md")));
});

test("plan records approval through the gate", () => {
  const plan = read("playbook/plan.md");
  assert.ok(/quark gate/.test(plan), "plan must record approval via quark gate");
  assert.ok(/approv/i.test(plan));
});

test("review is native, records a verdict, and has no headless fallback", () => {
  const review = read("playbook/review.md");
  assert.ok(!/fallback-approved/.test(review), "fallback-approved is retired");
  assert.ok(
    !/codex exec/.test(review) && !/claude -p/.test(review),
    "review must not shell out to the other engine",
  );
  assert.ok(
    /--verdict/.test(review) && /accepted/.test(review),
    "review records a verdict including the accept-gaps path",
  );
});

test("build routes drift back through plan/review", () => {
  const build = read("playbook/build.md");
  assert.ok(/re-approv/i.test(build) || /plan\/review/.test(build));
});

test("verify reads the diff and keys the security pass off Sensitivity", () => {
  const verify = read("playbook/verify.md");
  assert.ok(/git diff/.test(verify), "verify must take the diff as input");
  assert.ok(/Sensitivity/.test(verify));
});

test("ship cleans safely and computes a robust base", () => {
  const ship = read("playbook/ship.md");
  assert.ok(/--porcelain/.test(ship), "ship must inspect the working tree");
  assert.ok(/origin\/HEAD|default branch/.test(ship));
});

test("_shared documents the gate fields and the review verdicts", () => {
  const shared = read("playbook/_shared.md");
  assert.ok(/gate_plan_approved/.test(shared));
  assert.ok(/gate_review/.test(shared));
  assert.ok(!/fallback-approved/.test(shared), "fallback-approved is retired");
  assert.ok(/accepted/.test(shared), "documents the accept-gaps verdict");
});

test("templates and playbooks wire the acceptance-criterion spine", () => {
  assert.ok(/- AC1:/.test(read("templates/context.md")), "context AC ids");
  assert.ok(/\(ACn\)/.test(read("templates/plan.md")), "plan DoD cites (ACn)");
  assert.ok(/\(ACn\)/.test(read("templates/uat.md")), "uat cites (ACn)");
  assert.ok(/\(ACn\)/.test(read("playbook/plan.md")), "plan teaches (ACn)");
  assert.ok(/AC1:/.test(read("playbook/frame.md")), "frame assigns AC ids");
});
