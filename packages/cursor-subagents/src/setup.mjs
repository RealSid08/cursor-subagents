import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { cursorBinary } from "./cursor-cli.mjs";

const REPO = "RealSid08/cursor-subagents";
const NPM_RUNTIME = "cursor-subagents";
const OPENCODE_PACKAGE = "opencode-cursor-subagents";
const PI_PACKAGE = "pi-cursor-subagents";
const CLAUDE_PLUGIN = "cursor-subagents@cursor-subagents";
const ALL_TARGETS = ["codex", "claude-code", "opencode", "pi", "skills", "mcp"];
const here = dirname(fileURLToPath(import.meta.url));
const TARGET_ALIASES = new Map([
  ["claude", "claude-code"],
  ["claude-code-desktop", "claude-code"],
  ["claude-desktop", "claude-code"],
  ["open-code", "opencode"],
  ["skill", "skills"],
  ["agent-skills", "skills"],
  ["generic-mcp", "mcp"],
]);

export function setupHelp() {
  return `cursor-subagents setup

Usage:
  cursor-subagents setup [--interactive] [--harness <targets>] [--all] [--yes] [--dry-run] [--json]
  cursor-subagents install [same options]

Targets:
  codex          Add the Codex plugin marketplace from GitHub.
  claude-code    Add and install the Claude Code plugin marketplace package.
  opencode       Install the native OpenCode npm plugin or update opencode.json.
  pi             Install the Pi package from GitHub, with npm as a release option.
  skills         Install the harness-agnostic Agent Skill through npx skills.
  mcp            Print a generic MCP server config for harnesses without plugins.

Options:
  --harness <list>          Comma-separated targets, or repeat the flag.
  --all                     Select every target.
  --scope <scope>           user|project|local|global. Defaults to user/global.
  --source <source>         github|npm. Defaults to github until npm packages ship.
  --repo <owner/repo>       GitHub repository for marketplace/skills installs.
  --npm-package <name>      Runtime npm package for MCP snippets. Defaults to cursor-subagents.
  --install-cursor          Install Cursor CLI if cursor-agent is missing.
  --skip-cursor-install     Never install Cursor CLI; only print next steps.
  --login-cursor            Run cursor-agent login when not authenticated.
  --interactive             Force the guided terminal installer, even with --dry-run.
  --no-color                Disable ANSI color in human-readable output.
  --yes                     Non-interactive yes for selected actions.
  --dry-run                 Show what would happen without changing anything.
  --json                    Emit machine-readable results.

Examples:
  npx -y github:RealSid08/cursor-subagents setup
  npx -y github:RealSid08/cursor-subagents setup --interactive --dry-run
  npx -y cursor-subagents setup --all --yes
  cursor-subagents setup --harness codex,claude-code,opencode --install-cursor
`;
}

export async function runSetup(rawFlags = {}, io = {}) {
  const flags = normalizeFlags(rawFlags);
  const out = io.stdout || process.stdout;
  const err = io.stderr || process.stderr;
  const detected = await detectEnvironment();
  const interactive = shouldUseInteractive(flags);
  const ui = createUi(flags, out);
  const selection = interactive
    ? await collectInteractiveSetup(flags, detected, ui)
    : { targets: await selectTargets(flags, detected, false), cancelled: false };
  const targets = selection.targets;
  let steps = [];
  let cancelled = selection.cancelled === true;

  if (interactive && !cancelled) {
    const plannedSteps = await buildSetupSteps({ ...flags, dryRun: true }, detected, targets, false);
    out.write(formatInteractivePlan(plannedSteps, ui, flags));
    if (flags.dryRun) {
      steps = plannedSteps;
    } else {
      const proceed = await confirmPrompt(ui, "Proceed with these changes?", true);
      if (proceed) {
        steps = await buildSetupSteps(flags, detected, targets, false);
      } else {
        cancelled = true;
        steps = plannedSteps;
      }
    }
  }

  if (!flags.json && !interactive) {
    out.write(formatSummaryHeader(flags, detected, targets, ui));
  }

  if (!interactive) {
    steps = await buildSetupSteps(flags, detected, targets, false);
  }

  const result = {
    ok: steps.every((step) => step.status !== "failed"),
    cancelled,
    dryRun: flags.dryRun,
    source: flags.source,
    scope: flags.scope,
    selectedTargets: targets,
    detected,
    steps,
  };

  if (flags.json) {
    out.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    out.write(formatSteps(steps, ui, { cancelled }));
  }

  if (!result.ok) {
    err.write("One or more setup steps failed. The JSON output has exact commands and stderr.\n");
  }
  return result;
}

function normalizeFlags(flags) {
  const normalized = { ...flags };
  normalized.repo = normalized.repo || REPO;
  normalized.sourceWasSet = Boolean(normalized.source);
  normalized.scopeWasSet = Boolean(normalized.scope);
  normalized.source = normalized.source || "github";
  normalized.scope = normalized.scope || "user";
  normalized.npmPackage = normalized["npm-package"] || normalized.npmPackage || NPM_RUNTIME;
  normalized.yes = normalized.yes === true;
  normalized.all = normalized.all === true;
  normalized.json = normalized.json === true;
  normalized.dryRun = normalized["dry-run"] === true || normalized.dryRun === true;
  normalized.installCursor = normalized["install-cursor"] === true || normalized.installCursor === true;
  normalized.skipCursorInstall = normalized["skip-cursor-install"] === true || normalized.skipCursorInstall === true;
  normalized.loginCursor = normalized["login-cursor"] === true || normalized.loginCursor === true;
  normalized.interactive = normalized.interactive === true;
  normalized.noColor = normalized["no-color"] === true || normalized.noColor === true;
  normalized.harnesses = parseHarnesses(normalized.harness || normalized.harnesses || normalized.target || normalized.targets);
  if (!["github", "npm"].includes(normalized.source)) throw new Error("--source must be github or npm");
  if (!["user", "project", "local", "global"].includes(normalized.scope)) {
    throw new Error("--scope must be user, project, local, or global");
  }
  return normalized;
}

function parseHarnesses(value) {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  const targets = [];
  for (const item of raw) {
    for (const piece of String(item).split(",")) {
      const key = piece.trim().toLowerCase();
      if (!key) continue;
      const target = TARGET_ALIASES.get(key) || key;
      if (target === "all") {
        for (const name of ALL_TARGETS) pushUnique(targets, name);
      } else if (ALL_TARGETS.includes(target)) {
        pushUnique(targets, target);
      } else {
        throw new Error(`Unknown setup target: ${piece}`);
      }
    }
  }
  return targets;
}

function shouldUseInteractive(flags) {
  if (flags.yes || flags.json) return false;
  const tty = process.stdin.isTTY && process.stdout.isTTY;
  if (!tty) return false;
  return flags.interactive || !flags.dryRun && flags.harnesses.length === 0 && !flags.all;
}

function createUi(flags, out) {
  const useColor = !flags.noColor && !process.env.NO_COLOR && out.isTTY === true;
  const color = (code, text) => useColor ? `\x1b[${code}m${text}\x1b[0m` : text;
  return {
    out,
    color,
    dim: (text) => color("2", text),
    bold: (text) => color("1", text),
    green: (text) => color("32", text),
    yellow: (text) => color("33", text),
    red: (text) => color("31", text),
    cyan: (text) => color("36", text),
  };
}

async function collectInteractiveSetup(flags, detected, ui) {
  const defaults = detectedNativeTargets(detected);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    ui.out.write(formatInteractiveIntro(flags, detected, defaults, ui));

    const targets = flags.all
      ? [...ALL_TARGETS]
      : flags.harnesses.length
        ? flags.harnesses
        : await promptInstallProfile(rl, defaults, ui);

    if (!targets.length) {
      return { targets: [], cancelled: true };
    }

    if (!flags.sourceWasSet && targets.some((target) => ["opencode", "pi", "mcp"].includes(target))) {
      flags.source = await promptChoice(rl, ui, {
        label: "Package source",
        defaultValue: "github",
        choices: [
          ["github", "GitHub repo now (recommended before npm publication)"],
          ["npm", "npm registry packages"],
        ],
      });
    }

    if (!flags.scopeWasSet && targets.some((target) => ["claude-code", "opencode"].includes(target))) {
      flags.scope = await promptChoice(rl, ui, {
        label: "Install scope",
        defaultValue: "user",
        choices: [
          ["user", "current user / global harness config"],
          ["project", "current project only"],
        ],
      });
    }

    ui.out.write(`\n${ui.bold("Selection")}\n`);
    ui.out.write(`  targets: ${targets.join(", ")}\n`);
    ui.out.write(`  source: ${flags.source}\n`);
    ui.out.write(`  scope: ${flags.scope}\n`);
    if (flags.dryRun) ui.out.write(`  mode: dry run; no changes will be made\n`);
    ui.out.write("\n");

    return { targets, cancelled: false };
  } finally {
    rl.close();
  }
}

async function promptInstallProfile(rl, defaults, ui) {
  const defaultText = defaults.join(", ") || "skills, mcp";
  ui.out.write(`${ui.bold("Install profile")}\n`);
  ui.out.write(`  1. Recommended  ${ui.dim(defaultText)}\n`);
  ui.out.write(`  2. Everything   ${ui.dim(ALL_TARGETS.join(", "))}\n`);
  ui.out.write(`  3. Custom       ${ui.dim("choose exact targets")}\n`);
  ui.out.write(`  4. MCP only     ${ui.dim("generic fallback config")}\n`);
  ui.out.write(`  5. Exit\n`);
  const answer = (await rl.question("Choose [1]: ")).trim();
  if (!answer || answer === "1") return defaults.length ? defaults : ["skills", "mcp"];
  if (answer === "2") return [...ALL_TARGETS];
  if (answer === "4") return ["mcp"];
  if (answer === "5" || /^q(uit)?$/i.test(answer)) return [];
  if (answer === "3") {
    const custom = await rl.question("Targets (codex, claude-code, opencode, pi, skills, mcp): ");
    return parseHarnesses(custom);
  }
  return parseHarnesses(answer);
}

async function promptChoice(rl, ui, { label, defaultValue, choices }) {
  ui.out.write(`${ui.bold(label)}\n`);
  choices.forEach(([value, description], index) => {
    const suffix = value === defaultValue ? " default" : "";
    ui.out.write(`  ${index + 1}. ${value.padEnd(8)} ${ui.dim(description)}${suffix ? ui.dim(` (${suffix})`) : ""}\n`);
  });
  const answer = (await rl.question(`Choose [${defaultValue}]: `)).trim();
  if (!answer) return defaultValue;
  const byNumber = choices[Number(answer) - 1]?.[0];
  if (byNumber) return byNumber;
  const byValue = choices.find(([value]) => value === answer.toLowerCase())?.[0];
  if (byValue) return byValue;
  throw new Error(`Unknown ${label.toLowerCase()}: ${answer}`);
}

async function confirmPrompt(ui, question, defaultYes) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const suffix = defaultYes ? "[Y/n]" : "[y/N]";
    const answer = (await rl.question(`${question} ${suffix} `)).trim();
    if (!answer) return defaultYes;
    return /^y(es)?$/i.test(answer);
  } finally {
    rl.close();
  }
}

async function buildSetupSteps(flags, detected, targets, interactive) {
  const steps = [];
  await ensureCursorCli(flags, detected, steps, interactive);

  for (const target of targets) {
    if (target === "codex") await installCodex(flags, detected, steps);
    else if (target === "claude-code") await installClaudeCode(flags, detected, steps);
    else if (target === "opencode") await installOpenCode(flags, detected, steps);
    else if (target === "pi") await installPi(flags, detected, steps);
    else if (target === "skills") await installSkills(flags, detected, steps);
    else if (target === "mcp") addMcpSnippet(flags, steps);
  }

  addCursorAuthNote(flags, detected, steps);
  return steps;
}

async function selectTargets(flags, detected, interactive) {
  if (flags.all) return [...ALL_TARGETS];
  if (flags.harnesses.length) return flags.harnesses;
  if (!interactive) return detectedNativeTargets(detected);

  const defaults = detectedNativeTargets(detected);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question([
      "Select targets to install.",
      "Options: codex, claude-code, opencode, pi, skills, mcp, all",
      `Detected default: ${defaults.join(", ") || "skills,mcp"}`,
      "Targets: ",
    ].join("\n"));
    const selected = parseHarnesses(answer || defaults.join(",") || "skills,mcp");
    return selected.length ? selected : defaults;
  } finally {
    rl.close();
  }
}

function detectedNativeTargets(detected) {
  const targets = [];
  if (detected.commands.codex) targets.push("codex");
  if (detected.commands.claude) targets.push("claude-code");
  if (detected.commands.opencode || detected.desktopApps.OpenCode) targets.push("opencode");
  if (detected.commands.pi) targets.push("pi");
  if (!targets.length) targets.push("skills", "mcp");
  return targets;
}

async function detectEnvironment() {
  const commands = {};
  for (const command of ["cursor-agent", "codex", "claude", "opencode", "pi", "npx", "npm", "curl"]) {
    commands[command] = await commandExists(command);
  }

  const cursor = {
    binary: cursorBinary(),
    installed: await commandExists(cursorBinary()),
    version: null,
    authenticated: false,
    status: "",
  };
  if (cursor.installed) {
    const version = await runCommand(cursorBinary(), ["--version"], { timeoutMs: 15000 });
    cursor.version = version.stdout.trim() || null;
    const status = await runCommand(cursorBinary(), ["status"], { timeoutMs: 15000 });
    cursor.authenticated = status.code === 0;
    cursor.status = (status.stdout || status.stderr).trim();
  }

  return {
    platform: platform(),
    cwd: process.cwd(),
    home: homedir(),
    commands,
    cursor,
    desktopApps: detectDesktopApps(),
  };
}

function detectDesktopApps() {
  if (platform() !== "darwin") return {};
  const appRoots = ["/Applications", join(homedir(), "Applications")];
  const names = {
    Codex: ["Codex.app"],
    Claude: ["Claude.app"],
    OpenCode: ["OpenCode.app", "opencode.app"],
    Cursor: ["Cursor.app"],
  };
  const result = {};
  for (const [label, apps] of Object.entries(names)) {
    result[label] = apps.some((app) => appRoots.some((root) => existsSync(join(root, app))));
  }
  return result;
}

async function ensureCursorCli(flags, detected, steps, interactive) {
  if (detected.cursor.installed) {
    steps.push({
      target: "cursor",
      status: "ok",
      message: `Cursor CLI found${detected.cursor.version ? `: ${detected.cursor.version}` : ""}.`,
    });
    if (!detected.cursor.authenticated && flags.loginCursor) {
      await runStep(flags, steps, {
        target: "cursor",
        description: "Authenticate Cursor CLI",
        command: cursorBinary(),
        args: ["login"],
      });
    }
    return;
  }

  const command = "bash";
  const args = ["-lc", "curl https://cursor.com/install -fsS | bash"];
  let shouldInstall = flags.installCursor && !flags.skipCursorInstall;
  if (interactive && !flags.skipCursorInstall) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      const answer = await rl.question("Cursor CLI was not found. Install it now with Cursor's official script? [y/N] ");
      shouldInstall = /^y(es)?$/i.test(answer.trim());
    } finally {
      rl.close();
    }
  }

  if (shouldInstall) {
    await runStep(flags, steps, {
      target: "cursor",
      description: "Install Cursor CLI",
      command,
      args,
    });
  } else {
    steps.push({
      target: "cursor",
      status: "manual",
      command,
      args,
      message: "Cursor CLI is required. Install it with Cursor's official script, then run cursor-agent login.",
    });
  }
}

async function installCodex(flags, detected, steps) {
  if (detected.commands.codex) {
    await runStep(flags, steps, {
      target: "codex",
      description: "Add Codex plugin marketplace",
      command: "codex",
      args: ["plugin", "marketplace", "add", flags.repo],
    });
  } else {
    steps.push({
      target: "codex",
      status: "manual",
      command: "codex",
      args: ["plugin", "marketplace", "add", flags.repo],
      message: desktopHint(detected, "Codex", "Install Codex CLI or add the GitHub marketplace from Codex Desktop's plugin UI."),
    });
  }
  steps.push({
    target: "codex",
    status: "manual",
    message: "Enable Cursor Subagents in the Codex plugin UI, then start a fresh thread so the MCP tools are loaded.",
  });
}

async function installClaudeCode(flags, detected, steps) {
  if (detected.commands.claude) {
    await runStep(flags, steps, {
      target: "claude-code",
      description: "Add Claude Code plugin marketplace",
      command: "claude",
      args: ["plugin", "marketplace", "add", flags.repo],
    });
    await runStep(flags, steps, {
      target: "claude-code",
      description: "Install Claude Code plugin",
      command: "claude",
      args: ["plugin", "install", CLAUDE_PLUGIN, "--scope", claudeScope(flags.scope)],
    });
  } else {
    steps.push({
      target: "claude-code",
      status: "manual",
      command: "claude",
      args: ["plugin", "marketplace", "add", flags.repo],
      message: desktopHint(detected, "Claude", "Install Claude Code CLI or add the marketplace from Claude Code Desktop's Add plugin browser."),
    });
  }
  steps.push({
    target: "claude-code",
    status: "manual",
    message: "Claude Code Desktop uses the same configured marketplaces; use Add plugin / Manage plugins if you prefer the desktop UI.",
  });
}

async function installOpenCode(flags, detected, steps) {
  if (flags.source !== "npm") {
    await installOpenCodeLocal(flags, steps);
    return;
  }

  if (detected.commands.opencode) {
    const args = ["plugin", OPENCODE_PACKAGE];
    if (flags.scope !== "project" && flags.scope !== "local") args.push("--global");
    await runStep(flags, steps, {
      target: "opencode",
      description: "Install OpenCode native plugin",
      command: "opencode",
      args,
    });
    return;
  }

  const configPath = opencodeConfigPath(flags.scope);
  if (flags.dryRun || canWriteConfig(configPath)) {
    const step = {
      target: "opencode",
      description: "Update OpenCode config plugin array",
      status: flags.dryRun ? "planned" : "ok",
      path: configPath,
      message: `Ensure ${OPENCODE_PACKAGE} is listed in ${configPath}.`,
    };
    if (!flags.dryRun) {
      const updated = updateOpenCodeConfig(configPath);
      step.updated = updated;
    }
    steps.push(step);
  } else {
    steps.push({
      target: "opencode",
      status: "manual",
      command: "opencode",
      args: ["plugin", OPENCODE_PACKAGE, "--global"],
      message: desktopHint(detected, "OpenCode", `Add "${OPENCODE_PACKAGE}" to the plugin array in ${configPath}.`),
    });
  }
}

async function installOpenCodeLocal(flags, steps) {
  const configDir = flags.scope === "project" || flags.scope === "local"
    ? resolve(process.cwd(), ".opencode")
    : join(homedir(), ".config", "opencode");
  const pluginDir = join(configDir, "plugins");
  const pluginPath = join(pluginDir, "cursor-subagents.js");
  const packageJsonPath = join(configDir, "package.json");
  const npxSpec = flags.source === "npm" ? flags.npmPackage : `github:${flags.repo}`;

  if (flags.dryRun) {
    steps.push({
      target: "opencode",
      status: "planned",
      path: pluginPath,
      message: `Install a local OpenCode plugin that launches ${npxSpec} via npx.`,
    });
    return;
  }

  mkdirSync(pluginDir, { recursive: true });
  const template = readFileSync(join(here, "opencode-local-plugin.mjs"), "utf8")
    .replace("__CURSOR_SUBAGENTS_NPX_SPEC__", npxSpec);
  writeFileSync(pluginPath, template);
  const packageJson = readPackageJson(packageJsonPath, {
    type: "module",
    dependencies: {},
  });
  packageJson.type = packageJson.type || "module";
  packageJson.dependencies = packageJson.dependencies || {};
  packageJson.dependencies["@opencode-ai/plugin"] = packageJson.dependencies["@opencode-ai/plugin"] || "latest";
  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

  steps.push({
    target: "opencode",
    status: "ok",
    path: pluginPath,
    message: "Installed GitHub-backed local OpenCode plugin. OpenCode will install @opencode-ai/plugin from the config package.json at startup.",
  });
}

async function installPi(flags, detected, steps) {
  const source = flags.source === "npm" ? `npm:${PI_PACKAGE}` : `git:github.com/${flags.repo}`;
  if (detected.commands.pi) {
    await runStep(flags, steps, {
      target: "pi",
      description: "Install Pi package",
      command: "pi",
      args: ["install", source],
    });
  } else {
    steps.push({
      target: "pi",
      status: "manual",
      command: "pi",
      args: ["install", source],
      message: "Pi CLI was not found. After installing Pi, run this command to add the package extension and skill.",
    });
  }
}

async function installSkills(flags, detected, steps) {
  if (!detected.commands.npx) {
    steps.push({
      target: "skills",
      status: "manual",
      command: "npx",
      args: ["skills", "add", flags.repo, "--skill", "cursor-subagents", "-g", "-y"],
      message: "npx was not found. Install Node.js/npm, then run this command for the harness-agnostic skill.",
    });
    return;
  }
  await runStep(flags, steps, {
    target: "skills",
    description: "Install Agent Skill",
    command: "npx",
    args: ["skills", "add", flags.repo, "--skill", "cursor-subagents", "-g", "-y"],
  });
}

function addMcpSnippet(flags, steps) {
  const npmArgs = ["-y", flags.npmPackage, "mcp"];
  const githubArgs = ["-y", `github:${flags.repo}`, "mcp"];
  const args = flags.source === "npm" ? npmArgs : githubArgs;
  steps.push({
    target: "mcp",
    status: "manual",
    message: "For harnesses without a plugin system, add this MCP server entry.",
    config: {
      mcpServers: {
        "cursor-subagents": {
          command: "npx",
          args,
        },
      },
    },
  });
}

function addCursorAuthNote(flags, detected, steps) {
  if (detected.cursor.authenticated) return;
  steps.push({
    target: "cursor",
    status: "manual",
    command: cursorBinary(),
    args: ["login"],
    message: "Authenticate Cursor CLI before using subagents. Browser login is the recommended path.",
  });
}

async function runStep(flags, steps, step) {
  if (flags.dryRun) {
    steps.push({ ...step, status: "planned", commandLine: commandLine(step.command, step.args) });
    return;
  }
  const result = await runCommand(step.command, step.args, { timeoutMs: step.timeoutMs || 120000 });
  const ok = result.code === 0 || isBenignInstallOutput(result.stdout, result.stderr);
  steps.push({
    ...step,
    status: ok ? "ok" : "failed",
    commandLine: commandLine(step.command, step.args),
    exitCode: result.code,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
    message: ok ? `${step.description || step.command} completed.` : `${step.description || step.command} failed.`,
  });
}

function isBenignInstallOutput(stdout, stderr) {
  const text = `${stdout}\n${stderr}`.toLowerCase();
  return text.includes("already installed")
    || text.includes("already exists")
    || text.includes("already added")
    || text.includes("no changes");
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...(options.env || {}) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
    }, options.timeoutMs || 30000);
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: stderr || error.message });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

async function commandExists(command) {
  const result = await runCommand(command, ["--version"], { timeoutMs: 10000 });
  if (result.code === 0) return true;
  const which = platform() === "win32" ? "where" : "command";
  const args = platform() === "win32" ? [command] : ["-v", command];
  const shellResult = platform() === "win32"
    ? await runCommand(which, args, { timeoutMs: 10000 })
    : await runCommand("sh", ["-lc", `command -v ${shellQuote(command)}`], { timeoutMs: 10000 });
  return shellResult.code === 0;
}

function updateOpenCodeConfig(path) {
  mkdirSync(dirname(path), { recursive: true });
  const json = readPackageJson(path, { $schema: "https://opencode.ai/config.json" });
  const plugins = Array.isArray(json.plugin) ? json.plugin : [];
  if (!plugins.includes(OPENCODE_PACKAGE)) plugins.push(OPENCODE_PACKAGE);
  json.plugin = plugins;
  writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`);
  return true;
}

function readPackageJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

function canWriteConfig(path) {
  if (!existsSync(path)) return true;
  try {
    JSON.parse(readFileSync(path, "utf8"));
    return true;
  } catch {
    return false;
  }
}

function opencodeConfigPath(scope) {
  if (scope === "project" || scope === "local") return resolve(process.cwd(), "opencode.json");
  return join(homedir(), ".config", "opencode", "opencode.json");
}

function claudeScope(scope) {
  if (scope === "project" || scope === "local") return scope;
  return "user";
}

function desktopHint(detected, app, fallback) {
  return detected.desktopApps?.[app] ? `${app} Desktop was detected. ${fallback}` : fallback;
}

function formatInteractiveIntro(flags, detected, defaults, ui) {
  const lines = [];
  lines.push("");
  lines.push(ui.bold("Cursor Subagents Setup"));
  lines.push(ui.dim("Install native Cursor Agent subagents for your agent harnesses."));
  lines.push("");
  lines.push(`Repo: ${flags.repo}`);
  lines.push(`Detected default: ${defaults.join(", ") || "skills, mcp"}`);
  lines.push("");
  lines.push(ui.bold("Detected environment"));
  lines.push(...formatDetectionRows(detected, ui).map((line) => `  ${line}`));
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function formatSummaryHeader(flags, detected, targets, ui) {
  return [
    ui.bold("cursor-subagents setup"),
    `repo: ${flags.repo}`,
    `selected: ${targets.join(", ") || "(none)"}`,
    `source: ${flags.source}`,
    `scope: ${flags.scope}`,
    "",
    "Detected:",
    ...formatDetectionRows(detected, ui).map((line) => `  ${line}`),
    "",
  ].join("\n");
}

function formatDetectionRows(detected, ui) {
  const cliRows = [
    ["Cursor CLI", detected.cursor.installed, detected.cursor.version || "cursor-agent not found"],
    ["Cursor auth", detected.cursor.authenticated, detected.cursor.authenticated ? "authenticated" : "login required"],
    ["Codex CLI", detected.commands.codex, "codex"],
    ["Claude CLI", detected.commands.claude, "claude"],
    ["OpenCode CLI", detected.commands.opencode, "opencode"],
    ["Pi CLI", detected.commands.pi, "pi"],
    ["Node tools", detected.commands.npx && detected.commands.npm, "npm/npx"],
  ];
  const desktop = Object.entries(detected.desktopApps || {})
    .filter(([, value]) => value)
    .map(([name]) => name)
    .join(", ") || "none";
  const rows = cliRows.map(([label, ok, detail]) => {
    const status = ok ? ui.green("OK") : ui.yellow("MISS");
    return `${label.padEnd(12)} ${status.padEnd(ok ? 11 : 13)} ${detail}`;
  });
  rows.push(`${"Desktop apps".padEnd(12)} ${ui.cyan("INFO").padEnd(13)} ${desktop}`);
  return rows;
}

function formatInteractivePlan(steps, ui, flags) {
  const lines = [];
  lines.push(ui.bold("Install plan"));
  lines.push(flags.dryRun ? ui.yellow("Dry run: no changes will be made.") : "Review before changes are applied.");
  for (const step of steps) {
    lines.push(`  ${formatStatus(step.status, ui).padEnd(12)} ${step.target.padEnd(12)} ${step.message || step.description || step.commandLine || ""}`);
    if (step.commandLine) lines.push(`               ${ui.dim(step.commandLine)}`);
    if (step.path) lines.push(`               ${ui.dim(step.path)}`);
    if (step.config) {
      for (const line of JSON.stringify(step.config, null, 2).split("\n")) {
        lines.push(`               ${ui.dim(line)}`);
      }
    }
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function formatStatus(status, ui) {
  if (status === "ok") return ui.green("OK");
  if (status === "planned") return ui.cyan("PLAN");
  if (status === "manual") return ui.yellow("TODO");
  if (status === "failed") return ui.red("FAIL");
  return String(status || "INFO").toUpperCase();
}

function formatDetection(detected) {
  const commands = Object.entries(detected.commands)
    .filter(([, ok]) => ok)
    .map(([name]) => name)
    .join(", ") || "none";
  const apps = Object.entries(detected.desktopApps || {})
    .filter(([, ok]) => ok)
    .map(([name]) => name)
    .join(", ") || "none";
  return [
    "Detected:",
    `  commands: ${commands}`,
    `  desktop apps: ${apps}`,
    `  cursor-agent: ${detected.cursor.installed ? detected.cursor.version || "installed" : "missing"}`,
    `  cursor auth: ${detected.cursor.authenticated ? "authenticated" : "not authenticated"}`,
    "",
  ].join("\n");
}

function formatSteps(steps, ui = createUi({ noColor: true }, process.stdout), options = {}) {
  const lines = [options.cancelled ? "Setup cancelled:" : "Setup results:"];
  for (const step of steps) {
    lines.push(`- [${formatStatus(step.status, ui)}] ${step.target}: ${step.message || step.description || step.commandLine || ""}`);
    if (step.commandLine) lines.push(`  command: ${ui.dim(step.commandLine)}`);
    if (step.path) lines.push(`  path: ${ui.dim(step.path)}`);
    if (step.config) {
      lines.push("  config:");
      for (const line of JSON.stringify(step.config, null, 2).split("\n")) {
        lines.push(`    ${ui.dim(line)}`);
      }
    }
    if (step.stderr && step.status === "failed") lines.push(`  stderr: ${step.stderr}`);
  }
  return `${lines.join("\n")}\n`;
}

function commandLine(command, args = []) {
  return [command, ...args].map(shellQuote).join(" ");
}

function shellQuote(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:@+=,-]+$/.test(text)) return text;
  return `'${text.replace(/'/g, "'\\''")}'`;
}

function pushUnique(array, item) {
  if (!array.includes(item)) array.push(item);
}
