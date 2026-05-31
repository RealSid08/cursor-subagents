---
name: cursor-subagents
description: Use Cursor Agent as a delegated subagent from any AI coding harness. Use for coding, review, exploration, follow-up work, live ACP sessions, yolo write-capable runs, direct Cursor model choice, or Cursor-specific model/tool behavior.
---

# Cursor Subagents

Use this skill when delegating work to Cursor Agent from the current harness.

Requires Cursor Agent CLI (`cursor-agent`) or the `cursor-subagents` runtime package. Works best in harnesses with MCP or Agent Skills support.

## Default Behavior

- Use `composer-2.5` as the default Cursor model unless the user or task asks for another model.
- Use write-capable/yolo execution by default for implementation tasks.
- Use the current workspace by default. Do not create a Cursor worktree unless the user explicitly asks for one.
- If the parent harness is already inside a git worktree, pass that worktree path as the workspace.
- Tell Cursor it is a subagent working for the parent agent, with a bounded task and clear return contract.
- Tell Cursor not to revert unrelated user or parent-agent changes.
- Ask Cursor to report summary, files changed, checks run, blockers, and assumptions.

## Preferred Tool Order

1. Use native `cursor-subagents` MCP tools when the harness exposes them.
2. Use the `cursor-subagents` CLI when available.
3. Use raw `cursor-agent` only when neither native tools nor the CLI package are installed.

## Native MCP Tools

When available, prefer these tools:

- `cursor_spawn_task`: start a live ACP subagent and send the first prompt.
- `cursor_start_agent` plus `cursor_prompt_agent`: create a persistent live ACP session for multi-turn delegation.
- `cursor_run_once`: reliable one-shot task using Cursor print mode.
- `cursor_list_models`: inspect Cursor model ids before choosing a non-default model.
- `cursor_list_agents` and `cursor_stop_agent`: inspect and clean up live sessions.

For read-only review, pass `mode: "ask"` or `mode: "plan"` and `yolo: false`.

## CLI Fallback

When MCP tools are unavailable, use:

```bash
cursor-subagents run --workspace "$PWD" --model composer-2.5 --yolo --prompt "<task>"
```

Useful commands:

```bash
cursor-subagents doctor --json
cursor-subagents models --json
cursor-subagents run --workspace "$PWD" --model composer-2.5 --yolo --prompt "<task>"
cursor-subagents mcp
```

For read-only review:

```bash
cursor-subagents run --workspace "$PWD" --model composer-2.5 --mode ask --no-yolo --prompt "<review task>"
```

## Raw Cursor Fallback

If only `cursor-agent` exists:

```bash
cursor-agent -p \
  --output-format stream-json \
  --stream-partial-output \
  --workspace "$PWD" \
  --model composer-2.5 \
  --trust \
  --yolo \
  "<task>"
```

For read-only review, replace `--yolo` with `--mode ask` or `--mode plan`.

## Prompt Template

```text
You are a Cursor subagent working for <parent harness>.
Workspace: <absolute path>
Task: <bounded task>
Scope: <files, folders, or behavior you own>
Constraints:
- Do not revert unrelated user or parent-agent changes.
- Work in the current workspace; do not create a worktree unless explicitly asked.
- Keep edits narrowly scoped.
- Run the relevant checks you can run quickly.
Return:
- Summary
- Files changed
- Commands/checks run
- Open questions or blockers
```

## Live ACP Sessions

Use ACP sessions for persistent, iterative Cursor subagents. They remain live while the MCP server process stays alive. Do not treat MCP process restarts as durable session persistence.

## Model Selection

Use `model` or `--model` to choose a Cursor model directly. Default to `composer-2.5`. Use `composer-2.5-fast` only when the user asks for fast mode or latency matters more than quality. Call `cursor_list_models` or `cursor-subagents models --json` before choosing unfamiliar model ids.
