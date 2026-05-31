# Cursor Subagents for Codex

Cursor Subagents is a Codex plugin that exposes the Cursor Agent CLI as Codex-managed subagents.
It gives Codex a small MCP tool surface for one-shot Cursor runs, persistent live ACP sessions,
follow-up prompts, model listing, and explicit Cursor model selection.

The default model is `composer-2.5`.

## What Is Included

- A repo-local Codex marketplace at `.agents/plugins/marketplace.json`.
- The `cursor-subagents` plugin under `plugins/cursor-subagents`.
- A dependency-free MCP server at `plugins/cursor-subagents/scripts/cursor-subagents-mcp.mjs`.
- A Codex skill that tells Codex when and how to use Cursor as a subagent.
- Distribution and tool-reference docs under `docs/`.

## Requirements

- Codex with plugin support enabled.
- Node.js available on `PATH`.
- Cursor Agent CLI available as `cursor-agent`.
- Cursor Agent authentication, usually via `cursor-agent login`.

You can override the Cursor binary path with:

```bash
CURSOR_AGENT_BIN=/absolute/path/to/cursor-agent
```

## Install From A Local Clone

From the repository root:

```bash
codex plugin marketplace add "$PWD"
```

Then enable `cursor-subagents` from the Codex app plugin UI.

For headless Codex environments where the plugin UI is not available, enable plugins and this
marketplace plugin in `~/.codex/config.toml`:

```toml
[features]
plugins = true

[plugins."cursor-subagents@cursor-subagents-local"]
enabled = true
```

Start a new Codex thread after enabling the plugin so its skills and MCP tools are loaded.

## Quick Smoke Test

Ask Codex:

```text
Use [$cursor-subagents](plugin://cursor-subagents@cursor-subagents-local) and call cursor_list_models.
```

Expected result: `defaultModel` is `composer-2.5`.

## Validate The Distribution

```bash
node scripts/validate-distribution.mjs
```

For full Codex plugin schema validation during development, also run:

```bash
PYTHONPATH=/tmp/codex-pyyaml-validator python3 /Users/sid/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/cursor-subagents
```

## Usage Notes

- `cursor_run_once` is the most reliable one-shot path and defaults to Cursor print mode with
  `stream-json`, `--trust`, and `--yolo`.
- Pass `yolo: false` and `mode: "ask"` or `mode: "plan"` for read-only review tasks.
- Live ACP sessions persist while the MCP server process stays alive.
- No Cursor worktree is created by default. Pass the current Codex workspace as `cwd`.
- Use `model` on the MCP call to choose a Cursor model directly.

See `docs/TOOL_REFERENCE.md` for the tool surface and `docs/DISTRIBUTION.md` for release prep.
