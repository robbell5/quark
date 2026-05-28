import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

export const STEPS = ["frame", "plan", "review", "build", "verify", "ship"];

/** Non-loop utility commands, generated from the reviewer-free config shims. */
export const UTILITIES = ["config"];

/** Sub-agent workers, composed per-engine from shared specs in `agents/`. */
export const AGENTS = ["explorer"];

/**
 * Resolve the Quark repo root from a module URL inside src/.
 * src/lib.mjs lives one level below the repo root.
 */
export function resolveQuarkRoot(moduleUrl) {
  const here = path.dirname(fileURLToPath(moduleUrl));
  return path.resolve(here, "..");
}

/**
 * Split an agent spec (`agents/<name>.md`) into { description, readOnly, body }.
 * Frontmatter is a leading `---`-fenced block of flat `key: value` lines; the
 * body is everything after it. A quoted description is unquoted. Throws when the
 * frontmatter block is absent. Kept local (not reused from check.mjs) to avoid a
 * lib<->check import cycle.
 */
export function parseAgentSpec(text) {
  const norm = text.replace(/\r\n/g, "\n");
  const m = norm.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error("agent spec missing frontmatter block");
  const fm = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  const description = (fm.description ?? "").replace(/^["']|["']$/g, "");
  const readOnly = (fm.read_only ?? "").split("#")[0].trim().toLowerCase() === "true";
  return { description, readOnly, body: m[2].trim() };
}

/** Read all `<dir>/*.md` from the source root into a name→content map. */
function readMarkdownDir(root, dir) {
  const d = path.join(root, dir);
  const map = {};
  if (!fs.existsSync(d)) return map;
  for (const file of fs.readdirSync(d)) {
    if (file.endsWith(".md")) {
      map[path.basename(file, ".md")] = fs.readFileSync(
        path.join(d, file),
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
  const templates = readMarkdownDir(root, "templates");
  const examples = readMarkdownDir(root, "examples");
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
      examples,
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
      agentTemplate: "shims/claude-agent.md",
      outDir: path.join(home, ".claude", "skills"),
      agentsDir: path.join(home, ".claude", "agents"),
      sidecar: null,
      legacyDir: path.join(home, ".claude", "commands"),
    },
    codex: {
      loopTemplate: "shims/codex.md",
      configTemplate: "shims/codex-config.md",
      agentTemplate: "shims/codex-agent.toml",
      outDir: path.join(home, ".agents", "skills"),
      agentsDir: path.join(home, ".codex", "agents"),
      sidecar: { src: "shims/codex-openai.yaml", dest: "agents/openai.yaml" },
      legacyDir: path.join(home, ".codex", "prompts"),
    },
  };
}

/**
 * Names referenced as `<dir>/<name>.md` in the given text, in first-seen order,
 * limited to names we actually have content for. Uses matchAll, not a loop.
 */
function referenced(stepText, map, dir) {
  const re = new RegExp(`${dir}/([\\w-]+)\\.md`, "g");
  const found = [];
  for (const m of stepText.matchAll(re)) {
    if (map[m[1]] && !found.includes(m[1])) found.push(m[1]);
  }
  return found;
}

const FENCE = "`".repeat(3);

/**
 * Compose one self-contained command file. Pure: operates on strings only.
 * Order: rendered header, shared conventions (if any), the step body, then a
 * Templates appendix and an Examples appendix for each `templates/<name>.md` /
 * `examples/<name>.md` the step references (first-seen order).
 *
 * Only `{{STEP}}` is substituted: this inlines real content, not file paths.
 * Appendices are driven solely by references in `stepText`; `sharedText` is
 * not scanned.
 */
export function composeCommand({
  header,
  step,
  sharedText = "",
  stepText = "",
  templates = {},
  examples = {},
}) {
  const parts = [header.replaceAll("{{STEP}}", step).trimEnd()];
  if (sharedText) parts.push(sharedText.trim());
  parts.push(stepText.trim());
  const appendix = (title, dir, map) => {
    const refs = referenced(stepText, map, dir);
    if (!refs.length) return null;
    const blocks = refs.map(
      (name) =>
        `### ${dir}/${name}.md\n\n${FENCE}markdown\n${map[name].trim()}\n${FENCE}`,
    );
    return `## ${title}\n\n${blocks.join("\n\n")}`;
  };
  const templatesBlock = appendix("Templates", "templates", templates);
  if (templatesBlock) parts.push(templatesBlock);
  const examplesBlock = appendix("Examples", "examples", examples);
  if (examplesBlock) parts.push(examplesBlock);
  return parts.join("\n\n") + "\n";
}

/**
 * Per-engine rendering of an agent's access level, keyed by read-only-ness.
 * Read-only is the only level today (the explorer); the code-writing executor
 * pass adds a `readWrite` entry per engine.
 */
const AGENT_ACCESS = {
  claude: { readOnly: 'tools: ["Read", "Grep", "Glob"]' },
  codex: { readOnly: 'sandbox_mode = "read-only"' },
};

/**
 * Compose one self-contained agent definition for an engine. Pure: string
 * substitution only. Substitutes {{AGENT}}, {{DESCRIPTION}}, {{ACCESS}} (the
 * engine's access directive, from `readOnly`), and {{BODY}} (worker
 * instructions). Returns the rendered file content.
 */
export function composeAgent({ header, engine, agent, description, body, readOnly }) {
  const key = readOnly ? "readOnly" : "readWrite";
  const access = AGENT_ACCESS[engine]?.[key] ?? "";
  return (
    header
      .replaceAll("{{AGENT}}", agent)
      .replaceAll("{{DESCRIPTION}}", description)
      .replaceAll("{{ACCESS}}", access)
      .replaceAll("{{BODY}}", body)
      .trimEnd() + "\n"
  );
}

/**
 * Compose and write one self-contained agent file per name into outDir, as
 * `<prefix><name>.<ext>` (`.md` for Claude, `.toml` for Codex). Reads each
 * shared spec from `agents/<name>.md` under `root`. Idempotent: overwrites the
 * files it owns. Returns the file paths written.
 */
export function installEngineAgents({
  shimTemplate, engine, outDir, root, names = AGENTS, prefix = "quark-",
}) {
  fs.mkdirSync(outDir, { recursive: true });
  const ext = engine === "codex" ? "toml" : "md";
  const written = [];
  for (const name of names) {
    const spec = fs.readFileSync(path.join(root, `agents/${name}.md`), "utf8");
    const { description, readOnly, body } = parseAgentSpec(spec);
    const content = composeAgent({
      header: shimTemplate, engine, agent: name, description, body, readOnly,
    });
    const file = path.join(outDir, `${prefix}${name}.${ext}`);
    fs.writeFileSync(file, content);
    written.push(file);
  }
  return written;
}

/**
 * Remove the agent files Quark owns (`<prefix><name>.<ext>`) from outDir. Only
 * deletes exact known names; never globs. Returns the paths removed.
 */
export function uninstallEngineAgents({
  engine, outDir, names = AGENTS, prefix = "quark-",
}) {
  const ext = engine === "codex" ? "toml" : "md";
  const removed = [];
  for (const name of names) {
    const file = path.join(outDir, `${prefix}${name}.${ext}`);
    if (fs.existsSync(file)) {
      fs.rmSync(file);
      removed.push(file);
    }
  }
  return removed;
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
 * Parse argv into { command, ticket, gate, forStep, by, waive, verdict, note,
 * engines, dryRun }. The first non-flag positional is the subcommand (default
 * "install"); the second is the ticket; the third is the gate name (used by
 * `gate`). Value-flags: --for <step> (readiness target for `check`),
 * --by <author>, --waive <reason>, --verdict <value>, --note <text> (all for
 * `gate`). Boolean flags: --claude, --codex, --dry-run.
 */
export function parseArgs(argv) {
  const skip = new Set();
  const flagValue = (name) => {
    const i = argv.indexOf(name);
    if (i === -1) return null;
    skip.add(i);
    skip.add(i + 1);
    return argv[i + 1] ?? null;
  };
  const forStep = flagValue("--for");
  const by = flagValue("--by");
  const waive = flagValue("--waive");
  const verdict = flagValue("--verdict");
  const note = flagValue("--note");
  const positional = argv.filter((a, i) => !a.startsWith("--") && !skip.has(i));
  const command = positional[0] ?? "install";
  const ticket = positional[1] ?? null;
  const gate = positional[2] ?? null;
  const wantClaude = argv.includes("--claude");
  const wantCodex = argv.includes("--codex");
  const engines =
    wantClaude || wantCodex
      ? [wantClaude && "claude", wantCodex && "codex"].filter(Boolean)
      : ["claude", "codex"];
  return {
    command, ticket, gate, forStep, by, waive, verdict, note,
    engines, dryRun: argv.includes("--dry-run"),
  };
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
    const { loopTemplate, configTemplate, agentTemplate, outDir, agentsDir, sidecar, legacyDir } =
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
    const agentShim = fs.readFileSync(path.join(root, agentTemplate), "utf8");
    const agents = installEngineAgents({
      shimTemplate: agentShim, engine, outDir: agentsDir, root,
    });
    const legacy = sweepLegacy({ legacyDir, names: allNames });
    results.push({
      engine,
      outDir,
      count: loop.length + util.length,
      agents: agents.length,
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
    const { outDir, agentsDir, legacyDir } = targets[engine];
    const removed = uninstallEngine({ outDir, names });
    const agents = uninstallEngineAgents({ engine, outDir: agentsDir, names: AGENTS });
    const legacy = sweepLegacy({ legacyDir, names });
    results.push({
      engine,
      outDir,
      count: removed.length,
      agents: agents.length,
      legacyRemoved: legacy.length,
    });
  }
  return results;
}
