
/* GitHub Pages -> Google Apps Script, preserving the original google.script.run API */
(()=>{
'use strict';
const API='https://script.google.com/macros/s/AKfycbwc1xEltV1MS9TEy9P5CWzSAgBu3x908XDBGHA9jUzA_Uvm_id9M_VU3aLrC5rR7kuYEw/exec';
const API_ENABLED=false; // Switch after backend deployment verified
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
const snapshot=async()=>{
 const r=await fetch('./snapshot.json',{cache:'no-cache'});
 if(!r.ok)throw Error('GitHub-Vorschau derzeit nicht erreichbar');
 const data=await r.json();
 data.loadedAt=data.snapshotAt||data.loadedAt;
 data.snapshotMode=true;
 return data;
};
const readonly=()=>Promise.reject(Error('GitHub-Vorschau: Bearbeiten vorerst über die bisherige Web-App.'));
const pictures={
 banner:'1u0-G-FsdLWK5OGa1HYkKcU8ksRllaHmf',
 logo:'1eZKis5E2I_Vuor2SEXBtYcEwOqNKgrS4',
 alt:'1E0eS0L3oBb3ug0sWTtdMqJI6KIuGnKnx',
 icon1:'1OQD-XxySeZpHuIVTM2M9M6aM5RiwRUkF',
 icon2:'1N4mg49YwdWggHLB-c3i60Vi3U6IH9AYo'
};
const functions={
 getHubData:()=>API_ENABLED?read('getHubData').catch(snapshot):snapshot(),
 getHubImage:key=>API_ENABLED?read('getHubImage',key):Promise.resolve({
  key,dataUrl:'https://drive.google.com/thumbnail?id='+encodeURIComponent(pictures[key]||'')+'&sz=w'+(key==='banner'?1800:400)
 }),
 saveHubStatic:(...args)=>API_ENABLED?write('saveHubStatic',args):readonly(),
 saveHubAbsence:(...args)=>API_ENABLED?write('saveHubAbsence',args):readonly(),
 deleteHubAbsence:(...args)=>API_ENABLED?write('deleteHubAbsence',args):readonly(),
 registerHubVisit:(...args)=>API_ENABLED?write('registerHubVisit',args):Promise.reject(Error('Besucherstatistik in der Vorschau deaktiviert'))
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