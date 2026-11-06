"""Disposable bare remote integration tests; no Overleaf upload or model calls."""
from pathlib import Path
from tempfile import TemporaryDirectory
from editor import git_preview, git_commit
from overleaf_sync import OverleafSync, run, output, conservative_analysis, parse_hunks, destination


def create(directory):
    root=Path(directory).resolve()
    remote=root/'remote.git'; a=root/'local'; b=root/'collaborator'
    root.mkdir(exist_ok=True)
    run(root,'init','--bare','--initial-branch=main',str(remote))
    run(root,'clone',str(remote),str(a))
    for repo in (a,):
        run(repo,'config','user.name','Test');run(repo,'config','user.email','test@example.invalid')
    (a/'main.tex').write_text('First paragraph.\n\nWe assume stable contacts.\n\nLast paragraph.\n')
    (a/'remote.tex').write_text('original\n')
    run(a,'add','.');run(a,'commit','-m','Initial');run(a,'push','-u','origin','main')
    run(root,'clone',str(remote),str(b))
    run(b,'config','user.name','Collaborator');run(b,'config','user.email','collab@example.invalid')
    return a,b,remote


def job(a,analyser=lambda items:[],direction='push',record=None):
    task=OverleafSync(a,git_preview(a)['signature'],'Paper update',git_preview,git_commit,analyser=analyser,allow_local=True,
                      direction=direction,record=record)
    task.start();task.thread.join(20);assert not task.thread.is_alive()
    return task

with TemporaryDirectory() as directory:
    a,b,remote=create(directory)
    # Nonoverlapping local and remote edits combine and actually reach the bare remote.
    (a/'main.tex').write_text('Local first paragraph.\n\nWe assume stable contacts.\n\nLast paragraph.\n')
    (a/'main.log').write_text('excluded')
    (b/'remote.tex').write_text('collaborator change\n');run(b,'add','.');run(b,'commit','-m','Remote');run(b,'push')
    task=job(a)
    assert task.result['status']=='done',task.result
    assert output(a,'rev-parse','HEAD')==output(remote,'rev-parse','main')
    assert (a/'remote.tex').read_text()=='collaborator change\n'
    assert 'main.log' not in output(remote,'ls-tree','-r','--name-only','main')
    assert not git_preview(a)['files']
    # With no new draft, already committed changes still push.
    (a/'remote.tex').write_text('local committed change\n');run(a,'add','remote.tex');run(a,'commit','-m','Already committed')
    assert job(a).result['status']=='done'
    try: destination(a)
    except ValueError: pass
    else: raise AssertionError('Non-Overleaf production destination accepted')

with TemporaryDirectory() as directory:
    a,b,remote=create(directory)
    initial=(a/'main.tex').read_text()
    ours=initial.replace('We assume stable contacts.','We do not assume stable contacts.')
    theirs=initial.replace('We assume stable contacts.','We require stable contacts for convergence.')
    (a/'main.tex').write_text(ours);(b/'main.tex').write_text(theirs)
    run(b,'add','.');run(b,'commit','-m','Competing logic');run(b,'push')
    before=output(remote,'rev-parse','main')
    task=job(a,lambda items:[{'id':item['id'],'severity':'critical','category':'logic','confidence':'high',
                             'reason':'否定假设与收敛条件竞争修改。','recommendation':'核对稳定接触假设。','method':'codex'} for item in items])
    assert task.result['status']=='conflicts',task.result
    assert task.result['conflicts'][0]['analysis']['severity']=='critical'
    assert task.result['conflicts'][0]['base'].strip()=='We assume stable contacts.'
    assert (a/'main.tex').read_text()==ours and not run(a,'ls-files','--unmerged').stdout
    assert output(remote,'rev-parse','main')==before,'Conflict must not upload or write real conflict markers.'
    try: task.resolve([{'path':'main.tex','choice':'manual','source':task.result['files'][0]['merged']}])
    except ValueError: pass
    else: raise AssertionError('Conflict markers accepted')
    merged=initial.replace('We assume stable contacts.','We require stable contacts only for convergence.')
    task.resolve([{'path':'main.tex','choice':'manual','source':merged}]);task.thread.join(20)
    assert task.result['status']=='done',task.result
    assert run(remote,'show','main:main.tex').stdout.decode()==merged
    assert (a/'main.tex').read_text()==merged

with TemporaryDirectory() as directory:
    a,b,remote=create(directory)
    (a/'main.tex').write_text('Local sentence.\n');(b/'main.tex').write_text('Remote sentence.\n')
    run(b,'add','.');run(b,'commit','-m','Remote');run(b,'push')
    task=job(a,lambda _: (_ for _ in ()).throw(ValueError('AI unavailable')))
    assert task.result['status']=='conflicts' and task.result['analysis_warning']
    (a/'main.tex').write_text('New local edits after analysis.\n')
    task.resolve([{'path':'main.tex','choice':'remote'}]);task.thread.join(20)
    assert task.result['status']=='error'
    assert (a/'main.tex').read_text()=='New local edits after analysis.\n'

with TemporaryDirectory() as directory:
    a,b,remote=create(directory)
    (a/'main.tex').write_text('Local text.\n');(b/'main.tex').unlink()
    run(b,'add','-A');run(b,'commit','-m','Remote deletes source');run(b,'push')
    task=job(a)
    assert task.result['status']=='conflicts'
    assert task.result['conflicts'][0]['analysis']['severity']=='critical'
    task.resolve([{'path':'main.tex','choice':'remote'}]);task.thread.join(20)
    assert task.result['status']=='done',task.result
    assert not (a/'main.tex').exists()

# Mechanical text evidence is distinguished from semantic uncertainty.
assert conservative_analysis('x','same words\n','same  words')['severity']=='minor'
assert conservative_analysis('We assume contact.','We do not assume contact.','We require contact.')['severity']!='minor'
assert conservative_analysis('x=1','x=2','x=3')['severity']=='critical'
assert conservative_analysis('A.\n\nB.','B.\n\nA.','A.\n\nB.')['category']=='paragraph_order'
print('PASS: local+remote sync, prior commits, excluded artifacts, real conflict isolation, semantic labels, manual resolution, stale protection, AI fallback, delete/modify resolution and destination validation')

# An edit arriving after fetch must reject an ordinary push and preserve both authors' work.
from unittest.mock import patch
import overleaf_sync
with TemporaryDirectory() as directory:
    a,b,remote=create(directory)
    (a/'main.tex').write_text('New local draft.\n')
    real_run=overleaf_sync.run
    raced=[]
    def racing_run(root,*args,**kwargs):
        if Path(root)==a and args and args[0]=='push' and not raced:
            raced.append(True)
            (b/'remote.tex').write_text('Remote edit during sync.\n')
            real_run(b,'add','remote.tex');real_run(b,'commit','-m','Concurrent remote edit');real_run(b,'push')
        return real_run(root,*args,**kwargs)
    with patch('overleaf_sync.run',side_effect=racing_run):
        task=job(a)
    assert task.result['status']=='error',task.result
    assert run(remote,'show','main:remote.tex').stdout==b'Remote edit during sync.\n'
    assert run(a,'show','HEAD:main.tex').stdout==b'New local draft.\n'
    assert run(remote,'show','main:main.tex').stdout!=b'New local draft.\n'
print('PASS: concurrent remote edit rejects push and preserves local commit and collaborator content')

# Real HTTP routes start a background sync, stay responsive while it holds the document lock,
# return semantic conflicts and resolve only the selected snapshot.
import json
import threading
import time
from urllib.request import Request, build_opener, ProxyHandler
from urllib.error import HTTPError
import editor
with TemporaryDirectory() as directory:
    a,b,remote=create(directory)
    (a/'main.tex').write_text('Local competing draft.\n')
    (b/'main.tex').write_text('Remote competing draft.\n')
    run(b,'add','.');run(b,'commit','-m','Remote conflict');run(b,'push')
    entered,release=threading.Event(),threading.Event()
    def analyser(items):
        entered.set();assert release.wait(5)
        return []
    factory=lambda *args,**kwargs: OverleafSync(*args,**kwargs,allow_local=True,analyser=analyser)
    with patch('editor.destination',side_effect=lambda root: destination(root,allow_local=True)),patch('editor.OverleafSync',side_effect=factory):
        server=editor.make_server(a/'main.tex',main_thread='',preferences_path=Path(directory)/'prefs.sqlite3')
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        opener=build_opener(ProxyHandler({}));base=f'http://127.0.0.1:{server.server_port}'
        def request(route,data=None,origin=None):
            headers={'Content-Type':'application/json'}
            if origin:headers['Origin']=origin
            req=Request(base+route,None if data is None else json.dumps(data).encode(),headers)
            try:
                with opener.open(req,timeout=5) as response:return response.status,json.loads(response.read())
            except HTTPError as error:return error.code,json.loads(error.read())
        try:
            state=request('/state')[1];preview=request('/git')[1]
            payload={'signature':preview['signature'],'message':'HTTP sync','path':state['path'],'version':state['version'],'source':state['source']}
            assert request('/git/sync',payload,'https://example.invalid')[0]==403
            assert request('/git/sync',{**payload,'version':'stale'})[0]==409
            code,data=request('/git/sync',payload);assert code==200
            assert entered.wait(5)
            code,progress=request('/git/job?id='+data['id'])
            assert code==200 and progress['status']=='running','Job polling must bypass the document lock.'
            release.set();server.git_sync.thread.join(10)
            result=request('/git/job?id='+data['id'])[1];assert result['status']=='conflicts'
            assert request('/git/resolve',{'id':data['id'],'resolutions':[{'path':'main.tex','choice':'remote'}]})[0]==200
            server.git_sync.thread.join(10)
            assert request('/git/job?id='+data['id'])[1]['status']=='done'
            assert (a/'main.tex').read_text()=='Remote competing draft.\n'
        finally:
            release.set();server.shutdown();server.server_close();server.build.cleanup();thread.join()
print('PASS: HTTP sync, progress polling, same-origin and version guards, conflict reporting and selected resolution')

with TemporaryDirectory() as directory:
    a,b,remote=create(directory)
    (a/'notes.md').write_text('Private local notes')
    run(a,'add','notes.md'); run(a,'commit','-qm','Local notes')
    task=job(a)
    task.thread.join(20)
    assert task.result['status']=='error' and 'notes.md' in task.result['error']
    assert b'notes.md' not in run(remote,'ls-tree','-r','--name-only','main').stdout
print('PASS: already committed unrelated files cannot bypass the upload filter')

# Sync from Overleaf: remote commits reach the branch and the working tree; drafts stay uncommitted; nothing is pushed.
from overleaf_sync import sync_status, read_sync_record
def push_remote(b,files,message='Overleaf edit'):
    for name,text in files.items():
        if text is None: (b/name).unlink()
        else: (b/name).write_text(text)
    run(b,'add','-A');run(b,'commit','-qm',message);run(b,'push','-q')
def tracked_status(a):
    return run(a,'status','--porcelain','--untracked-files=no').stdout.decode()

with TemporaryDirectory() as directory:
    a,b,remote=create(directory)
    initial=(a/'main.tex').read_text()
    target=destination(a,allow_local=True)
    assert sync_status(a,target,a)['behind']==0
    push_remote(b,{'remote.tex':'Overleaf edit\n','main.tex':initial.replace('Last paragraph.','Last paragraph from Overleaf.')})
    status=sync_status(a,target,a,fetch=True)
    assert status['behind']==1 and status['ahead']==0 and status['incoming'][0]['subject']=='Overleaf edit'
    assert {item['path'] for item in status['incoming_files']}=={'main.tex','remote.tex'}
    assert read_sync_record(a)['check']['time']
    draft=initial.replace('First paragraph.','Local unsaved first paragraph.')
    (a/'main.tex').write_text(draft)
    remote_before=output(remote,'rev-parse','main')
    calls=[]
    task=job(a,direction='pull',record=lambda kind,paths:calls.append((kind,sorted(Path(p).name for p in paths),[Path(p).read_text() for p in sorted(paths)])))
    assert task.result['status']=='done' and task.result['direction']=='pull',task.result
    assert task.result['drafts'] and sorted(task.result['changed'])==['main.tex','remote.tex']
    assert (a/'remote.tex').read_text()=='Overleaf edit\n'
    merged=draft.replace('Last paragraph.','Last paragraph from Overleaf.')
    assert (a/'main.tex').read_text()==merged,'Non-overlapping draft and Overleaf edits merge in the working tree.'
    assert output(a,'rev-parse','HEAD')==remote_before==output(remote,'rev-parse','main'),'Pull fast-forwards and never pushes.'
    assert run(a,'show','HEAD:main.tex').stdout.decode()==initial.replace('Last paragraph.','Last paragraph from Overleaf.')
    assert tracked_status(a)==' M main.tex\n','The draft stays an uncommitted edit.'
    assert [call[0] for call in calls]==['before','after'] and calls[0][2][0]==draft and calls[1][2][0]==merged
    assert read_sync_record(a)['pull']['commit']==remote_before[:8]
    again=job(a,direction='pull')
    assert again.result['status']=='done' and again.result['up_to_date'] and (a/'main.tex').read_text()==merged

with TemporaryDirectory() as directory:
    a,b,remote=create(directory)
    initial=(a/'main.tex').read_text()
    (a/'main.tex').write_text(initial.replace('We assume stable contacts.','We do not assume stable contacts.'))
    push_remote(b,{'main.tex':initial.replace('We assume stable contacts.','We require stable contacts.')})
    head=output(a,'rev-parse','HEAD');local=(a/'main.tex').read_text()
    task=job(a,lambda items:[{'id':item['id'],'severity':'critical','category':'logic','confidence':'high',
                             'reason':'Competing assumptions.','recommendation':'Reconcile.','method':'codex'} for item in items],direction='pull')
    assert task.result['status']=='conflicts' and task.result['direction']=='pull',task.result
    conflict=task.result['conflicts'][0]
    assert conflict['local'].strip()=='We do not assume stable contacts.' and conflict['remote'].strip()=='We require stable contacts.'
    assert (a/'main.tex').read_text()==local and output(a,'rev-parse','HEAD')==head,'Conflicts never touch real files or the branch.'
    resolved=initial.replace('We assume stable contacts.','We require stable contacts only for convergence.')
    task.resolve([{'path':'main.tex','choice':'manual','source':resolved}]);task.thread.join(20)
    assert task.result['status']=='done',task.result
    assert (a/'main.tex').read_text()==resolved and output(a,'rev-parse','HEAD')==output(remote,'rev-parse','main')
    assert run(remote,'show','main:main.tex').stdout.decode()==initial.replace('We assume stable contacts.','We require stable contacts.')

with TemporaryDirectory() as directory:
    a,b,remote=create(directory)
    (a/'main.tex').write_text('Local draft.\n')
    push_remote(b,{'main.tex':'Overleaf text.\n'})
    task=job(a,direction='pull')
    assert task.result['status']=='conflicts'
    (a/'main.tex').write_text('Edited again after analysis.\n')
    task.resolve([{'path':'main.tex','choice':'remote'}]);task.thread.join(20)
    assert task.result['status']=='error' and (a/'main.tex').read_text()=='Edited again after analysis.\n'
    head=output(a,'rev-parse','HEAD')
    assert run(a,'merge-base','--is-ancestor',output(remote,'rev-parse','main'),head,check=False).returncode,'A stale resolution keeps the old branch.'
    task=job(a,direction='pull');assert task.result['status']=='conflicts'
    task.resolve([{'path':'main.tex','choice':'local'}]);task.thread.join(20)
    assert task.result['status']=='done' and (a/'main.tex').read_text()=='Edited again after analysis.\n'
    assert output(a,'rev-parse','HEAD')==output(remote,'rev-parse','main')

with TemporaryDirectory() as directory:
    a,b,remote=create(directory)
    # Unpushed local commits get an ordinary local merge commit; the remote is untouched.
    (a/'main.tex').write_text('Committed locally.\n');run(a,'commit','-qam','Local commit')
    local=output(a,'rev-parse','HEAD')
    push_remote(b,{'remote.tex':'Overleaf only.\n'})
    before=output(remote,'rev-parse','main')
    task=job(a,direction='pull')
    assert task.result['status']=='done',task.result
    parents=output(a,'rev-list','--parents','-n','1','HEAD').split()
    assert parents[1:]==[local,before] and output(remote,'rev-parse','main')==before
    assert (a/'remote.tex').read_text()=='Overleaf only.\n' and (a/'main.tex').read_text()=='Committed locally.\n'
    assert not tracked_status(a)

with TemporaryDirectory() as directory:
    a,b,remote=create(directory)
    (a/'main.tex').write_text('Committed locally.\n');run(a,'commit','-qam','Local commit')
    push_remote(b,{'main.tex':'Committed on Overleaf.\n'})
    head=output(a,'rev-parse','HEAD')
    task=job(a,direction='pull')
    assert task.result['status']=='error' and '同步到 Overleaf' in task.result['error'],task.result
    assert output(a,'rev-parse','HEAD')==head and (a/'main.tex').read_text()=='Committed locally.\n'

with TemporaryDirectory() as directory:
    a,b,remote=create(directory)
    # An untracked local file at a path Overleaf adds is merged, never silently overwritten; deletions apply.
    (a/'appendix.tex').write_text('Local appendix.\n')
    push_remote(b,{'appendix.tex':'Overleaf appendix.\n','remote.tex':None})
    task=job(a,direction='pull')
    assert task.result['status']=='conflicts' and task.result['files'][0]['path']=='appendix.tex',task.result
    assert (a/'appendix.tex').read_text()=='Local appendix.\n' and (a/'remote.tex').exists()
    task.resolve([{'path':'appendix.tex','choice':'local'}]);task.thread.join(20)
    assert task.result['status']=='done',task.result
    assert (a/'appendix.tex').read_text()=='Local appendix.\n' and not (a/'remote.tex').exists()
    assert tracked_status(a)==' M appendix.tex\n'
print('PASS: sync from Overleaf fast-forwards, merges drafts, keeps drafts uncommitted, snapshots history, resolves conflicts, rejects stale or conflicting commits, protects untracked files and never pushes')

# HTTP: /git/status reports incoming commits, the pull job writes files and records history checkpoints.
with TemporaryDirectory() as directory:
    a,b,remote=create(directory)
    push_remote(b,{'main.tex':'Pulled over HTTP.\n'})
    with patch('editor.destination',side_effect=lambda root: destination(root,allow_local=True)),patch('editor.OverleafSync',side_effect=lambda *args,**kwargs: OverleafSync(*args,**kwargs,allow_local=True,analyser=lambda items:[])):
        server=editor.make_server(a/'main.tex',main_thread='',preferences_path=Path(directory)/'prefs.sqlite3')
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        opener=build_opener(ProxyHandler({}));base=f'http://127.0.0.1:{server.server_port}'
        def request(route,data=None):
            req=Request(base+route,None if data is None else json.dumps(data).encode(),{'Content-Type':'application/json'})
            try:
                with opener.open(req,timeout=10) as response:return response.status,json.loads(response.read())
            except HTTPError as error:return error.code,json.loads(error.read())
        try:
            code,status=request('/git/status?fetch=1')
            assert code==200 and status['fetched'] and status['behind']==1,status
            code,preview=request('/git');assert code==200 and preview['status']['behind']==1
            state=request('/state')[1]
            payload={'direction':'pull','signature':preview['signature'],'message':'','path':state['path'],'version':state['version'],'source':state['source']}
            assert request('/git/sync',{**payload,'direction':'sideways'})[0]==400
            code,data=request('/git/sync',payload);assert code==200,data
            server.git_sync.thread.join(10)
            result=request('/git/job?id='+data['id'])[1]
            assert result['status']=='done' and result['changed']==['main.tex'],result
            assert (a/'main.tex').read_text()=='Pulled over HTTP.\n'
            assert request('/state')[1]['source']=='Pulled over HTTP.\n'
            assert request('/git/status')[1]['behind']==0
            import sqlite3
            with sqlite3.connect(a/'.latex-codex'/'history.sqlite3') as db:
                kinds=[row[0] for row in db.execute("SELECT kind FROM revisions WHERE file='main.tex' ORDER BY id")]
            assert kinds[-1]=='overleaf',kinds
            assert output(remote,'rev-parse','main')==output(a,'rev-parse','HEAD')
        finally:
            server.shutdown();server.server_close();server.build.cleanup();thread.join()
print('PASS: HTTP status check, pull job, direction validation, refreshed state and history checkpoint')
