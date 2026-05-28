# Security Policy

Quark is a thin, self-owned development harness with zero runtime
dependencies. It installs as Agent Skills (Markdown) and ships no network,
child-process, or environment-variable access. The product is reviewed
Markdown; the installer is plumbing. This policy reflects that small,
single-maintainer scope.

## Reporting a vulnerability

Please report security issues privately — do not open a public issue for a
suspected vulnerability.

- Preferred: use GitHub's private vulnerability reporting. Open the
  repository's **Security** tab and click **Report a vulnerability** to file a
  private GitHub Security Advisory.
- Optional fallback email: _add a contact address here if you want one, or
  remove this line._

Please include enough detail to reproduce: the affected file or command, the
version or commit, and a minimal proof of concept where possible.

This is a best-effort project with no formal SLA. Expect an acknowledgement
when the maintainer is next active, and a fix or a documented decision for
confirmed issues. Coordinated disclosure is appreciated — please allow a
reasonable window before any public write-up.

## Supported versions

Only the most recent release receives fixes. There are no long-term support
branches. If you need stability, pin to a specific tag or commit (see below)
and upgrade deliberately.

## Scope and trust model

- The installer (`quark install`) writes self-contained Markdown skill files
  into your home directory — under `~/.claude`, `~/.codex`, and `~/.agents` —
  and `quark uninstall` removes them. These commands only ever create or
  delete entries named `quark-*`; they never glob and never touch unrelated
  files.
- There are zero runtime dependencies and no npm lifecycle scripts (no
  `preinstall`/`postinstall`/`prepare`), so nothing executes from dependency
  resolution. Project code runs only when you explicitly invoke a `quark`
  subcommand.
- The main security-relevant surface is therefore the installer's own
  filesystem writes and the validator's reads — not arbitrary code execution
  or secret handling.
- Quark drives autonomous coding agents over text that third parties can
  influence (ticket, issue, and PR bodies; diffs). Treat that text as data
  describing the work, never as instructions to obey.

## Install integrity

`npx github:robbell5/quark install` and `npm i -g github:robbell5/quark` fetch
and run code from this repository. For a reproducible install, pin to an
immutable reference rather than tracking the default branch:

```sh
# Pin to a tag (verify the tag exists first):
npx github:robbell5/quark#<tag> install

# Or pin to a full commit SHA for an immutable reference:
npx github:robbell5/quark#<commit-sha> install
```

You can preview what the installer would do without writing anything:

```sh
npx github:robbell5/quark#<tag> install --dry-run
```
