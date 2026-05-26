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
 * Compose and write one self-contained skill per name into outDir, as
 * `<prefix><name>/SKILL.md`. Reads source playbooks/templates from `root`.
 * Loop steps get `_shared.md` (`includeShared`); utilities do not. When
 * `sidecar` is `{ dest, content }`, also writes that file inside each skill dir
 * (e.g. `agents/openai.yaml`). Returns the skill directories written.
 * Idempotent: overwrites the files it owns.
 */
export function installEngine({
  headerTemplate,
  outDir,
  root,
  names = STEPS,
  prefix = "quark-",
  includeShared = true,
  sidecar = null,
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
    const skillDir = path.join(outDir, `${prefix}${name}`);
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), content);
    if (sidecar) {
      const dest = path.join(skillDir, sidecar.dest);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, sidecar.content);
    }
    written.push(skillDir);
  }
  return written;
}

/** Per-engine skill root, templates, sidecar, and legacy (v0.3.0) dir. */
export function engineTargets(home = os.homedir()) {
  return {
    claude: {
      loopTemplate: "shims/claude.md",
      configTemplate: "shims/claude-config.md",
      outDir: path.join(home, ".claude", "skills"),
      sidecar: null,
      legacyDir: path.join(home, ".claude", "commands"),
    },
    codex: {
      loopTemplate: "shims/codex.md",
      configTemplate: "shims/codex-config.md",
      outDir: path.join(home, ".agents", "skills"),
      sidecar: { src: "shims/codex-openai.yaml", dest: "agents/openai.yaml" },
      legacyDir: path.join(home, ".codex", "prompts"),
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
 * Remove the skill directories Quark owns (`${prefix}${name}/`) from outDir.
 * Only deletes exact known names; never globs. Returns the paths removed.
 */
export function uninstallEngine({ outDir, names, prefix = "quark-" }) {
  const removed = [];
  for (const name of names) {
    const skillDir = path.join(outDir, `${prefix}${name}`);
    if (fs.existsSync(skillDir)) {
      fs.rmSync(skillDir, { recursive: true, force: true });
      removed.push(skillDir);
    }
  }
  return removed;
}

/**
 * Remove the v0.3.0 flat command files (`${prefix}${name}.md`) from a legacy
 * directory. Only deletes exact known names; never globs. Tolerates a missing
 * directory. Returns the paths removed.
 */
export function sweepLegacy({ legacyDir, names, prefix = "quark-" }) {
  const removed = [];
  for (const name of names) {
    const target = path.join(legacyDir, `${prefix}${name}.md`);
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
 * Install all Quark skills for the given engines, composing self-contained
 * `<name>/SKILL.md` dirs (plus the Codex sidecar) into each engine's skill
 * root under `home`, then sweeping any leftover v0.3.0 flat command files.
 * `root` is the source tree. Returns per-engine summaries.
 */
export function install({ engines, root, home = os.homedir() }) {
  const targets = engineTargets(home);
  const allNames = [...STEPS, ...UTILITIES];
  const results = [];
  for (const engine of engines) {
    const { loopTemplate, configTemplate, outDir, sidecar, legacyDir } =
      targets[engine];
    const loopHeader = fs.readFileSync(path.join(root, loopTemplate), "utf8");
    const configHeader = fs.readFileSync(
      path.join(root, configTemplate),
      "utf8",
    );
    const resolvedSidecar = sidecar
      ? {
          dest: sidecar.dest,
          content: fs.readFileSync(path.join(root, sidecar.src), "utf8"),
        }
      : null;
    const loop = installEngine({
      headerTemplate: loopHeader,
      outDir,
      root,
      names: STEPS,
      includeShared: true,
      sidecar: resolvedSidecar,
    });
    const util = installEngine({
      headerTemplate: configHeader,
      outDir,
      root,
      names: UTILITIES,
      includeShared: false,
      sidecar: resolvedSidecar,
    });
    const legacy = sweepLegacy({ legacyDir, names: allNames });
    results.push({
      engine,
      outDir,
      count: loop.length + util.length,
      legacyRemoved: legacy.length,
    });
  }
  return results;
}

/**
 * Uninstall all Quark skills for the given engines from their skill roots under
 * `home`, and sweep any leftover v0.3.0 flat command files. Returns per-engine
 * summaries with the counts removed.
 */
export function uninstall({ engines, home = os.homedir() }) {
  const targets = engineTargets(home);
  const names = [...STEPS, ...UTILITIES];
  const results = [];
  for (const engine of engines) {
    const { outDir, legacyDir } = targets[engine];
    const removed = uninstallEngine({ outDir, names });
    const legacy = sweepLegacy({ legacyDir, names });
    results.push({
      engine,
      outDir,
      count: removed.length,
      legacyRemoved: legacy.length,
    });
  }
  return results;
}
