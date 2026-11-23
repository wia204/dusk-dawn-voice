
/* GitHub Pages -> Google Apps Script, preserving the original google.script.run API */
(()=>{
'use strict';
const API='https://script.google.com/macros/s/AKfycbwc1xEltV1MS9TEy9P5CWzSAgBu3x908XDBGHA9jUzA_Uvm_id9M_VU3aLrC5rR7kuYEw/exec';
let count=0;const id=p=>p+Date.now()+'_'+(++count);
function read(fn,arg){return new Promise((resolve,reject)=>{
 const name=id('ddhub_cb_'),script=document.createElement('script');let finished=false;
 const finish=(err,data)=>{if(finished)return;finished=true;clearTimeout(timer);delete window[name];script.remove();err?reject(err):resolve(data)};
 window[name]=x=>x&&x.ok?finish(null,x.result):finish(Error(x&&x.error||'Backend-Fehler'));
 const timer=setTimeout(()=>finish(Error('GitHub-API noch nicht in Apps Script bereitgestellt')),18000);
 script.onerror=()=>finish(Error('Backend nicht erreichbar'));
 script.src=API+'?api=v1&fn='+encodeURIComponent(fn)+'&callback='+name+(arg==null?'':'&arg='+encodeURIComponent(arg))+'&t='+Date.now();
 document.head.appendChild(script);
});}
function write(fn,args){return new Promise((resolve,reject)=>{
 const requestId=id('ddhub_write_'),frame=document.createElement('iframe'),form=document.createElement('form');
 frame.name=requestId;frame.style.display='none';frame.setAttribute('aria-hidden','true');
 form.action=API;form.method='POST';form.target=requestId;form.style.display='none';
 const add=(name,value)=>{const input=document.createElement('input');input.name=name;input.type='hidden';input.value=value;form.appendChild(input);};
 add('fn',fn);add('requestId',requestId);add('args',JSON.stringify(args));
 let finished=false;
 const finish=(err,data)=>{if(finished)return;finished=true;clearTimeout(timer);removeEventListener('message',onMessage);form.remove();frame.remove();err?reject(err):resolve(data);};
 const onMessage=e=>{
  if(e.source!==frame.contentWindow||!e.origin.endsWith('.googleusercontent.com'))return;
  const p=e.data;
  if(!p||p.type!=='DD_HUB_API'||p.id!==requestId)return;
  p.ok?finish(null,p.result):finish(Error(p.error||'Backend-Fehler'));
 };
 addEventListener('message',onMessage);
 const timer=setTimeout(()=>finish(Error('Keine Bestätigung vom Backend – bitte die bisherige Web-App verwenden')),25000);
 document.body.appendChild(frame);document.body.appendChild(form);form.submit();
});}
const functions={
 getHubData:()=>read('getHubData').catch(async e=>{
  const r=await fetch('./snapshot.json',{cache:'no-cache'});if(!r.ok)throw e;
  const d=await r.json();d.loadedAt=d.snapshotAt||d.loadedAt;d.snapshotMode=true;return d;
 }),
 getHubImage:key=>read('getHubImage',key),
 saveHubStatic:(...args)=>write('saveHubStatic',args),
 saveHubAbsence:(...args)=>write('saveHubAbsence',args),
 deleteHubAbsence:(...args)=>write('deleteHubAbsence',args),
 registerHubVisit:()=>Promise.resolve({total:0,unique:0})
};
function run(onSuccess,onFailure){
 return new Proxy({}, {get(_,key){
  if(key==='withSuccessHandler')return fn=>run(fn,onFailure);
  if(key==='withFailureHandler')return fn=>run(onSuccess,fn);
  if(Object.prototype.hasOwnProperty.call(functions,key))
   return (...args)=>functions[key](...args).then(d=>onSuccess&&onSuccess(d)).catch(e=>onFailure&&onFailure(e));
  return ()=>onFailure&&onFailure(Error('Unbekannte Funktion: '+String(key)));
 }});
}
window.google={script:{run:run(null,null)}};
})();