#!/usr/bin/env node
// LiquidLM skills installer. Installs, updates or removes the assistant
// conventions for one client, touching only owned files or a delimited
// managed block. Dependency-free; requires Node 18+.
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  readFileSync,
  rmSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const BEGIN = /<!-- liquidlm:begin sha256:([0-9a-f]{64}) -->/;
const END = "<!-- liquidlm:end -->";

function sha(text) {
  return createHash("sha256").update(text).digest("hex");
}

function usage(stream = console.error) {
  stream(`Usage: node install.mjs --client <generic|claude-code|codex|cursor> [options]

Options:
  --mcp-endpoint <url>  MCP endpoint to embed (default: https://mcp.liquidlm.com/v1/mcp)
  --dir <path>          Project directory (default: current working directory)
  --uninstall           Remove the managed conventions instead of installing
  --force               Replace even when the managed content was edited by hand
  --print               Print the rendered conventions to stdout and exit
  --help                Show this help`);
}

function parseArgs(argv) {
  const opts = {
    dir: process.cwd(),
    endpoint: "https://mcp.liquidlm.com/v1/mcp",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--client") opts.client = argv[++i];
    else if (arg === "--mcp-endpoint") opts.endpoint = argv[++i];
    else if (arg === "--dir") opts.dir = argv[++i];
    else if (arg === "--uninstall") opts.uninstall = true;
    else if (arg === "--force") opts.force = true;
    else if (arg === "--print") opts.print = true;
    else if (arg === "--help") {
      usage(console.log);
      process.exit(0);
    } else {
      console.error(`Unknown option: ${arg}`);
      usage();
      process.exit(1);
    }
  }
  if (!opts.client) {
    usage();
    process.exit(1);
  }
  return opts;
}

const manifest = JSON.parse(readFileSync(join(here, "manifest.json"), "utf8"));

function render(clientName, endpoint) {
  const client = manifest.clients[clientName];
  if (!client) {
    console.error(
      `Unsupported client "${clientName}". Known: ${Object.keys(manifest.clients).join(", ")}`,
    );
    process.exit(1);
  }
  const adapter = readFileSync(join(here, client.adapter), "utf8").replaceAll(
    "{{MCP_ENDPOINT}}",
    endpoint,
  );
  if (!client.frontmatter) return { frontmatter: "", body: adapter };
  const match = adapter.match(/^(---\n[\s\S]*?\n---\n\n)([\s\S]*)$/);
  return { frontmatter: match[1], body: match[2] };
}

function wrapBlock(body) {
  return `<!-- liquidlm:begin sha256:${sha(body)} -->\n${body}\n${END}\n`;
}

function parseBlock(content) {
  const begin = content.match(BEGIN);
  if (!begin) return null;
  const endIndex = content.indexOf(END, begin.index + begin[0].length);
  if (endIndex === -1) return null;
  const innerStart = begin.index + begin[0].length + 1;
  return {
    recordedSha: begin[1],
    inner: content.slice(innerStart, endIndex - 1),
    start: begin.index,
    end: endIndex + END.length,
  };
}

function backup(target) {
  copyFileSync(target, `${target}.liquidlm.bak`);
  return `${target}.liquidlm.bak`;
}

const opts = parseArgs(process.argv.slice(2));
const client = manifest.clients[opts.client];
if (!client) {
  console.error(
    `Unsupported client "${opts.client}". Known: ${Object.keys(manifest.clients).join(", ")}`,
  );
  process.exit(1);
}
const { frontmatter, body } = render(opts.client, opts.endpoint);
if (opts.print) {
  process.stdout.write(body);
  process.exit(0);
}

const target = resolve(opts.dir, client.target);
const section = client.mode === "managed-section";

if (!existsSync(target)) {
  if (opts.uninstall) {
    console.log(`Not installed: ${target} does not exist.`);
    process.exit(0);
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, frontmatter + wrapBlock(body));
  console.log(
    `Installed LiquidLM conventions (v${manifest.version}) into ${target}`,
  );
  process.exit(0);
}

const existing = readFileSync(target, "utf8");
const block = parseBlock(existing);

if (opts.uninstall) {
  if (!block) {
    console.error(
      `Refusing to uninstall: ${target} has no LiquidLM managed block; nothing was changed.`,
    );
    process.exit(1);
  }
  if (sha(block.inner) !== block.recordedSha && !opts.force) {
    console.error(
      `Refusing to uninstall: the managed block in ${target} was edited by hand. Re-run with --force to remove it anyway.`,
    );
    process.exit(1);
  }
  const remainder = (existing.slice(0, block.start) + existing.slice(block.end))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const withoutWrapper = section
    ? remainder
    : remainder.replace(/^---\n[\s\S]*?\n---\n?$/, "").trim();
  const path = backup(target);
  if (!withoutWrapper) {
    rmSync(target);
    console.log(`Removed ${target} (backup: ${path})`);
  } else {
    writeFileSync(target, remainder + "\n");
    console.log(
      `Removed the LiquidLM block from ${target}; other content preserved (backup: ${path})`,
    );
  }
  process.exit(0);
}

const expected = wrapBlock(body);
const expectedFile = frontmatter + expected;
if (section) {
  if (block) {
    if (sha(block.inner) === sha(body) && existing.includes(expected.trim())) {
      console.log(`Already up to date: ${target}`);
      process.exit(0);
    }
    if (sha(block.inner) !== block.recordedSha && !opts.force) {
      console.error(
        `Refusing to update: the managed block in ${target} was edited by hand. Re-run with --force to replace it.`,
      );
      process.exit(1);
    }
    const path = backup(target);
    writeFileSync(
      target,
      existing.slice(0, block.start) +
        expected.trimEnd() +
        "\n" +
        existing.slice(block.end),
    );
    console.log(
      `Updated the LiquidLM block in ${target} to v${manifest.version} (backup: ${path})`,
    );
  } else {
    const path = backup(target);
    const separator = existing.endsWith("\n") ? "\n" : "\n\n";
    writeFileSync(target, existing + separator + expected);
    console.log(
      `Appended LiquidLM conventions (v${manifest.version}) to ${target}; existing content preserved (backup: ${path})`,
    );
  }
  process.exit(0);
}

// owned-file mode
if (existing === expectedFile) {
  console.log(`Already up to date: ${target}`);
  process.exit(0);
}
if (!block) {
  if (!opts.force) {
    console.error(
      `Refusing to overwrite ${target}: it exists without a LiquidLM managed block. Re-run with --force to replace it (a backup is made either way).`,
    );
    process.exit(1);
  }
} else if (sha(block.inner) !== block.recordedSha && !opts.force) {
  console.error(
    `Refusing to update: the managed block in ${target} was edited by hand. Re-run with --force to replace it.`,
  );
  process.exit(1);
}
const path = backup(target);
writeFileSync(target, expectedFile);
console.log(`Wrote ${target} at v${manifest.version} (backup: ${path})`);
