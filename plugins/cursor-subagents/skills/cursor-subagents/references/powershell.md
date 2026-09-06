# PowerShell launches

Use PowerShell 7 for the examples below. Native Cursor CLI supports Windows;
WSL is optional. Use paths and a CLI installation from the same environment.

## One task

Use the intended workspace, an absolute path, and a unique output directory. A
single-quoted here-string preserves dollar signs, backticks, and quotes in the
prompt. Pass it as one argument; do not build a command string or use
`Invoke-Expression` to launch the task.

```powershell
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$workspace = 'C:\path\to\repo'
$runDir = Join-Path ([IO.Path]::GetTempPath()) ('cursor-task-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $runDir | Out-Null
$taskPrompt = @'
Review src/parser.ts for correctness. Do not edit files.
Report concrete issues with file and line references, or say none found.
'@
$cursorArgs = @(
    '--workspace', $workspace,
    '--model', 'cursor-grok-4.6-high',
    '--yolo', '--sandbox', 'disabled', '--trust',
    '--print', '--output-format', 'json',
    $taskPrompt
)
# A finite input stream ends stdin. PowerShell does not support </dev/null.
'' | & agent @cursorArgs > (Join-Path $runDir 'result.json') 2> (Join-Path $runDir 'stderr.log')
$cursorExit = $LASTEXITCODE
if ($cursorExit -ne 0) {
    Get-Content -LiteralPath (Join-Path $runDir 'stderr.log')
    throw "Cursor exited with code $cursorExit"
}
$result = Get-Content -Raw -LiteralPath (Join-Path $runDir 'result.json') | ConvertFrom-Json
if ($result.type -ne 'result' -or $result.subtype -ne 'success' -or $result.is_error -ne $false) {
    throw 'Cursor did not return a successful result'
}
$result.result
$sessionId = $result.session_id
```

Change the prompt for an implementation task; keep all full-access flags for
every task. Review prompts requesting no edits do not restrict tool permissions.
Use `cursor-agent` throughout if that is the installed command name.

For a long prompt, use `$taskPrompt = Get-Content -Raw -LiteralPath 'C:\path\task.md'`.
If it exceeds the Windows command-line limit, pass a short instruction to read
that absolute task file instead. Keep task files and logs outside source control.

## Background execution

Prefer Codex's managed terminal session so the process survives individual tool
calls. If using a persistent PowerShell session, the same arguments can run as a
job instead of the foreground invocation above:

```powershell
$cursorCommand = (Get-Command agent -ErrorAction Stop).Source
$job = Start-Job -ArgumentList $cursorCommand, $cursorArgs, $runDir -ScriptBlock {
    param($commandPath, $arguments, $outputDir)
    [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
    '' | & $commandPath @arguments > (Join-Path $outputDir 'result.json') 2> (Join-Path $outputDir 'stderr.log')
    $LASTEXITCODE | Set-Content -LiteralPath (Join-Path $outputDir 'exit-code.txt')
}
$job | Select-Object Id, State
```

Keep this PowerShell session alive: its jobs are not durable across shell exit.
The explicit UTF-8 setting preserves non-ASCII text from native CLI output.
Poll with `Get-Job -Id $job.Id`. Once finished, call `Receive-Job -Job $job`, read
`exit-code.txt`, and validate the result as above. A missing exit-code file or
failed job means the invocation did not finish normally. `Stop-Job -Job $job`
targets this job if cancellation is needed; inspect partial edits afterward.

## Resume the exact child

```powershell
'' | & agent --workspace $workspace --resume $sessionId `
    --model cursor-grok-4.6-high --yolo --sandbox disabled --trust `
    --print --output-format json `
    'Check the related parser entrypoint too. Do not edit files.' `
    > (Join-Path $runDir 'followup.json') 2> (Join-Path $runDir 'followup.stderr.log')
$followupExit = $LASTEXITCODE
```

Validate `$followupExit` and the new JSON object using the same checks as the
first run. Do not use a global latest-session shortcut.
