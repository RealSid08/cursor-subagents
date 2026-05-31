# opencode-cursor-subagents

OpenCode plugin for using Cursor Agent as a write-capable subagent.

```bash
opencode plugin opencode-cursor-subagents --global
```

Then ask OpenCode to use the `cursor_*` tools.

Defaults:

- `composer-2.5`
- yolo/write-capable one-shot runs
- persistent ACP sessions for live subagents
- current OpenCode worktree or directory as the workspace

Requires `cursor-agent` and a logged-in Cursor account.
