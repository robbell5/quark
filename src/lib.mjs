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

/** Read all `templates/*.md` from the source root into a name→content map. */
function readTemplates(root) {
  const dir = path.join(root, "templates");
  const map = {};
  if (!fs.existsSync(dir)) return map;
  for (const file of fs.readdirSync(dir)) {
    if (file.endsWith(".md")) {
      map[path.basename(file, ".md")] = fs.readFileSync(
        path.join(dir, file),
        "utf8",
      );
    }
  }
  return map;
}

/**
 * Compose and write one self-contained command file per name into outDir,
 * reading source playbooks/templates from `root`. Loop steps get `_shared.md`
 * (`includeShared`); utilities do not. Returns the absolute paths written.
 * Idempotent: overwrites only files named `${prefix}${name}.md`.
 */
export function installEngine({
  headerTemplate,
  outDir,
  root,
  names = STEPS,
  prefix = "quark-",
  includeShared = true,
}) {
  fs.mkdirSync(outDir, { recursive: true });
  const sharedText = includeShared
    ? fs.readFileSync(path.join(root, "playbook/_shared.md"), "utf8")
    : "";
  const templates = readTemplates(root);
  const written = [];
  for (const name of names) {
    const stepText = fs.readFileSync(
      path.join(root, `playbook/${name}.md`),
      "utf8",
    );
    const content = composeCommand({
      header: headerTemplate,
      step: name,
      sharedText,
      stepText,
      templates,
    });
    const target = path.join(outDir, `${prefix}${name}.md`);
    fs.writeFileSync(target, content);
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

/**
 * Names of templates referenced as `templates/<name>.md` in the given text,
 * in first-seen order, limited to templates we actually have content for.
 */
function referencedTemplates(stepText, templates) {
  const found = [];
  const re = /templates\/([\w-]+)\.md/g;
  let m;
  while ((m = re.exec(stepText)) !== null) {
    const name = m[1];
    if (templates[name] && !found.includes(name)) found.push(name);
  }
  return found;
}

const FENCE = "`".repeat(3);

/**
 * Compose one self-contained command file. Pure: operates on strings only.
 * Order: rendered header, then shared conventions (if any), then the step body,
 * then a Templates appendix for each `templates/<name>.md` the step references.
 *
 * Only `{{STEP}}` is substituted (not `{{QUARK_ROOT}}`): this inlines real
 * content, not file paths. The Templates appendix is driven solely by
 * `templates/<name>.md` references in `stepText`; `sharedText` is not scanned.
 */
export function composeCommand({
  header,
  step,
  sharedText = "",
  stepText = "",
  templates = {},
}) {
  const parts = [header.replaceAll("{{STEP}}", step).trimEnd()];
  if (sharedText) parts.push(sharedText.trim());
  parts.push(stepText.trim());
  const refs = referencedTemplates(stepText, templates);
  if (refs.length) {
    const blocks = refs.map(
      (name) =>
        `### templates/${name}.md\n\n${FENCE}markdown\n${templates[name].trim()}\n${FENCE}`,
    );
    parts.push(`## Templates\n\n${blocks.join("\n\n")}`);
  }
  return parts.join("\n\n") + "\n";
}

/**
 * Remove the command files Quark owns (`${prefix}${name}.md`) from outDir.
 * Only deletes exact known names; never globs. Returns the paths removed.
 */
export function uninstallEngine({ outDir, names, prefix = "quark-" }) {
  const removed = [];
  for (const name of names) {
    const target = path.join(outDir, `${prefix}${name}.md`);
    if (fs.existsSync(target)) {
      fs.rmSync(target);
      removed.push(target);
    }
  }
  return removed;
}

/**
 * Parse argv into { command, engines, dryRun }. The first non-flag positional
 * is the subcommand (default "install"); flags are --claude, --codex, --dry-run.
 */
export function parseArgs(argv) {
  const positional = argv.filter((a) => !a.startsWith("--"));
  const command = positional[0] ?? "install";
  const wantClaude = argv.includes("--claude");
  const wantCodex = argv.includes("--codex");
  const engines =
    wantClaude || wantCodex
      ? [wantClaude && "claude", wantCodex && "codex"].filter(Boolean)
      : ["claude", "codex"];
  return { command, engines, dryRun: argv.includes("--dry-run") };
}

/**
 * Install all Quark commands for the given engines, composing self-contained
 * files into each engine's command dir under `home`. `root` is the source tree
 * (where playbook/, templates/, shims/ live). Returns per-engine summaries.
 */
export function install({ engines, root, home = os.homedir() }) {
  const targets = engineTargets(home);
  const results = [];
  for (const engine of engines) {
    const { loopTemplate, configTemplate, outDir } = targets[engine];
    const loopHeader = fs.readFileSync(path.join(root, loopTemplate), "utf8");
    const configHeader = fs.readFileSync(path.join(root, configTemplate), "utf8");
    const loop = installEngine({
      headerTemplate: loopHeader,
      outDir,
      root,
      names: STEPS,
      includeShared: true,
    });
    const util = installEngine({
      headerTemplate: configHeader,
      outDir,
      root,
      names: UTILITIES,
      includeShared: false,
    });
    results.push({ engine, outDir, count: loop.length + util.length });
  }
  return results;
}

/**
 * Uninstall all Quark commands for the given engines from their command dirs
 * under `home`. Returns per-engine summaries with the count removed.
 */
export function uninstall({ engines, home = os.homedir() }) {
  const targets = engineTargets(home);
  const names = [...STEPS, ...UTILITIES];
  const results = [];
  for (const engine of engines) {
    const { outDir } = targets[engine];
    const removed = uninstallEngine({ outDir, names });
    results.push({ engine, outDir, count: removed.length });
  }
  return results;
}
