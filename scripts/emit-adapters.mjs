import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// The script lives at <skills-root>/scripts/ in every layout (source checkout
// or staged repository), so the skills root is always its parent directory.
const skillsDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const conventions = readFileSync(resolve(skillsDir, "conventions.md"), "utf8");
const sha256 = createHash("sha256").update(conventions).digest("hex");

const CURSOR_FRONTMATTER = `---
description: LiquidLM knowledge backend conventions (search first, cite, scoped vaults)
alwaysApply: true
---

`;

const manifestPath = resolve(skillsDir, "manifest.json");
const existing = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, "utf8"))
  : {};
const manifest = {
  version: existing.version ?? "0.1.0-alpha.0",
  conventionsSha256: sha256,
  clients: {
    generic: {
      adapter: "adapters/generic.md",
      target: "LIQUIDLM.md",
      mode: "owned-file",
    },
    "claude-code": {
      adapter: "adapters/claude-code.md",
      target: "CLAUDE.md",
      mode: "managed-section",
    },
    codex: {
      adapter: "adapters/codex.md",
      target: "AGENTS.md",
      mode: "managed-section",
    },
    opencode: {
      adapter: "adapters/opencode.md",
      target: "AGENTS.md",
      mode: "managed-section",
    },
    cursor: {
      adapter: "adapters/cursor.mdc",
      target: ".cursor/rules/liquidlm.mdc",
      mode: "owned-file",
      frontmatter: true,
    },
  },
  expectedTools: [
    "search_knowledge",
    "get_knowledge",
    "list_knowledge",
    "put_knowledge",
    "forget_knowledge",
    "follow_references",
    "get_related",
    "list_entities",
    "pin_knowledge",
    "unpin_knowledge",
    "get_document_pages",
    "search",
    "fetch",
  ],
  testedClients: {},
};

const outputs = new Map([
  ["adapters/generic.md", conventions],
  ["adapters/claude-code.md", conventions],
  ["adapters/codex.md", conventions],
  ["adapters/opencode.md", conventions],
  ["adapters/cursor.mdc", CURSOR_FRONTMATTER + conventions],
  ["manifest.json", JSON.stringify(manifest, null, 2) + "\n"],
]);

const check = process.argv.includes("--check");
let drifted = false;
for (const [rel, content] of outputs) {
  const path = resolve(skillsDir, rel);
  if (check) {
    if (!existsSync(path) || readFileSync(path, "utf8") !== content) {
      console.error(
        `Skills adapter drift: ${rel} (run scripts/emit-adapters.mjs)`,
      );
      drifted = true;
    }
  } else {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
}
if (drifted) process.exit(1);
console.log(
  `Skills conventions sha256: ${sha256} (${outputs.size} artifacts ${check ? "verified" : "written"})`,
);
