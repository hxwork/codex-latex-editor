"""Real filesystem/HTTP integration in disposable projects; no real paper changes."""
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import threading
from urllib.request import Request,build_opener,ProxyHandler
from urllib.error import HTTPError
from editor import make_server

with TemporaryDirectory() as directory:
    base=Path(directory).resolve();root=base/'project';root.mkdir();main=root/'main.tex'
    main.write_text('\\documentclass{article}\\begin{document}Test\\end{document}')
    (root/'sec').mkdir();(root/'sec'/'part.tex').write_text('Part')
    (root/'refs.bib').write_text('@article{test,title={Test}}')
    (root/'local.md').write_text('Notes');(root/'main.log').write_text('product')
    (root/'.git').mkdir();(root/'.git'/'config').write_text('private')
    outside=base/'outside.txt';outside.write_text('outside');(root/'linked.txt').symlink_to(outside)
    server=make_server(main,main_thread='',preferences_path=base/'prefs.sqlite3')
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    url=f'http://127.0.0.1:{server.server_port}';opener=build_opener(ProxyHandler({}))
    def request(route,data=None,origin=None):
        headers={'Content-Type':'application/json'}
        if origin:headers['Origin']=origin
        req=Request(url+route,None if data is None else json.dumps(data).encode(),headers)
        try:
            with opener.open(req,timeout=10) as response:return response.status,json.load(response)
        except HTTPError as error:return error.code,json.load(error)
    def operation(action,path='',**more):
        state=request('/state')[1];tree=request('/tree')[1]
        return request('/tree',dict(action=action,path=path,active_path=state['path'],version=state['version'],root=tree['root'],signature=tree['signature'],**more))
    try:
        tree=request('/tree')[1];names={e['path'] for e in tree['entries']}
        assert {'main.tex','sec','sec/part.tex','refs.bib','local.md'}<=names
        assert not {'main.log','.git/config','linked.txt'} & names
        state=request('/state')[1]
        payload=dict(action='folder',path='bad',active_path=state['path'],version=state['version'],root=tree['root'],signature=tree['signature'])
        assert request('/tree',payload,'https://example.invalid')[0]==403
        assert request('/tree',{**payload,'version':'stale'})[0]==409
        (root/'external.tex').write_text('external')
        assert request('/tree',payload)[0]==400
        for name in ['../escape.tex','.git/new.tex','linked.txt/child.tex']:
            assert operation('file',name)[0]==400
        assert operation('folder','draft')[0]==200
        assert operation('file','draft/new.tex')[0]==200
        assert operation('file','draft/new.tex')[0]==400
        assert operation('move','sec',target='sec/inside')[0]==400
        assert operation('move','refs.bib',target='main.tex')[0]==400
        state=request('/state')[1]
        code,data=request('/source',{'path':str(root/'refs.bib'),'version':state['version']})
        assert code==200 and data['main_file']==str(main),data
        code,data=operation('move','refs.bib',target='draft/references.bib')
        assert code==200 and data['state']['path']==str(root/'draft/references.bib'),data
        code,data=operation('move','draft',target='renamed')
        assert code==200 and data['state']['path']==str(root/'renamed/references.bib'),data
        code,data=operation('delete','renamed')
        assert code==200 and data['state']['path']==str(main),data
        token=data['token'];assert not (root/'renamed').exists()
        assert request('/tree')[1]['trash'][0]['token']==token
        assert operation('restore',token=token)[0]==200
        assert (root/'renamed/references.bib').read_text().startswith('@article')
        assert operation('restore',token=token)[0]==400
        assert operation('delete','main.tex')[0]==400
        code,data=operation('move','main.tex',target='entry.tex')
        assert code==200 and data['state']['main_file']==str(root/'entry.tex') and data['state']['path']==str(root/'entry.tex'),data
        assert outside.read_text()=='outside'
    finally:
        server.shutdown();server.server_close();server.build.cleanup();thread.join()
print('PASS: tree listing, cache/symlink exclusions, text opening, create/move/rename, active/main remapping, recoverable folder deletion, persisted recovery, stale and same-origin guards, collision and root protection')
