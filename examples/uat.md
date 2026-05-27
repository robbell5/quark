# UAT: RAY-001

Manual acceptance walkthrough, mapped to the acceptance criteria.

- [x] Run `status --json` → prints one JSON object; process exits 0.
  (AC: "prints a single JSON object to stdout and exits 0".)
- [x] Pipe `status --json | jq .id` → returns the id; `.state` and `.updated`
  are present. (AC: "includes every field shown in the table".)
- [x] Run `status` with no flag → byte-identical to the pre-change output.
  (AC: "existing output is byte-for-byte unchanged".)

## Result

pass — all three acceptance criteria reproduced on 2026-05-26; default output
diffed clean against the pinned characterization test.
