import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STEPS, UTILITIES, install, installEngine, installEngineAgents, engineTargets } from "../src/lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Recursively copy a file or directory tree (zero-dep, no experimental warning). */
function copyInto(src, dest) {
  if (fs.statSync(src).isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyInto(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

test("end-to-end: self-contained skills land in both engine dirs", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "quark-home-"));
  const targets = engineTargets(home);
  for (const engine of ["claude", "codex"]) {
    const { loopTemplate, configTemplate, agentTemplate, outDir, agentsDir, sidecar } = targets[engine];
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

    const agentHeader = fs.readFileSync(path.join(root, agentTemplate), "utf8");
    installEngineAgents({ shimTemplate: agentHeader, engine, outDir: agentsDir, root });

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

    const agentExt = engine === "codex" ? "toml" : "md";
    const agentFile = path.join(agentsDir, `quark-explorer.${agentExt}`);
    assert.ok(fs.existsSync(agentFile), `${engine}: quark-explorer agent file written`);
    const agentBody = fs.readFileSync(agentFile, "utf8");
    assert.ok(!agentBody.includes("{{"), `${engine}: agent placeholder left`);
    assert.ok(agentBody.includes("Relevant files"), `${engine}: explorer body inlined`);
  }
});

// Guards packaging completeness: every asset directory the installer reads must
// be shipped in package.json `files`, or `npx github:...` install fails with
// ENOENT. Reproduces the npm/npx environment in-process by running install()
// against a tree containing ONLY the files-allowlisted paths — so any future
// directory the installer reads but forgets to ship fails here, with no
// parallel hardcoded list to maintain.
test("packaging: installer runs against only the files-allowlisted tree", () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8"),
  );
  const packed = fs.mkdtempSync(path.join(os.tmpdir(), "quark-packed-"));
  for (const entry of pkg.files) {
    const rel = entry.replace(/\/$/, "");
    const src = path.join(root, rel);
    if (fs.existsSync(src)) copyInto(src, path.join(packed, rel));
  }
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "quark-home-"));
  const results = install({ engines: ["claude", "codex"], root: packed, home });
  for (const r of results) {
    assert.ok(
      r.agents >= 1,
      `${r.engine}: no agents composed from packaged tree — missing dir in package.json "files"?`,
    );
  }
});
