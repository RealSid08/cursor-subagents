---
name: cursor-subagents
description: Use Cursor as Codex-managed subagents through the cursor-subagents MCP tools. Use when Codex should delegate coding, exploration, review, or follow-up work to Cursor CLI with live ACP sessions, headless --yolo runs, explicit model choice, or Cursor-specific model/tool behavior.
---

# Cursor Subagents

Use this skill when delegating work to Cursor from Codex. Prefer the MCP tools supplied by this plugin over hand-written `cursor-agent` shell commands.

## Default Shape

- Use `composer-2.5` as the default model unless the user or task asks for another model.
- Use the current workspace by default. Do not create a Cursor worktree by default.
- If Codex itself is already in a git worktree, pass that worktree path as `cwd`.
- Tell Cursor it is a subagent working for Codex, with a bounded task and clear output requirements.
- Tell Cursor not to revert unrelated changes and to report changed files, tests run, blockers, and assumptions.

## Tool Choices

- Use `cursor_spawn_task` for a live Cursor ACP subagent when follow-up prompts may be useful.
- Use `cursor_start_agent` followed by `cursor_prompt_agent` for longer multi-turn delegation.
- Use `cursor_run_once` for the most reliable single task, especially when exact `--model` selection matters.
- Use `cursor_list_models` before selecting a non-default model or when model names may have drifted.
- Use `cursor_list_agents` and `cursor_stop_agent` to keep live sessions tidy.

## Prompt Template

Include this structure in Cursor prompts:

```text
You are a Cursor subagent working for Codex.
Workspace: <absolute path>
Task: <bounded task>
Scope: <files, folders, or behavior you own>
Constraints:
- Do not revert unrelated user or Codex changes.
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

Use live ACP sessions for iterative subagent work. ACP sessions remain persistent while the MCP server process stays alive. Durable reload after the MCP server restarts is not guaranteed by Cursor CLI, so treat long-lived active sessions as the reliable persistence boundary.

## Headless Runs

`cursor_run_once` uses Cursor CLI print mode with stream JSON, trust, and yolo defaults. Prefer it when:

- the task is one-shot,
- exact model selection matters,
- the live ACP session is flaky,
- the output should be a compact structured result.

## Model Selection

Use `model` on the MCP call to choose a Cursor model directly. The default is `composer-2.5`. For fast mode, pass `composer-2.5-fast`. For another model, call `cursor_list_models` first and pass the returned model id.

`cursor_list_models` is concise by default: it returns the default model, model count, and recommended ids. Pass `includeModels: true` with optional `filter` and `limit` when you need the expanded model list.
