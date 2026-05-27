import fs from "node:fs";
import path from "node:path";
import { STEPS } from "./lib.mjs";

/** Allowed values for state.md frontmatter `status`. */
export const STATUSES = ["in-progress", "blocked", "done"];

/**
 * Machine-checkable contract per artifact. `sections` are required `##`
 * headings (present + non-empty + no unfilled `<placeholder>`). Extra rules:
 * `minItems` (>=N list items), `requireDash` (each list item contains " — "),
 * `requireCheckbox` (>=1 `- [ ]`/`- [x]`; "__preamble__" targets the preamble),
 * `frontmatter`/`enums` (state.md only), `h1` (required H1 prefix, no `<>`).
 */
export const SCHEMAS = {
  context: {
    h1: "Context",
    sections: [
      "Intent",
      "Acceptance criteria",
      "Files / modules in play",
      "Constraints",
      "Risks",
      "Out of scope",
      "Open questions",
    ],
    minItems: { "Acceptance criteria": 1, "Out of scope": 1 },
  },
  plan: {
    h1: "Plan",
    sections: [
      "Approach",
      "Changes (file by file)",
      "Test strategy",
      "Definition of done",
      "Risks & mitigations",
    ],
    minItems: { "Changes (file by file)": 1, "Test strategy": 1 },
    requireDash: ["Changes (file by file)"],
    requireCheckbox: ["Definition of done"],
  },
  review: {
    h1: "Review",
    sections: ["Blocking", "Important", "Minor", "Resolutions"],
  },
  uat: {
    h1: "UAT",
    sections: ["Result"],
    requireCheckbox: ["__preamble__"],
  },
  pr: {
    h1: null,
    sections: ["Summary", "Verification"],
  },
  state: {
    h1: "State",
    frontmatter: ["ticket", "current_step", "status", "driving_engine", "updated"],
    enums: { current_step: STEPS, status: STATUSES },
    sections: [
      "Completed",
      "Decisions & deviations",
      "Next action",
      "Gotchas for the next runner",
    ],
  },
};

/**
 * Split artifact markdown into `{ h1, preamble, sections }`. `h1` is the text
 * after the first `# ` (or null). `preamble` is the trimmed text between the H1
 * and the first `## `. `sections` maps each `## heading` to its trimmed body.
 */
export function parseSections(text) {
  let h1 = null;
  let current = null; // null === still in the preamble
  const preamble = [];
  const sections = {};
  for (const line of text.split("\n")) {
    const h1m = line.match(/^#(?!#)\s+(.*)$/);
    const h2m = line.match(/^##\s+(.*)$/);
    if (h2m) {
      current = h2m[1].trim();
      sections[current] = [];
      continue;
    }
    if (h1m && h1 === null && current === null) {
      h1 = h1m[1].trim();
      continue;
    }
    (current === null ? preamble : sections[current]).push(line);
  }
  const out = {};
  for (const [k, v] of Object.entries(sections)) out[k] = v.join("\n").trim();
  return { h1, preamble: preamble.join("\n").trim(), sections: out };
}

/**
 * Parse a leading `---`-fenced frontmatter block into a flat object of
 * `key -> value` (string). Returns null when the text has no frontmatter.
 * Only flat `key: value` lines are recognised (nested YAML is not supported).
 */
export function parseFrontmatter(text) {
  const block = text.replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---/);
  if (!block) return null;
  const fm = {};
  for (const line of block[1].split("\n")) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return fm;
}

// A placeholder is `<...>` with no space right after `<` (e.g. `<TICKET-ID>`,
// `<Claude Code | Codex>`). The no-space rule avoids matching comparison prose
// like "x < 10 > 0", where operators are written with surrounding spaces.
const PLACEHOLDER_RE = /<[^\s>][^>\n]*>/;

/** Trimmed list items (`- ` / `* `) in a section body, including checkboxes. */
function listItems(body) {
  return body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[-*]\s+/.test(l));
}

/** True when the body contains at least one `- [ ]` / `- [x]` checkbox. */
function hasCheckbox(body) {
  return /^[-*]\s+\[[ xX]\]/m.test(body);
}

/**
 * Structurally validate one artifact's text against its schema. Returns
 * `{ errors, warnings }`. `errors` block; `warnings` are advisory. Quality is
 * out of scope — only structure is checked.
 */
export function validateArtifact(name, text, schema) {
  const errors = [];
  const warnings = [];
  const { h1, preamble, sections } = parseSections(text);

  if (schema.frontmatter) {
    const fm = parseFrontmatter(text);
    if (!fm) {
      errors.push(`${name}: missing frontmatter block`);
    } else {
      for (const key of schema.frontmatter) {
        if (!fm[key]) errors.push(`${name}: frontmatter missing "${key}"`);
      }
      for (const [key, allowed] of Object.entries(schema.enums ?? {})) {
        if (fm[key] && !allowed.includes(fm[key])) {
          errors.push(
            `${name}: frontmatter ${key}="${fm[key]}" not one of ${allowed.join("|")}`,
          );
        }
      }
    }
  }

  if (schema.h1) {
    if (!h1 || !h1.startsWith(`${schema.h1}: `) || /[<>]/.test(h1)) {
      errors.push(`${name}: H1 must be "# ${schema.h1}: <id>" with a real id`);
    }
  }

  for (const sec of schema.sections ?? []) {
    if (!(sec in sections)) {
      errors.push(`${name}: missing section "## ${sec}"`);
      continue;
    }
    const body = sections[sec];
    if (!body) {
      errors.push(`${name}: section "## ${sec}" is empty (write "None" if intentional)`);
    } else if (PLACEHOLDER_RE.test(body)) {
      errors.push(`${name}: section "## ${sec}" has an unfilled <placeholder>`);
    }
  }

  for (const [sec, n] of Object.entries(schema.minItems ?? {})) {
    if (!(sec in sections)) continue; // missing-section already reported above
    if (listItems(sections[sec]).length < n) {
      errors.push(`${name}: "## ${sec}" needs at least ${n} list item(s)`);
    }
  }

  for (const sec of schema.requireDash ?? []) {
    if (!(sec in sections)) continue; // missing-section already reported above
    for (const item of listItems(sections[sec])) {
      if (!item.includes(" — ")) {
        errors.push(`${name}: "## ${sec}" item lacks " — " (path — change): ${item}`);
      }
    }
  }

  for (const sec of schema.requireCheckbox ?? []) {
    if (sec !== "__preamble__" && !(sec in sections)) continue;
    const body = sec === "__preamble__" ? preamble : sections[sec];
    if (!hasCheckbox(body)) {
      const where = sec === "__preamble__" ? "walkthrough steps" : `"## ${sec}"`;
      errors.push(`${name}: ${where} needs at least one checkbox`);
    }
  }

  return { errors, warnings };
}

/** True when state's current_step is at/after `target` (target counts only if done). */
function stepReached(fm, target) {
  if (!fm) return false;
  const cur = STEPS.indexOf(fm.current_step);
  const want = STEPS.indexOf(target);
  if (cur === -1 || want === -1) return false;
  return cur > want || (cur === want && fm.status === "done");
}

/**
 * Validate that `dir` (a `.work/<TICKET>/`) is ready to ENTER `step`, applying
 * the cross-artifact gates. Returns `{ errors, warnings }`.
 */
export function checkReadiness(dir, step) {
  const errors = [];
  const warnings = [];
  const readArtifact = (n) => {
    const p = path.join(dir, `${n}.md`);
    return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
  };
  const requireValid = (n) => {
    const text = readArtifact(n);
    if (text === null) {
      errors.push(`missing ${n}.md`);
      return null;
    }
    errors.push(...validateArtifact(n, text, SCHEMAS[n]).errors);
    return text;
  };
  const openQuestionsResolved = (ctxText) => {
    const { sections } = parseSections(ctxText);
    if (/^[-*]\s+\[ \]/m.test(sections["Open questions"] ?? "")) {
      errors.push("context.md has unresolved Open questions (unchecked [ ])");
    }
  };

  switch (step) {
    case "frame":
      break;
    case "plan": {
      const ctx = requireValid("context");
      if (ctx !== null) openQuestionsResolved(ctx);
      break;
    }
    case "review": {
      requireValid("context");
      requireValid("plan");
      break;
    }
    case "build": {
      const ctx = requireValid("context");
      if (ctx !== null) openQuestionsResolved(ctx);
      requireValid("plan");
      const review = readArtifact("review");
      if (review !== null) {
        const { sections } = parseSections(review);
        const blocking = (sections.Blocking ?? "").trim();
        const resolutions = (sections.Resolutions ?? "").trim();
        const hasBlocking = blocking !== "" && blocking !== "None";
        if (hasBlocking && (resolutions === "" || resolutions === "None")) {
          errors.push("review.md has Blocking items but no Resolutions");
        }
      }
      break;
    }
    case "verify": {
      requireValid("plan");
      const state = readArtifact("state");
      if (state !== null && !stepReached(parseFrontmatter(state), "build")) {
        errors.push("state.md does not show build complete");
      }
      break;
    }
    case "ship": {
      const uat = requireValid("uat");
      if (uat !== null) {
        const { sections } = parseSections(uat);
        if (!/^\s*pass/im.test(sections.Result ?? "")) {
          errors.push("uat.md Result is not pass (developer override is manual)");
        }
      }
      break;
    }
    default:
      errors.push(`unknown step: ${step}`);
  }

  return { errors, warnings };
}

/**
 * Human-readable `state.md` baton lines for `quark check <TICKET>` (no --for):
 * a deterministic answer to "where am I?". `text` is the state.md contents, or
 * null when the file is absent. Never throws.
 */
export function batonSummary(ticket, text) {
  if (text === null) {
    return [`Baton for ${ticket}: no state.md yet (new ticket)`];
  }
  const fm = parseFrontmatter(text);
  if (!fm || !fm.current_step) {
    return [`Baton for ${ticket}: no baton (state.md unreadable)`];
  }
  const { sections } = parseSections(text);
  const next =
    (sections["Next action"] ?? "")
      .split("\n")
      .map((l) => l.replace(/^[-*]\s*(\[[ xX]\]\s*)?/, "").trim())
      .find((l) => l) ?? "—";
  return [
    `Baton for ${ticket} (from state.md):`,
    `  step: ${fm.current_step} (${fm.status ?? "?"}) · driver: ${
      fm.driving_engine ?? "?"
    } · updated: ${fm.updated ?? "?"}`,
    `  next: ${next}`,
  ];
}

/**
 * Run the validator for a ticket. With `step`, checks readiness to enter it;
 * without, validates every artifact present. Returns `{ code, lines }`:
 * code 0 = pass, 1 = validation failure, 2 = usage error. Does no printing.
 */
export function runCheck({ ticket, step = null, cwd = process.cwd() }) {
  if (!ticket) {
    return { code: 2, lines: ["usage: quark check <TICKET> [--for <step>]"] };
  }
  const dir = path.join(cwd, ".work", ticket);
  if (!fs.existsSync(dir)) {
    return { code: 2, lines: [`no .work/${ticket}/ directory (run from the repo root)`] };
  }
  const lines = [];
  let errors = [];
  let warnings = [];
  if (step) {
    const r = checkReadiness(dir, step);
    errors = r.errors;
    warnings = r.warnings;
    lines.push(`Readiness for "${step}" on ${ticket}:`);
  } else {
    const statePath = path.join(dir, "state.md");
    const stateText = fs.existsSync(statePath)
      ? fs.readFileSync(statePath, "utf8")
      : null;
    lines.push(...batonSummary(ticket, stateText));
    for (const name of Object.keys(SCHEMAS)) {
      const p = path.join(dir, `${name}.md`);
      if (!fs.existsSync(p)) continue;
      const r = validateArtifact(name, fs.readFileSync(p, "utf8"), SCHEMAS[name]);
      errors.push(...r.errors);
      warnings.push(...r.warnings);
    }
    lines.push(`Artifacts for ${ticket}:`);
  }
  for (const e of errors) lines.push(`  ERROR  ${e}`);
  for (const w of warnings) lines.push(`  WARN   ${w}`);
  if (errors.length === 0 && warnings.length === 0) lines.push("  OK");
  return { code: errors.length ? 1 : 0, lines };
}
