#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { doctor, listModels, runOnce, DEFAULT_MODEL } from "../src/cursor-cli.mjs";

const here = dirname(fileURLToPath(import.meta.url));

function help() {
  return `cursor-subagents

Usage:
  cursor-subagents doctor [--json]
  cursor-subagents models [--json] [--include-models] [--filter <text>] [--limit <n>]
  cursor-subagents run --prompt <task> [--workspace <path>] [--model <id>] [--mode agent|ask|plan] [--yolo|--no-yolo]
  cursor-subagents mcp

Defaults:
  model: ${DEFAULT_MODEL}
  run: --yolo --trust --mode agent

Examples:
  cursor-subagents doctor --json
  cursor-subagents models --json
  cursor-subagents run --workspace "$PWD" --model ${DEFAULT_MODEL} --yolo --prompt "Review and fix the failing test"
  cursor-subagents run --workspace "$PWD" --mode ask --no-yolo --prompt "Inspect this diff without editing"
  cursor-subagents mcp
`;
}

function parseArgs(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      flags._.push(arg);
      continue;
    }
    const name = arg.slice(2);
    if (name === "json" || name === "include-models" || name === "yolo" || name === "no-yolo" || name === "trust" || name === "no-trust" || name === "approve-mcps") {
      flags[name] = true;
      continue;
    }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`Missing value for --${name}`);
    flags[name] = value;
    i += 1;
  }
  return flags;
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  const [command = "help", ...rest] = process.argv.slice(2);
  if (command === "--help" || command === "-h" || command === "help") {
    process.stdout.write(help());
    return;
  }

  const flags = parseArgs(rest);
  if (command === "doctor") {
    const result = await doctor({ json: flags.json === true });
    flags.json ? printJson(result) : process.stdout.write(`${result}\n`);
    process.exitCode = typeof result === "object" && !result.ok ? 1 : 0;
    return;
  }

  if (command === "models") {
    const result = await listModels({
      includeModels: flags["include-models"] === true,
      filter: flags.filter || "",
      limit: flags.limit ? Number(flags.limit) : 50,
    });
    if (flags.json) {
      printJson(result);
    } else {
      process.stdout.write(`default_model: ${result.defaultModel}\nmodel_count: ${result.modelCount}\n`);
      for (const model of result.recommendedModels) process.stdout.write(`${model.id}\t${model.name || ""}\n`);
    }
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (command === "run") {
    if (!flags.prompt) throw new Error("Missing --prompt <task>");
    const result = await runOnce({
      prompt: flags.prompt,
      cwd: flags.workspace || flags.cwd || process.cwd(),
      model: flags.model || DEFAULT_MODEL,
      mode: flags.mode || "agent",
      yolo: flags["no-yolo"] ? false : true,
      trust: flags["no-trust"] ? false : true,
      approveMcps: flags["approve-mcps"] === true,
      sandbox: flags.sandbox,
      timeoutMs: flags.timeout ? Number(flags.timeout) : undefined,
    });
    flags.json ? printJson(result) : process.stdout.write(`${result.text}\n`);
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (command === "mcp") {
    await import(join(here, "../src/mcp-server.mjs"));
    return;
  }

  throw new Error(`Unknown command: ${command}\n\n${help()}`);
}

main().catch((error) => {
  process.stderr.write(`Error: ${error.message}\n`);
  process.exitCode = 1;
});
