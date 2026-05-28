# UAT: RAY-001

Manual acceptance walkthrough, mapped to the acceptance criteria.

- [x] (AC1) Run `status --json` → prints one JSON object; process exits 0.
- [x] (AC2) Pipe `status --json | jq .id` → returns the id; `.state` and
  `.updated` are present.
- [x] (AC3) Run `status` with no flag → byte-identical to the pre-change output.

## Result

pass — all three acceptance criteria reproduced on 2026-05-26; default output
diffed clean against the pinned characterization test.
