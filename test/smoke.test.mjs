import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const bin = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "bin",
  "quark",
);

test("bin/quark exists with a node shebang", () => {
  const src = fs.readFileSync(bin, "utf8");
  assert.ok(src.startsWith("#!/usr/bin/env node"), "missing node shebang");
});

test("bin/quark is marked executable", () => {
  assert.ok(fs.statSync(bin).mode & 0o111, "bin/quark needs an execute bit");
});

test("bin/quark dispatches install and uninstall via lib", () => {
  const src = fs.readFileSync(bin, "utf8");
  assert.ok(src.includes("parseArgs"), "uses parseArgs");
  assert.ok(src.includes('opts.command === "uninstall"'), "branches on uninstall");
  assert.ok(/from "\.\.\/src\/lib\.mjs"/.test(src), "imports from lib");
  assert.ok(src.includes("process.exit(1)"), "errors on unknown subcommand");
});

test("bin/quark dispatches the check subcommand via check.mjs", () => {
  const src = fs.readFileSync(bin, "utf8");
  assert.ok(src.includes('opts.command === "check"'), "branches on check");
  assert.ok(/from "\.\.\/src\/check\.mjs"/.test(src), "imports runCheck from check.mjs");
});
