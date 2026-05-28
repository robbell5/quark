# Plan: RAY-001

## Approach

Parse a `--json` flag in the status handler. When set, build the same record the
table renderer uses and emit `JSON.stringify(record)`; otherwise fall through to
the existing table path unchanged.

## Changes (file by file)

- src/commands/status.mjs — parse `--json`; branch to the JSON renderer before
  the table call.
- src/format.mjs — add `renderStatusJson(record)` beside `renderStatusTable`;
  both read one shared `record` builder so fields cannot drift.
- test/status.test.mjs — cover `--json` output and the unchanged default.

## Test strategy

- (AC1, AC2) `status --json` emits parseable JSON with id/state/updated — unit
  test; TDD yes.
- (AC3) default `status` output is unchanged — characterization test; TDD no
  (pin first).

## Definition of done

- [ ] (AC1) `status --json` prints a single JSON object and exits 0.
- [ ] (AC2) the JSON includes id, state, and updated (every table field).
- [ ] (AC3) default `status` output is byte-for-byte unchanged (pinned by a test).
- [ ] `node --test` passes.

## Risks & mitigations

- JSON/table field drift — both render from one shared `record` builder.
