import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

export const STEPS = ["frame", "plan", "review", "build", "verify", "ship"];

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
 * Generate one command file per STEP into outDir by rendering `template`.
 * Returns the list of absolute paths written. Idempotent: overwrites only
 * files named `${prefix}${step}.md`, never touching anything else.
 */
export function installEngine({ template, outDir, root, prefix = "quark-" }) {
  fs.mkdirSync(outDir, { recursive: true });
  const written = [];
  for (const step of STEPS) {
    const target = path.join(outDir, `${prefix}${step}.md`);
    fs.writeFileSync(target, renderShim(template, { root, step }));
    written.push(target);
  }
  return written;
}

/**
 * Ensure `entry` is present on its own line in <repoDir>/.gitignore.
 * Returns true if it added the entry, false if it was already present.
 */
export function ensureGitignoreEntry(repoDir, entry) {
  const giPath = path.join(repoDir, ".gitignore");
  let current = "";
  if (fs.existsSync(giPath)) current = fs.readFileSync(giPath, "utf8");
  const present = current
    .split("\n")
    .some((line) => line.trim() === entry);
  if (present) return false;
  const sep = current.length && !current.endsWith("\n") ? "\n" : "";
  fs.appendFileSync(giPath, `${sep}${entry}\n`);
  return true;
}

/** Default command directory for each engine. */
export function engineTargets(home = os.homedir()) {
  return {
    claude: {
      template: "shims/claude.md",
      outDir: path.join(home, ".claude", "commands"),
    },
    codex: {
      template: "shims/codex.md",
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

/**
 * Symlink <repoDir>/AGENTS.md -> CLAUDE.md so Codex shares the steering doc.
 * Returns one of: "linked", "skipped-exists", "skipped-no-claude",
 * "already-linked".
 */
export function ensureAgentsSymlink(repoDir) {
  const claude = path.join(repoDir, "CLAUDE.md");
  const agents = path.join(repoDir, "AGENTS.md");
  // existsSync (follows symlinks) is intentional: only alias AGENTS.md when
  // CLAUDE.md actually resolves. AGENTS.md uses lstatSync below to detect any
  // inode — including a dangling link — so an existing one is never clobbered.
  if (!fs.existsSync(claude)) return "skipped-no-claude";
  let stat = null;
  try {
    stat = fs.lstatSync(agents);
  } catch {
    stat = null;
  }
  if (stat) {
    if (stat.isSymbolicLink() && fs.readlinkSync(agents) === "CLAUDE.md") {
      return "already-linked";
    }
    return "skipped-exists";
  }
  fs.symlinkSync("CLAUDE.md", agents);
  return "linked";
}
