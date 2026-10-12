# Personal fork

Fork: https://github.com/hxwork/codex-latex-editor
Upstream: https://github.com/Fr0zenWatter/codex-latex-editor

Includes the existing Cursor-style theme adjustments, one-click Overleaf synchronization, and three-way conflict analysis through the signed-in Codex CLI. Conflict analysis reports minor, critical, or uncertain changes with reasons and confidence; resolutions remain explicit user choices. Ordinary pushes preserve concurrent remote updates.

## Local use

```sh
python3 plugins/latex-codex/scripts/editor.py /path/to/main.tex
codex plugin marketplace add .
codex plugin add latex-codex@latex-codex-shared
```

After editing the fork, reinstall the local plugin to refresh its installed cache, then start a new chat. Keep paper sources, project history, preferences, credentials, and generated files outside this repository.

## Maintain the fork

```sh
git fetch upstream
git merge upstream/main
# Review changes and run the affected checks before pushing.
git push origin main
```

Never force-push shared history. Preserve custom runtime modules and themes when merging upstream changes. The optional DeepSeek package has not been adapted for Overleaf sync.

## Validation

Run from plugins/latex-codex/scripts:

```sh
python3 -B test_git.py
python3 -B test_overleaf_sync.py
python3 -B test_http_server.py
node test_ui.cjs
node test_settings.mjs
```

Overleaf integration tests use disposable local Git remotes and do not upload real papers. Semantic analysis was additionally checked with synthetic text through the actual Codex CLI.

## Project file tree

The toolbar tree button toggles a resizable project sidebar. Click text files to edit; right-click for creation, rename/move, or deletion; drag project files/folders onto a folder or the project-root row. Images and PDFs have a read-only preview. Rename/move does not rewrite TeX references. Deletion moves items into the project-local recovery area; the restore button recovers the most recent item, including after refresh. The main compilation file cannot be deleted until a different main file is selected.

Checks: test_project_tree.py, test_file_tree.mjs and test_ui.cjs. Runtime module project_tree.py must be included in installation packages.

编译错误保持当前源码文件和光标，仅在当前文件标记错误并显示日志；不自动跳到父文件的 input 行。关闭自动编译后，切换源码不触发编译。

自动更新：运行服务监测自身 scripts 与 vendor 的文件版本；代码稳定且草稿可保存、无冲突、批注或后台任务时，同址重启并刷新页面，恢复文件与编辑位置。更新失败保留已保存内容及恢复检查点。仅加载本地代码，不拉取 GitHub 或修改 Codex 配置。
