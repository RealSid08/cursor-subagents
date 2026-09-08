"""Execute the published shell examples with a fake CLI; no login or paid calls."""

import json
import os
from pathlib import Path
import re
import shlex
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / 'plugins/cursor-subagents/skills/cursor-subagents'


def blocks(path, language):
    return re.findall(rf'^```{language}\n(.*?)^```', path.read_text(encoding='utf-8'), re.M | re.S)


def check_result(path, workspace, resume=False):
    result = json.loads(path.read_text(encoding='utf-8-sig'))
    args = result['argv']
    for flag, value in [('--workspace', str(workspace)), ('--model', 'cursor-grok-4.6-high'),
                        ('--sandbox', 'disabled'), ('--output-format', 'json')]:
        assert args[args.index(flag) + 1] == value, args
    assert '--yolo' in args and '--trust' in args and '--print' in args
    assert result['result'] == 'Unicode report: café 日本語'
    assert result['stdin_closed'] is True
    if resume:
        assert args[args.index('--resume') + 1] == 'smoke-session'
    assert args[-1] and not args[-1].startswith('--')


def main():
    with tempfile.TemporaryDirectory(prefix='cursor shell café ') as directory:
        root = Path(directory)
        workspace = root / 'workspace with spaces'
        workspace.mkdir()
        env = dict(os.environ)
        env['PATH'] = str(root) + os.pathsep + env.get('PATH', '')
        if os.name == 'nt':
            shell = shutil.which('pwsh')
            if not shell:
                raise RuntimeError('PowerShell 7.3+ is required for Windows smoke tests')
            (root / 'agent.ps1').write_text('''$input | Out-Null
@{ type='result'; subtype='success'; is_error=$false; session_id='smoke-session'; result='Unicode report: café 日本語'; argv=@($args); stdin_closed=$true } | ConvertTo-Json -Compress
$global:LASTEXITCODE = 0
''', encoding='utf-8')
            examples = blocks(SKILL / 'references/powershell.md', 'powershell')
            # Resolve, launch with task-file pointer, background, collect, resume.
            quote = lambda value: "'" + str(value).replace("'", "''") + "'"
            setup = examples[0] + examples[1].replace("'C:\\path\\to\\repo'", quote(workspace))
            setup = setup.replace("$runDir = Join-Path ([IO.Path]::GetTempPath()) ('cursor-task-' + [guid]::NewGuid().ToString('N'))", '$runDir = ' + quote(root / 'logs'))
            script = "$ErrorActionPreference = 'Stop'\n" + setup
            script += '\n' + examples[2] + '\n' + examples[3] + '\n' + examples[4]
            script += '\nif ($followupExit -ne 0) { throw "Follow-up failed" }\n'
            path = root / 'smoke.ps1'
            path.write_text(script, encoding='utf-8')
            subprocess.run([shell, '-NoProfile', '-File', str(path)], env=env, check=True, timeout=60)
            for name, resume in [('result.json', False), ('followup.json', True)]:
                check_result(root / 'logs' / name, workspace, resume)
            task = (root / 'logs/task.md').read_text(encoding='utf-8')
            assert 'Review src/parser.ts' in task
            print('PASS PowerShell foreground, task file, background collection, resume, Unicode and spaced paths')
        else:
            mock = root / 'agent'
            mock.write_text('#!' + sys.executable + '\n' + '''import json, sys
stdin = sys.stdin.read()
print(json.dumps(dict(type='result', subtype='success', is_error=False, session_id='smoke-session', result='Unicode report: café 日本語', argv=sys.argv[1:], stdin_closed=stdin == ''), ensure_ascii=False))
''', encoding='utf-8')
            mock.chmod(0o755)
            examples = blocks(SKILL / 'SKILL.md', 'bash')
            for shell in ['bash', 'zsh']:
                executable = shutil.which(shell)
                if not executable:
                    if sys.platform == 'darwin':
                        raise RuntimeError(f'Missing required Mac shell: {shell}')
                    continue
                logs = root / shell
                logs.mkdir()
                script = 'CURSOR_COMMAND=' + shlex.quote(str(mock)) + '\n'
                script += examples[0].replace("'/absolute/path/to/repo'", shlex.quote(str(workspace))).replace('$(mktemp -d)', shlex.quote(str(logs)))
                script += '\n' + examples[1] + '\n' + examples[2].replace('the-session-id-from-result-json', 'smoke-session')
                subprocess.run([executable, '-c', script], env=env, check=True, timeout=60, stdout=subprocess.DEVNULL)
                check_result(logs / 'result.json', workspace)
                check_result(logs / 'followup.json', workspace, True)
                print(f'PASS {shell} launch, wait, resume, Unicode and spaced paths')


if __name__ == '__main__':
    main()
