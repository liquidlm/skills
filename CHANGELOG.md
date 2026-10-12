# Changelog

## 0.1.0-alpha.0 — source candidate

- Canonical conventions document with privacy, provenance, temporal-correction
  and prompt-injection behavior rules, pinned by SHA-256 in `manifest.json`.
- Adapters for generic (`LIQUIDLM.md`), Claude Code (`CLAUDE.md`), Codex
  (`AGENTS.md`) and Cursor (`.cursor/rules/liquidlm.mdc`) targets.
- Dependency-free installer with reversible managed blocks: install, repeated
  install, update, hand-edit detection, uninstall and rolling backups.
- Behavior-contract fixtures and installer reversibility tests.
