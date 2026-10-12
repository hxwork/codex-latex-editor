"""Local runtime change detection. Does not fetch code or edit plugin configuration."""
import ast
import hashlib
from pathlib import Path


def runtime_files(directory):
    root = Path(directory)
    return sorted([p for p in root.glob('*.py') if not p.name.startswith('test_')] +
                  [p for p in (root/'vendor').rglob('*') if p.is_file()], key=str)


def runtime_revision(directory):
    root = Path(directory)
    digest = hashlib.sha256()
    for path in runtime_files(root):
        stat = path.stat()
        digest.update((path.relative_to(root).as_posix()+':'+str(stat.st_mtime_ns)+':'+str(stat.st_size)+'\n').encode())
    return digest.hexdigest()


def validate_runtime(directory):
    for path in Path(directory).glob('*.py'):
        if not path.name.startswith('test_'):
            try:
                ast.parse(path.read_bytes(), filename=str(path))
            except SyntaxError as error:
                raise ValueError(f'插件代码尚未完成：{path.name}:{error.lineno} {error.msg}') from error


def reload_blocked(server):
    for name in ('chat', 'history_summary', 'git_sync'):
        job = getattr(server, name, None)
        if job and job.result.get('status') in ('running', 'conflicts'):
            return True
    return bool(getattr(server, 'runtime_history_builds', 0))
