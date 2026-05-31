# Distribution Guide

The distribution rule is: use each harness's native install surface first, and
keep copy-paste scripts as development-only fallbacks.

## Install Matrix

| Harness | Native install | Package in this repo | Status |
| --- | --- | --- | --- |
| Codex | `codex plugin marketplace add RealSid08/cursor-subagents` | `.agents/plugins/marketplace.json`, `plugins/cursor-subagents/` | Works from a public GitHub repo after push |
| Claude Code | `claude plugin marketplace add RealSid08/cursor-subagents` then `claude plugin install cursor-subagents@cursor-subagents` | `.claude-plugin/marketplace.json`, `plugins/claude-code/cursor-subagents/` | Works from a public GitHub repo after push |
| OpenCode | `opencode plugin opencode-cursor-subagents --global` | `packages/opencode-cursor-subagents/` | Works after npm publication |
| Pi | `pi install github:RealSid08/cursor-subagents` or `pi install npm:pi-cursor-subagents` | root `pi.skills`, `packages/pi-cursor-subagents/` | GitHub works after push; npm works after npm publication |
| Agent Skills harnesses | `npx skills add RealSid08/cursor-subagents --skill cursor-subagents -g -y` | `skills/cursor-subagents/` | Works from a public GitHub repo after push |
| MCP-only harnesses | configure `npx -y cursor-subagents mcp` | `packages/cursor-subagents/` | Works after npm publication |

## Release Order

1. Validate locally:

   ```bash
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
   pi install github:RealSid08/cursor-subagents
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
marketplace and enable the plugin.

### Claude Code

Claude Code marketplaces are GitHub-friendly. The plugin root contains only the
Claude manifest under `.claude-plugin/`; skills and MCP config live at the plugin
root so cache installs can resolve paths correctly.

### OpenCode

OpenCode's native plugin path is npm. `packages/opencode-cursor-subagents` is a
real OpenCode plugin, not a config snippet: it starts the shared
`cursor-subagents` MCP runtime internally and exposes the `cursor_*` tools as
OpenCode custom tools.

### Pi

Pi can install packages from GitHub or npm. The repository root declares the
canonical skill for GitHub installs, and `packages/pi-cursor-subagents` is the
publishable npm package.

### Universal Skill

Vercel's `skills` CLI is the broadest fallback. It should remain harness-agnostic
and should not contain Codex-, Claude-, or OpenCode-only setup prose beyond the
tool preference order.

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
