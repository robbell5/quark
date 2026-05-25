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
