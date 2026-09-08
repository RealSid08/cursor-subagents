# PowerShell launches

Use PowerShell 7.3+ (`pwsh`) for the examples below, not Windows PowerShell 5.1
or cmd.exe. Native argument quoting and UTF-8 redirection differ in older shells.
Native Cursor CLI supports Windows;
WSL is optional. Use paths and a CLI installation from the same environment.

## Resolve the executable

```powershell
$cursorCommand = $null
foreach ($name in @('agent', 'cursor-agent')) {
    $found = Get-Command $name -CommandType Application,ExternalScript -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) { $cursorCommand = $found.Source; break }
}
if (-not $cursorCommand) {
    foreach ($name in @('agent.exe', 'agent.cmd', 'agent.ps1', 'cursor-agent.exe', 'cursor-agent.cmd', 'cursor-agent.ps1')) {
        $candidate = Join-Path $HOME ".local\bin\$name"
        if (Test-Path -LiteralPath $candidate -PathType Leaf) { $cursorCommand = $candidate; break }
    }
}
if (-not $cursorCommand) { throw 'Cursor CLI missing: reopen the shell after installation or use its installed absolute path.' }
& $cursorCommand --version
& $cursorCommand --help
```

Verify the command is Cursor CLI and supports the required flags. Then run
`& $cursorCommand status` and `& $cursorCommand models`. Keep this path for
launches and resumes. Do not change machine-wide PATH or execution policy to
work around a failed invocation; report the error if a fresh shell or verified
installed executable does not resolve it.

## One task

Use the intended workspace, an absolute path, and a unique output directory. A
single-quoted here-string preserves dollar signs, backticks, and quotes in the
prompt. The example saves it to a UTF-8 file and passes a short file pointer
as one argument; do not build a command string or use
`Invoke-Expression` to launch the task.

```powershell
$OutputEncoding = [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$workspace = 'C:\path\to\repo'
$runDir = Join-Path ([IO.Path]::GetTempPath()) ('cursor-task-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $runDir | Out-Null
$taskPrompt = @'
Review src/parser.ts for correctness. Do not edit files.
Report concrete issues with file and line references, or say none found.
'@
$taskFile = Join-Path $runDir 'task.md'
[IO.File]::WriteAllText($taskFile, $taskPrompt, [Text.UTF8Encoding]::new($false))
$taskPrompt = "Read the task instructions from this UTF-8 file: $taskFile"
$cursorArgs = @(
    '--workspace', $workspace,
    '--model', 'cursor-grok-4.6-high',
    '--yolo', '--sandbox', 'disabled', '--trust',
    '--print', '--output-format', 'json',
    $taskPrompt
)
# A finite input stream ends stdin. PowerShell does not support </dev/null.
'' | & $cursorCommand @cursorArgs > (Join-Path $runDir 'result.json') 2> (Join-Path $runDir 'stderr.log')
$cursorExit = $LASTEXITCODE
if ($cursorExit -ne 0) {
    Get-Content -LiteralPath (Join-Path $runDir 'stderr.log')
    throw "Cursor exited with code $cursorExit"
}
$result = Get-Content -Raw -LiteralPath (Join-Path $runDir 'result.json') | ConvertFrom-Json
if ($result -isnot [pscustomobject] -or $result.type -ne 'result' -or $result.subtype -ne 'success' -or $result.is_error -ne $false -or $result.session_id -isnot [string] -or [string]::IsNullOrWhiteSpace($result.session_id)) {
    throw 'Cursor did not return a successful result'
}
$result.result
$sessionId = $result.session_id
```

Change the prompt for an implementation task; keep all full-access flags for
every task. Review prompts requesting no edits do not restrict tool permissions.
The resolved `$cursorCommand` also handles paths containing spaces.

For complex or long prompts, write a UTF-8 task file and pass a short instruction
to read its absolute path. In particular, `.cmd`/`.bat` launchers use legacy
Windows argument handling: multiline text, embedded quotes, and metacharacters
may not survive even PowerShell 7. Use a task-file pointer for those launchers
instead of passing the full content. For a native executable and a short prompt,
`Get-Content -Raw -Encoding utf8 -LiteralPath 'C:\path\task.md'` is also suitable.
Keep task files and logs outside source control. Avoid `Start-Process -ArgumentList`
for arbitrary prompt text; it joins arguments into a command line.



## Background execution

Prefer Codex's managed terminal session so the process survives individual tool
calls. If using a persistent PowerShell session, the same arguments can run as a
job instead of the foreground invocation above:

```powershell
$job = Start-Job -ArgumentList $cursorCommand, $cursorArgs, $runDir -ScriptBlock {
    param($commandPath, $arguments, $outputDir)
    $OutputEncoding = [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
    '' | & $commandPath @arguments > (Join-Path $outputDir 'result.json') 2> (Join-Path $outputDir 'stderr.log')
    $LASTEXITCODE | Set-Content -LiteralPath (Join-Path $outputDir 'exit-code.txt')
}
$job | Select-Object Id, State
```

Keep this PowerShell session alive: its jobs are not durable across shell exit.
The explicit UTF-8 setting preserves non-ASCII text from native CLI output.
Poll with `Get-Job -Id $job.Id`. Once finished, collect it in that same session:

```powershell
Wait-Job -Job $job | Out-Null
Receive-Job -Job $job -ErrorAction Stop
if ($job.State -ne 'Completed') { throw "Cursor job failed: $($job.State)" }
$cursorExit = [int](Get-Content -LiteralPath (Join-Path $runDir 'exit-code.txt') -ErrorAction Stop)
if ($cursorExit -ne 0) { throw "Cursor exited with code $cursorExit" }
Remove-Job -Job $job
```

Read and validate `result.json` again using the first example, retaining its
`session_id` before resuming. A missing exit-code file or
failed job means the invocation did not finish normally. `Stop-Job -Job $job`
targets this job if cancellation is needed; inspect partial edits afterward.

## Resume the exact child

```powershell
'' | & $cursorCommand --workspace $workspace --resume $sessionId `
    --model cursor-grok-4.6-high --yolo --sandbox disabled --trust `
    --print --output-format json `
    'Check the related parser entrypoint too. Do not edit files.' `
    > (Join-Path $runDir 'followup.json') 2> (Join-Path $runDir 'followup.stderr.log')
$followupExit = $LASTEXITCODE
```

Validate `$followupExit` and the new JSON object using the same checks as the
first run. Do not use a global latest-session shortcut.
