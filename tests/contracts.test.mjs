import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const skills = resolve(here, "..");
const conventions = readFileSync(join(skills, "conventions.md"), "utf8");
const manifest = JSON.parse(
  readFileSync(join(skills, "manifest.json"), "utf8"),
);
const fixtures = JSON.parse(
  readFileSync(join(skills, "fixtures/behavior.json"), "utf8"),
);

test("every behavior fixture's anchors are present in the canonical conventions", () => {
  for (const fixture of fixtures.fixtures) {
    for (const anchor of fixture.anchors) {
      assert.ok(
        conventions.includes(anchor),
        `conventions.md is missing contract "${fixture.contract}" anchor: ${anchor}`,
      );
    }
  }
});

test("manifest checksum, clients and adapters are consistent", () => {
  const sha = createHash("sha256").update(conventions).digest("hex");
  assert.equal(manifest.conventionsSha256, sha);
  assert.ok(manifest.version.length > 0);
  for (const [name, client] of Object.entries(manifest.clients)) {
    const adapterPath = join(skills, client.adapter);
    assert.ok(existsSync(adapterPath), `${name}: missing ${client.adapter}`);
    const adapter = readFileSync(adapterPath, "utf8");
    assert.ok(
      adapter.includes("{{MCP_ENDPOINT}}"),
      `${name}: adapter keeps the endpoint placeholder`,
    );
    assert.ok(
      adapter.replace(/^---\n[\s\S]*?\n---\n\n/, "") === conventions,
      `${name}: adapter body matches conventions.md`,
    );
    assert.ok(
      client.target.length > 0 &&
        ["owned-file", "managed-section"].includes(client.mode),
    );
  }
});

test("expected tool names cover the documented memory surface", () => {
  const tools = new Set(manifest.expectedTools);
  for (const tool of [
    "search_knowledge",
    "get_knowledge",
    "put_knowledge",
    "forget_knowledge",
    "follow_references",
  ]) {
    assert.ok(tools.has(tool), `expectedTools missing ${tool}`);
  }
  assert.equal(
    tools.size,
    manifest.expectedTools.length,
    "duplicate tool names",
  );
});

test("only the cursor adapter carries a client-specific wrapper", () => {
  for (const [name, client] of Object.entries(manifest.clients)) {
    const adapter = readFileSync(join(skills, client.adapter), "utf8");
    if (name === "cursor")
      assert.ok(adapter.startsWith("---\n"), "cursor keeps frontmatter");
    else
      assert.equal(
        adapter,
        conventions,
        `${name} must equal the canonical conventions`,
      );
  }
});
