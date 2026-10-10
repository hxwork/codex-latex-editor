"""Real Git tests using disposable local repositories; no network or paper commits."""
from pathlib import Path
from tempfile import TemporaryDirectory
from editor import git_preview, git_commit, git_run, FileConflict

with TemporaryDirectory() as directory:
    root = Path(directory)
    git_run(root, 'init', '-q')
    git_run(root, 'config', 'user.name', 'Plugin test')
    git_run(root, 'config', 'user.email', 'test@example.invalid')
    paper = root / 'paper'; paper.mkdir()
    (paper / 'main.tex').write_text('original')
    (root / 'other.txt').write_text('original')
    git_run(root, 'add', '.')
    git_run(root, 'commit', '-qm', 'Initial')
    (paper / 'main.tex').write_text('updated')
    (root / 'other.txt').write_text('staged elsewhere')
    git_run(root, 'add', 'other.txt')
    (paper / 'main.pdf').write_bytes(b'compiled')
    (paper / '.latex-codex').mkdir()
    (paper / '.latex-codex' / 'history.sqlite3').write_bytes(b'cache')
    (paper / 'main.bib').write_text('bibliography')
    (paper / 'figure.pdf').write_bytes(b'figure')
    (paper / 'assets.tex').write_text(r'\includegraphics{figure}')
    (paper / 'notes.md').write_text('local notes')
    (paper / 'script.py').write_text('local tooling')
    (paper / 'unused.png').write_bytes(b'unused')
    (paper / 'data.csv').write_text('1,2')
    (paper / 'assets.tex').write_text(r'\includegraphics{figure}\pgfplotstableread{data.csv}')
    (paper / 'space [1].tex').write_text('note')
    preview = git_preview(paper)
    assert {x['path'] for x in preview['files']} == {'paper/main.tex', 'paper/main.bib', 'paper/figure.pdf', 'paper/space [1].tex', 'paper/assets.tex', 'paper/data.csv'}
    assert len(preview['excluded']) == 5
    (paper / 'main.tex').write_text('another edit')
    try:
        git_commit(paper, preview['signature'], 'Stale')
        raise AssertionError('Stale preview accepted')
    except FileConflict:
        pass
    result = git_commit(paper, git_preview(paper)['signature'], 'Paper update')
    assert result['count'] == 6
    assert git_run(root, 'diff', '--cached', '--name-only').decode().strip() == 'other.txt'
    assert git_run(root, 'show', 'HEAD:other.txt') == b'original'
    assert not git_preview(paper)['files']
    assert (paper / 'notes.md').exists()
    assert b'paper/notes.md' not in git_run(root, 'ls-tree', '-r', '--name-only', 'HEAD')
    (paper / 'main.bib').unlink()
    git_commit(paper, git_preview(paper)['signature'], 'Remove bibliography')
    assert b'paper/main.bib' not in git_run(root, 'ls-tree', '-r', '--name-only', 'HEAD')
print('Git tests passed: scoped commits, staged preservation, new/deleted files, literal paths, generated exclusions, stale rejection.')

import json
import threading
from urllib.request import Request, build_opener, ProxyHandler
from urllib.error import HTTPError
from unittest.mock import patch
from editor import make_server
with TemporaryDirectory() as directory:
    root = Path(directory).resolve()
    git_run(root, 'init', '-q')
    git_run(root, 'config', 'user.name', 'Plugin test')
    git_run(root, 'config', 'user.email', 'test@example.invalid')
    source = root / 'main.tex'; source.write_text('original')
    git_run(root, 'add', '.')
    git_run(root, 'commit', '-qm', 'Initial')
    source.write_text('modified')
    server = make_server(source, main_thread='', preferences_path=root / 'prefs.sqlite3')
    thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
    opener = build_opener(ProxyHandler({}))
    base = f'http://127.0.0.1:{server.server_port}'
    def request(route, data=None, origin=None):
        headers = {'Content-Type': 'application/json'}
        if origin: headers['Origin'] = origin
        req = Request(base + route, data=None if data is None else json.dumps(data).encode(), headers=headers)
        try:
            with opener.open(req, timeout=5) as result:
                return result.status, json.loads(result.read())
        except HTTPError as error:
            return error.code, json.loads(error.read())
    destination_patch = patch('editor.destination', return_value={'project':'test-project'})
    destination_patch.start()
    try:
        state = request('/state')[1]
        preview = request('/git')[1]
        payload = dict(signature=preview['signature'], message='HTTP commit', path=str(source), version=state['version'], source=state['source'])
        assert request('/git/commit', payload, 'https://example.invalid')[0] == 403
        assert request('/git/commit', {**payload, 'version':'stale'})[0] == 409
        code, result = request('/git/commit', payload)
        assert code == 200 and result['commit']
        assert request('/git/commit', payload)[0] == 409, 'A repeated commit cannot duplicate the original.'
        assert not request('/git')[1]['files']
    finally:
        destination_patch.stop()
        server.shutdown(); server.server_close(); server.build.cleanup(); thread.join()
print('HTTP Git tests passed: same-origin protection, stale version rejection, successful commit, duplicate rejection.')
