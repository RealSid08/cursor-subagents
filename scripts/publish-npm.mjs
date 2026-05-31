#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const packages = [
  "packages/cursor-subagents",
  "packages/opencode-cursor-subagents",
  "packages/pi-cursor-subagents",
];

const flags = parseArgs(process.argv.slice(2));
const results = [];

for (const packageDir of packages) {
  const absDir = join(root, packageDir);
  const manifest = JSON.parse(readFileSync(join(absDir, "package.json"), "utf8"));
  const id = `${manifest.name}@${manifest.version}`;
  const existing = packageExists(id);

  if (existing && !flags.force) {
    results.push({ package: manifest.name, version: manifest.version, status: "skipped", reason: "already published" });
    continue;
  }

  const args = ["publish", `./${packageDir}`, "--access", flags.access, "--tag", flags.tag];
  if (flags.dryRun) args.push("--dry-run");
  if (flags.otp) args.push("--otp", flags.otp);
  if (flags.provenance) args.push("--provenance");

  const result = spawnSync("npm", args, {
    cwd: root,
    encoding: "utf8",
    stdio: flags.json ? "pipe" : "inherit",
  });

  results.push({
    package: manifest.name,
    version: manifest.version,
    status: result.status === 0 ? flags.dryRun ? "dry-run" : "published" : "failed",
    exitCode: result.status,
    stdout: flags.json ? result.stdout?.trim() : undefined,
    stderr: flags.json ? result.stderr?.trim() : undefined,
  });

  if (result.status !== 0) break;
}

const ok = results.every((result) => result.status !== "failed");
if (flags.json) {
  process.stdout.write(`${JSON.stringify({ ok, dryRun: flags.dryRun, results }, null, 2)}\n`);
} else {
  for (const result of results) {
    process.stdout.write(`${result.package}@${result.version}: ${result.status}${result.reason ? ` (${result.reason})` : ""}\n`);
  }
}
process.exitCode = ok ? 0 : 1;

function parseArgs(argv) {
  const parsed = {
    access: "public",
    tag: "latest",
    dryRun: false,
    force: false,
    json: false,
    otp: process.env.NPM_CONFIG_OTP || "",
    provenance: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") parsed.dryRun = true;
    else if (arg === "--force") parsed.force = true;
    else if (arg === "--json") parsed.json = true;
    else if (arg === "--provenance") parsed.provenance = true;
    else if (arg === "--tag" || arg === "--access" || arg === "--otp") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
      parsed[arg.slice(2)] = value;
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function packageExists(id) {
  const result = spawnSync("npm", ["view", id, "version", "--json"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status === 0) return true;
  if ((result.stderr || "").includes("E404")) return false;
  throw new Error(`Could not check ${id}: ${result.stderr || result.stdout}`);
}
