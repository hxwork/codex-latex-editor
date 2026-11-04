import {t} from './latex-settings.mjs';
export function mountProjectTree({request,context,prepare,lock,open,changed,resize}){
  const panel=document.querySelector('#file-tree-panel'),toggle=document.querySelector('#file-tree-toggle'),root=document.querySelector('#tree-root'),error=document.querySelector('#tree-error');
  // Material Symbols Rounded (Apache-2.0), wght 400 / opsz 20, as used by Overleaf's file tree.
  const symbols={"description":"M371.96-240h215.76q15.28 0 25.78-10.29 10.5-10.29 10.5-25.5t-10.34-25.71Q603.32-312 588.04-312H372.28q-15.28 0-25.78 10.29-10.5 10.29-10.5 25.5t10.34 25.71q10.34 10.5 25.62 10.5Zm0-144h215.76q15.28 0 25.78-10.29 10.5-10.29 10.5-25.5t-10.34-25.71Q603.32-456 588.04-456H372.28q-15.28 0-25.78 10.29-10.5 10.29-10.5 25.5t10.34 25.71q10.34 10.5 25.62 10.5ZM263.72-96Q234-96 213-117.15T192-168v-624q0-29.7 21.15-50.85Q234.3-864 264-864h282q14.22 0 27.11 5Q586-854 597-843l150 150q11 11 16 23.89t5 27.11v474q0 29.7-21.16 50.85Q725.68-96 695.96-96H263.72ZM528-660v-132H264v624h432v-456H564q-15.3 0-25.65-10.35Q528-644.7 528-660ZM264-792v168-168 624-624Z","image":"M216-144q-29.7 0-50.85-21.5Q144-187 144-216v-528q0-29 21.15-50.5T216-816h528q29.7 0 50.85 21.5Q816-773 816-744v528q0 29-21.15 50.5T744-144H216Zm0-72h528v-528H216v528Zm0 0v-528 528Zm84-72h360.19Q671-288 676-298t-2-19L566-461q-5.25-8-14-8t-14 8l-94 125-58-77q-5.25-8-14-8t-14 8l-71.82 96.03Q279-308 284.25-298q5.25 10 15.75 10Z","book_5":"M288-96q-40 0-68-27.5T192-190v-553q0-34 22-59.5t56-32.5l267-56q34-7 60.5 14.5T624-820v479q0 26-16 45.5t-41.06 24.21l-281.89 59.4Q277-210 270.5-203.75 264-197.5 264-190q0 10 7.2 16t16.8 6h408v-588q0-15.3 10.29-25.65Q716.58-792 731.79-792t25.71 10.35Q768-771.3 768-756v588q0 29.7-21.15 50.85Q725.7-96 696-96H288Zm96-211 168-36v-477l-168 35v478Zm-72 15v-477l-30 6q-8 2-13 7.19T264-743v463q5-2 10.5-3t10.5-3l27-6Zm-48-471v483-483Z","table_chart":"M744-144H216q-29 0-50.5-21.5T144-216v-528q0-29.7 21.5-50.85Q187-816 216-816h528q29 0 50.5 21.15T816-744v528q0 29-21.5 50.5T744-144ZM216-636h528v-108H216v108Zm96 72h-96v348h96v-348Zm336 0v348h96v-348h-96Zm-72 0H384v348h192v-348Z","code":"m198-480 164 164q11 11 11 25.5T362-265q-11 11-25.5 11T311-265L121-455q-5-5-7.5-11.5T111-480q0-7 2.5-13.5T121-505l190-190q11-11 25.5-11t25.5 11q11 11 11 25.5T362-644L198-480Zm564 0L598-644q-11-11-11-25.5t11-25.5q11-11 25.5-11t25.5 11l190 190q5 5 7.5 11.5T849-480q0 7-2.5 13.5T839-455L649-265q-11 11-25 10.5T599-266q-11-11-11-25.5t11-25.5l163-163Z","note_add":"M444.25-348.25v72.17q0 15.33 10.38 25.71Q465-240 480.23-240q15.24 0 25.54-10.35 10.31-10.35 10.31-25.65v-72h71.69q15.23 0 25.73-10.29t10.5-25.5q0-15.21-10.37-25.58-10.38-10.38-25.71-10.38h-72.17v-72.17q0-15.33-10.38-25.71Q495-528 479.77-528q-15.24 0-25.54 10.35-10.31 10.35-10.31 25.65v72h-71.69q-15.23 0-25.73 10.29t-10.5 25.5q0 15.21 10.37 25.58 10.38 10.38 25.71 10.38h72.17ZM263.72-96Q234-96 213-117.15T192-168v-624q0-29.7 21.15-50.85Q234.3-864 264-864h282q14.22 0 27.11 5Q586-854 597-843l150 150q11 11 16 23.89t5 27.11v474q0 29.7-21.16 50.85Q725.68-96 695.96-96H263.72ZM528-660v-132H264v624h432v-456H564q-15.3 0-25.65-10.35Q528-644.7 528-660ZM264-792v168-168 624-624Z","create_new_folder":"M168-192q-29 0-50.5-21.5T96-264v-432q0-29.7 21.5-50.85Q139-768 168-768h185.64q14.35 0 27.36 5 13 5 24 16l75 75h312q29.7 0 50.85 21.15Q864-629.7 864-600v336q0 29-21.15 50.5T792-192H168Zm0-72h624v-336H450l-96-96H168v432Zm0 0v-432 432Zm408-132v35.79q0 15.21 10.29 25.71t25.5 10.5q15.21 0 25.59-10.38 10.39-10.39 10.39-25.74v-36.11h36.11q15.35 0 25.74-10.39Q720-417 720-432.21q0-15.21-10.35-25.5T684-468h-36v-35.79q0-15.21-10.29-25.71t-25.5-10.5q-15.21 0-25.59 10.38-10.39 10.39-10.39 25.74v36.11h-36.11q-15.35 0-25.74 10.39Q504-447 504-431.79q0 15.21 10.35 25.5T540-396h36Z","chevron_right":"M522-480 358-644q-11-11-11-25.5t11-25.5q11-11 25.5-11t25.5 11l190 190q5 5 7.5 11.5T609-480q0 7-2.5 13.5T599-455L409-265q-11 11-25 10.5T359-266q-11-11-11-25.5t11-25.5l163-163Z","expand_more":"M466.5-350.5Q460-353 455-358L265-548q-11-11-10.5-25.5T266-599q11-11 25.5-11t25.5 11l163 164 164-164q11-11 25.5-10.5T695-598q11 11 11 25.5T695-547L505-358q-5 5-11.5 7.5T480-348q-7 0-13.5-2.5Z","keyboard_arrow_right":"M522-480 358-644q-11-11-11-25.5t11-25.5q11-11 25.5-11t25.5 11l190 190q5 5 7.5 11.5T609-480q0 7-2.5 13.5T599-455L409-265q-11 11-25 10.5T359-266q-11-11-11-25.5t11-25.5l163-163Z","keyboard_arrow_down":"M466.5-350.5Q460-353 455-358L265-548q-11-11-10.5-25.5T266-599q11-11 25.5-11t25.5 11l163 164 164-164q11-11 25.5-10.5T695-598q11 11 11 25.5T695-547L505-358q-5 5-11.5 7.5T480-348q-7 0-13.5-2.5Z","more_vert":"M479.79-192Q450-192 429-213.21t-21-51Q408-294 429.21-315t51-21Q510-336 531-314.79t21 51Q552-234 530.79-213t-51 21Zm0-216Q450-408 429-429.21t-21-51Q408-510 429.21-531t51-21Q510-552 531-530.79t21 51Q552-450 530.79-429t-51 21Zm0-216Q450-624 429-645.21t-21-51Q408-726 429.21-747t51-21Q510-768 531-746.79t21 51Q552-666 530.79-645t-51 21Z"};
  const msym=name=>{const node=document.createElement('span');node.className='tree-icon';node.setAttribute('aria-hidden','true');node.innerHTML='<svg viewBox="0 -960 960 960" fill="currentColor"><path d="'+symbols[name]+'"/></svg>';return node;};
  const fileSymbol=name=>{const ext=name.split('.').pop().toLowerCase();return ['png','pdf','jpg','jpeg','gif'].includes(ext)?'image':['csv','xls','xlsx'].includes(ext)?'table_chart':['py','r'].includes(ext)?'code':ext==='bib'?'book_5':'description';};
  const resizer=document.querySelector('#file-tree-resizer'),heading=document.querySelector('#tree-heading-toggle');
  document.querySelector('#tree-new-file').append(msym('note_add'));document.querySelector('#tree-new-folder').append(msym('create_new_folder'));
  const headingIcon=()=>heading.querySelector('.tree-heading-chevron').replaceChildren(msym(root.hidden?'keyboard_arrow_right':'keyboard_arrow_down'));headingIcon();
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
  heading.onclick=()=>{root.hidden=!root.hidden;heading.setAttribute('aria-expanded',String(!root.hidden));heading.setAttribute('aria-label',root.hidden?t('展开文件树内容'):t('折叠文件树内容'));headingIcon();};
  let snapshot=null,inflight=null,lastRoot='',lastSignature='',trash=null,mutation=false,selected='',expanded=new Set();
  const menu=document.createElement('div');menu.className='file-tree-menu';menu.setAttribute('role','menu');menu.hidden=true;document.body.append(menu);
  const dialog=document.createElement('dialog');dialog.className='file-tree-dialog';
  const title=document.createElement('h3'),description=document.createElement('p'),input=document.createElement('input'),form=document.createElement('form'),buttons=document.createElement('div'),cancel=document.createElement('button'),submit=document.createElement('button');
  input.required=true;input.setAttribute('aria-label',t('文件或文件夹路径'));cancel.type='button';cancel.textContent=t('取消');submit.type='submit';submit.textContent=t('确定');buttons.className='history-dialog-actions';buttons.append(cancel,submit);form.append(input,buttons);dialog.append(title,description,form);document.body.append(dialog);cancel.onclick=()=>dialog.close();
  function notice(message=''){error.textContent=message;}
  function closeMenu(){menu.hidden=true;}
  function setVisible(value){panel.hidden=!value;resizer.hidden=!value;toggle.setAttribute('aria-expanded',String(value));toggle.setAttribute('aria-label',value?t('折叠项目文件树'):t('展开项目文件树'));try{localStorage.setItem('latex-file-tree',value?'open':'closed');}catch{}resize();if(value)refresh();}
  toggle.onclick=()=>setVisible(panel.hidden);
  try{if(localStorage.getItem('latex-file-tree')==='open'){panel.hidden=false;toggle.setAttribute('aria-expanded','true');toggle.setAttribute('aria-label',t('折叠项目文件树'));}}catch{}
  resizer.hidden=panel.hidden;
  window.addEventListener?.('latex-language-change',()=>{toggle.setAttribute('aria-label',t(panel.hidden?'展开项目文件树':'折叠项目文件树'));heading.setAttribute('aria-label',t(root.hidden?'展开文件树内容':'折叠文件树内容'));lastSignature='';if(!panel.hidden)refresh();});
  function popup(action,path='',directory=false){
    if(mutation)return;
    closeMenu();title.textContent=({file:t('新建文件'),folder:t('新建文件夹'),move:t('重命名 / 移动'),delete:t('删除到本地回收区')})[action];
    description.textContent=action==='delete'?t('删除 {path}？本地副本将保留在回收区，可点击“恢复删除”。',{path}):action==='move'?t('输入相对于项目根目录的新路径。TeX 中的引用路径需要自行更新。'):action==='folder'?t('输入新文件夹名称。'):t('在 {path} 中新建文件，例如 section.tex 或 references.bib。',{path:path||t('项目根目录')});
    input.setAttribute('aria-label',action==='folder'?t('新文件夹路径'):action==='file'?t('新文件路径'):t('文件或文件夹路径'));
    input.hidden=action==='delete';input.required=action!=='delete';input.value=action==='move'?path:path?(path+'/'):'';submit.textContent=action==='delete'?t('移到回收区'):t('确定');
    form.onsubmit=async e=>{e.preventDefault();const value=input.value.trim();dialog.close();await mutate({action,path:action==='file'||action==='folder'?value:path,...(action==='move'?{target:value}:{})});};
    dialog.showModal();if(!input.hidden){input.focus();if(action==='move')input.select();}
  }
  function showMenu(entry,x,y){
    selected=entry.path;render();menu.replaceChildren();
    const item=(label,fn)=>{const b=document.createElement('button');b.type='button';b.setAttribute('role','menuitem');b.textContent=label;b.onclick=()=>{closeMenu();fn();};menu.append(b);};
    if(entry.path)item(t('重命名 / 移动'),()=>popup('move',entry.path,entry.directory));
    if(entry.path)item(t('移到回收区'),()=>popup('delete',entry.path,entry.directory));
    const parent=entry.directory?entry.path:entry.path.split('/').slice(0,-1).join('/');
    item(t('新建文件'),()=>popup('file',parent));item(t('新建文件夹'),()=>popup('folder',parent));if(!entry.path)item(t('刷新文件树'),()=>{lastSignature='';refresh();});
    menu.hidden=false;menu.style.left=Math.min(x,window.innerWidth-190)+'px';menu.style.top=Math.min(y,window.innerHeight-190)+'px';menu.querySelector('button').focus();
  }
  document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target))closeMenu();});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
  function attachDrop(node,destination){
    node.ondragover=e=>{if(e.dataTransfer.types.includes('application/x-latex-project-path')){e.preventDefault();e.stopPropagation();node.classList.add('tree-drop');e.dataTransfer.dropEffect='move';}};
    node.ondragleave=()=>node.classList.remove('tree-drop');
    node.ondrop=async e=>{node.classList.remove('tree-drop');e.preventDefault();e.stopPropagation();try{const data=JSON.parse(e.dataTransfer.getData('application/x-latex-project-path'));if(data.root!==context().root)throw new Error(t('只能移动当前项目中的文件。'));const target=(destination?destination+'/':'')+data.path.split('/').pop();if(data.path!==target)await mutate({action:'move',path:data.path,target});}catch(err){notice(err.message);}};
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
      const icon=msym(entry.directory?(expanded.has(entry.path)?'expand_more':'chevron_right'):fileSymbol(entry.name));
      const label=document.createElement('span');label.className='tree-label';label.textContent=entry.name;
      if(entry.directory){
        icon.classList.add('tree-chevron');row.classList.add('tree-directory');
        row.append(icon,label);
      }else row.append(icon,label);
      const current=active===snapshot.root+'/'+entry.path;row.classList.toggle('tree-active',highlighted===entry.path);row.setAttribute('aria-selected',String(highlighted===entry.path));if(current)row.setAttribute('aria-current','page');
      row.onclick=async()=>{if(mutation)return;selected=entry.path;if(entry.directory){if(expanded.has(entry.path))expanded.delete(entry.path);else expanded.add(entry.path);try{localStorage.setItem('latex-file-tree-expanded:'+snapshot.root,JSON.stringify([...expanded]));}catch{}render();}else if(entry.editable){closeMenu();if(await open(snapshot.root+'/'+entry.path))render();}else{render();preview(entry);}};
      row.oncontextmenu=e=>{e.preventDefault();e.stopPropagation();showMenu(entry,e.clientX,e.clientY);};
      row.onkeydown=e=>{if(e.target!==row)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();row.onclick();}else if(e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10')){e.preventDefault();const r=row.getBoundingClientRect();showMenu(entry,r.left,r.bottom);}};
      row.ondragstart=e=>{closeMenu();e.dataTransfer.setData('application/x-latex-project-path',JSON.stringify({root:snapshot.root,path:entry.path}));e.dataTransfer.effectAllowed='move';};
      const more=document.createElement('button');more.type='button';more.className='tree-more';more.setAttribute('aria-label',t('更多操作：{name}',{name:entry.name}));more.title=t('更多操作');more.append(msym('more_vert'));more.onclick=e=>{e.stopPropagation();const r=more.getBoundingClientRect();showMenu(entry,r.left,r.bottom);};more.ondragstart=e=>{e.preventDefault();e.stopPropagation();};row.append(more);
      container.append(row);
      if(entry.directory){row.setAttribute('aria-expanded',String(expanded.has(entry.path)));attachDrop(row,entry.path);if(expanded.has(entry.path)){const group=document.createElement('div');group.className='tree-group';group.setAttribute('role','group');container.append(group);groups.set(entry.path,group);}}
    }
  }
  async function refresh(){
    if(panel.hidden||mutation)return;if(inflight)return inflight;
    inflight=(async()=>{try{const data=await request('/tree');snapshot=data;if(lastRoot!==data.root){expanded=new Set();selected='';try{expanded=new Set(JSON.parse(localStorage.getItem('latex-file-tree-expanded:'+data.root)||'[]'));}catch{}const parts=context().active_path.slice(data.root.length+1).split('/');parts.pop();for(let n=1;n<=parts.length;n++)expanded.add(parts.slice(0,n).join('/'));trash=null;document.querySelector('#tree-restore').hidden=true;lastRoot=data.root;}trash=data.trash?.[0]?.token||null;const restore=document.querySelector('#tree-restore');restore.hidden=!trash;restore.title=trash?t('恢复 {path}',{path:data.trash[0].path}):'';const signature=data.signature+context().active_path;if(signature!==lastSignature){lastSignature=signature;render();}}catch(e){notice(e.message);}finally{inflight=null;}})();return inflight;
  }
  async function mutate(data){
    if(mutation)return;mutation=true;let acquired=false;notice();
    try{await prepare();lock(true);acquired=true;const latest=await request('/tree');const result=await request('/tree',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,...context(),signature:latest.signature})});snapshot=result.tree;lastSignature='';if(result.token){trash=result.token;document.querySelector('#tree-restore').hidden=false;}if(result.restored){trash=null;document.querySelector('#tree-restore').hidden=true;}lock(false);acquired=false;await changed(result);if(result.created){selected=result.created;const parent=result.created.split('/').slice(0,-1).join('/');if(parent)expanded.add(parent);if(data.action==='folder')expanded.add(result.created);else if(data.action==='file')await open(snapshot.root+'/'+result.created);}if(result.from&&selected.startsWith(result.from))selected=result.to+selected.slice(result.from.length);if(result.deleted)selected='';notice(result.deleted?t('已移到本地回收区，可恢复。'):'');}
    catch(e){notice(e.message);}
    finally{if(acquired)lock(false);mutation=false;await refresh();}
  }
  function parentSelection(){const entry=snapshot?.entries.find(e=>e.path===selected);return entry?.directory?selected:selected.split('/').slice(0,-1).join('/');}
  document.querySelector('#tree-new-file').onclick=()=>popup('file',parentSelection());document.querySelector('#tree-new-folder').onclick=()=>popup('folder',parentSelection());document.querySelector('#tree-restore').onclick=()=>{if(trash)mutate({action:'restore',token:trash});};
  const asset=document.createElement('dialog');asset.className='file-tree-asset';document.body.append(asset);let assetGeneration=0,assetTask=null;asset.onclose=()=>{assetGeneration++;assetTask?.destroy();assetTask=null;};
  async function preview(entry){const token=++assetGeneration;assetTask?.destroy();assetTask=null;asset.replaceChildren();const header=document.createElement('h3'),close=document.createElement('button'),link=document.createElement('a');header.textContent=entry.path;close.textContent=t('关闭');close.onclick=()=>asset.close();const url='/tree/asset?path='+encodeURIComponent(entry.path);link.href=url;link.download=entry.name;link.textContent=t('下载文件');asset.append(header,close,link);if(/\.(png|jpe?g|gif|webp)$/i.test(entry.path)){const image=document.createElement('img');image.src=url;image.alt=entry.name;asset.append(image);}else if(/\.pdf$/i.test(entry.path)){
      const controls=document.createElement('div'),previous=document.createElement('button'),next=document.createElement('button'),count=document.createElement('span'),canvas=document.createElement('canvas');
      previous.textContent=t('上一页');next.textContent=t('下一页');previous.disabled=next.disabled=true;controls.append(previous,count,next);asset.append(controls,canvas);asset.showModal();
      try{const pdfjs=await import('/vendor/pdfjs/build/pdf.mjs');if(token!==assetGeneration)return;pdfjs.GlobalWorkerOptions.workerSrc='/vendor/pdfjs/build/pdf.worker.mjs';assetTask=pdfjs.getDocument(url);const pdf=await assetTask.promise;if(token!==assetGeneration)return;let page=1;
        async function render(){previous.disabled=next.disabled=true;const current=await pdf.getPage(page);if(token!==assetGeneration)return;const unit=current.getViewport({scale:1});const scale=Math.min(2,Math.max(200,asset.clientWidth-40)/unit.width);const viewport=current.getViewport({scale});canvas.width=viewport.width;canvas.height=viewport.height;await current.render({canvasContext:canvas.getContext('2d'),viewport}).promise;if(token!==assetGeneration)return;count.textContent=` ${page} / ${pdf.numPages} `;previous.disabled=page===1;next.disabled=page===pdf.numPages;}
        previous.onclick=()=>{if(page>1){page--;render().catch(e=>notice(e.message));}};next.onclick=()=>{if(page<pdf.numPages){page++;render().catch(e=>notice(e.message));}};await render();
      }catch(e){if(token===assetGeneration){count.textContent=t('预览失败，可下载文件查看。');}}
      return;
    }else{const p=document.createElement('p');p.textContent=t('此文件暂不支持编辑，可下载查看。');asset.append(p);}asset.showModal();}
  setInterval(refresh,4000);return {refresh};
}
