const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Pass=Symbol('Pass');let initialize;
const CM={Pass,Init:Symbol(),Pos:function(line,ch){return {line,ch}},defineOption:(name,value,fn)=>{initialize=fn},cmpPos:(a,b)=>a.line-b.line||a.ch-b.ch,isWordChar:c=>/\w/.test(c)};
vm.runInNewContext(fs.readFileSync(__dirname+'/vendor/closebrackets.js','utf8'),{CodeMirror:CM});
function editor(text='',from=text.length,to=from,options={}){
  const cm={text,head:{line:0,ch:to},anchor:{line:0,ch:from},state:{},options,
    getOption:n=>cm.options[n],getModeAt:()=>({closeBrackets:'()'}),
    getCursor:()=>cm.head,getRange:(a,b)=>cm.text.slice(Math.max(0,a.ch),b.ch),
    listSelections:()=>[{head:cm.head,anchor:cm.anchor,empty:()=>cm.head.ch===cm.anchor.ch}],
    getSelections:()=>[cm.text.slice(Math.min(cm.head.ch,cm.anchor.ch),Math.max(cm.head.ch,cm.anchor.ch))],
    setSelections:r=>{cm.head=r[0].head;cm.anchor=r[0].anchor},
    replaceSelection:(s)=>cm.replaceSelections([s]),
    replaceSelections:(s,hint)=>{const from=Math.min(cm.head.ch,cm.anchor.ch),to=Math.max(cm.head.ch,cm.anchor.ch);cm.text=cm.text.slice(0,from)+s[0]+cm.text.slice(to);cm.head={line:0,ch:from+s[0].length};cm.anchor=hint==='around'?{line:0,ch:from}:cm.head},
    replaceRange:(s,a,b)=>{cm.text=cm.text.slice(0,a.ch)+s+cm.text.slice(b.ch);cm.anchor=cm.head={line:0,ch:a.ch+s.length}},
    operation:f=>f(),triggerElectric:()=>{},getTokenAt:()=>({type:null}),getTokenTypeAt:()=>null,
    addKeyMap:m=>{cm.map=m},removeKeyMap:()=>{}
  };
  initialize(cm,{pairs:'()[]{}$$',override:true,explode:''},CM.Init);return cm;
}
for(const [left,right] of [['{','}'],['[',']'],['(',')'],['$','$']]){
  let cm=editor();cm.map["'"+left+"'"](cm);assert.equal(cm.text,left+right);assert.equal(cm.head.ch,1);
  cm.map["'"+right+"'"](cm);assert.equal(cm.text,left+right);assert.equal(cm.head.ch,2);
  cm=editor(left+right,1);cm.map.Backspace(cm);assert.equal(cm.text,'');
  cm=editor('hello',0,5);cm.map["'"+left+"'"](cm);assert.equal(cm.text,left+'hello'+right);assert.equal(cm.anchor.ch,1);assert.equal(cm.head.ch,6);
  cm=editor('\\');assert.equal(cm.map["'"+left+"'"](cm),Pass);assert.equal(cm.text,'\\');
}
for(const options of [{readOnly:true},{readOnly:'nocursor'},{disableInput:true}]){
 const cm=editor('',0,0,options);assert.equal(cm.map["'{'"](cm),Pass);assert.equal(cm.text,'');
}
let cm=editor('text');cm.map["'$'"](cm);assert.equal(cm.text,'text$$');assert.equal(cm.head.ch,5);
cm=editor('\\\\');cm.map["'{'"](cm);assert.equal(cm.text,'\\\\{}');
cm=editor('{}',1);cm.map["'{'"](cm);assert.equal(cm.text,'{{}}');assert.equal(cm.head.ch,2);
const page=fs.readFileSync(__dirname+'/editor.py','utf8');
assert(page.includes('src="/vendor/closebrackets.js"'));
assert(page.includes("autoCloseBrackets:{pairs:'()[]{}$$',override:true,explode:''}"));
console.log('PASS: actual addon pairs/cursor, closer skipping, selection wrapping, pair deletion, escapes, nesting, dollars beside prose, readonly/Vim-normal input guards and page wiring');
