import assert from 'node:assert/strict';
import {mountProjectTree} from './vendor/latex-file-tree.mjs';
class Element{
 constructor(){this.hidden=false;this.children=[];this.dataset={};this.style={};this.classList={add(){},remove(){},toggle(){}};}
 append(...x){this.children.push(...x)}replaceChildren(...x){this.children=x}setAttribute(){}focus(){}select(){}showModal(){}close(){}contains(x){return this.children.includes(x)}querySelector(){return this.children[0]}
}
const elements=new Map(),body=new Element();globalThis.document={body,querySelector(id){if(!elements.has(id))elements.set(id,new Element());return elements.get(id)},createElement(){return new Element()},addEventListener(){}};
globalThis.window={innerWidth:1000,innerHeight:700};globalThis.localStorage={getItem(){return null},setItem(){}};const interval=globalThis.setInterval;globalThis.setInterval=()=>{};
const active={root:'/project',active_path:'/project/main.tex',version:'1'},data={root:'/project',signature:'one',trash:[],entries:[{path:'assets',name:'assets',directory:true},{path:'main.tex',name:'main.tex',editable:true}]};let calls=[],prepared=0,locks=[],fail=false;
const tree=mountProjectTree({context:()=>active,request:async(route,options)=>{if(!options)return data;calls.push(JSON.parse(options.body));return {state:{},tree:data}},prepare:async()=>{prepared++;if(fail)throw Error('busy')},lock:v=>locks.push(v),open:async()=>true,changed:async()=>{},resize(){}});
elements.get('#file-tree-panel').hidden=true;elements.get('#file-tree-toggle').onclick();await tree.refresh();
const root=elements.get('#tree-root'),folder=root.children.find(e=>e.dataset.path==='assets'),file=root.children.find(e=>e.dataset.path==='main.tex');let payload='';file.ondragstart({dataTransfer:{setData(type,value){assert.equal(type,'application/x-latex-project-path');payload=value}}});let prevented=false;
folder.ondragover({dataTransfer:{types:['application/x-latex-project-path']},preventDefault(){prevented=true},stopPropagation(){}});assert(prevented);
const drop=value=>({dataTransfer:{getData:()=>value},preventDefault(){},stopPropagation(){}});
await folder.ondrop(drop(payload));assert.equal(calls.length,1);assert.equal(calls[0].target,'assets/main.tex');assert.equal(calls[0].signature,'one');assert.equal(prepared,1);assert.deepEqual(locks,[true,false]);
await folder.ondrop(drop(JSON.stringify({root:'/other',path:'file.tex'})));assert.equal(calls.length,1);
fail=true;locks=[];await folder.ondrop(drop(payload));assert.equal(calls.length,1);assert.deepEqual(locks,[]);
const menu=body.children.find(e=>e.className==='file-tree-menu');folder.oncontextmenu({preventDefault(){},clientX:10,clientY:20});assert.equal(menu.children.length,4);elements.get('#file-tree-toggle').onclick();assert(elements.get('#file-tree-panel').hidden);globalThis.setInterval=interval;
console.log('PASS: collapse, drag/drop routing, project-bound payload, versioned mutation, menus and busy guard');
