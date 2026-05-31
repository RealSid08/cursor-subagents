# Cursor Subagents

Use Cursor Agent as a real delegated subagent from Codex, Claude Code, OpenCode,
Pi, and any Agent Skills or MCP-capable harness.

Defaults:

- Live subagents use Cursor ACP.
- One-shot runs are yolo/write-capable by default.
- The default model is `composer-2.5`.
- The current workspace is reused; Cursor worktrees are never created unless requested.
- If the parent harness is already inside a git worktree, that worktree path is used.

## Requirements

Install and authenticate Cursor Agent first:

```bash
cursor-agent login
cursor-agent --version
```

Override the binary with `CURSOR_AGENT_BIN=/path/to/cursor-agent` if needed.

## Install

### Codex

```bash
codex plugin marketplace add RealSid08/cursor-subagents
```

Then enable **Cursor Subagents** in the Codex plugin UI and start a fresh thread.

### Claude Code

```bash
claude plugin marketplace add RealSid08/cursor-subagents
claude plugin install cursor-subagents@cursor-subagents
```

The same flow works inside Claude Code with:

```text
/plugin marketplace add RealSid08/cursor-subagents
/plugin install cursor-subagents@cursor-subagents
```

### OpenCode

After the npm packages are published:

```bash
opencode plugin opencode-cursor-subagents --global
```

That installs the native OpenCode plugin and exposes the same `cursor_*` tools.

### Pi

From GitHub now:

```bash
pi install github:RealSid08/cursor-subagents
```

After npm publication:

```bash
pi install npm:pi-cursor-subagents
```

### Universal Skill

For any supported Agent Skills harness:

```bash
npx skills add RealSid08/cursor-subagents --skill cursor-subagents -g -y
```

To target specific harnesses:

```bash
npx skills add RealSid08/cursor-subagents --skill cursor-subagents -a claude-code -a codex -a opencode -a pi -g -y
```

## Tools

Native plugin installs expose:

- `cursor_spawn_task`: start a live ACP subagent, send the first prompt, and keep it alive.
- `cursor_start_agent`: start a persistent ACP session.
- `cursor_prompt_agent`: send follow-up prompts to a live session.
- `cursor_run_once`: run one headless yolo Cursor task.
- `cursor_list_models`: list Cursor models and the default.
- `cursor_list_agents`: inspect live sessions.
- `cursor_stop_agent`: stop a live session.

Use `mode: "ask"` or `mode: "plan"` and `yolo: false` for read-only delegation.

## Runtime CLI

The shared runtime is also usable directly:

```bash
npx -y cursor-subagents doctor --json
npx -y cursor-subagents models --json
npx -y cursor-subagents run --workspace "$PWD" --model composer-2.5 --yolo --prompt "Review and fix the failing test"
```

## Repository Layout

- `skills/cursor-subagents/`: canonical harness-agnostic skill.
- `packages/cursor-subagents/`: shared runtime CLI and MCP server.
- `packages/opencode-cursor-subagents/`: native OpenCode npm plugin.
- `packages/pi-cursor-subagents/`: Pi package.
- `plugins/cursor-subagents/`: Codex plugin marketplace package.
- `plugins/claude-code/cursor-subagents/`: Claude Code plugin marketplace package.
- `.agents/plugins/marketplace.json`: Codex marketplace.
- `.claude-plugin/marketplace.json`: Claude Code marketplace.

## Validate

```bash
npm run validate
npx skills add . --list
```

See `docs/DISTRIBUTION.md` for release steps.
