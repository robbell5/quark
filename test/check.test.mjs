import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import {
  SCHEMAS,
  STATUSES,
  parseSections,
  parseFrontmatter,
  validateArtifact,
  checkReadiness,
  runCheck,
  batonSummary,
} from "../src/check.mjs";
import { STEPS } from "../src/lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("SCHEMAS has an entry for all six artifacts", () => {
  assert.deepEqual(Object.keys(SCHEMAS).sort(), [
    "context",
    "plan",
    "pr",
    "review",
    "state",
    "uat",
  ]);
});

test("state schema enums reference STEPS and STATUSES", () => {
  assert.deepEqual(SCHEMAS.state.enums.current_step, STEPS);
  assert.deepEqual(SCHEMAS.state.enums.status, STATUSES);
});

test("parseSections splits H1, preamble, and ## sections", () => {
  const text = [
    "# Context: RAY-001",
    "",
    "intro line",
    "",
    "## Intent",
    "",
    "do the thing",
    "",
    "## Risks",
    "",
    "None",
  ].join("\n");
  const { h1, preamble, sections } = parseSections(text);
  assert.equal(h1, "Context: RAY-001");
  assert.equal(preamble, "intro line");
  assert.equal(sections.Intent, "do the thing");
  assert.equal(sections.Risks, "None");
});

test("parseSections does not treat ## as a second H1", () => {
  const { h1, sections } = parseSections("# State: X\n\n## Next action\n\ngo");
  assert.equal(h1, "State: X");
  assert.equal(sections["Next action"], "go");
});

test("parseFrontmatter reads flat key: value pairs", () => {
  const text = [
    "---",
    "ticket: RAY-001",
    "current_step: build",
    "status: in-progress",
    "---",
    "# State: RAY-001",
  ].join("\n");
  const fm = parseFrontmatter(text);
  assert.equal(fm.ticket, "RAY-001");
  assert.equal(fm.current_step, "build");
  assert.equal(fm.status, "in-progress");
});

test("parseFrontmatter returns null when there is no frontmatter", () => {
  assert.equal(parseFrontmatter("# Plan: RAY-001\n\n## Approach\n\nx"), null);
});

test("parseFrontmatter tolerates CRLF line endings", () => {
  const fm = parseFrontmatter(
    "---\r\nticket: RAY-001\r\nstatus: done\r\n---\r\n# State: RAY-001",
  );
  assert.equal(fm.ticket, "RAY-001");
  assert.equal(fm.status, "done");
});

const goodContext = [
  "# Context: RAY-001",
  "",
  "## Intent",
  "",
  "Add a --json flag.",
  "",
  "## Acceptance criteria",
  "",
  "- prints JSON",
  "",
  "## Files / modules in play",
  "",
  "- src/x.mjs — handler",
  "",
  "## Constraints",
  "",
  "None",
  "",
  "## Risks",
  "",
  "None",
  "",
  "## Out of scope",
  "",
  "- other commands",
  "",
  "## Open questions",
  "",
  "- [x] resolved",
].join("\n");

test("validateArtifact accepts a well-formed context", () => {
  const { errors } = validateArtifact("context", goodContext, SCHEMAS.context);
  assert.deepEqual(errors, []);
});

test("validateArtifact flags a missing section", () => {
  const text = goodContext.replace("## Risks\n\nNone\n\n", "");
  const { errors } = validateArtifact("context", text, SCHEMAS.context);
  assert.ok(errors.some((e) => e.includes("Risks")));
});

test("validateArtifact flags an unfilled <placeholder>", () => {
  const text = goodContext.replace("Add a --json flag.", "<what it is for>");
  const { errors } = validateArtifact("context", text, SCHEMAS.context);
  assert.ok(errors.some((e) => e.includes("Intent") && e.includes("placeholder")));
});

test("validateArtifact flags an empty required section (use None)", () => {
  const text = goodContext.replace("## Constraints\n\nNone", "## Constraints\n\n");
  const { errors } = validateArtifact("context", text, SCHEMAS.context);
  assert.ok(errors.some((e) => e.includes("Constraints") && e.includes("empty")));
});

test("validateArtifact enforces minItems", () => {
  const text = goodContext.replace("- prints JSON", "prose, no list item");
  const { errors } = validateArtifact("context", text, SCHEMAS.context);
  assert.ok(errors.some((e) => e.includes("Acceptance criteria")));
});

test("validateArtifact enforces requireDash on plan Changes", () => {
  const plan = [
    "# Plan: RAY-001",
    "",
    "## Approach",
    "",
    "x",
    "",
    "## Changes (file by file)",
    "",
    "- src/x.mjs no dash here",
    "",
    "## Test strategy",
    "",
    "- behavior — unit; TDD yes",
    "",
    "## Definition of done",
    "",
    "- [ ] it works",
    "",
    "## Risks & mitigations",
    "",
    "None",
  ].join("\n");
  const { errors } = validateArtifact("plan", plan, SCHEMAS.plan);
  assert.ok(errors.some((e) => e.includes("Changes") && e.includes("—")));
});

test("validateArtifact enforces requireCheckbox on plan DoD", () => {
  const plan = [
    "# Plan: RAY-001",
    "",
    "## Approach",
    "",
    "x",
    "",
    "## Changes (file by file)",
    "",
    "- src/x.mjs — edit",
    "",
    "## Test strategy",
    "",
    "- behavior — unit; TDD yes",
    "",
    "## Definition of done",
    "",
    "- no checkbox",
    "",
    "## Risks & mitigations",
    "",
    "None",
  ].join("\n");
  const { errors } = validateArtifact("plan", plan, SCHEMAS.plan);
  assert.ok(errors.some((e) => e.includes("Definition of done")));
});

test("validateArtifact validates state frontmatter keys and enums", () => {
  const bad = [
    "---",
    "ticket: RAY-001",
    "current_step: nonsense",
    "status: in-progress",
    "driving_engine: Codex",
    "updated: 2026-05-26T00:00:00Z",
    "---",
    "# State: RAY-001",
    "",
    "## Completed",
    "",
    "None",
    "",
    "## Decisions & deviations",
    "",
    "None",
    "",
    "## Next action",
    "",
    "go",
    "",
    "## Gotchas for the next runner",
    "",
    "None",
  ].join("\n");
  const { errors } = validateArtifact("state", bad, SCHEMAS.state);
  assert.ok(errors.some((e) => e.includes("current_step")));
});

test("validateArtifact does not double-report a missing minItems section", () => {
  const text = goodContext.replace(
    "## Acceptance criteria\n\n- prints JSON\n\n",
    "",
  );
  const { errors } = validateArtifact("context", text, SCHEMAS.context);
  const hits = errors.filter((e) => e.includes("Acceptance criteria"));
  assert.equal(hits.length, 1);
});

test("validateArtifact does not flag a comparison like x < 10 > 0", () => {
  const text = goodContext.replace("None", "Keep x < 10 > 0 at all times");
  const { errors } = validateArtifact("context", text, SCHEMAS.context);
  assert.deepEqual(errors, []);
});

test("validateArtifact flags an H1 with no id", () => {
  const text = goodContext.replace("# Context: RAY-001", "# Context:");
  const { errors } = validateArtifact("context", text, SCHEMAS.context);
  assert.ok(errors.some((e) => e.includes("H1")));
});

const goodPlan = [
  "# Plan: RAY-001",
  "",
  "## Approach",
  "",
  "Add the flag.",
  "",
  "## Changes (file by file)",
  "",
  "- src/x.mjs — add flag",
  "",
  "## Test strategy",
  "",
  "- flag works — unit; TDD yes",
  "",
  "## Definition of done",
  "",
  "- [ ] flag works",
  "",
  "## Risks & mitigations",
  "",
  "None",
].join("\n");

const goodState = [
  "---",
  "ticket: RAY-001",
  "current_step: build",
  "status: in-progress",
  "driving_engine: Claude Code",
  "updated: 2026-05-27T10:00:00Z",
  "---",
  "# State: RAY-001",
  "",
  "## Completed",
  "",
  "- frame — context written",
  "",
  "## Decisions & deviations",
  "",
  "None",
  "",
  "## Next action",
  "",
  "- finish the JSON renderer unit, then run verify",
  "",
  "## Gotchas for the next runner",
  "",
  "None",
].join("\n");

test("batonSummary renders step, status, driver, and next action", () => {
  const lines = batonSummary("RAY-001", goodState);
  assert.ok(lines[0].includes("Baton for RAY-001"), "header names the ticket");
  assert.ok(
    lines.some((l) => l.includes("build") && l.includes("in-progress")),
    "shows current_step and status",
  );
  assert.ok(lines.some((l) => l.includes("Claude Code")), "shows the driver");
  assert.ok(
    lines.some((l) => l.includes("finish the JSON renderer unit")),
    "shows the next action",
  );
});

test("batonSummary reports a new ticket when state.md is absent", () => {
  const lines = batonSummary("RAY-001", null);
  assert.equal(lines.length, 1);
  assert.ok(/new ticket/i.test(lines[0]));
});

test("batonSummary degrades when state.md has no frontmatter", () => {
  const lines = batonSummary("RAY-001", "# State: RAY-001\n\n## Next action\n\ngo");
  assert.equal(lines.length, 1);
  assert.ok(/no baton/i.test(lines[0]));
});

test("batonSummary strips a checkbox marker from the next action", () => {
  const state = goodState.replace(
    "- finish the JSON renderer unit, then run verify",
    "- [ ] finish the JSON renderer unit, then run verify",
  );
  const lines = batonSummary("RAY-001", state);
  assert.ok(
    lines.some((l) => l.includes("next: finish the JSON renderer unit")),
    "next action text is preserved",
  );
  assert.ok(!lines.some((l) => l.includes("[ ]")), "no raw checkbox marker leaks");
});

function workdir(files) {
  const dir = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "quark-work-")),
    ".work",
    "RAY-001",
  );
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, `${name}.md`), body);
  }
  return dir;
}

test("checkReadiness --for frame needs nothing", () => {
  const dir = workdir({});
  assert.deepEqual(checkReadiness(dir, "frame").errors, []);
});

test("checkReadiness --for plan fails on unresolved open questions", () => {
  const ctx = goodContext.replace("- [x] resolved", "- [ ] still open");
  const dir = workdir({ context: ctx });
  const { errors } = checkReadiness(dir, "plan");
  assert.ok(errors.some((e) => e.toLowerCase().includes("open question")));
});

test("checkReadiness --for plan passes when questions are resolved", () => {
  const dir = workdir({ context: goodContext });
  assert.deepEqual(checkReadiness(dir, "plan").errors, []);
});

test("checkReadiness --for build flags blocking review with no resolutions", () => {
  const review = [
    "# Review: RAY-001",
    "",
    "## Blocking",
    "",
    "- auth check missing",
    "",
    "## Important",
    "",
    "None",
    "",
    "## Minor",
    "",
    "None",
    "",
    "## Resolutions",
    "",
    "None",
  ].join("\n");
  const dir = workdir({ context: goodContext, plan: goodPlan, review });
  const { errors } = checkReadiness(dir, "build");
  assert.ok(errors.some((e) => e.toLowerCase().includes("blocking")));
});

test("checkReadiness --for ship requires a passing UAT", () => {
  const failing = "# UAT: RAY-001\n\n- [x] step → ok\n\n## Result\n\nfail: broke";
  const dir = workdir({ uat: failing });
  const { errors } = checkReadiness(dir, "ship");
  assert.ok(errors.some((e) => e.toLowerCase().includes("uat")));
});

test("checkReadiness --for ship treats 'did not pass' as failing", () => {
  const uat =
    "# UAT: RAY-001\n\n- [x] step → ok\n\n## Result\n\ndid not pass: regressions";
  const dir = workdir({ uat });
  const { errors } = checkReadiness(dir, "ship");
  assert.ok(errors.some((e) => e.toLowerCase().includes("uat")));
});

test("checkReadiness --for ship accepts a passing UAT", () => {
  const uat =
    "# UAT: RAY-001\n\n- [x] step → ok\n\n## Result\n\npass: all scenarios verified";
  const dir = workdir({ uat });
  assert.deepEqual(checkReadiness(dir, "ship").errors, []);
});

function repoWith(files) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "quark-repo-"));
  const dir = path.join(home, ".work", "RAY-001");
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, `${name}.md`), body);
  }
  return home;
}

test("runCheck returns code 2 with no ticket", () => {
  assert.equal(runCheck({ ticket: null }).code, 2);
});

test("runCheck returns code 2 when .work/<ticket> is absent", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "quark-empty-"));
  assert.equal(runCheck({ ticket: "RAY-001", cwd }).code, 2);
});

test("runCheck (artifact mode) passes on clean artifacts", () => {
  const cwd = repoWith({ context: goodContext, plan: goodPlan });
  const res = runCheck({ ticket: "RAY-001", cwd });
  assert.equal(res.code, 0);
});

test("runCheck (artifact mode) fails and reports a malformed artifact", () => {
  const bad = goodPlan.replace("- src/x.mjs — add flag", "- src/x.mjs no dash");
  const cwd = repoWith({ context: goodContext, plan: bad });
  const res = runCheck({ ticket: "RAY-001", cwd });
  assert.equal(res.code, 1);
  assert.ok(res.lines.some((l) => l.includes("Changes")));
});

test("runCheck (readiness mode) honors --for build", () => {
  const cwd = repoWith({ context: goodContext, plan: goodPlan });
  const res = runCheck({ ticket: "RAY-001", step: "build", cwd });
  assert.equal(res.code, 0);
  assert.ok(res.lines[0].includes("Readiness"));
});

test("runCheck (artifact mode) prints the state.md baton first", () => {
  const cwd = repoWith({ context: goodContext, plan: goodPlan, state: goodState });
  const res = runCheck({ ticket: "RAY-001", cwd });
  assert.equal(res.code, 0);
  assert.ok(res.lines[0].includes("Baton for RAY-001"), "baton heads the output");
  assert.ok(
    res.lines.some((l) => l.includes("build") && l.includes("in-progress")),
    "baton shows the current step",
  );
  assert.ok(
    res.lines.some((l) => l.includes("Artifacts for RAY-001")),
    "artifact report still present",
  );
});

test("runCheck (artifact mode) shows a new-ticket baton when state.md is absent", () => {
  const cwd = repoWith({ context: goodContext });
  const res = runCheck({ ticket: "RAY-001", cwd });
  assert.equal(res.code, 0, "absent state.md does not change the exit code");
  assert.ok(res.lines.some((l) => /Baton for RAY-001: no state\.md/i.test(l)));
});

test("worked-example artifacts validate clean against their schemas", () => {
  for (const name of ["context", "plan", "state"]) {
    const text = fs.readFileSync(path.join(root, "examples", `${name}.md`), "utf8");
    const { errors } = validateArtifact(name, text, SCHEMAS[name]);
    assert.deepEqual(errors, [], `examples/${name}.md: ${errors.join("; ")}`);
  }
});
