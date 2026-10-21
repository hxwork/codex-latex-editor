export function mountProjectTree({request,context,prepare,lock,open,changed,resize}){
  const panel=document.querySelector('#file-tree-panel'),toggle=document.querySelector('#file-tree-toggle'),root=document.querySelector('#tree-root'),error=document.querySelector('#tree-error');
  const svg=(paths)=>{const node=document.createElement('span');node.className='tree-icon';node.setAttribute('aria-hidden','true');node.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">'+paths+'</svg>';return node;};
  const icons={file:'<path d="M14 3H6v18h13V8zM14 3v5h5M9 12h6M9 16h6"/>',bib:'<path d="M5 5h12v15H5zM8 2h12v15M8 5v15"/>',image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 3-3 6 6"/>',chevron:'<path d="m9 5 7 7-7 7"/>',more:'<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',newFile:'<path d="M14 2H5v20h14V7zM14 2v5h5M8 14h8M12 10v8"/>',newFolder:'<path d="M3 6V4h7l2 3h9v13H3V6zM12 12v6M9 15h6"/>'};
  const resizer=document.querySelector('#file-tree-resizer'),heading=document.querySelector('#tree-heading-toggle');
  document.querySelector('#tree-new-file').append(svg(icons.newFile));document.querySelector('#tree-new-folder').append(svg(icons.newFolder));
  heading.querySelector('.tree-heading-chevron').append(svg(icons.chevron));
  let frame=null;
  function redraw(){if(window.requestAnimationFrame){if(frame!==null)return;frame=window.requestAnimationFrame(()=>{frame=null;resize();});}else resize();}
  let width=240,drag=null;
  try{const stored=Number(localStorage.getItem('latex-file-tree-width'));if(stored>=180)width=stored;}catch{}
  function setWidth(value,persist=false){const maximum=Math.max(180,Math.min(520,window.innerWidth*.45));width=Math.round(Math.min(maximum,Math.max(180,value)));panel.style.width=width+'px';resizer.setAttribute('aria-valuemax',String(Math.round(maximum)));resizer.setAttribute('aria-valuenow',String(width));if(persist)try{localStorage.setItem('latex-file-tree-width',String(width));}catch{}redraw();}
  setWidth(width);
  resizer.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();drag={id:e.pointerId,x:e.clientX,width};resizer.setPointerCapture?.(e.pointerId);resizer.classList.add('tree-resizing');};
  resizer.onpointermove=e=>{if(drag?.id===e.pointerId){e.preventDefault();setWidth(drag.width+e.clientX-drag.x);}};
  function endResize(e){if(!drag||drag.id!==e.pointerId)return;if(resizer.hasPointerCapture?.(e.pointerId))resizer.releasePointerCapture(e.pointerId);drag=null;resizer.classList.remove('tree-resizing');setWidth(width,true);}
  resizer.onpointerup=endResize;resizer.onpointercancel=endResize;resizer.onlostpointercapture=e=>{if(drag?.id===e.pointerId){drag=null;resizer.classList.remove('tree-resizing');setWidth(width,true);}};
  resizer.ondblclick=()=>setWidth(240,true);resizer.onkeydown=e=>{const step=e.shiftKey?48:16;if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();setWidth(e.key==='Home'?240:e.key==='End'?520:width+(e.key==='ArrowRight'?step:-step),true);};
  window.addEventListener?.('resize',()=>setWidth(width));
  heading.onclick=()=>{root.hidden=!root.hidden;heading.setAttribute('aria-expanded',String(!root.hidden));heading.setAttribute('aria-label',root.hidden?'展开文件树内容':'折叠文件树内容');};
  let snapshot=null,inflight=null,lastRoot='',lastSignature='',trash=null,mutation=false,selected='',expanded=new Set();
  const menu=document.createElement('div');menu.className='file-tree-menu';menu.setAttribute('role','menu');menu.hidden=true;document.body.append(menu);
  const dialog=document.createElement('dialog');dialog.className='file-tree-dialog';
  const title=document.createElement('h3'),description=document.createElement('p'),input=document.createElement('input'),form=document.createElement('form'),buttons=document.createElement('div'),cancel=document.createElement('button'),submit=document.createElement('button');
  input.required=true;input.setAttribute('aria-label','文件或文件夹路径');cancel.type='button';cancel.textContent='取消';submit.type='submit';submit.textContent='确定';buttons.className='history-dialog-actions';buttons.append(cancel,submit);form.append(input,buttons);dialog.append(title,description,form);document.body.append(dialog);cancel.onclick=()=>dialog.close();
  function notice(message=''){error.textContent=message;}
  function closeMenu(){menu.hidden=true;}
  function setVisible(value){panel.hidden=!value;resizer.hidden=!value;toggle.setAttribute('aria-expanded',String(value));toggle.setAttribute('aria-label',value?'折叠项目文件树':'展开项目文件树');try{localStorage.setItem('latex-file-tree',value?'open':'closed');}catch{}resize();if(value)refresh();}
  toggle.onclick=()=>setVisible(panel.hidden);
  try{if(localStorage.getItem('latex-file-tree')==='open'){panel.hidden=false;toggle.setAttribute('aria-expanded','true');toggle.setAttribute('aria-label','折叠项目文件树');}}catch{}
  resizer.hidden=panel.hidden;
  function popup(action,path='',directory=false){
    if(mutation)return;
    closeMenu();title.textContent=({file:'新建文件',folder:'新建文件夹',move:'重命名 / 移动',delete:'删除到本地回收区'})[action];
    description.textContent=action==='delete'?`删除 ${path}？本地副本将保留在回收区，可点击“恢复删除”。`:action==='move'?'输入相对于项目根目录的新路径。TeX 中的引用路径需要自行更新。':action==='folder'?'输入新文件夹名称。':`在 ${path||'项目根目录'} 中新建文件，例如 section.tex 或 references.bib。`;
    input.setAttribute('aria-label',action==='folder'?'新文件夹路径':action==='file'?'新文件路径':'文件或文件夹路径');
    input.hidden=action==='delete';input.required=action!=='delete';input.value=action==='move'?path:path?(path+'/'):'';submit.textContent=action==='delete'?'移到回收区':'确定';
    form.onsubmit=async e=>{e.preventDefault();const value=input.value.trim();dialog.close();await mutate({action,path:action==='file'||action==='folder'?value:path,...(action==='move'?{target:value}:{})});};
    dialog.showModal();if(!input.hidden){input.focus();if(action==='move')input.select();}
  }
  function showMenu(entry,x,y){
    selected=entry.path;render();menu.replaceChildren();
    const item=(label,fn)=>{const b=document.createElement('button');b.type='button';b.setAttribute('role','menuitem');b.textContent=label;b.onclick=()=>{closeMenu();fn();};menu.append(b);};
    if(entry.path)item('重命名 / 移动',()=>popup('move',entry.path,entry.directory));
    if(entry.path)item('删除',()=>popup('delete',entry.path,entry.directory));
    const parent=entry.directory?entry.path:entry.path.split('/').slice(0,-1).join('/');
    item('新建文件',()=>popup('file',parent));item('新建文件夹',()=>popup('folder',parent));if(!entry.path)item('刷新文件树',()=>{lastSignature='';refresh();});
    menu.hidden=false;menu.style.left=Math.min(x,window.innerWidth-190)+'px';menu.style.top=Math.min(y,window.innerHeight-190)+'px';menu.querySelector('button').focus();
  }
  document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target))closeMenu();});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
  function attachDrop(node,destination){
    node.ondragover=e=>{if(e.dataTransfer.types.includes('application/x-latex-project-path')){e.preventDefault();e.stopPropagation();node.classList.add('tree-drop');e.dataTransfer.dropEffect='move';}};
    node.ondragleave=()=>node.classList.remove('tree-drop');
    node.ondrop=async e=>{node.classList.remove('tree-drop');e.preventDefault();e.stopPropagation();try{const data=JSON.parse(e.dataTransfer.getData('application/x-latex-project-path'));if(data.root!==context().root)throw new Error('只能移动当前项目中的文件。');const target=(destination?destination+'/':'')+data.path.split('/').pop();if(data.path!==target)await mutate({action:'move',path:data.path,target});}catch(err){notice(err.message);}};
  }
  root.oncontextmenu=e=>{if(e.target===root){e.preventDefault();showMenu({path:'',directory:true},e.clientX,e.clientY);}};
  root.onclick=e=>{if(e.target===root){selected='';render();}};attachDrop(root,'');
  function render(){
    if(!snapshot)return;
    root.replaceChildren();const groups=new Map([['',root]]);const active=context().active_path;
    const highlighted=selected||active.slice(snapshot.root.length+1);
    for(const entry of snapshot.entries){
      const parent=entry.path.split('/').slice(0,-1).join('/'),container=groups.get(parent);if(!container)continue;
      const row=document.createElement('div');row.className='tree-row';row.setAttribute('role','treeitem');row.setAttribute('tabindex','0');row.setAttribute('aria-label',entry.name);row.setAttribute('aria-level',String(entry.path.split('/').length));row.draggable=true;row.dataset.path=entry.path;row.title=entry.path;
      const icon=svg(entry.directory?icons.chevron:/\.bib$/i.test(entry.name)?icons.bib:/\.(png|jpe?g|gif|webp|pdf)$/i.test(entry.name)?icons.image:icons.file);
      if(entry.directory){icon.classList.add('tree-chevron');if(expanded.has(entry.path))icon.classList.add('tree-chevron-open');}
      const label=document.createElement('span');label.className='tree-label';label.textContent=entry.name;row.append(icon,label);
      const current=active===snapshot.root+'/'+entry.path;row.classList.toggle('tree-active',highlighted===entry.path);row.setAttribute('aria-selected',String(highlighted===entry.path));if(current)row.setAttribute('aria-current','page');
      row.onclick=async()=>{if(mutation)return;selected=entry.path;if(entry.directory){if(expanded.has(entry.path))expanded.delete(entry.path);else expanded.add(entry.path);try{localStorage.setItem('latex-file-tree-expanded:'+snapshot.root,JSON.stringify([...expanded]));}catch{}render();}else if(entry.editable){closeMenu();if(await open(snapshot.root+'/'+entry.path))render();}else{render();preview(entry);}};
      row.oncontextmenu=e=>{e.preventDefault();e.stopPropagation();showMenu(entry,e.clientX,e.clientY);};
      row.onkeydown=e=>{if(e.target!==row)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();row.onclick();}else if(e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10')){e.preventDefault();const r=row.getBoundingClientRect();showMenu(entry,r.left,r.bottom);}};
      row.ondragstart=e=>{closeMenu();e.dataTransfer.setData('application/x-latex-project-path',JSON.stringify({root:snapshot.root,path:entry.path}));e.dataTransfer.effectAllowed='move';};
      const more=document.createElement('button');more.type='button';more.className='tree-more';more.setAttribute('aria-label','更多操作：'+entry.name);more.title='更多操作';more.append(svg(icons.more));more.onclick=e=>{e.stopPropagation();const r=more.getBoundingClientRect();showMenu(entry,r.left,r.bottom);};more.ondragstart=e=>{e.preventDefault();e.stopPropagation();};row.append(more);
      container.append(row);
      if(entry.directory){row.setAttribute('aria-expanded',String(expanded.has(entry.path)));attachDrop(row,entry.path);if(expanded.has(entry.path)){const group=document.createElement('div');group.className='tree-group';group.setAttribute('role','group');container.append(group);groups.set(entry.path,group);}}
    }
  }
  async function refresh(){
    if(panel.hidden||mutation)return;if(inflight)return inflight;
    inflight=(async()=>{try{const data=await request('/tree');snapshot=data;if(lastRoot!==data.root){expanded=new Set();selected='';try{expanded=new Set(JSON.parse(localStorage.getItem('latex-file-tree-expanded:'+data.root)||'[]'));}catch{}const parts=context().active_path.slice(data.root.length+1).split('/');parts.pop();for(let n=1;n<=parts.length;n++)expanded.add(parts.slice(0,n).join('/'));trash=null;document.querySelector('#tree-restore').hidden=true;lastRoot=data.root;}trash=data.trash?.[0]?.token||null;const restore=document.querySelector('#tree-restore');restore.hidden=!trash;restore.title=trash?'恢复 '+data.trash[0].path:'';const signature=data.signature+context().active_path;if(signature!==lastSignature){lastSignature=signature;render();}}catch(e){notice(e.message);}finally{inflight=null;}})();return inflight;
  }
  async function mutate(data){
    if(mutation)return;mutation=true;let acquired=false;notice();
    try{await prepare();lock(true);acquired=true;const latest=await request('/tree');const result=await request('/tree',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,...context(),signature:latest.signature})});snapshot=result.tree;lastSignature='';if(result.token){trash=result.token;document.querySelector('#tree-restore').hidden=false;}if(result.restored){trash=null;document.querySelector('#tree-restore').hidden=true;}lock(false);acquired=false;await changed(result);if(result.created){selected=result.created;const parent=result.created.split('/').slice(0,-1).join('/');if(parent)expanded.add(parent);if(data.action==='folder')expanded.add(result.created);else if(data.action==='file')await open(snapshot.root+'/'+result.created);}if(result.from&&selected.startsWith(result.from))selected=result.to+selected.slice(result.from.length);if(result.deleted)selected='';notice(result.deleted?'已移到本地回收区，可恢复。':'');}
    catch(e){notice(e.message);}
    finally{if(acquired)lock(false);mutation=false;await refresh();}
  }
  function parentSelection(){const entry=snapshot?.entries.find(e=>e.path===selected);return entry?.directory?selected:selected.split('/').slice(0,-1).join('/');}
  document.querySelector('#tree-new-file').onclick=()=>popup('file',parentSelection());document.querySelector('#tree-new-folder').onclick=()=>popup('folder',parentSelection());document.querySelector('#tree-restore').onclick=()=>{if(trash)mutate({action:'restore',token:trash});};
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
