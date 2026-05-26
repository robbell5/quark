import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STEPS, UTILITIES, installEngine, engineTargets } from "../src/lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("end-to-end: self-contained skills land in both engine dirs", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "quark-home-"));
  const targets = engineTargets(home);
  for (const engine of ["claude", "codex"]) {
    const { loopTemplate, configTemplate, outDir, sidecar } = targets[engine];
    const loopHeader = fs.readFileSync(path.join(root, loopTemplate), "utf8");
    const configHeader = fs.readFileSync(path.join(root, configTemplate), "utf8");
    const resolvedSidecar = sidecar
      ? {
          dest: sidecar.dest,
          content: fs.readFileSync(path.join(root, sidecar.src), "utf8"),
        }
      : null;
    installEngine({
      headerTemplate: loopHeader,
      outDir,
      root,
      names: STEPS,
      includeShared: true,
      sidecar: resolvedSidecar,
    });
    installEngine({
      headerTemplate: configHeader,
      outDir,
      root,
      names: UTILITIES,
      includeShared: false,
      sidecar: resolvedSidecar,
    });

    for (const name of [...STEPS, ...UTILITIES]) {
      const body = fs.readFileSync(
        path.join(outDir, `quark-${name}`, "SKILL.md"),
        "utf8",
      );
      assert.ok(!body.includes("{{"), `${engine}/${name}: placeholder left`);
      assert.ok(!body.includes(root), `${engine}/${name}: absolute clone path leaked`);
    }

    const frame = fs.readFileSync(
      path.join(outDir, "quark-frame", "SKILL.md"),
      "utf8",
    );
    assert.ok(frame.includes("Shared Conventions"), "loop step inlines _shared");
    assert.ok(frame.includes("# Context: <TICKET-ID>"), "context inlined");
    assert.ok(frame.includes("# State: <TICKET-ID>"), "state inlined");

    const config = fs.readFileSync(
      path.join(outDir, "quark-config", "SKILL.md"),
      "utf8",
    );
    assert.ok(!config.includes("Shared Conventions"), "config omits _shared");

    const sidecarPath = path.join(outDir, "quark-frame", "agents", "openai.yaml");
    if (engine === "codex") {
      assert.ok(fs.existsSync(sidecarPath), "codex skill has openai.yaml sidecar");
      assert.ok(
        fs
          .readFileSync(sidecarPath, "utf8")
          .includes("allow_implicit_invocation: false"),
      );
    } else {
      assert.ok(!fs.existsSync(sidecarPath), "claude skill has no sidecar");
    }
  }
});
