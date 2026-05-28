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
  runGate,
  batonSummary,
  planHash,
  setFrontmatterField,
  parseAcIds,
  collectAcRefs,
  acQualityWarnings,
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
  "- AC1: prints JSON",
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
  "## Sensitivity",
  "",
  "None",
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
  const text = goodContext.replace("- AC1: prints JSON", "prose, no list item");
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
    "## Acceptance criteria\n\n- AC1: prints JSON\n\n",
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

test("validateArtifact flags an acceptance criterion missing its ACn: id", () => {
  const text = goodContext.replace("- AC1: prints JSON", "- prints JSON");
  const { errors } = validateArtifact("context", text, SCHEMAS.context);
  assert.ok(errors.some((e) => /lacks an "ACn:" id/.test(e)));
});

test("validateArtifact flags duplicate acceptance-criterion ids", () => {
  const text = goodContext.replace(
    "- AC1: prints JSON",
    "- AC1: prints JSON\n- AC1: prints again",
  );
  const { errors } = validateArtifact("context", text, SCHEMAS.context);
  assert.ok(errors.some((e) => /duplicate acceptance-criterion id AC1/.test(e)));
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
  "- [ ] (AC1) flag works",
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
  let state = setFrontmatterField(
    goodState,
    "gate_plan_approved",
    `Dev @ 2026-05-27T00:00:00Z hash=${planHash(goodPlan)}`,
  );
  state = setFrontmatterField(
    state,
    "gate_review",
    `resolved hash=${planHash(goodPlan)}`,
  );
  const cwd = repoWith({ context: goodContext, plan: goodPlan, state });
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

test("the clean worked-example context emits no AC-quality warnings", () => {
  const ctx = fs.readFileSync(path.join(root, "examples", "context.md"), "utf8");
  assert.deepEqual(acQualityWarnings(ctx), []);
});

test("planHash is a 12-char hex digest", () => {
  assert.match(planHash(goodPlan), /^[0-9a-f]{12}$/);
});

test("planHash is stable under whitespace reflow", () => {
  const reflowed = goodPlan
    .replace("Add the flag.", "Add\nthe   flag.")
    .replace("- src/x.mjs — add flag", "-   src/x.mjs — add flag");
  assert.equal(planHash(reflowed), planHash(goodPlan));
});

test("planHash changes when section content changes", () => {
  const edited = goodPlan.replace("Add the flag.", "Add TWO flags.");
  assert.notEqual(planHash(edited), planHash(goodPlan));
});

test("setFrontmatterField updates an existing key in place", () => {
  const out = setFrontmatterField(goodState, "status", "done");
  const fm = parseFrontmatter(out);
  assert.equal(fm.status, "done");
  assert.ok(out.includes("# State: RAY-001"), "body is preserved");
});

test("setFrontmatterField appends a new key before the closing fence", () => {
  const out = setFrontmatterField(goodState, "gate_plan_approved", "Dev hash=abc123");
  const fm = parseFrontmatter(out);
  assert.equal(fm.gate_plan_approved, "Dev hash=abc123");
  assert.ok(fm.ticket === "RAY-001", "existing keys untouched");
});

test("setFrontmatterField throws when there is no frontmatter", () => {
  assert.throws(() => setFrontmatterField("# Plan: X\n\n## Approach\n\nx", "k", "v"));
});

test("context schema requires a Sensitivity section", () => {
  assert.ok(SCHEMAS.context.sections.includes("Sensitivity"));
  const text = goodContext.replace("## Sensitivity\n\nNone\n\n", "");
  const { errors } = validateArtifact("context", text, SCHEMAS.context);
  assert.ok(errors.some((e) => e.includes("Sensitivity")));
});

const approvedState = (planText) =>
  setFrontmatterField(
    goodState,
    "gate_plan_approved",
    `Dev @ 2026-05-27T00:00:00Z hash=${planHash(planText)}`,
  );

test("checkReadiness --for build blocks an unapproved plan", () => {
  const dir = workdir({ context: goodContext, plan: goodPlan, state: goodState });
  const { errors } = checkReadiness(dir, "build");
  assert.ok(errors.some((e) => /not approved/i.test(e)));
});

test("checkReadiness --for build blocks when the plan changed since approval", () => {
  const state = approvedState(goodPlan);
  const editedPlan = goodPlan.replace("Add the flag.", "Add a totally different thing.");
  const dir = workdir({ context: goodContext, plan: editedPlan, state });
  const { errors } = checkReadiness(dir, "build");
  assert.ok(errors.some((e) => /changed since approval/i.test(e)));
});

const cleanReview = [
  "# Review: RAY-001",
  "",
  "## Blocking",
  "",
  "None",
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

const reviewedState = (planText, verdict = `resolved hash=${planHash(planText)}`) =>
  setFrontmatterField(approvedState(planText), "gate_review", verdict);

test("checkReadiness --for build blocks an approved plan with no review verdict", () => {
  const dir = workdir({
    context: goodContext,
    plan: goodPlan,
    state: approvedState(goodPlan),
  });
  const { errors } = checkReadiness(dir, "build");
  assert.ok(errors.some((e) => /recorded review verdict/i.test(e)));
});

test("checkReadiness --for build passes an approved + reviewed slice", () => {
  const dir = workdir({
    context: goodContext,
    plan: goodPlan,
    review: cleanReview,
    state: reviewedState(goodPlan),
  });
  assert.deepEqual(checkReadiness(dir, "build").errors, []);
});

test("checkReadiness --for build blocks when the review predates a plan change", () => {
  const dir = workdir({
    context: goodContext,
    plan: goodPlan,
    review: cleanReview,
    state: reviewedState(goodPlan, "resolved hash=deadbeef0000"),
  });
  const { errors } = checkReadiness(dir, "build");
  assert.ok(errors.some((e) => /changed since review/i.test(e)));
});

test("checkReadiness --for build accepts the 'accepted' accept-gaps verdict", () => {
  const dir = workdir({
    context: goodContext,
    plan: goodPlan,
    review: cleanReview,
    state: reviewedState(
      goodPlan,
      `accepted — by Dev (edge case deferred) hash=${planHash(goodPlan)}`,
    ),
  });
  assert.deepEqual(checkReadiness(dir, "build").errors, []);
});

test("runGate stamps gate_plan_approved with the current plan hash", () => {
  const cwd = repoWith({ plan: goodPlan, state: goodState });
  const res = runGate({ ticket: "RAY-001", gate: "plan-approved", by: "Rob", cwd });
  assert.equal(res.code, 0);
  const state = fs.readFileSync(
    path.join(cwd, ".work", "RAY-001", "state.md"), "utf8",
  );
  const fm = parseFrontmatter(state);
  assert.match(fm.gate_plan_approved, /^Rob @ .* hash=[0-9a-f]{12}$/);
  assert.ok(fm.gate_plan_approved.includes(`hash=${planHash(goodPlan)}`));
});

test("runGate records a waiver reason", () => {
  const cwd = repoWith({ plan: goodPlan, state: goodState });
  runGate({ ticket: "RAY-001", gate: "plan-approved", by: "Rob", waive: "trivial", cwd });
  const fm = parseFrontmatter(
    fs.readFileSync(path.join(cwd, ".work", "RAY-001", "state.md"), "utf8"),
  );
  assert.match(fm.gate_plan_approved, /^waived \(trivial\)/);
});

test("runGate stamps gate_review with a verdict and hash", () => {
  const cwd = repoWith({ plan: goodPlan, state: goodState });
  runGate({ ticket: "RAY-001", gate: "review", verdict: "resolved", cwd });
  const fm = parseFrontmatter(
    fs.readFileSync(path.join(cwd, ".work", "RAY-001", "state.md"), "utf8"),
  );
  assert.equal(fm.gate_review, `resolved hash=${planHash(goodPlan)}`);
});

test("runGate returns code 2 without plan.md", () => {
  const cwd = repoWith({ state: goodState });
  assert.equal(runGate({ ticket: "RAY-001", gate: "plan-approved", cwd }).code, 2);
});

test("runGate returns code 2 for an unknown gate", () => {
  const cwd = repoWith({ plan: goodPlan, state: goodState });
  assert.equal(runGate({ ticket: "RAY-001", gate: "bogus", cwd }).code, 2);
});

test("runGate rejects an unknown review verdict with code 2", () => {
  const cwd = repoWith({ plan: goodPlan, state: goodState });
  const res = runGate({ ticket: "RAY-001", gate: "review", verdict: "accpeted", cwd });
  assert.equal(res.code, 2);
  assert.ok(res.lines.some((l) => /unknown review verdict/.test(l)));
});

test("runGate stamps the accepted verdict with a by and note", () => {
  const cwd = repoWith({ plan: goodPlan, state: goodState });
  runGate({
    ticket: "RAY-001",
    gate: "review",
    verdict: "accepted",
    by: "Rob",
    note: "edge deferred",
    cwd,
  });
  const fm = parseFrontmatter(
    fs.readFileSync(path.join(cwd, ".work", "RAY-001", "state.md"), "utf8"),
  );
  assert.match(
    fm.gate_review,
    /^accepted — by Rob \(edge deferred\) hash=[0-9a-f]{12}$/,
  );
});

const acContext = (acLines) =>
  [
    "# Context: RAY-001",
    "",
    "## Acceptance criteria",
    "",
    ...acLines,
    "",
    "## Intent",
    "",
    "x",
  ].join("\n");

test("parseAcIds collects well-formed sequential ids", () => {
  const { ids, errors, warnings } = parseAcIds(
    acContext(["- AC1: first", "- AC2: second", "- AC3: third"]),
  );
  assert.deepEqual(ids, ["AC1", "AC2", "AC3"]);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test("parseAcIds rejects a bare bullet with no id", () => {
  const { errors } = parseAcIds(acContext(["- no id here"]));
  assert.ok(errors.some((e) => /lacks an "ACn:" id/.test(e)));
});

test("parseAcIds flags a duplicate id", () => {
  const { errors } = parseAcIds(acContext(["- AC1: a", "- AC1: b"]));
  assert.ok(errors.some((e) => /duplicate acceptance-criterion id AC1/.test(e)));
});

test("parseAcIds warns (not errors) on non-sequential ids", () => {
  const { ids, errors, warnings } = parseAcIds(
    acContext(["- AC1: a", "- AC3: c"]),
  );
  assert.deepEqual(ids, ["AC1", "AC3"]);
  assert.deepEqual(errors, []);
  assert.ok(warnings.some((w) => /not 1\.\.N sequential/.test(w)));
});

test("collectAcRefs parses single, comma, and adjacent ref forms", () => {
  assert.deepEqual([...collectAcRefs("- [ ] (AC1) do x")], ["AC1"]);
  assert.deepEqual(
    [...collectAcRefs("- [ ] (AC1, AC2) do x")].sort(),
    ["AC1", "AC2"],
  );
  assert.deepEqual([...collectAcRefs("(AC1)(AC3)")].sort(), ["AC1", "AC3"]);
});

test("collectAcRefs ignores a bare ACn in prose (no parens)", () => {
  assert.deepEqual([...collectAcRefs("AC1 is tricky to test")], []);
});

test("acQualityWarnings flags a compound AC (and / semicolon)", () => {
  assert.ok(
    acQualityWarnings(acContext(["- AC1: logs the user in and resets the password"]))
      .some((w) => /AC1.*compound/i.test(w)),
    "an AC joined by 'and' is flagged compound",
  );
  assert.ok(
    acQualityWarnings(acContext(["- AC1: saves the record; emails the user"]))
      .some((w) => /AC1.*compound/i.test(w)),
    "an AC joined by ';' is flagged compound",
  );
});

test("acQualityWarnings flags a bare subjective term", () => {
  const w = acQualityWarnings(acContext(["- AC1: error handling is robust"]));
  assert.ok(w.some((x) => /AC1.*subjective.*robust/i.test(x)));
});

test("acQualityWarnings is silent on a clean, atomic, observable AC", () => {
  assert.deepEqual(
    acQualityWarnings(acContext(["- AC1: rejects an invalid email with a message"])),
    [],
  );
});

test("acQualityWarnings no-ops when there are no acceptance criteria", () => {
  assert.deepEqual(acQualityWarnings("# Context: RAY-001\n\n## Intent\n\nx"), []);
});

test("validateArtifact surfaces AC-quality warnings (advisory, not errors)", () => {
  const text = goodContext.replace("- AC1: prints JSON", "- AC1: error handling is robust");
  const { errors, warnings } = validateArtifact("context", text, SCHEMAS.context);
  assert.deepEqual(errors, [], "AC quality never raises an error");
  assert.ok(warnings.some((w) => /subjective/.test(w)));
});

test("runCheck surfaces AC-quality WARN lines without failing", () => {
  const ctx = goodContext.replace(
    "- AC1: prints JSON",
    "- AC1: logs in and resets the password",
  );
  const cwd = repoWith({ context: ctx });
  const res = runCheck({ ticket: "RAY-001", cwd });
  assert.equal(res.code, 0, "advisory warnings never fail the check");
  assert.ok(res.lines.some((l) => /WARN/.test(l) && /compound/.test(l)));
});

test("AC-quality warnings stay out of the --for readiness gates", () => {
  // Characterization: requireValid forwards only .errors, so a weak AC neither
  // blocks the gate nor leaks an advisory warning into it.
  const ctx = goodContext.replace("- AC1: prints JSON", "- AC1: error handling is robust");
  // The warning DOES exist at the artifact level...
  const direct = validateArtifact("context", ctx, SCHEMAS.context).warnings;
  assert.ok(direct.some((w) => /subjective/.test(w)), "warning exists at artifact level");
  // ...but the readiness gate neither blocks on it nor surfaces it.
  const dir = workdir({ context: ctx });
  const { errors, warnings } = checkReadiness(dir, "plan");
  assert.deepEqual(errors, [], "a weak AC does not block the gate");
  assert.ok(!warnings.some((w) => /subjective/.test(w)), "gates forward errors only");
});

test("checkReadiness --for review flags an AC with no DoD coverage (R1)", () => {
  const plan = goodPlan.replace("- [ ] (AC1) flag works", "- [ ] flag works");
  const dir = workdir({ context: goodContext, plan });
  const { errors } = checkReadiness(dir, "review");
  assert.ok(errors.some((e) => /AC1 not covered/.test(e)));
});

test("checkReadiness --for review flags a DoD citing an undefined AC (R2)", () => {
  const plan = goodPlan.replace("- [ ] (AC1) flag works", "- [ ] (AC2) flag works");
  const dir = workdir({ context: goodContext, plan });
  const { errors } = checkReadiness(dir, "review");
  assert.ok(errors.some((e) => /cites AC2, which is not defined/.test(e)));
});

test("checkReadiness --for review passes when every AC is covered", () => {
  const dir = workdir({ context: goodContext, plan: goodPlan });
  assert.deepEqual(checkReadiness(dir, "review").errors, []);
});

test("checkReadiness --for build also enforces AC coverage (R1)", () => {
  const plan = goodPlan.replace("- [ ] (AC1) flag works", "- [ ] flag works");
  const dir = workdir({ context: goodContext, plan, state: approvedState(plan) });
  const { errors } = checkReadiness(dir, "build");
  assert.ok(errors.some((e) => /AC1 not covered/.test(e)));
});

test("worked-example plan covers + resolves every AC via the review gate", () => {
  const ctx = fs.readFileSync(path.join(root, "examples", "context.md"), "utf8");
  const plan = fs.readFileSync(path.join(root, "examples", "plan.md"), "utf8");
  const dir = workdir({ context: ctx, plan });
  const { errors } = checkReadiness(dir, "review");
  assert.deepEqual(errors, [], errors.join("; "));
});

test("checkReadiness --for ship flags an AC with no UAT coverage (R3)", () => {
  const uat = "# UAT: RAY-001\n\n- [x] step → ok\n\n## Result\n\npass";
  const dir = workdir({ context: goodContext, uat });
  const { errors } = checkReadiness(dir, "ship");
  assert.ok(errors.some((e) => /AC1 not covered/.test(e)));
});

test("checkReadiness --for ship flags UAT citing an undefined AC (R4)", () => {
  const uat = "# UAT: RAY-001\n\n- [x] (AC1)(AC9) step → ok\n\n## Result\n\npass";
  const dir = workdir({ context: goodContext, uat });
  const { errors } = checkReadiness(dir, "ship");
  assert.ok(errors.some((e) => /cites AC9, which is not defined/.test(e)));
});

test("checkReadiness --for ship passes when UAT covers every AC", () => {
  const uat = "# UAT: RAY-001\n\n- [x] (AC1) step → ok\n\n## Result\n\npass";
  const dir = workdir({ context: goodContext, uat });
  assert.deepEqual(checkReadiness(dir, "ship").errors, []);
});

test("checkReadiness --for ship no-ops AC coverage when context is absent", () => {
  const uat = "# UAT: RAY-001\n\n- [x] step → ok\n\n## Result\n\npass";
  const dir = workdir({ uat });
  assert.deepEqual(checkReadiness(dir, "ship").errors, []);
});

test("worked-example UAT covers every AC via the ship gate", () => {
  const ctx = fs.readFileSync(path.join(root, "examples", "context.md"), "utf8");
  const uat = fs.readFileSync(path.join(root, "examples", "uat.md"), "utf8");
  const dir = workdir({ context: ctx, uat });
  const { errors } = checkReadiness(dir, "ship");
  assert.deepEqual(errors, [], errors.join("; "));
});

test("the vague anti-example fails AC coverage at the review gate", () => {
  const ctx = fs.readFileSync(path.join(root, "examples", "context.md"), "utf8");
  const plan = fs.readFileSync(
    path.join(root, "examples", "plan-too-vague.md"),
    "utf8",
  );
  const dir = workdir({ context: ctx, plan });
  const { errors } = checkReadiness(dir, "review");
  assert.ok(errors.some((e) => /not covered by any Definition-of-done/.test(e)));
});

test("the vague-ACs anti-example trips AC-quality warnings", () => {
  const ctx = fs.readFileSync(
    path.join(root, "examples", "context-vague-acs.md"),
    "utf8",
  );
  const w = acQualityWarnings(ctx);
  assert.ok(w.some((x) => /compound/.test(x)), "anti-example shows a compound AC");
  assert.ok(w.some((x) => /subjective/.test(x)), "anti-example shows a subjective AC");
});
