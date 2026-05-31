#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const pluginRoot = join(root, "plugins", "cursor-subagents");
const claudePluginRoot = join(root, "plugins", "claude-code", "cursor-subagents");
const packageRoot = join(root, "packages", "cursor-subagents");
const opencodePackageRoot = join(root, "packages", "opencode-cursor-subagents");
const piPackageRoot = join(root, "packages", "pi-cursor-subagents");
const rootSkillPath = join(root, "skills", "cursor-subagents", "SKILL.md");
const licensePath = join(root, "LICENSE");
const manifestPath = join(pluginRoot, ".codex-plugin", "plugin.json");
const marketplacePath = join(root, ".agents", "plugins", "marketplace.json");
const claudeMarketplacePath = join(root, ".claude-plugin", "marketplace.json");
const claudeManifestPath = join(claudePluginRoot, ".claude-plugin", "plugin.json");
const mcpPath = join(pluginRoot, ".mcp.json");
const serverPath = join(pluginRoot, "scripts", "cursor-subagents-mcp.mjs");
const skillPath = join(pluginRoot, "skills", "cursor-subagents", "SKILL.md");
const claudeMcpPath = join(claudePluginRoot, ".mcp.json");
const claudeServerPath = join(claudePluginRoot, "scripts", "cursor-subagents-mcp.mjs");
const claudeSkillPath = join(claudePluginRoot, "skills", "cursor-subagents", "SKILL.md");
const packageJsonPath = join(packageRoot, "package.json");
const packageBinPath = join(packageRoot, "bin", "cursor-subagents.mjs");
const packageMcpPath = join(packageRoot, "src", "mcp-server.mjs");
const opencodePackageJsonPath = join(opencodePackageRoot, "package.json");
const opencodePackageIndexPath = join(opencodePackageRoot, "index.js");
const piPackageJsonPath = join(piPackageRoot, "package.json");
const piPackageSkillPath = join(piPackageRoot, "skills", "cursor-subagents", "SKILL.md");
const opencodePath = join(root, "adapters", "opencode", "opencode.jsonc");
const opencodeToolPath = join(root, "adapters", "opencode", "tools", "cursor-run-once.js");
const piAdapterPath = join(root, "adapters", "pi", "package.json");

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
requireFile(rootSkillPath);
requireFile(licensePath);
requireFile(mcpPath);
requireFile(serverPath);
requireFile(skillPath);
requireFile(claudeMarketplacePath);
requireFile(claudeManifestPath);
requireFile(claudeMcpPath);
requireFile(claudeServerPath);
requireFile(claudeSkillPath);
requireFile(packageJsonPath);
requireFile(packageBinPath);
requireFile(packageMcpPath);
requireFile(opencodePackageJsonPath);
requireFile(opencodePackageIndexPath);
requireFile(piPackageJsonPath);
requireFile(piPackageSkillPath);
requireFile(opencodePath);
requireFile(opencodeToolPath);
requireFile(piAdapterPath);

const manifest = existsSync(manifestPath) ? readJson(manifestPath) : null;
const marketplace = existsSync(marketplacePath) ? readJson(marketplacePath) : null;
const mcp = existsSync(mcpPath) ? readJson(mcpPath) : null;
const claudeMarketplace = existsSync(claudeMarketplacePath) ? readJson(claudeMarketplacePath) : null;
const claudeManifest = existsSync(claudeManifestPath) ? readJson(claudeManifestPath) : null;
const claudeMcp = existsSync(claudeMcpPath) ? readJson(claudeMcpPath) : null;
const packageJson = existsSync(packageJsonPath) ? readJson(packageJsonPath) : null;
const opencodePackageJson = existsSync(opencodePackageJsonPath) ? readJson(opencodePackageJsonPath) : null;
const piPackageJson = existsSync(piPackageJsonPath) ? readJson(piPackageJsonPath) : null;
const piAdapter = existsSync(piAdapterPath) ? readJson(piAdapterPath) : null;

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

if (packageJson) {
  if (packageJson.name !== "cursor-subagents") failures.push("runtime package name must be cursor-subagents");
  if (packageJson.bin?.["cursor-subagents"] !== "./bin/cursor-subagents.mjs") {
    failures.push("runtime package must expose cursor-subagents bin");
  }
  if (packageJson.exports?.["./package.json"] !== "./package.json") {
    failures.push("runtime package must export ./package.json for native harness plugin resolution");
  }
}

if (opencodePackageJson) {
  if (opencodePackageJson.name !== "opencode-cursor-subagents") {
    failures.push("OpenCode package name must be opencode-cursor-subagents");
  }
  if (opencodePackageJson.main !== "./index.js") {
    failures.push("OpenCode package main must be ./index.js");
  }
  if (!opencodePackageJson.dependencies?.["cursor-subagents"]) {
    failures.push("OpenCode package must depend on cursor-subagents");
  }
  if (!opencodePackageJson.dependencies?.["@opencode-ai/plugin"]) {
    failures.push("OpenCode package must depend on @opencode-ai/plugin");
  }
}

if (piPackageJson) {
  if (piPackageJson.name !== "pi-cursor-subagents") failures.push("Pi package name must be pi-cursor-subagents");
  if (!Array.isArray(piPackageJson.pi?.skills)) failures.push("Pi package must declare pi.skills");
  if (!piPackageJson.dependencies?.["cursor-subagents"]) {
    failures.push("Pi package must depend on cursor-subagents");
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

if (claudeMarketplace) {
  const entry = claudeMarketplace.plugins?.find((plugin) => plugin.name === "cursor-subagents");
  if (!entry) failures.push("Claude marketplace is missing cursor-subagents entry");
  if (entry?.source !== "./plugins/claude-code/cursor-subagents") {
    failures.push("Claude marketplace source should be ./plugins/claude-code/cursor-subagents");
  }
}

if (claudeManifest) {
  if (claudeManifest.name !== "cursor-subagents") failures.push("Claude plugin name must be cursor-subagents");
  if (claudeManifest.version !== manifest?.version) {
    failures.push("Claude plugin version should match Codex plugin version");
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

if (claudeMcp) {
  const server = claudeMcp.mcpServers?.["cursor-subagents"];
  if (!server) failures.push("Claude .mcp.json is missing cursor-subagents server");
  if (server?.command !== "node") failures.push("Claude .mcp.json should launch with node");
  if (!server?.args?.includes("./scripts/cursor-subagents-mcp.mjs")) {
    failures.push("Claude .mcp.json should point at ./scripts/cursor-subagents-mcp.mjs");
  }
}

if (piAdapter && !Array.isArray(piAdapter.pi?.skills)) {
  failures.push("Pi adapter package.json must declare pi.skills");
}

const rootSkill = existsSync(rootSkillPath) ? readFileSync(rootSkillPath, "utf8") : "";
const codexSkill = existsSync(skillPath) ? readFileSync(skillPath, "utf8") : "";
const claudeSkill = existsSync(claudeSkillPath) ? readFileSync(claudeSkillPath, "utf8") : "";
const piPackageSkill = existsSync(piPackageSkillPath) ? readFileSync(piPackageSkillPath, "utf8") : "";
if (rootSkill && codexSkill && rootSkill !== codexSkill) {
  failures.push("Codex plugin skill copy differs from canonical root skill");
}
if (rootSkill && claudeSkill && rootSkill !== claudeSkill) {
  failures.push("Claude plugin skill copy differs from canonical root skill");
}
if (rootSkill && piPackageSkill && rootSkill !== piPackageSkill) {
  failures.push("Pi package skill copy differs from canonical root skill");
}

const codexMcpServer = existsSync(serverPath) ? readFileSync(serverPath, "utf8") : "";
const claudeMcpServer = existsSync(claudeServerPath) ? readFileSync(claudeServerPath, "utf8") : "";
const packageMcpServer = existsSync(packageMcpPath) ? readFileSync(packageMcpPath, "utf8") : "";
if (codexMcpServer && claudeMcpServer && codexMcpServer !== claudeMcpServer) {
  failures.push("Claude MCP server copy differs from Codex plugin MCP server");
}
if (codexMcpServer && packageMcpServer && codexMcpServer !== packageMcpServer) {
  failures.push("Runtime package MCP server copy differs from Codex plugin MCP server");
}

const syntax = spawnSync("node", ["--check", serverPath], { encoding: "utf8" });
if (syntax.status !== 0) {
  failures.push(`MCP server syntax check failed:\n${syntax.stderr || syntax.stdout}`);
}
for (const path of [claudeServerPath, packageBinPath, packageMcpPath, opencodePackageIndexPath, opencodeToolPath]) {
  const check = spawnSync("node", ["--check", path], { encoding: "utf8" });
  if (check.status !== 0) failures.push(`${path} syntax check failed:\n${check.stderr || check.stdout}`);
}

const help = spawnSync("node", [packageBinPath, "--help"], { encoding: "utf8" });
if (help.status !== 0 || !help.stdout.includes("cursor-subagents run")) {
  failures.push("runtime CLI help did not complete or missed run command");
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
