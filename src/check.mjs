import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { STEPS } from "./lib.mjs";

/** Allowed values for state.md frontmatter `status`. */
export const STATUSES = ["in-progress", "blocked", "done"];

/**
 * Allowed review verdicts recorded in state.md `gate_review`: `passed` (no
 * gaps), `resolved` (gaps closed via the plan ⇄ review loop), `accepted` (gaps
 * consciously accepted, with a note). Single source of truth for `runGate`
 * (input) and `checkReadiness` (gate).
 */
export const REVIEW_VERDICTS = ["passed", "resolved", "accepted"];
const REVIEW_VERDICT_RE = new RegExp(`^(${REVIEW_VERDICTS.join("|")})\\b`);

/**
 * Machine-checkable contract per artifact. `sections` are required `##`
 * headings (present + non-empty + no unfilled `<placeholder>`). Extra rules:
 * `minItems` (>=N list items), `requireDash` (each list item contains " — "),
 * `requireCheckbox` (>=1 `- [ ]`/`- [x]`; "__preamble__" targets the preamble),
 * `frontmatter`/`enums` (state.md only), `h1` (required H1 prefix, no `<>`),
 * `acIds` (the named section's list items must be `- ACn: <text>`-shaped).
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
      "Sensitivity",
      "Open questions",
    ],
    minItems: { "Acceptance criteria": 1, "Out of scope": 1 },
    acIds: "Acceptance criteria",
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

/**
 * A 12-char hex digest of a plan's content, computed over its `##` section
 * bodies with whitespace collapsed and sections name-sorted. Stable under
 * markdownlint reflow; changes when real content changes. Used to bind a
 * recorded approval/review to the exact plan it cleared.
 */
export function planHash(planText) {
  const { sections } = parseSections(planText);
  const norm = Object.entries(sections)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, body]) => `${name}\n${body.replace(/\s+/g, " ").trim()}`)
    .join("\n");
  return crypto.createHash("sha256").update(norm).digest("hex").slice(0, 12);
}

/**
 * Return `text` with frontmatter `key` set to `value` — updating the line in
 * place if present, else appending it as the last line of the `---` block.
 * Pure. Throws when `text` has no frontmatter block, or when `value` contains a
 * newline: a single field value can never span lines, and rejecting it prevents
 * a crafted value from forging additional frontmatter fields.
 */
export function setFrontmatterField(text, key, value) {
  if (/[\r\n]/.test(value)) {
    throw new Error("setFrontmatterField: value must be single-line");
  }
  const norm = text.replace(/\r\n/g, "\n");
  const m = norm.match(/^(---\n)([\s\S]*?)(\n---)/);
  if (!m) throw new Error("setFrontmatterField: no frontmatter block");
  const keyRe = new RegExp(`^${key}:.*$`, "m");
  const line = `${key}: ${value}`;
  // Use a replacer function so `$`-sequences in `value` (`$&`, `$1`, …) are
  // inserted literally rather than interpreted as replacement patterns.
  const newBody = keyRe.test(m[2]) ? m[2].replace(keyRe, () => line) : `${m[2]}\n${line}`;
  return (
    norm.slice(0, m.index) +
    m[1] + newBody + m[3] +
    norm.slice(m.index + m[0].length)
  );
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

// Acceptance-criterion ids are the traceability spine. A definition lives in
// context's `## Acceptance criteria` as `- AC1: <text>`; downstream plan DoD /
// test-strategy items and UAT steps cite them as `(AC1)` / `(AC1, AC2)`. The
// validator enforces linkage (coverage + integrity), never prose quality.
const AC_DEF_RE = /^[-*]\s+(AC\d+):\s+\S/;
const AC_REF_RE = /\(AC\d+(?:\s*,\s*AC\d+)*\)/g;

// AC-quality heuristics — advisory warnings only, never errors. They nudge
// toward the quality bar taught in frame.md; the author judges. `AC_TEXT_RE`
// captures an AC's id and its prose so the heuristics can scan the text.
const AC_TEXT_RE = /^[-*]\s+(AC\d+):\s+(.*)$/;
const SUBJECTIVE_TERMS = [
  "robust", "clean", "maintainable", "appropriate", "appropriately",
  "proper", "properly", "user-friendly", "performant", "scalable",
  "intuitive", "seamless", "efficient", "flexible", "simple", "nice",
  "good", "reliable", "secure", "fast", "easy",
];
const SUBJECTIVE_RE = new RegExp(`\\b(${SUBJECTIVE_TERMS.join("|")})\\b`, "i");

/**
 * Parse acceptance-criterion ids from a context's `## Acceptance criteria`.
 * Returns `{ ids, errors, warnings }`: malformed items and duplicate ids are
 * errors; a non-sequential 1..N run is a warning (deleting an AC mid-stream
 * should nudge, not hard-block). Pure.
 */
export function parseAcIds(contextText) {
  const { sections } = parseSections(contextText);
  const ids = [];
  const errors = [];
  const warnings = [];
  const seen = new Set();
  for (const item of listItems(sections["Acceptance criteria"] ?? "")) {
    const m = item.match(AC_DEF_RE);
    if (!m) {
      errors.push(`context: acceptance criterion lacks an "ACn:" id: ${item}`);
      continue;
    }
    if (seen.has(m[1])) {
      errors.push(`context: duplicate acceptance-criterion id ${m[1]}`);
      continue;
    }
    seen.add(m[1]);
    ids.push(m[1]);
  }
  const expected = ids.map((_, i) => `AC${i + 1}`).join(",");
  if (ids.length && ids.join(",") !== expected) {
    warnings.push(
      `context: acceptance-criterion ids are not 1..N sequential (got ${ids.join(", ")})`,
    );
  }
  return { ids, errors, warnings };
}

/** Set of `ACn` tokens cited as `(ACn)` / `(AC1, AC2)` in a section body. */
export function collectAcRefs(body) {
  const out = new Set();
  for (const group of body.match(AC_REF_RE) ?? []) {
    for (const tok of group.match(/AC\d+/g) ?? []) out.add(tok);
  }
  return out;
}

/**
 * Advisory (never-blocking) quality warnings for a context's acceptance
 * criteria, nudging toward the quality bar in frame.md. Per AC it flags two
 * mechanical smells: a compound criterion (joined by "and" or ";") and a bare
 * subjective term ("robust", "clean", …). Outcome-shape is intentionally not
 * checked — its heuristic is too noisy; it is taught, not gated. Pure; no-ops
 * when the section is absent. False positives are acceptable: the channel is
 * advisory and the author judges.
 */
export function acQualityWarnings(contextText) {
  const { sections } = parseSections(contextText);
  const warnings = [];
  for (const item of listItems(sections["Acceptance criteria"] ?? "")) {
    const m = item.match(AC_TEXT_RE);
    if (!m) continue; // a malformed/missing id is parseAcIds' job (an error there)
    const [, id, text] = m;
    if (/\band\b/i.test(text) || text.includes(";")) {
      warnings.push(
        `context: ${id} may be compound ("… and …") — consider splitting into atomic criteria`,
      );
    }
    const sub = text.match(SUBJECTIVE_RE);
    if (sub) {
      warnings.push(
        `context: ${id} uses a subjective term ("${sub[1]}") — phrase it as an observable check`,
      );
    }
  }
  return warnings;
}

/**
 * Linkage checks against a context's acceptance-criterion ids. `coverFrom` must
 * cite every defined AC (coverage); every `(ACn)` in `integrityFrom` must
 * resolve to a defined AC (integrity). No-op when `contextText` is null or
 * defines no ACs, so AC-less tickets and context-free checks never false-reject.
 * `label` ("plan"/"uat") shapes the messages. Returns `{ errors }`.
 */
function acCoverage(contextText, { coverFrom, integrityFrom, label }) {
  const errors = [];
  if (contextText === null) return { errors };
  const { ids } = parseAcIds(contextText);
  if (ids.length === 0) return { errors };
  const defined = new Set(ids);
  const covered = collectAcRefs(coverFrom);
  const where =
    label === "plan" ? "any Definition-of-done item" : "any walkthrough step";
  for (const id of ids) {
    if (!covered.has(id)) {
      errors.push(`${label}: acceptance criterion ${id} not covered by ${where}`);
    }
  }
  for (const id of collectAcRefs(integrityFrom)) {
    if (!defined.has(id)) {
      errors.push(`${label}: cites ${id}, which is not defined in context.md`);
    }
  }
  return { errors };
}

/**
 * Structurally validate one artifact's text against its schema. Returns
 * `{ errors, warnings }`. `errors` block and check structure only; `warnings`
 * are advisory and never block — structural nudges plus AC-quality smells (see
 * `acQualityWarnings`).
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

  // Acceptance criteria must carry stable `ACn:` ids (skipped when the section
  // is missing/empty — that is already reported above).
  if (schema.acIds && sections[schema.acIds]) {
    const ac = parseAcIds(text);
    errors.push(...ac.errors);
    warnings.push(...ac.warnings);
    warnings.push(...acQualityWarnings(text));
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
 * Validate that `dir` (a `.work/<TICKET-ID>/`) is ready to ENTER `step`, applying
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
  const planCoverage = (ctxText, planText) => {
    if (ctxText === null || planText === null) return [];
    const { sections } = parseSections(planText);
    return acCoverage(ctxText, {
      coverFrom: sections["Definition of done"] ?? "",
      integrityFrom: planText,
      label: "plan",
    }).errors;
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
      const ctx = requireValid("context");
      const planText = requireValid("plan");
      errors.push(...planCoverage(ctx, planText));
      break;
    }
    case "build": {
      const ctx = requireValid("context");
      if (ctx !== null) openQuestionsResolved(ctx);
      const planText = requireValid("plan");
      errors.push(...planCoverage(ctx, planText));
      const stateText = readArtifact("state");
      const fm = stateText !== null ? parseFrontmatter(stateText) : null;

      const approval = fm?.gate_plan_approved;
      if (!approval) {
        errors.push(
          "plan not approved — run `quark gate <TICKET-ID> plan-approved --by <name>`",
        );
      } else if (planText !== null) {
        const want = planHash(planText);
        const got = (approval.match(/hash=([0-9a-f]+)/) ?? [])[1];
        if (got !== want) {
          errors.push(
            "plan changed since approval — re-run `quark gate <TICKET-ID> plan-approved`",
          );
        }
      }

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

      const verdict = (fm?.gate_review ?? "").trim();
      if (!REVIEW_VERDICT_RE.test(verdict)) {
        errors.push(
          `build needs a recorded review verdict (${REVIEW_VERDICTS.join("/")}) — run review, then \`quark gate <TICKET-ID> review --verdict <v>\``,
        );
      } else if (planText !== null) {
        const want = planHash(planText);
        const got = (verdict.match(/hash=([0-9a-f]+)/) ?? [])[1];
        if (got !== want) {
          errors.push("plan changed since review — re-run the review step");
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
        errors.push(
          ...acCoverage(readArtifact("context"), {
            coverFrom: uat,
            integrityFrom: uat,
            label: "uat",
          }).errors,
        );
      }
      break;
    }
    default:
      errors.push(`unknown step: ${step}`);
  }

  return { errors, warnings };
}

/**
 * Human-readable `state.md` baton lines for `quark check <TICKET-ID>` (no --for):
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
 * Resolve `.work/<ticket>/` under `cwd`, guarding against path traversal: a
 * `ticket` that contains `..` (or is absolute) and escapes the `.work` root
 * yields null. Pure; no filesystem access.
 */
function workDir(cwd, ticket) {
  const root = path.resolve(cwd, ".work");
  const dir = path.resolve(root, ticket);
  if (dir !== root && !dir.startsWith(root + path.sep)) return null;
  return dir;
}

/**
 * Stamp a gate outcome into `state.md`, binding it to the current plan hash.
 * `gate` is "plan-approved" or "review". Mirrors runCheck's `{ code, lines }`
 * contract; does no printing. code 0 = stamped, 2 = usage/precondition error.
 */
export function runGate({
  ticket, gate, by = null, waive = null, verdict = null, note = null,
  cwd = process.cwd(),
}) {
  if (!ticket || !gate) {
    return { code: 2, lines: ["usage: quark gate <TICKET-ID> <plan-approved|review> [--by <name>] [--waive <reason>] [--verdict <v>] [--note <text>]"] };
  }
  for (const [flag, v] of Object.entries({ by, waive, verdict, note })) {
    if (v != null && /[\r\n]/.test(v)) {
      return { code: 2, lines: [`--${flag} must be a single line (no newlines)`] };
    }
  }
  const dir = workDir(cwd, ticket);
  if (dir === null) {
    return { code: 2, lines: [`invalid ticket id: ${ticket}`] };
  }
  const planPath = path.join(dir, "plan.md");
  const statePath = path.join(dir, "state.md");
  if (!fs.existsSync(planPath)) {
    return { code: 2, lines: [`no plan.md for ${ticket} — cannot gate before a plan exists`] };
  }
  if (!fs.existsSync(statePath)) {
    return { code: 2, lines: [`no state.md for ${ticket}`] };
  }
  const hash = planHash(fs.readFileSync(planPath, "utf8"));
  const now = new Date().toISOString();
  let key, value;
  if (gate === "plan-approved") {
    key = "gate_plan_approved";
    value = waive
      ? `waived (${waive}) — ${by ?? "developer"} @ ${now} hash=${hash}`
      : `${by ?? "developer"} @ ${now} hash=${hash}`;
  } else if (gate === "review") {
    const v = verdict ?? "resolved";
    if (!REVIEW_VERDICTS.includes(v)) {
      return {
        code: 2,
        lines: [`unknown review verdict: ${verdict} (use ${REVIEW_VERDICTS.join("/")})`],
      };
    }
    key = "gate_review";
    const byPart = by ? ` — by ${by}` : "";
    const notePart = note ? ` (${note})` : "";
    value = `${v}${byPart}${notePart} hash=${hash}`;
  } else {
    return { code: 2, lines: [`unknown gate: ${gate} (use plan-approved or review)`] };
  }
  const updated = setFrontmatterField(fs.readFileSync(statePath, "utf8"), key, value);
  fs.writeFileSync(statePath, updated);
  return { code: 0, lines: [`Stamped ${key} for ${ticket}: ${value}`] };
}

/**
 * Run the validator for a ticket. With `step`, checks readiness to enter it;
 * without, validates every artifact present. Returns `{ code, lines }`:
 * code 0 = pass, 1 = validation failure, 2 = usage error. Does no printing.
 */
export function runCheck({ ticket, step = null, cwd = process.cwd() }) {
  if (!ticket) {
    return { code: 2, lines: ["usage: quark check <TICKET-ID> [--for <step>]"] };
  }
  const dir = workDir(cwd, ticket);
  if (dir === null) {
    return { code: 2, lines: [`invalid ticket id: ${ticket}`] };
  }
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
