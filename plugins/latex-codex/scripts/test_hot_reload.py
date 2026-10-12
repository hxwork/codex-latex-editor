import sys, tempfile, shutil, subprocess, urllib.request, urllib.error, json, time
from pathlib import Path
source=Path(__file__).resolve().parent
sys.path.insert(0,str(source))
from hot_reload import runtime_revision,validate_runtime,reload_blocked
from types import SimpleNamespace
assert reload_blocked(SimpleNamespace(chat=SimpleNamespace(result={'status':'running'})))
assert reload_blocked(SimpleNamespace(git_sync=SimpleNamespace(result={'status':'conflicts'})))
assert reload_blocked(SimpleNamespace(runtime_history_builds=1))
assert not reload_blocked(SimpleNamespace(chat=SimpleNamespace(result={'status':'done'})))
with tempfile.TemporaryDirectory() as directory:
 root=Path(directory).resolve(); runtime=root/'runtime';runtime.mkdir()
 for p in source.glob('*.py'):
  if not p.name.startswith('test_'):shutil.copy2(p,runtime/p.name)
 shutil.copytree(source/'vendor',runtime/'vendor')
 project=root/'project';project.mkdir();main=project/'main.tex';child=project/'child.tex'
 main.write_text('\\documentclass{article}\n\\begin{document}\n\\input{child}\n\\end{document}\n');child.write_text('Child remains intact.\n')
 process=subprocess.Popen([sys.executable,'-u','-B',str(runtime/'editor.py'),str(main),'--port','0'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 try:
  url=process.stdout.readline().strip().rstrip('/');assert url.startswith('http://127.0.0.1:'),url
  def request(route,data=None):
   return json.load(urllib.request.urlopen(urllib.request.Request(url+route,data=None if data is None else json.dumps(data).encode(),headers={'Content-Type':'application/json','Origin':url}),timeout=5))
  state=request('/state');state=request('/source',{'path':str(child),'version':state['version']})
  old=request('/runtime');assert old['started']==old['current']
  (runtime/'vendor'/'runtime-test.txt').write_text('changed')
  new=request('/runtime');assert new['started']==old['started'] and new['current']!=old['current']
  try:request('/runtime/reload',{'revision':new['current'],'path':str(child),'version':'stale'})
  except urllib.error.HTTPError as error:assert error.code==409
  else:raise AssertionError('stale source accepted')
  (runtime/'invalid_runtime.py').write_text('def broken(')
  bad=request('/runtime')
  try:request('/runtime/reload',{'revision':bad['current'],'path':str(child),'version':state['version']})
  except urllib.error.HTTPError as error:
   assert error.code==400
  else:raise AssertionError('invalid Python accepted')
  assert request('/state')['path']==str(child)
  (runtime/'invalid_runtime.py').unlink()
  new=request('/runtime');assert request('/runtime/reload',{'revision':new['current'],'path':str(child),'version':state['version']})['ok']
  deadline=time.monotonic()+15
  while time.monotonic()<deadline:
   try:
    now=request('/runtime')
    if now['started']==new['current']:break
   except (OSError,ValueError):pass
   time.sleep(.1)
  else:raise AssertionError('replacement service did not start')
  restored=request('/state');assert restored['path']==str(child);assert restored['main_file']==str(main);assert restored['source']==child.read_text()
  assert process.poll() is None
  print('PASS: real same-port process reload, active child/main preservation, stale draft rejection, incomplete Python rejection, task guards')
 finally:
  process.terminate();process.wait(timeout=10)
