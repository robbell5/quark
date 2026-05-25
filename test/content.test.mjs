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
