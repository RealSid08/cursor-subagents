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
const rootPackageJsonPath = join(root, "package.json");
const ciWorkflowPath = join(root, ".github", "workflows", "ci.yml");
const publishWorkflowPath = join(root, ".github", "workflows", "publish.yml");
const publishScriptPath = join(root, "scripts", "publish-npm.mjs");
const publishCheckScriptPath = join(root, "scripts", "check-publish-ready.mjs");
const changelogPath = join(root, "CHANGELOG.md");
const securityPath = join(root, "SECURITY.md");
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
const packageSetupPath = join(packageRoot, "src", "setup.mjs");
const packageOpenCodeLocalPluginPath = join(packageRoot, "src", "opencode-local-plugin.mjs");
const opencodePackageJsonPath = join(opencodePackageRoot, "package.json");
const opencodePackageIndexPath = join(opencodePackageRoot, "index.js");
const piPackageJsonPath = join(piPackageRoot, "package.json");
const piPackageSkillPath = join(piPackageRoot, "skills", "cursor-subagents", "SKILL.md");
const piPackageExtensionPath = join(piPackageRoot, "extensions", "cursor-subagents.js");
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

requireFile(rootPackageJsonPath);
requireFile(ciWorkflowPath);
requireFile(publishWorkflowPath);
requireFile(publishScriptPath);
requireFile(publishCheckScriptPath);
requireFile(changelogPath);
requireFile(securityPath);
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
requireFile(packageSetupPath);
requireFile(packageOpenCodeLocalPluginPath);
requireFile(opencodePackageJsonPath);
requireFile(opencodePackageIndexPath);
requireFile(piPackageJsonPath);
requireFile(piPackageSkillPath);
requireFile(piPackageExtensionPath);
requireFile(opencodePath);
requireFile(opencodeToolPath);
requireFile(piAdapterPath);

const rootPackageJson = existsSync(rootPackageJsonPath) ? readJson(rootPackageJsonPath) : null;
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

if (rootPackageJson) {
  if (rootPackageJson.bin?.["cursor-subagents"] !== "./packages/cursor-subagents/bin/cursor-subagents.mjs") {
    failures.push("root package must expose cursor-subagents bin for npx github installs");
  }
  if (!Array.isArray(rootPackageJson.pi?.skills)) failures.push("root package must declare pi.skills");
  if (!Array.isArray(rootPackageJson.pi?.extensions)) failures.push("root package must declare pi.extensions");
  if (!rootPackageJson.pi?.extensions?.includes("packages/pi-cursor-subagents/extensions")) {
    failures.push("root pi.extensions must include packages/pi-cursor-subagents/extensions");
  }
  for (const script of ["publish:check", "publish:npm", "publish:npm:dry-run"]) {
    if (!rootPackageJson.scripts?.[script]) failures.push(`root package scripts must include ${script}`);
  }
}

if (packageJson) {
  if (packageJson.name !== "cursor-subagents") failures.push("runtime package name must be cursor-subagents");
  if (!["./bin/cursor-subagents.mjs", "bin/cursor-subagents.mjs"].includes(packageJson.bin?.["cursor-subagents"])) {
    failures.push("runtime package must expose cursor-subagents bin");
  }
  if (packageJson.exports?.["./package.json"] !== "./package.json") {
    failures.push("runtime package must export ./package.json for native harness plugin resolution");
  }
  if (packageJson.exports?.["./opencode-local-plugin"] !== "./src/opencode-local-plugin.mjs") {
    failures.push("runtime package must export ./opencode-local-plugin for setup fallback copies");
  }
  if (packageJson.publishConfig?.access !== "public") failures.push("runtime package publishConfig.access must be public");
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
  if (opencodePackageJson.publishConfig?.access !== "public") failures.push("OpenCode package publishConfig.access must be public");
}

if (piPackageJson) {
  if (piPackageJson.name !== "pi-cursor-subagents") failures.push("Pi package name must be pi-cursor-subagents");
  if (!Array.isArray(piPackageJson.pi?.skills)) failures.push("Pi package must declare pi.skills");
  if (!Array.isArray(piPackageJson.pi?.extensions)) failures.push("Pi package must declare pi.extensions");
  if (!piPackageJson.dependencies?.["cursor-subagents"]) {
    failures.push("Pi package must depend on cursor-subagents");
  }
  if (!piPackageJson.peerDependencies?.["typebox"] || !piPackageJson.peerDependencies?.["@earendil-works/pi-ai"]) {
    failures.push("Pi package must peer depend on Pi-provided typebox and @earendil-works/pi-ai");
  }
  if (piPackageJson.publishConfig?.access !== "public") failures.push("Pi package publishConfig.access must be public");
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
for (const path of [claudeServerPath, packageBinPath, packageMcpPath, packageSetupPath, packageOpenCodeLocalPluginPath, opencodePackageIndexPath, opencodeToolPath, piPackageExtensionPath, publishScriptPath, publishCheckScriptPath]) {
  const check = spawnSync("node", ["--check", path], { encoding: "utf8" });
  if (check.status !== 0) failures.push(`${path} syntax check failed:\n${check.stderr || check.stdout}`);
}

const help = spawnSync("node", [packageBinPath, "--help"], { encoding: "utf8" });
if (help.status !== 0 || !help.stdout.includes("cursor-subagents run")) {
  failures.push("runtime CLI help did not complete or missed run command");
}

const setupHelp = spawnSync("node", [packageBinPath, "setup", "--help"], { encoding: "utf8" });
if (setupHelp.status !== 0 || !setupHelp.stdout.includes("cursor-subagents setup")) {
  failures.push("runtime setup help did not complete");
}

const setupDryRun = spawnSync("node", [packageBinPath, "setup", "--dry-run", "--harness", "codex,claude-code,opencode,pi,skills,mcp", "--json"], { encoding: "utf8" });
if (setupDryRun.status !== 0) {
  failures.push(`runtime setup dry-run failed:\n${setupDryRun.stderr || setupDryRun.stdout}`);
} else {
  try {
    const dryRun = JSON.parse(setupDryRun.stdout);
    if (!dryRun.dryRun || !dryRun.steps?.some((step) => step.target === "pi")) {
      failures.push("runtime setup dry-run JSON missed expected targets");
    }
  } catch (error) {
    failures.push(`runtime setup dry-run emitted invalid JSON: ${error.message}`);
  }
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
