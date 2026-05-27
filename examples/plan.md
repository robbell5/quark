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

- `status --json` emits parseable JSON with id/state/updated — unit test; TDD yes.
- default `status` output is unchanged — characterization test; TDD no (pin first).

## Definition of done

- [ ] `status --json` prints a JSON object with id, state, updated and exits 0.
- [ ] default `status` output is byte-for-byte unchanged (pinned by a test).
- [ ] `node --test` passes.

## Risks & mitigations

- JSON/table field drift — both render from one shared `record` builder.
