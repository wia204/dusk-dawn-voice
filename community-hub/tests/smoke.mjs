import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const html=read('index.html');
const backend=read('backend/Code.gs');
const bridge=read('bridge.js');
const snapshot=JSON.parse(read('snapshot.json'));
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert(script,'Frontend JS missing');
new Function(script);
new Function(bridge);
new Function(backend);
assert(html.includes('src="./bridge.js"'));
assert(html.includes('raidShortLabel(current)'));
assert(html.includes('snapshotMode'));
assert(bridge.includes('const API_ENABLED=false'),'Preview must remain read-only until tested');
for(const name of ['getHubData','saveHubStatic','saveHubAbsence','deleteHubAbsence','runMemberProfileSyncBatch']){
 assert(backend.includes('function '+name+'('),name+' function missing');
}
assert(backend.includes('function doPost(e)'));
assert(backend.includes("p.fn==='getHubData'"));
assert(backend.includes("p.fn==='saveHubStatic'"));
assert(snapshot.members.length===snapshot.counts.total);
assert(snapshot.members.some(x=>x.name==='Warlokkz'));
assert(snapshot.members.some(x=>x.name==='Warlòkkz'));
console.log('OK – frontend, bridge, backend and snapshot checked; members:',snapshot.members.length);
