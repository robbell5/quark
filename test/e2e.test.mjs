import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STEPS, UTILITIES, installEngine, engineTargets } from "../src/lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("end-to-end: self-contained commands land in both engine dirs", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "quark-home-"));
  const targets = engineTargets(home);
  for (const engine of ["claude", "codex"]) {
    const { loopTemplate, configTemplate, outDir } = targets[engine];
    const loopHeader = fs.readFileSync(path.join(root, loopTemplate), "utf8");
    const configHeader = fs.readFileSync(path.join(root, configTemplate), "utf8");
    installEngine({
      headerTemplate: loopHeader,
      outDir,
      root,
      names: STEPS,
      includeShared: true,
    });
    installEngine({
      headerTemplate: configHeader,
      outDir,
      root,
      names: UTILITIES,
      includeShared: false,
    });

    for (const name of [...STEPS, ...UTILITIES]) {
      const body = fs.readFileSync(path.join(outDir, `quark-${name}.md`), "utf8");
      assert.ok(!body.includes("{{"), `${engine}/${name}: placeholder left`);
      assert.ok(
        !body.includes(root),
        `${engine}/${name}: absolute clone path leaked`,
      );
    }

    const frame = fs.readFileSync(path.join(outDir, "quark-frame.md"), "utf8");
    assert.ok(frame.includes("Shared Conventions"), "loop step inlines _shared");
    assert.ok(frame.includes("# Context: <TICKET-ID>"), "context inlined");
    assert.ok(frame.includes("# State: <TICKET-ID>"), "state inlined");

    const config = fs.readFileSync(path.join(outDir, "quark-config.md"), "utf8");
    assert.ok(!config.includes("Shared Conventions"), "config omits _shared");
  }
});
