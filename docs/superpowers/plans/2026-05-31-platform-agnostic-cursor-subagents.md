# Platform Agnostic Cursor Subagents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `cursor-subagents` installable as a harness-agnostic Agent Skill and as native plugins/adapters for Codex, Claude Code, OpenCode, Pi, and compatible MCP-based harnesses.

**Architecture:** Keep one canonical skill at `skills/cursor-subagents/SKILL.md` and one shared runtime package at `packages/cursor-subagents`. Harness-specific plugin folders copy or wrap that behavior in the native structure each harness expects. ACP remains the live-session layer, and write-capable/yolo behavior remains the default for delegated coding work.

**Tech Stack:** Node.js ESM, Cursor Agent CLI, ACP, MCP stdio, Agent Skills `SKILL.md`, Codex plugin manifests, Claude Code plugin marketplaces, OpenCode npm plugins/custom tools, Pi packages.

---

### Task 1: Canonical Skill

**Files:**
- Create: `skills/cursor-subagents/SKILL.md`
- Create: `skills/cursor-subagents/agents/openai.yaml`
- Modify: `plugins/cursor-subagents/skills/cursor-subagents/SKILL.md`

- [x] **Step 1: Write the harness-agnostic skill**

Create a skill that tells any agent harness to prefer native `cursor-subagents` tools, fall back to the `cursor-subagents` CLI, and then fall back to raw `cursor-agent`.

- [x] **Step 2: Keep plugin copies synchronized**

Copy the canonical skill into Codex and Claude plugin folders so plugin caches remain self-contained.

- [x] **Step 3: Validate**

Run:

```bash
PYTHONPATH=/tmp/codex-pyyaml-validator python3 /Users/sid/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/cursor-subagents
```

Expected: `Skill is valid!`

### Task 2: Shared Runtime Package

**Files:**
- Create: `package.json`
- Create: `packages/cursor-subagents/package.json`
- Create: `packages/cursor-subagents/bin/cursor-subagents.mjs`
- Create: `packages/cursor-subagents/src/cursor-cli.mjs`
- Create: `packages/cursor-subagents/src/mcp-server.mjs`

- [x] **Step 1: Add package metadata**

Expose a bin named `cursor-subagents` and publishable package metadata.

- [x] **Step 2: Add CLI commands**

Implement `help`, `doctor`, `models`, `run`, and `mcp`. Keep all commands non-interactive and provide copy-pasteable examples.

- [x] **Step 3: Validate**

Run:

```bash
node packages/cursor-subagents/bin/cursor-subagents.mjs --help
node packages/cursor-subagents/bin/cursor-subagents.mjs doctor --json
node packages/cursor-subagents/bin/cursor-subagents.mjs models --json
```

Expected: help text, JSON doctor output, and `defaultModel: "composer-2.5"` in models output.

### Task 3: Native Plugin Wrappers

**Files:**
- Modify: `.agents/plugins/marketplace.json`
- Create: `.claude-plugin/marketplace.json`
- Create: `plugins/claude-code/cursor-subagents/.claude-plugin/plugin.json`
- Create: `plugins/claude-code/cursor-subagents/.mcp.json`
- Create: `plugins/claude-code/cursor-subagents/scripts/cursor-subagents-mcp.mjs`
- Create: `plugins/claude-code/cursor-subagents/skills/cursor-subagents/SKILL.md`

- [x] **Step 1: Keep Codex wrapper working**

Codex continues to load from `.agents/plugins/marketplace.json` and `plugins/cursor-subagents`.

- [x] **Step 2: Add Claude Code marketplace**

Claude Code loads from `.claude-plugin/marketplace.json` and installs a self-contained plugin under `plugins/claude-code/cursor-subagents`.

- [x] **Step 3: Validate**

Run Codex plugin validation and, when available, `claude plugin validate plugins/claude-code/cursor-subagents`.

### Task 4: OpenCode And Pi Native Packages

**Files:**
- Create: `packages/opencode-cursor-subagents/package.json`
- Create: `packages/opencode-cursor-subagents/index.js`
- Create: `packages/pi-cursor-subagents/package.json`
- Create: `packages/pi-cursor-subagents/skills/cursor-subagents/SKILL.md`
- Create: `adapters/opencode/opencode.jsonc`
- Create: `adapters/opencode/tools/cursor-run-once.js`
- Create: `adapters/pi/package.json`
- Modify: root `package.json`

- [x] **Step 1: OpenCode**

Provide a native OpenCode npm plugin as the primary install path. Keep MCP config and custom-tool templates only as development fallbacks.

- [x] **Step 2: Pi**

Expose the canonical skill through root GitHub install metadata and a publishable `pi-cursor-subagents` npm package.

### Task 5: Docs And Validation

**Files:**
- Modify: `README.md`
- Modify: `docs/DISTRIBUTION.md`
- Modify: `docs/TOOL_REFERENCE.md`
- Modify: `scripts/validate-distribution.mjs`

- [x] **Step 1: Document installs**

Lead with native install paths: Codex marketplace, Claude Code marketplace, OpenCode npm plugin, Pi package, and Vercel Skills.

- [x] **Step 2: Extend validation**

Check root skill, runtime package, Claude marketplace, Codex marketplace, self-contained MCP scripts, and adapter templates.

- [ ] **Step 3: Commit and push**

Run all validations, commit the result, and push `main`.
