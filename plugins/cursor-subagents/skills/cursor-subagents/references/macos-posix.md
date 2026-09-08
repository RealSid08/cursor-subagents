# macOS, Linux, and WSL

Use Bash or zsh. On Apple Silicon, use the native installation; Rosetta and an
Intel Homebrew installation are not prerequisites. `cursor` opens the editor;
`agent` or `cursor-agent` runs the headless CLI.

## Resolve the executable

Desktop apps can inherit a PATH older than the CLI installation. Try a fresh
login shell, or resolve the user-local executable without editing shell profiles:

```bash
CURSOR_COMMAND=''
for candidate in agent cursor-agent "$HOME/.local/bin/agent" "$HOME/.local/bin/cursor-agent"; do
  if command -v "$candidate" >/dev/null 2>&1; then
    CURSOR_COMMAND=$(command -v "$candidate")
    break
  fi
done
if [ -z "$CURSOR_COMMAND" ]; then
  printf '%s\n' 'Cursor CLI not found; follow the official installation guide.' >&2
else
  "$CURSOR_COMMAND" --version
  "$CURSOR_COMMAND" --help
fi
```

Do not continue with an empty value or an unrelated `agent` command. Select the
verified `cursor-agent` path explicitly if the short name belongs to another
program. Then run `"$CURSOR_COMMAND" status` and `"$CURSOR_COMMAND" models`.
If a verified launcher cannot find its runtime, inspect its reported error and
use the installed runtime's path or a fresh login shell; do not install another
Node version merely because Cursor is implemented with Node.

## Shell and paths

Use the [main skill's launch and resume examples](../SKILL.md). They use quoted
paths, BSD-compatible `mktemp -d`, and stdin from `/dev/null`, so they also work
with macOS's bundled Bash. Do not use GNU-only `readlink -f`, `timeout`, or
`setsid` as prerequisites. Keep `CURSOR_COMMAND`, `WORKSPACE`, and `RUN_DIR` in
the same shell, or explicitly restore their values for a managed follow-up.

For multiline prompts with quotes, dollar signs, or backticks, use a quoted
here-document so the shell cannot expand the task text:

```bash
cat >"$RUN_DIR/task.md" <<'TASK'
Review src/parser.ts. Do not edit files.
Treat literals such as $HOME, `command`, and "quoted text" as task data.
TASK
PROMPT=$(cat "$RUN_DIR/task.md")
```

Prefer a task-file pointer for very long prompts. Do not concatenate task text
into shell code or use `eval`. A macOS path may contain spaces and Unicode;
keep every path expansion quoted. WSL runs need `/home/...` or `/mnt/c/...`
paths understood by the Linux process, not `C:\...` paths. Keep the checkout,
Git, CLI, and authentication in the same environment for each run.
