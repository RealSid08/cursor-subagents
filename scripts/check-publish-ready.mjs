#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const packageDirs = [
  "packages/cursor-subagents",
  "packages/opencode-cursor-subagents",
  "packages/pi-cursor-subagents",
];
const failures = [];

for (const packageDir of packageDirs) {
  const absDir = join(root, packageDir);
  const manifestPath = join(absDir, "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

  requireField(manifest.name, `${packageDir}: missing name`);
  requireField(manifest.version, `${packageDir}: missing version`);
  requireField(manifest.description, `${packageDir}: missing description`);
  requireField(manifest.license, `${packageDir}: missing license`);
  requireField(manifest.repository?.url, `${packageDir}: missing repository.url`);
  requireField(manifest.homepage, `${packageDir}: missing homepage`);
  requireField(manifest.bugs?.url, `${packageDir}: missing bugs.url`);

  if (manifest.private) failures.push(`${packageDir}: publishable package must not be private`);
  if (manifest.publishConfig?.access !== "public") failures.push(`${packageDir}: publishConfig.access must be public`);
  if (manifest.publishConfig?.registry !== "https://registry.npmjs.org/") {
    failures.push(`${packageDir}: publishConfig.registry must be https://registry.npmjs.org/`);
  }
  if (!existsSync(join(absDir, "README.md"))) failures.push(`${packageDir}: missing README.md`);
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) failures.push(`${packageDir}: missing package files allowlist`);
}

const dryRun = spawnSync("npm", ["run", "pack:dry-run"], {
  cwd: root,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});
if (dryRun.status !== 0) failures.push(`pack dry-run failed:\n${dryRun.stderr || dryRun.stdout}`);

if (failures.length) {
  console.error("Publish readiness failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Publish readiness passed.");

function requireField(value, message) {
  if (!value) failures.push(message);
}
