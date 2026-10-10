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


def job(a,analyser=lambda items:[]):
    task=OverleafSync(a,git_preview(a)['signature'],'Paper update',git_preview,git_commit,analyser=analyser,allow_local=True)
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
