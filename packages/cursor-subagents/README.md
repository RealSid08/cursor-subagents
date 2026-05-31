# cursor-subagents

Portable Cursor Agent subagent runtime for AI coding harnesses.

```bash
npx -y cursor-subagents doctor --json
npx -y cursor-subagents models --json
npx -y cursor-subagents run --workspace "$PWD" --model composer-2.5 --yolo --prompt "Review this diff"
npx -y cursor-subagents mcp
```

From a linked checkout:

```bash
cursor-subagents doctor --json
cursor-subagents models --json
cursor-subagents run --workspace "$PWD" --model composer-2.5 --yolo --prompt "Review this diff"
cursor-subagents mcp
```

The runtime defaults to `composer-2.5` and write-capable/yolo execution for implementation tasks.
