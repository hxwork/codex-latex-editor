"""Run: python -B test_compile_options.py (stdlib only; no installs or real TeX calls)."""
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import patch

from editor import compiler, engine_flags, missing_tex_package, tex_options, remember_tex_options, history_pdf_context
from preferences import Preferences

with patch('editor.tex_tool', side_effect=lambda name: '/tex/' + name):
    assert compiler(r'\documentclass{article}')[0] == 'pdflatex'
    assert compiler('% 中文注释\n' + r'\documentclass{article}')[0] == 'pdflatex'
    assert compiler(r'\documentclass{article}\\% 中文注释')[0] == 'pdflatex'
    for source in (r'\documentclass{ctexart}', r'\usepackage{fontspec}', r'\usepackage{unicode-math}',
                   r'\setmainfont{Example}', r'\documentclass{article}正文'):
        assert compiler(source)[0] == 'xelatex', source
    assert compiler('% !TeX program = xelatex\ntext')[0] == 'xelatex'
    assert compiler('% !TeX program = xelatex\ntext', 'pdflatex')[0] == 'pdflatex'
    for choice in ('cmd.exe', None, [], True):
        try:
            compiler('text', choice)
            raise AssertionError('Invalid engine accepted')
        except ValueError:
            pass

engine_flags.cache_clear()
with patch('editor.subprocess.run', return_value=SimpleNamespace(stdout=b'MiKTeX', stderr=b'')):
    assert engine_flags('mock-tex') == ['--disable-installer'], 'MiKTeX never installs packages automatically.'
engine_flags.cache_clear()
assert missing_tex_package("! LaTeX Error: File `diagbox.sty' not found.") == 'diagbox.sty'
assert missing_tex_package("! LaTeX Error: File `example.cls' not found.") == 'example.cls'
assert missing_tex_package('Undefined control sequence.') is None

with TemporaryDirectory(prefix='latex options ') as directory:
    root = Path(directory)
    server = SimpleNamespace(main_file=root / 'one.tex', preferences=Preferences(root / 'settings.sqlite3'))
    assert tex_options(server) == {'engine_choice': 'auto'}
    original_context = history_pdf_context(server, server.main_file)
    remember_tex_options(server, 'xelatex')
    assert history_pdf_context(server, server.main_file) != original_context, 'History PDF caches include compilation options.'
    assert tex_options(server) == {'engine_choice': 'xelatex'}
    server.main_file = root / 'two.tex'
    assert tex_options(server)['engine_choice'] == 'auto', 'Engine choices belong to individual main files.'
    remember_tex_options(server, 'pdflatex')
    server.main_file = root / 'one.tex'
    assert tex_options(server) == {'engine_choice': 'xelatex'}
    remember_tex_options(server, 'auto')
    assert len(json.loads(server.preferences.read()['latex-codex-tex-engines'])) == 1
print('PASS: automatic/explicit engines, per-file persistence, disabled MiKTeX installer and missing packages')
