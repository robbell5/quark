# Prompt authoring standard

The house style for Quark step playbooks (`playbook/<step>.md`). It exists so
prompt quality is a standard the work is held to — not something eyeballed.

**Author-facing.** This doc guides how playbooks are *written*; it is not inlined
into the installed skills (that would bloat them, against the thin ethos). The
elements it requires are enforced two ways: a checklist you grade the rework
against, and machine-checked presence in `test/content.test.mjs`.

Every loop step (`frame`, `plan`, `review`, `build`, `verify`, `ship`) must have:

1. **Objective** — one sentence on the *outcome* (the `Goal:` line), distinct
   from the procedure. What does "done" mean for this step?
2. **Stance** — a `**Stance:**` line near the top naming the disposition the
   agent takes (skeptical planner, honest reviewer, …). Light, not theatrical;
   it sets posture, not personality.
3. **Orient → reason → act** — the first procedure action is to *think* (name the
   change surface, the unknowns, the mapping to criteria) before producing the
   artifact. Never open with "write the file."
4. **Named failure modes** — a `## Failure modes` section: the 1–3 ways this step
   characteristically drifts, each as *symptom → guardrail*. Generalize the
   `examples/plan-too-vague.md` anti-example pattern.
5. **Engineered elicitation** (`frame` and `plan` only) — when you need the
   developer, ask only what needs human judgment, batch the questions, and
   propose a default so they confirm rather than author. See the **Eliciting
   decisions** guide in `playbook/_shared.md`.
6. **Few-shot for judgment** — a judgment-heavy output gets a worked example in
   `examples/`, referenced from the step so `composeCommand` inlines it.
7. **Voice** — concise and imperative; second person to the agent; define terms;
   no filler. Wrap prose at ~80 columns.

## Checklist

When you add or rework a step, confirm:

- [ ] One-sentence `Goal:` stating the outcome.
- [ ] A `**Stance:**` line.
- [ ] The procedure's first action is to orient/reason, not to write.
- [ ] A `## Failure modes` block (symptom → guardrail).
- [ ] (frame/plan) elicitation routed through the Shared Conventions guide.
- [ ] (judgment steps) a referenced `examples/<name>.md`.
- [ ] Concise, imperative voice; ~80-column wrap; passes markdownlint.
- [ ] `node --test` green; re-ran `node bin/quark install`.
