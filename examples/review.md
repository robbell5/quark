# Review: RAY-001

Mode: plan review — 2026-05-26T16:10:00Z
Reviewer: Codex

## Blocking

None

## Important

- The plan emits `JSON.stringify(record)` with no trailing newline; piping to
  `jq` is fine, but a human running it in a terminal gets a glued prompt.
- No test pins behavior when `status` has zero rows — `--json` could emit
  `undefined` instead of an empty object.

## Minor

- `renderStatusJson` reads fine, but consider whether it should sit next to the
  other `render*` helpers in file order.

## Resolutions

- Trailing newline (important) — fold into plan: append `\n`, and add a test
  asserting the output ends with exactly one newline.
- Zero-row case (important) — fix in build: return `{}` for no rows, with a unit
  test for the empty case.
- Helper ordering (minor) — reject: `renderStatusJson` already sits beside
  `renderStatusTable`, which is the closer neighbor; sibling proximity wins.
