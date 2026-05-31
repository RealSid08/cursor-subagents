# Cursor Subagents

Use Cursor Agent as a real delegated subagent from Codex, Claude Code, OpenCode,
Pi, and any Agent Skills or MCP-capable harness.

Defaults:

- Live subagents use Cursor ACP.
- One-shot runs are yolo/write-capable by default.
- The default model is `composer-2.5`.
- The current workspace is reused; Cursor worktrees are never created unless requested.
- If the parent harness is already inside a git worktree, that worktree path is used.

## Fast Install

From GitHub today:

```bash
npx -y github:RealSid08/cursor-subagents setup
```

After npm publication:

```bash
npx -y cursor-subagents setup
```

The setup CLI detects installed harness CLIs and desktop apps, lets you choose
targets, installs through each harness's native plugin/package path where
possible, checks Cursor Agent, can install Cursor CLI from Cursor's official
installer when requested, and finishes by telling the user to run
`cursor-agent login` if auth is still missing.

Useful non-interactive forms:

```bash
npx -y github:RealSid08/cursor-subagents setup --all --yes
npx -y github:RealSid08/cursor-subagents setup --harness codex,claude-code,opencode --yes
npx -y github:RealSid08/cursor-subagents setup --harness mcp --dry-run --json
```

## Requirements

Install and authenticate Cursor Agent first:

```bash
curl https://cursor.com/install -fsS | bash
cursor-agent login
cursor-agent --version
```

Override the binary with `CURSOR_AGENT_BIN=/path/to/cursor-agent` if needed.

## Install

### Codex

```bash
codex plugin marketplace add RealSid08/cursor-subagents
```

Then enable **Cursor Subagents** in the Codex plugin UI and start a fresh
thread. Codex Desktop uses the same configured marketplace and plugin.

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

Claude Code Desktop exposes the same plugin browser from the Code tab:
Add plugin -> Cursor Subagents from the configured marketplace.

### OpenCode

From GitHub now, use setup. It installs a local OpenCode plugin in the native
OpenCode plugin directory and points it at this repo through `npx`:

```bash
npx -y github:RealSid08/cursor-subagents setup --harness opencode
```

After the npm packages are published, use the npm-native plugin path:

```bash
opencode plugin opencode-cursor-subagents --global
npx -y cursor-subagents setup --harness opencode --source npm
```

That installs the native OpenCode plugin and exposes the same `cursor_*` tools.
If the OpenCode CLI is unavailable for npm installs, the setup CLI can update
`~/.config/opencode/opencode.json` or a project `opencode.json` with the npm
plugin entry.

### Pi

From GitHub now:

```bash
pi install git:github.com/RealSid08/cursor-subagents
```

After npm publication:

```bash
pi install npm:pi-cursor-subagents
```

The Pi package includes both the harness-agnostic skill and a native Pi extension
that registers `cursor_*` tools.

### Universal Skill

For any supported Agent Skills harness:

```bash
npx skills add RealSid08/cursor-subagents --skill cursor-subagents -g -y
```

To target specific harnesses:

```bash
npx skills add RealSid08/cursor-subagents --skill cursor-subagents -a claude-code -a codex -a opencode -a pi -g -y
```

### MCP Fallback

For harnesses without a plugin system, add a generic MCP server:

```json
{
  "mcpServers": {
    "cursor-subagents": {
      "command": "npx",
      "args": ["-y", "github:RealSid08/cursor-subagents", "mcp"]
    }
  }
}
```

After npm publication, use `["-y", "cursor-subagents", "mcp"]`.

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
npx -y github:RealSid08/cursor-subagents setup --dry-run --json
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

## References

- Cursor CLI install/auth/parameters: https://docs.cursor.com/en/cli/installation
- Claude Code plugins and Desktop plugin browser: https://code.claude.com/docs/en/discover-plugins
- OpenCode plugins: https://opencode.ai/docs/plugins/
- Pi packages and extensions: https://pi.dev/docs/latest/packages
- Vercel Agent Skills CLI: https://github.com/vercel-labs/skills
