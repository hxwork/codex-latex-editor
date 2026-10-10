export function mountProjectTree({request,context,prepare,lock,open,changed,resize}){
  const panel=document.querySelector('#file-tree-panel'),toggle=document.querySelector('#file-tree-toggle'),root=document.querySelector('#tree-root'),error=document.querySelector('#tree-error');
  let snapshot=null,inflight=null,lastRoot='',lastSignature='',trash=null,mutation=false,selected='',expanded=new Set();
  const menu=document.createElement('div');menu.className='file-tree-menu';menu.setAttribute('role','menu');menu.hidden=true;document.body.append(menu);
  const dialog=document.createElement('dialog');dialog.className='file-tree-dialog';
  const title=document.createElement('h3'),description=document.createElement('p'),input=document.createElement('input'),form=document.createElement('form'),buttons=document.createElement('div'),cancel=document.createElement('button'),submit=document.createElement('button');
  input.required=true;input.setAttribute('aria-label','文件或文件夹路径');cancel.type='button';cancel.textContent='取消';submit.type='submit';submit.textContent='确定';buttons.className='history-dialog-actions';buttons.append(cancel,submit);form.append(input,buttons);dialog.append(title,description,form);document.body.append(dialog);cancel.onclick=()=>dialog.close();
  function notice(message=''){error.textContent=message;}
  function closeMenu(){menu.hidden=true;}
  function setVisible(value){panel.hidden=!value;toggle.setAttribute('aria-expanded',String(value));toggle.setAttribute('aria-label',value?'折叠项目文件树':'展开项目文件树');try{localStorage.setItem('latex-file-tree',value?'open':'closed');}catch{}resize();if(value)refresh();}
  toggle.onclick=()=>setVisible(panel.hidden);
  try{if(localStorage.getItem('latex-file-tree')==='open'){panel.hidden=false;toggle.setAttribute('aria-expanded','true');}}catch{}
  function popup(action,path='',directory=false){
    if(mutation)return;
    closeMenu();title.textContent=({file:'新建文件',folder:'新建文件夹',move:'重命名 / 移动',delete:'删除到本地回收区'})[action];
    description.textContent=action==='delete'?`删除 ${path}？本地副本将保留在回收区，可点击“恢复删除”。`:action==='move'?'输入相对于项目根目录的新路径。TeX 中的引用路径需要自行更新。':'在项目中创建文件或文件夹。文件需要带扩展名，例如 section.tex 或 references.bib。';
    input.hidden=action==='delete';input.required=action!=='delete';input.value=action==='move'?path:path?(path+'/'):'';submit.textContent=action==='delete'?'移到回收区':'确定';
    form.onsubmit=async e=>{e.preventDefault();const value=input.value.trim();dialog.close();await mutate({action,path:action==='file'||action==='folder'?value:path,...(action==='move'?{target:value}:{})});};
    dialog.showModal();if(!input.hidden){input.focus();if(action==='move')input.select();}
  }
  function showMenu(entry,x,y){
    selected=entry.path;menu.replaceChildren();
    const item=(label,fn)=>{const b=document.createElement('button');b.type='button';b.setAttribute('role','menuitem');b.textContent=label;b.onclick=()=>{closeMenu();fn();};menu.append(b);};
    if(entry.path)item('重命名 / 移动',()=>popup('move',entry.path,entry.directory));
    if(entry.path)item('删除',()=>popup('delete',entry.path,entry.directory));
    const parent=entry.directory?entry.path:entry.path.split('/').slice(0,-1).join('/');
    item('新建文件',()=>popup('file',parent));item('新建文件夹',()=>popup('folder',parent));
    menu.hidden=false;menu.style.left=Math.min(x,window.innerWidth-190)+'px';menu.style.top=Math.min(y,window.innerHeight-190)+'px';menu.querySelector('button').focus();
  }
  document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target))closeMenu();});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
  function attachDrop(node,destination){
    node.ondragover=e=>{if(e.dataTransfer.types.includes('application/x-latex-project-path')){e.preventDefault();e.stopPropagation();node.classList.add('tree-drop');e.dataTransfer.dropEffect='move';}};
    node.ondragleave=()=>node.classList.remove('tree-drop');
    node.ondrop=async e=>{node.classList.remove('tree-drop');e.preventDefault();e.stopPropagation();try{const data=JSON.parse(e.dataTransfer.getData('application/x-latex-project-path'));if(data.root!==context().root)throw new Error('只能移动当前项目中的文件。');const target=(destination?destination+'/':'')+data.path.split('/').pop();if(data.path!==target)await mutate({action:'move',path:data.path,target});}catch(err){notice(err.message);}};
  }
  const rootButton=document.createElement('button');rootButton.className='tree-row tree-project-root';rootButton.textContent='▾ 项目根目录';rootButton.onclick=()=>{selected='';};rootButton.oncontextmenu=e=>{e.preventDefault();showMenu({path:'',directory:true},e.clientX,e.clientY);};attachDrop(rootButton,'');
  function render(){
    root.replaceChildren(rootButton);const groups=new Map([['',root]]);const active=context().active_path;
    for(const entry of snapshot.entries){
      const parent=entry.path.split('/').slice(0,-1).join('/'),container=groups.get(parent);if(!container)continue;
      const row=document.createElement('button');row.type='button';row.className='tree-row';row.setAttribute('role','treeitem');row.draggable=true;row.dataset.path=entry.path;row.title=entry.path;
      row.textContent=(entry.directory?(expanded.has(entry.path)?'▾ 📁 ':'▸ 📁 '):'▤ ')+entry.name;
      const current=active===snapshot.root+'/'+entry.path;row.classList.toggle('tree-active',current);if(current)row.setAttribute('aria-current','page');
      row.onclick=async()=>{if(mutation)return;selected=entry.path;if(entry.directory){if(expanded.has(entry.path))expanded.delete(entry.path);else expanded.add(entry.path);render();}else if(entry.editable){closeMenu();if(await open(snapshot.root+'/'+entry.path))render();}else preview(entry);};
      row.oncontextmenu=e=>{e.preventDefault();showMenu(entry,e.clientX,e.clientY);};row.onkeydown=e=>{if(e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10')){e.preventDefault();const r=row.getBoundingClientRect();showMenu(entry,r.left,r.bottom);}};
      row.ondragstart=e=>{closeMenu();e.dataTransfer.setData('application/x-latex-project-path',JSON.stringify({root:snapshot.root,path:entry.path}));e.dataTransfer.effectAllowed='move';};
      container.append(row);
      if(entry.directory){row.setAttribute('aria-expanded',String(expanded.has(entry.path)));attachDrop(row,entry.path);if(expanded.has(entry.path)){const group=document.createElement('div');group.className='tree-group';group.setAttribute('role','group');container.append(group);groups.set(entry.path,group);}}
    }
  }
  async function refresh(){
    if(panel.hidden||mutation)return;if(inflight)return inflight;
    inflight=(async()=>{try{const data=await request('/tree');snapshot=data;if(lastRoot!==data.root){expanded=new Set();trash=null;document.querySelector('#tree-restore').hidden=true;lastRoot=data.root;}trash=data.trash?.[0]?.token||null;const restore=document.querySelector('#tree-restore');restore.hidden=!trash;restore.title=trash?'恢复 '+data.trash[0].path:'';const signature=data.signature+context().active_path;if(signature!==lastSignature){lastSignature=signature;render();}}catch(e){notice(e.message);}finally{inflight=null;}})();return inflight;
  }
  async function mutate(data){
    if(mutation)return;mutation=true;let acquired=false;notice();
    try{await prepare();lock(true);acquired=true;const latest=await request('/tree');const result=await request('/tree',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,...context(),signature:latest.signature})});snapshot=result.tree;lastSignature='';if(result.token){trash=result.token;document.querySelector('#tree-restore').hidden=false;}if(result.restored){trash=null;document.querySelector('#tree-restore').hidden=true;}lock(false);acquired=false;await changed(result);notice(result.deleted?'已移到本地回收区，可恢复。':'');}
    catch(e){notice(e.message);}
    finally{if(acquired)lock(false);mutation=false;await refresh();}
  }
  function parentSelection(){const entry=snapshot?.entries.find(e=>e.path===selected);return entry?.directory?selected:selected.split('/').slice(0,-1).join('/');}
  document.querySelector('#tree-new-file').onclick=()=>popup('file',parentSelection());document.querySelector('#tree-new-folder').onclick=()=>popup('folder',parentSelection());document.querySelector('#tree-refresh').onclick=()=>{lastSignature='';refresh();};document.querySelector('#tree-restore').onclick=()=>{if(trash)mutate({action:'restore',token:trash});};
  const asset=document.createElement('dialog');asset.className='file-tree-asset';document.body.append(asset);let assetGeneration=0,assetTask=null;asset.onclose=()=>{assetGeneration++;assetTask?.destroy();assetTask=null;};
  async function preview(entry){const token=++assetGeneration;assetTask?.destroy();assetTask=null;asset.replaceChildren();const header=document.createElement('h3'),close=document.createElement('button'),link=document.createElement('a');header.textContent=entry.path;close.textContent='关闭';close.onclick=()=>asset.close();const url='/tree/asset?path='+encodeURIComponent(entry.path);link.href=url;link.download=entry.name;link.textContent='下载文件';asset.append(header,close,link);if(/\.(png|jpe?g|gif|webp)$/i.test(entry.path)){const image=document.createElement('img');image.src=url;image.alt=entry.name;asset.append(image);}else if(/\.pdf$/i.test(entry.path)){
      const controls=document.createElement('div'),previous=document.createElement('button'),next=document.createElement('button'),count=document.createElement('span'),canvas=document.createElement('canvas');
      previous.textContent='上一页';next.textContent='下一页';previous.disabled=next.disabled=true;controls.append(previous,count,next);asset.append(controls,canvas);asset.showModal();
      try{const pdfjs=await import('/vendor/pdfjs/build/pdf.mjs');if(token!==assetGeneration)return;pdfjs.GlobalWorkerOptions.workerSrc='/vendor/pdfjs/build/pdf.worker.mjs';assetTask=pdfjs.getDocument(url);const pdf=await assetTask.promise;if(token!==assetGeneration)return;let page=1;
        async function render(){previous.disabled=next.disabled=true;const current=await pdf.getPage(page);if(token!==assetGeneration)return;const unit=current.getViewport({scale:1});const scale=Math.min(2,Math.max(200,asset.clientWidth-40)/unit.width);const viewport=current.getViewport({scale});canvas.width=viewport.width;canvas.height=viewport.height;await current.render({canvasContext:canvas.getContext('2d'),viewport}).promise;if(token!==assetGeneration)return;count.textContent=` ${page} / ${pdf.numPages} `;previous.disabled=page===1;next.disabled=page===pdf.numPages;}
        previous.onclick=()=>{if(page>1){page--;render().catch(e=>notice(e.message));}};next.onclick=()=>{if(page<pdf.numPages){page++;render().catch(e=>notice(e.message));}};await render();
      }catch(e){if(token===assetGeneration){count.textContent='预览失败，可下载文件查看。';}}
      return;
    }else{const p=document.createElement('p');p.textContent='此文件暂不支持编辑，可下载查看。';asset.append(p);}asset.showModal();}
  setInterval(refresh,4000);return {refresh};
}
