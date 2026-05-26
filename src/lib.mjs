import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

export const STEPS = ["frame", "plan", "review", "build", "verify", "ship"];

/** Non-loop utility commands, generated from the reviewer-free config shims. */
export const UTILITIES = ["config"];

/**
 * Resolve the Quark repo root from a module URL inside src/.
 * src/lib.mjs lives one level below the repo root.
 */
export function resolveQuarkRoot(moduleUrl) {
  const here = path.dirname(fileURLToPath(moduleUrl));
  return path.resolve(here, "..");
}

/** Substitute {{QUARK_ROOT}} and {{STEP}} in a shim template. */
export function renderShim(template, { root, step }) {
  return template
    .replaceAll("{{QUARK_ROOT}}", root)
    .replaceAll("{{STEP}}", step);
}

/**
 * Generate one command file per name in `steps` (default STEPS) into outDir by
 * rendering `template`. Returns the list of absolute paths written. Idempotent:
 * overwrites only files named `${prefix}${name}.md`, never anything else.
 */
export function installEngine({
  template,
  outDir,
  root,
  steps = STEPS,
  prefix = "quark-",
}) {
  fs.mkdirSync(outDir, { recursive: true });
  const written = [];
  for (const step of steps) {
    const target = path.join(outDir, `${prefix}${step}.md`);
    fs.writeFileSync(target, renderShim(template, { root, step }));
    written.push(target);
  }
  return written;
}

/** Loop + config template paths and command directory for each engine. */
export function engineTargets(home = os.homedir()) {
  return {
    claude: {
      loopTemplate: "shims/claude.md",
      configTemplate: "shims/claude-config.md",
      outDir: path.join(home, ".claude", "commands"),
    },
    codex: {
      loopTemplate: "shims/codex.md",
      configTemplate: "shims/codex-config.md",
      outDir: path.join(home, ".codex", "prompts"),
    },
  };
}

/** Parse argv flags: --claude, --codex (default both), --dry-run. */
export function parseArgs(argv) {
  const wantClaude = argv.includes("--claude");
  const wantCodex = argv.includes("--codex");
  const engines =
    wantClaude || wantCodex
      ? [wantClaude && "claude", wantCodex && "codex"].filter(Boolean)
      : ["claude", "codex"];
  return { engines, dryRun: argv.includes("--dry-run") };
}

