# Tool Reference

All tools are served by the `cursor-subagents` MCP server. The OpenCode npm
plugin exposes the same names as native OpenCode custom tools and proxies them
to the shared MCP runtime internally.

The same behavior is available from the runtime CLI:

```bash
cursor-subagents doctor --json
cursor-subagents models --json
cursor-subagents run --workspace "$PWD" --model composer-2.5 --yolo --prompt "<task>"
cursor-subagents mcp
```

## `cursor_run_once`

Runs a single Cursor Agent task in print mode.

Useful for:

- Scoped implementation tasks.
- Read-only diff review.
- Exact model selection.
- Capturing structured output from Cursor.

Important inputs:

- `prompt`: required task prompt.
- `cwd`: workspace path. Defaults to the MCP server cwd.
- `model`: Cursor model id. Defaults to `composer-2.5`.
- `mode`: `agent`, `ask`, or `plan`. `ask` and `plan` are read-only Cursor modes.
- `yolo`: defaults to `true`. Set to `false` for read-only review.
- `trust`: defaults to `true`.
- `approveMcps`: defaults to `false`.
- `sandbox`: optional `enabled` or `disabled`.
- `timeoutMs`: defaults to 20 minutes.
- `extraArgs`: additional Cursor CLI arguments.

Output includes:

- `ok`
- `exitCode`
- `model`
- `cwd`
- `sessionId`
- `text`
- `toolCallCount`
- `gitStatus`
- `newGitStatusLines`
- `stderr`

CLI equivalent:

```bash
cursor-subagents run --json --workspace "$PWD" --model composer-2.5 --yolo --prompt "<task>"
```

## `cursor_start_agent`

Starts a live Cursor ACP session and returns an `agentId`.

Useful for iterative delegation where Codex may send follow-up prompts.

Important inputs:

- `cwd`
- `model`, defaulting to `composer-2.5`
- `mode`
- `autoApprove`, defaulting to `true`
- `name`

## `cursor_prompt_agent`

Sends a prompt to a live ACP agent.

Important inputs:

- `agentId`
- `prompt`
- `timeoutMs`

Output includes the accumulated Cursor text, stop reason, and recent events.

## `cursor_spawn_task`

Convenience wrapper that starts a live ACP agent and immediately sends a prompt.

Use this when the task may need a follow-up, but a separate start/prompt sequence would be noisy.

## `cursor_list_agents`

Lists live ACP agents held by the current MCP server process.

Use it before cleanup or when deciding whether a persistent session is still available.

## `cursor_stop_agent`

Stops one live ACP agent by `agentId`.

Use it when a task is complete and the session should not remain open.

## `cursor_list_models`

Lists Cursor model metadata.

By default this returns a concise payload:

- `defaultModel`
- `modelCount`
- `recommendedModels`

Optional inputs:

- `includeModels`: set to `true` to include model objects.
- `filter`: case-insensitive filter applied to model JSON.
- `limit`: max number of returned model objects when `includeModels` is true.

CLI equivalent:

```bash
cursor-subagents models --json
cursor-subagents models --json --include-models --filter composer --limit 20
```
