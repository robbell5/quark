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

test("claude shim names Codex reviewer; codex shim names Claude", () => {
  assert.ok(/Codex/.test(read("shims/claude.md")));
  assert.ok(/Claude Code/.test(read("shims/codex.md")));
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

test("_shared.md documents both reviewer invocations and the fallback", () => {
  const shared = read("playbook/_shared.md");
  assert.ok(shared.includes("codex exec"));
  assert.ok(shared.includes("claude -p"));
  assert.ok(/fallback/i.test(shared));
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
