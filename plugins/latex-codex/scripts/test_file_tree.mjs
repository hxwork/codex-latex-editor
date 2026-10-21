import assert from 'node:assert/strict';
import {mountProjectTree} from './vendor/latex-file-tree.mjs';
class Element{
 constructor(){this.hidden=false;this.children=[];this.dataset={};this.style={};this.attributes={};this.classList={add(){},remove(){},toggle(){}};}
 append(...x){this.children.push(...x)}replaceChildren(...x){this.children=x}setAttribute(k,v){this.attributes[k]=v}focus(){}select(){}showModal(){}close(){}contains(x){return this.children.includes(x)}querySelector(){return this.children[0]??(this.children[0]=new Element())}
}
const elements=new Map(),body=new Element();globalThis.document={body,querySelector(id){if(!elements.has(id))elements.set(id,new Element());return elements.get(id)},createElement(){return new Element()},addEventListener(){}};
globalThis.window={innerWidth:1000,innerHeight:700};const stored=new Map();globalThis.localStorage={getItem(k){return stored.get(k)??null},setItem(k,v){stored.set(k,v)}};const interval=globalThis.setInterval;globalThis.setInterval=()=>{};
const active={root:'/project',active_path:'/project/main.tex',version:'1'},data={root:'/project',signature:'one',trash:[],entries:[{path:'assets',name:'assets',directory:true},{path:'main.tex',name:'main.tex',editable:true}]};let calls=[],prepared=0,locks=[],fail=false,opened=[];
const tree=mountProjectTree({context:()=>active,request:async(route,options)=>{if(!options)return data;const body=JSON.parse(options.body);calls.push(body);return {state:{},tree:data,...(['file','folder'].includes(body.action)?{created:body.path}:{})}},prepare:async()=>{prepared++;if(fail)throw Error('busy')},lock:v=>locks.push(v),open:async path=>{opened.push(path);return true},changed:async()=>{},resize(){}});
elements.get('#file-tree-panel').hidden=true;elements.get('#file-tree-toggle').onclick();await tree.refresh();
const root=elements.get('#tree-root'),folder=root.children.find(e=>e.dataset.path==='assets'),file=root.children.find(e=>e.dataset.path==='main.tex');let payload='';file.ondragstart({dataTransfer:{setData(type,value){assert.equal(type,'application/x-latex-project-path');payload=value}}});let prevented=false;
folder.ondragover({dataTransfer:{types:['application/x-latex-project-path']},preventDefault(){prevented=true},stopPropagation(){}});assert(prevented);
const drop=value=>({dataTransfer:{getData:()=>value},preventDefault(){},stopPropagation(){}});
await folder.ondrop(drop(payload));assert.equal(calls.length,1);assert.equal(calls[0].target,'assets/main.tex');assert.equal(calls[0].signature,'one');assert.equal(prepared,1);assert.deepEqual(locks,[true,false]);
await folder.ondrop(drop(JSON.stringify({root:'/other',path:'file.tex'})));assert.equal(calls.length,1);
fail=true;locks=[];await folder.ondrop(drop(payload));assert.equal(calls.length,1);assert.deepEqual(locks,[]);
const menu=body.children.find(e=>e.className==='file-tree-menu');folder.oncontextmenu({preventDefault(){},stopPropagation(){},clientX:10,clientY:20});assert.equal(menu.children.length,4);
// Header creation uses the selected directory and file's parent respectively.
const dialog=body.children.find(e=>e.className==='file-tree-dialog'),form=dialog.children[2],input=form.children[0];
elements.get('#tree-new-file').onclick();assert.equal(input.value,'assets/');assert.equal(input.attributes['aria-label'],'新文件路径');
elements.get('#tree-new-folder').onclick();assert.equal(input.value,'assets/');assert.equal(input.attributes['aria-label'],'新文件夹路径');
fail=false;calls=[];input.value='assets/new-folder';await form.onsubmit({preventDefault(){}});assert.equal(calls[0].action,'folder');assert.equal(calls[0].path,'assets/new-folder');
elements.get('#tree-new-file').onclick();input.value='assets/new.tex';await form.onsubmit({preventDefault(){}});assert.equal(opened.at(-1),'/project/assets/new.tex','Created files open immediately');
const header=elements.get('#tree-heading-toggle');header.onclick();assert.equal(root.hidden,true);header.onclick();assert.equal(root.hidden,false);
const handle=elements.get('#file-tree-resizer'),panel=elements.get('#file-tree-panel');
let resized=0;handle.onpointerdown({button:0,pointerId:7,clientX:240,preventDefault(){}});handle.onpointermove({pointerId:7,clientX:340,preventDefault(){}});assert.equal(panel.style.width,'340px');handle.onpointerup({pointerId:7});assert.equal(stored.get('latex-file-tree-width'),'340');
handle.onkeydown({key:'ArrowRight',preventDefault(){}});assert.equal(panel.style.width,'356px');handle.onkeydown({key:'End',preventDefault(){}});assert.equal(panel.style.width,'450px','Width leaves room for the editor');handle.ondblclick();assert.equal(panel.style.width,'240px');
assert.equal(file.children[0].className,'tree-icon');assert.equal(file.children[1].textContent,'main.tex');assert.equal(file.children[2].attributes['aria-label'],'更多操作：main.tex');
elements.get('#file-tree-toggle').onclick();assert(elements.get('#file-tree-panel').hidden);globalThis.setInterval=interval;
console.log('PASS: icons, folder-based creation, tree collapse, pointer/keyboard resizing and persistence, drag/drop, menus and busy guard');
