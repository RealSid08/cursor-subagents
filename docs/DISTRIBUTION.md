# Distribution Guide

This repository is laid out as a repo-local Codex marketplace. The intended distribution path is:

1. Share or publish this repository.
2. The user clones it locally.
3. The user runs `codex plugin marketplace add <repo-root>`.
4. The user enables `cursor-subagents` in Codex and starts a new thread.

## Release Checklist

Run these before sharing a build:

```bash
node scripts/validate-distribution.mjs
node --check plugins/cursor-subagents/scripts/cursor-subagents-mcp.mjs
PYTHONPATH=/tmp/codex-pyyaml-validator python3 /Users/sid/.codex/skills/.system/skill-creator/scripts/quick_validate.py plugins/cursor-subagents/skills/cursor-subagents
PYTHONPATH=/tmp/codex-pyyaml-validator python3 /Users/sid/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/cursor-subagents
```

Then test from a fresh Codex thread:

```text
Use [$cursor-subagents](plugin://cursor-subagents@cursor-subagents-local).
Call cursor_list_models with no arguments and report defaultModel.
```

Expected default model: `composer-2.5`.

## Versioning

Use normal semantic versions in `plugins/cursor-subagents/.codex-plugin/plugin.json`.

For local iteration where Codex needs to refresh its cached plugin copy, use the plugin-creator
cachebuster helper rather than hand-editing marketplace files:

```bash
python3 /Users/sid/.codex/skills/.system/plugin-creator/scripts/update_plugin_cachebuster.py plugins/cursor-subagents
```

After a cachebuster update, reinstall or re-enable the plugin through the Codex app and start a new
thread.

## Marketplace Shape

The marketplace file is `.agents/plugins/marketplace.json`.

It intentionally points to:

```json
"path": "./plugins/cursor-subagents"
```

That keeps the repository self-contained: the marketplace root and plugin source travel together.

## Compatibility Notes

- The plugin expects the Cursor CLI command to be `cursor-agent`, or `CURSOR_AGENT_BIN` to point to
  an equivalent executable.
- `cursor_run_once` defaults to a write-capable `--yolo` run for coding tasks. Use `yolo: false`
  for read-only review or planning.
- Live ACP sessions are process-persistent. They are not a durable session database after the MCP
  server restarts.
- This plugin does not create Cursor worktrees by default.
- The Codex CLI currently exposes marketplace management commands. In environments without a CLI
  plugin-install command, enable the plugin from the Codex app UI or with the documented config
  stanza in `README.md`.

## Before Publishing Publicly

Decide and fill in:

- Repository URL in `plugin.json`.
- Homepage or documentation URL in `plugin.json`.
- License file and `license` field.
- Publisher name and contact metadata.
