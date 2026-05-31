#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const pluginRoot = join(root, "plugins", "cursor-subagents");
const manifestPath = join(pluginRoot, ".codex-plugin", "plugin.json");
const marketplacePath = join(root, ".agents", "plugins", "marketplace.json");
const mcpPath = join(pluginRoot, ".mcp.json");
const serverPath = join(pluginRoot, "scripts", "cursor-subagents-mcp.mjs");
const skillPath = join(pluginRoot, "skills", "cursor-subagents", "SKILL.md");

const failures = [];
const warnings = [];

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    failures.push(`${path}: ${error.message}`);
    return null;
  }
}

function requireFile(path) {
  if (!existsSync(path)) failures.push(`Missing required file: ${path}`);
}

requireFile(manifestPath);
requireFile(marketplacePath);
requireFile(mcpPath);
requireFile(serverPath);
requireFile(skillPath);

const manifest = existsSync(manifestPath) ? readJson(manifestPath) : null;
const marketplace = existsSync(marketplacePath) ? readJson(marketplacePath) : null;
const mcp = existsSync(mcpPath) ? readJson(mcpPath) : null;

if (manifest) {
  if (manifest.name !== "cursor-subagents") failures.push("plugin.json name must be cursor-subagents");
  if (!/^\d+\.\d+\.\d+(?:[+-][0-9A-Za-z.-]+)?$/.test(manifest.version || "")) {
    failures.push("plugin.json version should be semver-like");
  }
  if (manifest.mcpServers !== "./.mcp.json") failures.push("plugin.json mcpServers should point to ./.mcp.json");
  if (manifest.skills !== "./skills/") failures.push("plugin.json skills should point to ./skills/");
  if (manifest.interface?.displayName !== "Cursor Subagents") {
    failures.push("plugin interface displayName should be Cursor Subagents");
  }
}

if (marketplace) {
  const entry = marketplace.plugins?.find((plugin) => plugin.name === "cursor-subagents");
  if (!entry) failures.push("marketplace is missing cursor-subagents entry");
  if (entry?.source?.path !== "./plugins/cursor-subagents") {
    failures.push("marketplace cursor-subagents source path should be ./plugins/cursor-subagents");
  }
  if (!entry?.policy?.installation || !entry?.policy?.authentication) {
    failures.push("marketplace cursor-subagents entry must include installation and authentication policy");
  }
}

if (mcp) {
  const server = mcp.mcpServers?.["cursor-subagents"];
  if (!server) failures.push(".mcp.json is missing cursor-subagents server");
  if (server?.command !== "node") failures.push(".mcp.json should launch with node");
  if (!server?.args?.includes("./scripts/cursor-subagents-mcp.mjs")) {
    failures.push(".mcp.json should point at ./scripts/cursor-subagents-mcp.mjs");
  }
  if (server?.cwd !== ".") failures.push(".mcp.json should set cwd to .");
}

const syntax = spawnSync("node", ["--check", serverPath], { encoding: "utf8" });
if (syntax.status !== 0) {
  failures.push(`MCP server syntax check failed:\n${syntax.stderr || syntax.stdout}`);
}

const cursorBinary = process.env.CURSOR_AGENT_BIN || "cursor-agent";
const cursorVersion = spawnSync(cursorBinary, ["--version"], { encoding: "utf8" });
if (cursorVersion.status !== 0) {
  warnings.push(`Cursor Agent CLI was not found as ${cursorBinary}; users must install/authenticate it before use.`);
}

if (warnings.length) {
  console.warn("Warnings:");
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (failures.length) {
  console.error("Distribution validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Distribution validation passed.");
if (cursorVersion.status === 0) console.log(`Cursor Agent CLI: ${cursorVersion.stdout.trim()}`);
