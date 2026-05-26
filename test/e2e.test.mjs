import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STEPS, UTILITIES, installEngine, engineTargets } from "../src/lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("end-to-end: resolved loop + config commands land in both engine dirs", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "quark-home-"));
  const targets = engineTargets(home);
  for (const engine of ["claude", "codex"]) {
    const { loopTemplate, configTemplate, outDir } = targets[engine];
    const loopText = fs.readFileSync(path.join(root, loopTemplate), "utf8");
    const configText = fs.readFileSync(path.join(root, configTemplate), "utf8");
    installEngine({ template: loopText, outDir, root, steps: STEPS });
    installEngine({ template: configText, outDir, root, steps: UTILITIES });
    for (const name of [...STEPS, ...UTILITIES]) {
      const body = fs.readFileSync(
        path.join(outDir, `quark-${name}.md`),
        "utf8",
      );
      assert.ok(
        body.includes(`${root}/playbook/${name}.md`),
        `${engine}/${name}: playbook path not resolved`,
      );
      assert.ok(!body.includes("{{"), `${engine}/${name}: placeholder left`);
    }
  }
});
