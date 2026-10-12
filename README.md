# LiquidLM skills

Canonical assistant conventions for using a LiquidLM memory backend, plus
per-client installation adapters. This repository is prose and packaging, not a
runtime dependency: the CLI bundles a pinned copy and this repository is the
inspectable canonical source.

## Contents

- `conventions.md` — the canonical, versioned conventions document. Everything
  else is generated or verified against it.
- `manifest.json` — version, conventions SHA-256, client targets and the MCP
  tool names adapters expect.
- `adapters/` — generated per-client payloads. Only `cursor` carries a wrapper
  (frontmatter); the others are byte-identical to `conventions.md`.
- `install.mjs` — dependency-free installer (Node 18+) that installs, updates
  and removes conventions using reversible, checksum-guarded managed blocks.
- `tests/` and `fixtures/` — reversibility tests and the behavior-contract
  fixtures the conventions are checked against.

## Install

```sh
node install.mjs --client codex          # appends a managed block to AGENTS.md
node install.mjs --client opencode       # appends a managed block to AGENTS.md
node install.mjs --client claude-code    # appends a managed block to CLAUDE.md
node install.mjs --client cursor         # writes .cursor/rules/liquidlm.mdc
node install.mjs --client generic        # writes LIQUIDLM.md
```

Codex and opencode share the `AGENTS.md` target by design; installing both is
idempotent and never duplicates the block.

Add `--mcp-endpoint <url>` for self-hosted deployments, `--print` to render
without writing, `--uninstall` to remove, and `--force` to replace a block that
was edited by hand. Existing files are backed up to `<file>.liquidlm.bak`
before any change; unrelated content in shared files is preserved.

Client compatibility is recorded in `manifest.json`; an adapter without a
tested-client entry is a candidate, not a supported integration. See
[SUPPORT.md](SUPPORT.md).

## Development

No dependencies are required beyond Node 18+. Run the checks:

```sh
node scripts/emit-adapters.mjs --check   # generated-artifact drift
node --test tests/*.test.mjs             # installer + contract tests
```

Edit `conventions.md` only; adapters and the manifest checksum are generated
(`node scripts/emit-adapters.mjs`) and drift-checked in CI. Version bumps
change `manifest.json` deliberately, with a CHANGELOG entry.
