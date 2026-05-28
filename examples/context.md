# Context: RAY-001

## Intent

Add a `--json` flag to the `status` CLI command so scripts can consume status
output as structured data instead of parsing the human-readable table.

## Acceptance criteria

- AC1: `status --json` prints a single JSON object to stdout and exits 0.
- AC2: The JSON includes every field shown in the table (id, state, updated).
- AC3: Existing `status` (no flag) output is byte-for-byte unchanged.

## Files / modules in play

- src/commands/status.mjs — the command handler; add flag handling here.
- src/format.mjs — table renderer; add a JSON renderer beside it.
- test/status.test.mjs — command tests.

## Constraints

- No new dependencies (Node built-ins only).
- Must not change the default human-readable output.

## Risks

- The JSON shape drifting from the table fields over time.

## Out of scope

- A `--json` flag on any command other than `status`.
- Pretty-printing or color in JSON mode.

## Sensitivity

None

## Open questions

- [x] Should timestamps be ISO-8601 strings? Resolved: yes, ISO-8601 UTC.
