export function mountRuntimeReload({request,capture,blocked,save,lock,restore,ready}) {
  const button=document.createElement('button');button.id='runtime-update';button.hidden=true;
  button.textContent='更新编辑器';document.querySelector('#app-toolbar').append(button);
  const key='latex-runtime-resume:'+location.origin;
  let checking=false,reloading=false,seen='',stable=0,lastInput=Date.now(),restoring=false;
  window.addEventListener('keydown',()=>{lastInput=Date.now();});
  window.addEventListener('input',()=>{lastInput=Date.now();});
  function stash(value){sessionStorage.setItem(key,JSON.stringify(value));}
  async function apply(data){
    if(reloading||blocked())return;
    reloading=true;let acquired=false;
    try{
      await save();if(blocked())return;
      const position=capture();stash(position);lock(true);acquired=true;
      button.textContent='正在更新…';
      await request('/runtime/reload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:data.current,path:position.path,version:position.version})});
      // Wait for the replacement service on the same address. Leave the saved
      // page visible if startup fails; the resume checkpoint survives refresh.
      for(let attempt=0;attempt<40;attempt++){
        await new Promise(resolve=>setTimeout(resolve,500));
        try{const next=await request('/runtime');if(next.started===data.current){location.reload();return;}}catch{}
      }
      throw new Error('服务未能重启，请重试；草稿已保存。');
    }catch(error){button.textContent='更新失败，点击重试';button.title=error.message;}
    finally{if(acquired)lock(false);reloading=false;}
  }
  async function check(){
    if(checking||reloading||!ready())return;checking=true;
    try{
      if(!restoring){restoring=true;const raw=sessionStorage.getItem(key);if(raw){const value=JSON.parse(raw);if(await restore(value))sessionStorage.removeItem(key);}}
      const data=await request('/runtime');button.hidden=data.current===data.started;
      if(button.hidden){seen='';stable=0;return;}
      button.textContent='更新编辑器';button.title='检测到插件更新；编辑完成后自动加载，也可点击更新。';button.onclick=()=>apply(data);
      stable=data.current===seen?stable+1:0;seen=data.current;
      if(stable>=2&&Date.now()-lastInput>2500&&!blocked())await apply(data);
    }catch{}finally{checking=false;}
  }
  setInterval(check,2000);void check();
  return {check};
}
