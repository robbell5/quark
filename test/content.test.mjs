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

test("each loop shim is a header with STEP + ARGUMENTS and no clone path", () => {
  for (const engine of ["claude", "codex"]) {
    const tpl = read(`shims/${engine}.md`);
    assert.ok(tpl.includes("{{STEP}}"), `${engine}: no STEP`);
    assert.ok(tpl.includes("$ARGUMENTS"), `${engine}: no argument token`);
    assert.ok(!tpl.includes("{{QUARK_ROOT}}"), `${engine}: clone path leaked`);
    assert.ok(!tpl.includes("playbook/"), `${engine}: stale playbook pointer`);
  }
});

test("claude shim names Codex reviewer; codex shim names Claude", () => {
  assert.ok(/Codex/.test(read("shims/claude.md")));
  assert.ok(/Claude Code/.test(read("shims/codex.md")));
});

test("claude shim carries YAML frontmatter (description, argument-hint)", () => {
  const tpl = read("shims/claude.md");
  assert.ok(tpl.startsWith("---"), "claude: frontmatter must open at the top");
  assert.ok(
    tpl.includes("description:"),
    "claude: no description in frontmatter",
  );
  assert.ok(
    tpl.includes("argument-hint:"),
    "claude: no argument-hint in frontmatter",
  );
});

test("_shared.md documents both reviewer invocations and the fallback", () => {
  const shared = read("playbook/_shared.md");
  assert.ok(shared.includes("codex exec"));
  assert.ok(shared.includes("claude -p"));
  assert.ok(/fallback/i.test(shared));
});

test("config shims are reviewer-free headers with STEP + ARGUMENTS", () => {
  for (const engine of ["claude", "codex"]) {
    const tpl = read(`shims/${engine}-config.md`);
    assert.ok(tpl.includes("{{STEP}}"), `${engine}-config: no STEP`);
    assert.ok(tpl.includes("$ARGUMENTS"), `${engine}-config: no argument token`);
    assert.ok(
      !tpl.includes("{{QUARK_ROOT}}"),
      `${engine}-config: clone path leaked`,
    );
    assert.ok(!tpl.includes("playbook/"), `${engine}-config: stale pointer`);
  }
  assert.ok(
    !/Codex/.test(read("shims/claude-config.md")),
    "claude-config must not name the Codex reviewer",
  );
  assert.ok(
    !/Claude Code/.test(read("shims/codex-config.md")),
    "codex-config must not name the Claude Code reviewer",
  );
});

test("claude-config shim has frontmatter with description and no argument-hint", () => {
  const tpl = read("shims/claude-config.md");
  assert.ok(tpl.startsWith("---"), "claude-config: frontmatter must open at top");
  assert.ok(tpl.includes("description:"), "claude-config: no description");
  assert.ok(
    !tpl.includes("argument-hint:"),
    "claude-config: should omit argument-hint (no required arg)",
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
