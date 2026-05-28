# Explore digest: installer/validator core

A worked example of a `quark-explorer` digest — the fixed-shape output a Quark
step gets back when it delegates reading. Produced by exploring `src/lib.mjs`
and `src/check.mjs` for a hypothetical change to the installer/validator core.

## Relevant files

- `src/lib.mjs` — installer/composition core: `STEPS`/`UTILITIES`/`AGENTS`
  constants; `composeCommand`/`composeAgent` (pure); `installEngine`/
  `installEngineAgents`/`uninstall*`; `engineTargets`, `install`, `uninstall`.
- `src/check.mjs` — validator/gate core: `SCHEMAS`, `validateArtifact`,
  `checkReadiness`, `runCheck`/`runGate`, `planHash`, and the AC-spine helpers
  (`parseAcIds`/`collectAcRefs`).

## Patterns to follow

- Pure parsing/composition functions (strings in, data out) are isolated from
  I/O — mirror this for new logic (`parseSections`, `composeAgent`).
- Constants are the single source of truth (`SCHEMAS.state.enums.current_step`
  references `STEPS`); add new enums the same way.
- Validators return `{ errors, warnings }`; CLI entrypoints return
  `{ code, lines }` (0 ok / 1 validation / 2 usage). Keep the shape.

## Risks / surprises

- Import direction is one-way: `check.mjs` imports `STEPS` from `lib.mjs`;
  `lib.mjs` must NOT import from `check.mjs` (circular-dependency trap).
- `planHash` is whitespace-collapsed and section-sorted so it survives reflow;
  it binds `gate_plan_approved`/`gate_review`. Changing the algorithm orphans
  existing recorded gates.
- Tests import low-level exports by name (`composeCommand`, parse helpers), so
  changing an export's signature ripples into the suites.

## Ruled out

- `bin/quark` — thin argv wiring; calls the core, holds no logic.
- `playbook/`, `shims/`, `templates/`, `examples/`, `agents/` — content read by
  the installer, not core logic.
- `test/` — read for usage patterns, not part of the change surface itself.

## Open for the human

- None — the two modules have distinct responsibilities and a well-bounded
  change surface.
