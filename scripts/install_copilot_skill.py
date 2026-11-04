"""Install the editor as a personal GitHub Copilot skill.

Copies the runtime (scripts/ and vendor assets) and SKILL.md into one
self-contained folder, by default ~/.copilot/skills/latex-copilot, so every
Copilot session can launch the editor without this checkout. Rerun after
updating the repository. Tests, caches and the frontend sources are excluded.
"""
import argparse
import os
from pathlib import Path
import shutil
import tempfile

ROOT = Path(__file__).resolve().parents[1]
PLUGIN = ROOT / 'plugins' / 'latex-codex'
NAME = 'latex-copilot'


def ignored(directory, names):
    return {name for name in names if name == '__pycache__' or name.endswith('.pyc')
            or (Path(directory).name == 'scripts' and (name.startswith('test_') or name == 'pdf_analysis_test.mjs'))}


def install(target):
    target = Path(target).expanduser().resolve()
    target.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix='.latex-copilot-', dir=target.parent))
    try:
        shutil.copytree(PLUGIN / 'scripts', staging / 'scripts', ignore=ignored)
        skill = (PLUGIN / 'skills' / 'latex-codex' / 'SKILL.md').read_text(encoding='utf-8')
        skill = skill.replace('name: latex-codex', 'name: ' + NAME, 1)
        editor = staging / 'scripts' / 'editor.py'
        relative = 'Use `../../scripts/editor.py` relative to this skill directory.'
        if relative not in skill:
            raise SystemExit('SKILL.md launch path changed; update install_copilot_skill.py.')
        skill = skill.replace(relative, f'Use `{target / "scripts" / "editor.py"}` (`scripts/editor.py` inside this skill directory).')
        (staging / 'SKILL.md').write_text(skill, encoding='utf-8')
        if not editor.is_file():
            raise SystemExit('Runtime copy is incomplete.')
        # Replace the previous install only after the new copy is complete.
        previous = None
        if target.exists():
            previous = target.with_name(target.name + '.previous')
            shutil.rmtree(previous, ignore_errors=True)
            os.replace(target, previous)
        os.replace(staging, target)
        if previous:
            shutil.rmtree(previous, ignore_errors=True)
    finally:
        shutil.rmtree(staging, ignore_errors=True)
    return target


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--target', default=Path.home() / '.copilot' / 'skills' / NAME)
    print('Installed', install(parser.parse_args().target))
