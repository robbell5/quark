# Open questions — good vs. over-asking (frame elicitation)

Two versions of `context.md`'s `## Open questions` for RAY-001 (the `--json`
flag). The first elicits only what needs human judgment, each with a proposed
default; the second is the failure mode.

## Good — only judgment calls, batched, defaults proposed

- [ ] Should `--json` timestamps be ISO-8601 UTC, or match the table's localized
  format? Proposed default: ISO-8601 UTC (script-friendly, unambiguous).
- [ ] On error, should `--json` emit a JSON error object or exit non-zero with
  stderr text? Proposed default: exit non-zero + stderr (matches the existing
  CLI).

## Over-asking — do NOT imitate

- [ ] What file is the status command in? (Answerable by reading the repo.)
- [ ] What fields does the table show? (Read `renderStatusTable`.)
- [ ] Should we add tests? (The plan always tests behavior — not a judgment call.)

> **Why the second is bad:** every item is answerable from the code or from
> Quark's own conventions, so it burns the developer's attention instead of
> reserving it for genuine decisions. Elicit only what the code can't tell you,
> batch it, and propose a default so the developer confirms rather than authors.
