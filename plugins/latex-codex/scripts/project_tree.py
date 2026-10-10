"""Bounded project file operations and recoverable deletion."""
from pathlib import Path
import hashlib
import json
import os
import uuid
TEXT_EXTENSIONS = ('.tex', '.md', '.markdown', '.bib', '.bst', '.sty', '.cls', '.txt', '.csv', '.def', '.bbx', '.cbx', '.lbx', '.clo')
HIDDEN = {'.git', '.latex-codex', '.vscode', '__pycache__', 'node_modules'}
PRODUCTS = ('.aux', '.bbl', '.blg', '.brf', '.log', '.out', '.toc', '.bcf', '.run.xml', '.synctex.gz', '.fls', '.fdb_latexmk')


def safe_path(root, name, allow_root=False):
    root = Path(root).resolve()
    if not isinstance(name,str) or '\0' in name or '\\' in name:
        raise ValueError('请选择项目内的相对路径。')
    parts = Path(name).parts
    if Path(name).is_absolute() or any(p in HIDDEN or p in ('.','..') or p.startswith('.') for p in parts):
        raise ValueError('不能操作隐藏文件或项目外的路径。')
    target = root/name
    if target == root and not allow_root: raise ValueError('不能修改项目根目录。')
    for parent in (target,*target.parents):
        if parent == root: break
        if parent.is_symlink(): raise ValueError('不能通过符号链接操作文件。')
    if not target.resolve().is_relative_to(root): raise ValueError('路径超出项目根目录。')
    return target


def tree_snapshot(root):
    root = Path(root).resolve(); entries=[]; digest=hashlib.sha256(str(root).encode())
    def visit(folder):
        for path in sorted(folder.iterdir(),key=lambda p:(not p.is_dir(),p.name.casefold())):
            if path.name.startswith('.') or path.name in HIDDEN or path.is_symlink() or path.name.endswith(PRODUCTS): continue
            if path.suffix.lower()=='.pdf' and path.with_suffix('.tex').exists(): continue
            if not path.is_file() and not path.is_dir(): continue
            stat=path.stat(); name=path.relative_to(root).as_posix()
            entries.append({'path':name,'name':path.name,'directory':path.is_dir(),'editable':path.is_file() and path.suffix.lower() in TEXT_EXTENSIONS})
            digest.update(f'{name}:{stat.st_mtime_ns}:{stat.st_size}'.encode())
            if len(entries)>10000: raise ValueError('项目文件过多，请选择更小的项目根目录。')
            if path.is_dir(): visit(path)
    visit(root)
    trash=[]; store=root/'.latex-codex'/'file-trash'
    if not store.parent.is_symlink() and not store.is_symlink() and store.is_dir():
        for folder in store.iterdir():
            if folder.is_symlink() or not folder.is_dir(): continue
            meta=folder/'manifest.json'
            if meta.is_symlink() or not meta.is_file(): continue
            try:
                record=json.loads(meta.read_text()); safe_path(root,record['path'])
                trash.append({'token':folder.name,'path':record['path'],'time':meta.stat().st_mtime_ns})
            except (OSError,ValueError,KeyError): continue
    return {'root':str(root),'entries':entries,'signature':digest.hexdigest(),'trash':sorted(trash,key=lambda x:x['time'],reverse=True)}


def mutate(root,data,main_file):
    root=Path(root).resolve(); current=tree_snapshot(root)
    if data.get('root')!=str(root) or data.get('signature')!=current['signature']:
        raise ValueError('项目文件已变化，请刷新文件树后重试。')
    action=data.get('action')
    if action=='restore':
        token=data.get('token','')
        if not isinstance(token,str) or len(token)!=32 or any(c not in '0123456789abcdef' for c in token): raise ValueError('恢复记录无效。')
        store=root/'.latex-codex'/'file-trash'/token
        if any(p.is_symlink() for p in (store,store.parent,store.parent.parent,store/'manifest.json',store/'content')) or not store.is_dir(): raise ValueError('恢复记录不存在。')
        meta=json.loads((store/'manifest.json').read_text()); target=safe_path(root,meta['path'])
        if target.exists() or not target.parent.is_dir(): raise ValueError('原位置已占用或原文件夹不存在。')
        os.rename(store/'content',target); (store/'manifest.json').unlink(); store.rmdir()
        return {'restored':meta['path']}
    source=safe_path(root,data.get('path',''))
    if action in ('file','folder'):
        if source.exists() or not source.parent.is_dir(): raise ValueError('名称已存在或父文件夹不存在。')
        if action=='folder': source.mkdir()
        else:
            if source.suffix.lower() not in TEXT_EXTENSIONS: raise ValueError('新建文件需使用文本扩展名，例如 .tex 或 .bib。')
            with source.open('x',encoding='utf-8') as stream: stream.write('')
        return {'created':source.relative_to(root).as_posix()}
    if not source.exists(): raise ValueError('文件不存在，请刷新文件树。')
    if action=='move':
        target=safe_path(root,data.get('target'))
        if target.exists() or not target.parent.is_dir(): raise ValueError('目标名称已存在或目标文件夹不存在。')
        if source.is_dir() and target.is_relative_to(source): raise ValueError('不能把文件夹移入自身。')
        os.rename(source,target)
        return {'from':source.relative_to(root).as_posix(),'to':target.relative_to(root).as_posix()}
    if action=='delete':
        if Path(main_file).is_relative_to(source): raise ValueError('不能删除主编译文件或包含它的文件夹，请先更换主文件。')
        token=uuid.uuid4().hex; store=root/'.latex-codex'/'file-trash'/token
        if any(p.is_symlink() for p in (store.parent,store.parent.parent)): raise ValueError('本地回收区不可用。')
        store.mkdir(parents=True); (store/'manifest.json').write_text(json.dumps({'path':source.relative_to(root).as_posix()},ensure_ascii=False))
        os.rename(source,store/'content')
        return {'deleted':source.relative_to(root).as_posix(),'token':token}
    raise ValueError('未知文件操作。')
