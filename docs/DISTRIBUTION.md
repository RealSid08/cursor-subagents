# Distribution Guide

The distribution rule is: use each harness's native install surface first, use
desktop app plugin browsers when they exist, and keep copy-paste config snippets
as fallback paths for harnesses without plugin/package systems.

## Primary Installer

GitHub-first command:

```bash
npx -y github:RealSid08/cursor-subagents setup
```

Npm command after publication:

```bash
npx -y cursor-subagents setup
```

The setup CLI:

- detects `cursor-agent`, `codex`, `claude`, `opencode`, `pi`, `npx`, `npm`, and
  known macOS desktop apps;
- checks Cursor CLI version and authentication status;
- can install Cursor CLI with Cursor's official `curl https://cursor.com/install -fsS | bash` flow when selected;
- installs Codex and Claude Code through plugin marketplaces;
- installs OpenCode through a GitHub-backed local plugin before npm publication,
  or through its npm plugin command/config fallback after publication;
- installs Pi through `pi install git:github.com/RealSid08/cursor-subagents` or `pi install npm:pi-cursor-subagents`;
- installs the harness-agnostic skill through `npx skills add`;
- prints a generic MCP snippet for harnesses without native plugin systems.

## Install Matrix

| Harness | Native install | Package in this repo | Status |
| --- | --- | --- | --- |
| Codex | `codex plugin marketplace add RealSid08/cursor-subagents` | `.agents/plugins/marketplace.json`, `plugins/cursor-subagents/` | Works from a public GitHub repo after push |
| Claude Code | `claude plugin marketplace add RealSid08/cursor-subagents` then `claude plugin install cursor-subagents@cursor-subagents` | `.claude-plugin/marketplace.json`, `plugins/claude-code/cursor-subagents/` | Works from a public GitHub repo after push |
| OpenCode | GitHub setup local plugin now; `opencode plugin opencode-cursor-subagents --global` after npm | `packages/opencode-cursor-subagents/`, `packages/cursor-subagents/src/opencode-local-plugin.mjs` | GitHub works after push; npm works after npm publication |
| Pi | `pi install git:github.com/RealSid08/cursor-subagents` or `pi install npm:pi-cursor-subagents` | root `pi.skills`/`pi.extensions`, `packages/pi-cursor-subagents/` | GitHub works after push; npm works after npm publication |
| Agent Skills harnesses | `npx skills add RealSid08/cursor-subagents --skill cursor-subagents -g -y` | `skills/cursor-subagents/` | Works from a public GitHub repo after push |
| MCP-only harnesses | configure `npx -y cursor-subagents mcp` | `packages/cursor-subagents/` | Works after npm publication |

## Release Order

1. Validate locally:

   ```bash
   npx -y . setup --dry-run --all --json
   npm run validate
   npx skills add . --list
   claude plugin validate .claude-plugin/marketplace.json
   claude plugin validate plugins/claude-code/cursor-subagents
   ```

2. Push the GitHub repo and make it public.

3. Test GitHub-native installs:

   ```bash
   codex plugin marketplace add RealSid08/cursor-subagents
   claude plugin marketplace add RealSid08/cursor-subagents
   pi install git:github.com/RealSid08/cursor-subagents
   npx skills add RealSid08/cursor-subagents --skill cursor-subagents --list
   ```

4. Publish npm packages when logged into npm:

   ```bash
   npm publish packages/cursor-subagents --access public
   npm publish packages/opencode-cursor-subagents --access public
   npm publish packages/pi-cursor-subagents --access public
   ```

5. Test npm-native installs:

   ```bash
   npx -y cursor-subagents doctor --json
   opencode plugin opencode-cursor-subagents --global
   pi install npm:pi-cursor-subagents
   ```

## Harness Notes

### Codex

Codex plugins use a repository marketplace file plus plugin folders. The Codex
plugin bundles the canonical skill and an MCP server, so users only add the
marketplace and enable the plugin. Codex Desktop should see the same configured
marketplace; users can enable the plugin from the desktop plugin UI and then
start a fresh thread.

### Claude Code

Claude Code marketplaces are GitHub-friendly. The plugin root contains only the
Claude manifest under `.claude-plugin/`; skills and MCP config live at the plugin
root so cache installs can resolve paths correctly. Claude Code Desktop's Code
tab uses the configured marketplaces and has Add plugin / Manage plugins UI.

### OpenCode

OpenCode's polished marketplace path is npm. `packages/opencode-cursor-subagents`
is a real OpenCode plugin, not a config snippet: it starts the shared
`cursor-subagents` MCP runtime internally and exposes the `cursor_*` tools as
OpenCode custom tools.

Before npm publication, setup writes a local plugin to OpenCode's native plugin
directory. That plugin has the same tool surface and launches the shared MCP
runtime via `npx -y github:RealSid08/cursor-subagents mcp`. After npm
publication, users can choose `--source npm` to use `opencode plugin
opencode-cursor-subagents --global`. If the OpenCode CLI is unavailable, setup
can write the same npm plugin entry into `~/.config/opencode/opencode.json` or a
project `opencode.json`.

### Pi

Pi can install packages from GitHub or npm. The repository root declares the
canonical skill for GitHub installs, and `packages/pi-cursor-subagents` is the
publishable npm package. The Pi package includes both the skill and a native Pi
extension that registers `cursor_*` tools via `pi.registerTool()`.

### Universal Skill

Vercel's `skills` CLI is the broadest fallback. It should remain harness-agnostic
and should not contain Codex-, Claude-, or OpenCode-only setup prose beyond the
tool preference order.

### MCP-only Harnesses

Generic config before npm publication:

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

Generic config after npm publication:

```json
{
  "mcpServers": {
    "cursor-subagents": {
      "command": "npx",
      "args": ["-y", "cursor-subagents", "mcp"]
    }
  }
}
```

## Versioning

Update these together:

- `package.json`
- `packages/cursor-subagents/package.json`
- `packages/opencode-cursor-subagents/package.json`
- `packages/pi-cursor-subagents/package.json`
- `plugins/cursor-subagents/.codex-plugin/plugin.json`
- `plugins/claude-code/cursor-subagents/.claude-plugin/plugin.json`
- `.claude-plugin/marketplace.json`

## Development Fallbacks

The files under `adapters/` are examples for manual or pre-npm testing only.
They should not be the primary install path in user-facing docs.

## Research References

- Cursor CLI install, auth, and parameters: https://docs.cursor.com/en/cli/installation
- Claude Code plugin marketplaces and Desktop plugin browser: https://code.claude.com/docs/en/discover-plugins
- OpenCode plugin loading and npm package support: https://opencode.ai/docs/plugins/
- Pi packages and extensions: https://pi.dev/docs/latest/packages
- Vercel Skills CLI: https://github.com/vercel-labs/skills
