import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const installer = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../install.mjs",
);
let project;
beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), "liquidlm-skills-"));
});
afterEach(() => rmSync(project, { recursive: true, force: true }));

function run(args, { fail = false } = {}) {
  try {
    const stdout = execFileSync(
      process.execPath,
      [installer, ...args, "--dir", project],
      { encoding: "utf8" },
    );
    if (fail) assert.fail("expected the installer to refuse");
    return stdout;
  } catch (error) {
    if (!fail) throw error;
    return error.stderr.toString();
  }
}
const read = (rel) => readFileSync(join(project, rel), "utf8");

test("install into an empty project, repeated install is a no-op", () => {
  run(["--client", "codex"]);
  const first = read("AGENTS.md");
  assert.match(first, /liquidlm:begin sha256:[0-9a-f]{64}/);
  assert.match(first, /Search first/);
  assert.match(first, /https:\/\/mcp\.liquidlm\.com\/v1\/mcp/);
  assert.doesNotMatch(first, /\{\{MCP_ENDPOINT\}\}/);
  assert.match(run(["--client", "codex"]), /Already up to date/);
  assert.equal(read("AGENTS.md"), first);
});

test("managed section preserves existing user content and updates in place", () => {
  writeFileSync(
    join(project, "CLAUDE.md"),
    "# My project\n\nExisting instructions stay.\n",
  );
  run(["--client", "claude-code"]);
  const withSection = read("CLAUDE.md");
  assert.ok(
    withSection.startsWith("# My project\n\nExisting instructions stay.\n"),
  );
  assert.match(withSection, /liquidlm:begin/);
  assert.ok(existsSync(join(project, "CLAUDE.md.liquidlm.bak")));
  // Simulate a conventions update: replace the block with an older render whose
  // inner content matches its recorded checksum.
  const older = withSection.replace(
    "Search first.",
    "Search first (older wording).",
  );
  const blockRe =
    /<!-- liquidlm:begin sha256:[0-9a-f]{64} -->\n([\s\S]*?)\n<!-- liquidlm:end -->/;
  const inner = older.match(blockRe)[1];
  const rehashed = older.replace(
    /sha256:[0-9a-f]{64}/,
    `sha256:${createHash("sha256").update(inner).digest("hex")}`,
  );
  writeFileSync(join(project, "CLAUDE.md"), rehashed);
  assert.match(run(["--client", "claude-code"]), /Updated the LiquidLM block/);
  const updated = read("CLAUDE.md");
  assert.match(updated, /Search first\./);
  assert.ok(updated.includes("Existing instructions stay."));
});

test("hand-edited managed block is detected and requires --force", () => {
  run(["--client", "claude-code"]);
  const tampered = read("CLAUDE.md").replace(
    "Search first.",
    "User custom instruction.",
  );
  writeFileSync(join(project, "CLAUDE.md"), tampered);
  assert.match(
    run(["--client", "claude-code"], { fail: true }),
    /edited by hand/,
  );
  assert.equal(read("CLAUDE.md"), tampered);
  assert.match(
    run(["--client", "claude-code", "--force"]),
    /Updated the LiquidLM block/,
  );
});

test("uninstall removes the block, keeps other content, and restores cleanly", () => {
  writeFileSync(join(project, "AGENTS.md"), "# Pre-existing\n");
  run(["--client", "codex"]);
  assert.match(
    run(["--client", "codex", "--uninstall"]),
    /other content preserved/,
  );
  assert.equal(read("AGENTS.md"), "# Pre-existing\n");
  assert.ok(existsSync(join(project, "AGENTS.md.liquidlm.bak")));
  assert.match(
    run(["--client", "codex", "--uninstall"], { fail: true }),
    /no LiquidLM managed block/,
  );
});

test("owned-file client creates and deletes its own file", () => {
  run(["--client", "generic"]);
  assert.match(read("LIQUIDLM.md"), /# LiquidLM MCP Skill/);
  assert.match(run(["--client", "generic", "--uninstall"]), /Removed/);
  assert.ok(!existsSync(join(project, "LIQUIDLM.md")));
  assert.ok(existsSync(join(project, "LIQUIDLM.md.liquidlm.bak")));
});

test("owned-file client refuses to overwrite a foreign file without --force", () => {
  writeFileSync(join(project, "LIQUIDLM.md"), "Someone else's file\n");
  assert.match(
    run(["--client", "generic"], { fail: true }),
    /Refusing to overwrite/,
  );
  assert.equal(read("LIQUIDLM.md"), "Someone else's file\n");
  run(["--client", "generic", "--force"]);
  assert.match(read("LIQUIDLM.md"), /# LiquidLM MCP Skill/);
  assert.equal(read("LIQUIDLM.md.liquidlm.bak"), "Someone else's file\n");
});

test("cursor adapter writes frontmatter plus a managed block in .cursor/rules", () => {
  run(["--client", "cursor"]);
  const content = read(".cursor/rules/liquidlm.mdc");
  assert.ok(content.startsWith("---\ndescription:"));
  assert.match(content, /alwaysApply: true/);
  assert.match(content, /liquidlm:begin sha256:/);
  assert.match(run(["--client", "cursor", "--uninstall"]), /Removed/);
  assert.ok(!existsSync(join(project, ".cursor/rules/liquidlm.mdc")));
});

test("custom endpoint is embedded; --print renders without writing", () => {
  run([
    "--client",
    "generic",
    "--mcp-endpoint",
    "https://memory.example.test/v1/mcp",
  ]);
  assert.match(read("LIQUIDLM.md"), /https:\/\/memory\.example\.test\/v1\/mcp/);
  const out = run([
    "--client",
    "generic",
    "--print",
    "--mcp-endpoint",
    "https://other.example/v1/mcp",
  ]);
  assert.match(out, /https:\/\/other\.example\/v1\/mcp/);
  assert.match(read("LIQUIDLM.md"), /memory\.example\.test/);
});

test("uninstall of a hand-edited block requires --force", () => {
  run(["--client", "codex"]);
  writeFileSync(
    join(project, "AGENTS.md"),
    read("AGENTS.md").replace("Search first.", "Edited."),
  );
  assert.match(
    run(["--client", "codex", "--uninstall"], { fail: true }),
    /edited by hand/,
  );
  assert.match(run(["--client", "codex", "--uninstall", "--force"]), /Removed/);
  assert.ok(!existsSync(join(project, "AGENTS.md")));
});

test("opencode and codex share AGENTS.md without clobbering each other", () => {
  run(["--client", "codex"]);
  const afterCodex = read("AGENTS.md");
  assert.match(run(["--client", "opencode"]), /Already up to date/);
  assert.equal(read("AGENTS.md"), afterCodex);
  assert.match(
    run(["--client", "opencode", "--uninstall"]),
    /other content preserved|Removed/,
  );
});

test("parity: byte-identical block to the CLI installer (shared fixture hash)", () => {
  run(["--client", "opencode", "--mcp-endpoint", "https://mcp.example.test/v1/mcp"]);
  const digest = createHash("sha256").update(readFileSync(join(project, "AGENTS.md"))).digest("hex");
  assert.equal(digest, "05139399b4536ffd4b720c4477a9cfd467d5758ac0f3ce1964480d4dbe9756bd");
});

test("unknown client and missing --client fail with usage", () => {
  assert.match(
    run(["--client", "emacs"], { fail: true }),
    /Unsupported client/,
  );
  assert.match(run([], { fail: true }), /Usage:/);
});
