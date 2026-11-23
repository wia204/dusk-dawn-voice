
/**
 * DUSK & DAWN COMMUNITY HUB v3.3
 * Vollständige Ein-Datei-Web-App für Google Apps Script.
 *
 * FIX v3.3:
 * Warlokkz und Warlòkkz werden als zwei unterschiedliche
 * Charaktere behandelt.
 *
 * Wichtig:
 * - Spielersuche bleibt tolerant gegenüber Akzenten.
 * - Static- und Abwesenheitszuordnungen sind namensgenau.
 * - "Keine Static" entfernt echte vorhandene Zuordnungen.
 * - Bestehende Daten werden nicht automatisch gelöscht.
 *
 * Enthalten:
 * Mitglieder, Ranking, Statics, Abwesenheiten,
 * Aion Helper, Voice Changer, Dateien, Community-Links,
 * Bilder, Besucherstatistik und optionaler CP/GS-Abgleich.
 */

const HUB = Object.freeze({
  sheetId: '15sHqSBiYYSIrOvNoD4UGoEMyvhuTMjYFtA8FiFjRkuE',
  refreshMinutes: 15,
  absenceSheet: 'Abwesenheiten',
  staticSheet: 'Raid-Zuordnung',

  raids: [
    {id:'Raid1',label:'Ludra NM - Raid1'},
    {id:'Raid2',label:'Ludra NM - Raid2'},
    {id:'Raid3',label:'Ludra NM - Raid3'},
    {id:'Raid4',label:'Ludra NM - Raid4'},
    {id:'Raid5',label:'Ludra HM - Raid1'},
    {id:'Raid6',label:'Ludra HM - Raid2'}
  ],

  assets: {
    banner: {
      id:'1u0-G-FsdLWK5OGa1HYkKcU8ksRllaHmf',
      label:'Community-Banner',
      name:'Dusk & Dawn - Community Banner.png',
      original:true
    },
    logo: {
      id:'1eZKis5E2I_Vuor2SEXBtYcEwOqNKgrS4',
      label:'Community-Logo',
      name:'Dusk & Dawn - Community Logo.png'
    },
    alt: {
      id:'1E0eS0L3oBb3ug0sWTtdMqJI6KIuGnKnx',
      label:'Alternativer Banner',
      name:'Dusk & Dawn - Alternativer Community Banner.png',
      original:true
    },
    icon1: {
      id:'1OQD-XxySeZpHuIVTM2M9M6aM5RiwRUkF',
      label:'Discord-Icon V1',
      name:'Dusk & Dawn - Discord Icon V1.png'
    },
    icon2: {
      id:'1N4mg49YwdWggHLB-c3i60Vi3U6IH9AYo',
      label:'Discord-Icon V2',
      name:'Dusk & Dawn - Discord Icon V2.png'
    }
  },

  links: {
    twitch:'https://www.twitch.tv/sankuralp',
    youtube:'https://www.youtube.com/channel/UCWGXBwdwqP4T00NE0MlU4jQ',
    discordInvite:'https://discord.gg/zXbhV4975',
    voiceChanger:'https://wia204.github.io/dusk-dawn-voice/',
    arcanaPlanner:'https://arcana.dwell.ai.kr/',
    sender:'https://drive.google.com/uc?export=download&id=1Oa3qSfF91Q10vL2xavHCx0kJ7dqxLZoe',
    package:'https://drive.google.com/uc?export=download&id=1UhvJQd4QE42cR-1zbK_hDnfNbj3KmRLP',
    vbCableDownload:'https://download.vb-audio.com/Download_CABLE/VBCABLE_Driver_Pack45.zip',
    vbCableOfficial:'https://vb-audio.com/Cable/'
  }
});

/* =========================================================
   WEB-APP UND MITGLIEDER
   ========================================================= */

function doGet(e) {
  if(e && e.parameter && e.parameter.api==='v1')return hubPublicGet_(e);
  return HtmlService.createHtmlOutput(HUB_HTML)
    .setTitle('Dusk & Dawn | Community Hub')
    .addMetaTag('viewport','width=device-width, initial-scale=1');
}
/* GitHub Pages adapter. GET requests are strictly read-only. */
function hubPublicGet_(e){
  const p=e.parameter||{},cb=String(p.callback||'');
  if(!/^ddhub_cb_[A-Za-z0-9_]{1,80}$/.test(cb)){
    return ContentService.createTextOutput('/* Invalid callback */')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  let data;
  try{
    let result;
    if(p.fn==='getHubData')result=getHubData();
    else if(p.fn==='getHubImage')result=getHubImage(String(p.arg||''));
    else throw Error('Unknown read operation');
    data={ok:true,result:result};
  }catch(err){
    data={ok:false,error:String(err&&err.message||err)};
  }
  return ContentService
    .createTextOutput(cb+'('+JSON.stringify(data).replace(/</g,'\\u003c')+');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
/* POST used only for existing mutation functions. */
function doPost(e){
  const p=e&&e.parameter||{},id=String(p.requestId||'');
  if(!/^ddhub_write_[A-Za-z0-9_]{1,90}$/.test(id)){
    return HtmlService.createHtmlOutput('Invalid request');
  }
  let message;
  try{
    const args=JSON.parse(String(p.args||'[]'));
    if(!Array.isArray(args))throw Error('Invalid arguments');
    let result;
    if(p.fn==='saveHubStatic'&&args.length===4){
      result=saveHubStatic(args[0],args[1],args[2],args[3]);
    }else if(p.fn==='saveHubAbsence'&&args.length===1){
      result=saveHubAbsence(args[0]);
    }else if(p.fn==='deleteHubAbsence'&&args.length===2){
      result=deleteHubAbsence(args[0],args[1]);
    }else if(p.fn==='registerHubVisit'&&args.length===1){
      result=registerHubVisit(args[0]);
    }else{
      throw Error('Unknown write operation');
    }
    message={type:'DD_HUB_API',id:id,ok:true,result:result};
  }catch(err){
    message={type:'DD_HUB_API',id:id,ok:false,error:String(err&&err.message||err)};
  }
  const encoded=JSON.stringify(message).replace(/</g,'\\u003c');
  const body='<!doctype html><meta charset="utf-8"><script>'+
    'window.parent.postMessage('+encoded+', "https://wia204.github.io");'+
    '<'+'/script>';
  return HtmlService.createHtmlOutput(body)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


function getHubData() {
  const ss = SpreadsheetApp.openById(HUB.sheetId);
  const dusk = hubRead_(ss,'Dusk');
  const dawn = hubRead_(ss,'Dawn');

  return {
    members:dusk.concat(dawn),
    statics:hubReadStatics_(ss),
    absences:hubReadAbsences_(ss),
    raids:HUB.raids,
    counts:{
      dusk:dusk.length,
      dawn:dawn.length,
      total:dusk.length+dawn.length
    },
    assets:Object.keys(HUB.assets).map(key=>{
      const a=HUB.assets[key];
      return {
        key:key,
        label:a.label,
        filename:a.name,
        open:'https://drive.google.com/file/d/'+a.id+'/view',
        download:'https://drive.google.com/uc?export=download&id='+a.id
      };
    }),
    links:HUB.links,
    loadedAt:new Date().toISOString(),
    refreshMinutes:HUB.refreshMinutes
  };
}

function hubStat_(value) {
  const s=String(value==null?'':value)
    .trim()
    .replace(/[^0-9.,]/g,'')
    .replace(/[.,]/g,'');

  return s?Number(s):null;
}

function hubRead_(ss,legion) {
  const sh=ss.getSheetByName(legion);

  if(!sh)throw new Error('Quellblatt fehlt: '+legion);
  if(sh.getLastRow()<2)return [];

  return sh.getRange(2,1,sh.getLastRow()-1,8)
    .getDisplayValues()
    .filter(r=>String(r[1]||'').trim())
    .map(r=>({
      legion:legion,
      name:String(r[1]).trim(),
      cls:String(r[2]||'').trim()||'Unbekannt',
      cp:hubStat_(r[3]),
      gs:hubStat_(r[4]),
      source:String(r[5]||''),
      imported:String(r[6]||''),
      sourceLink:String(r[7]||'')
    }));
}

/* =========================================================
   STATIC-VERWALTUNG
   ========================================================= */

/*
 * FIX: Unicode NFC bewahrt die Akzente.
 *
 * Damit sind
 * Warlokkz -> warlokkz
 * Warlòkkz -> warlòkkz
 *
 * unterschiedliche Identitäten.
 *
 * Keine NFD-Normalisierung mit Entfernen der Akzente
 * bei Identitätsvergleichen verwenden!
 */

function hubIdentity_(name) {
  return String(name||'')
    .trim()
    .normalize('NFC')
    .toLocaleLowerCase('de');
}

function hubStaticKey_(legion,name) {
  return String(legion).normalize('NFC')+
    '\u0000'+hubIdentity_(name);
}

function hubRaidId_(value) {
  const s=String(value||'').trim();

  if(!s)return '';

  const found=HUB.raids.find(r=>
    r.id===s||r.label===s
  );

  return found?found.id:null;
}

function hubReadStatics_(ss) {
  const sh=ss.getSheetByName(HUB.staticSheet);

  if(!sh)throw new Error('Blatt "Raid-Zuordnung" fehlt.');
  if(sh.getLastRow()<2)return [];

  return sh.getRange(2,1,sh.getLastRow()-1,5)
    .getDisplayValues()
    .filter(r=>
      String(r[0]||'').trim()&&
      String(r[1]||'').trim()&&
      String(r[2]||'').trim()
    )
    .map(r=>({
      legion:String(r[0]).trim(),
      name:String(r[1]).trim(),
      raid:hubRaidId_(r[2])||String(r[2]),
      updatedAt:String(r[3]||''),
      version:Number(r[4])||1
    }));
}

function saveHubStatic(
  legion,
  characterName,
  raid,
  expectedVersion
) {
  if(legion!=='Dusk'&&legion!=='Dawn'){
    throw new Error('Ungültige Legion.');
  }

  const name=hubAbsenceText_(
    characterName,64,'Charaktername',true
  );

  const raidId=hubRaidId_(raid);

  if(raidId===null){
    throw new Error('Unbekannte Raid-Zuordnung.');
  }

  if(
    !Number.isInteger(expectedVersion)||
    expectedVersion<0
  ){
    throw new Error('Ungültige Bearbeitungsversion.');
  }

  const lock=LockService.getScriptLock();
  lock.waitLock(20000);

  try{
    const ss=SpreadsheetApp.openById(HUB.sheetId);
    const sh=ss.getSheetByName(HUB.staticSheet);

    if(!sh)throw new Error('Static-Blatt fehlt.');

    /*
     * Charakter mit exakt korrekter Schreibweise suchen.
     */

    const member=hubRead_(ss,legion).find(m=>
      hubStaticKey_(legion,m.name)===
      hubStaticKey_(legion,name)
    );

    if(!member){
      throw new Error(
        'Charakter nicht in der Mitgliederliste.'
      );
    }

    const rows=sh.getLastRow()<2
      ?[]
      :sh.getRange(2,1,sh.getLastRow()-1,5)
        .getDisplayValues();

    const matches=[];

    rows.forEach((r,i)=>{
      if(
        hubStaticKey_(r[0],r[1])===
        hubStaticKey_(legion,name)
      ){
        matches.push(i);
      }
    });

    if(matches.length>1){
      throw new Error(
        'Mehrere Static-Einträge für denselben Charakter gefunden.'
      );
    }

    const index=matches.length?matches[0]:-1;

    const previousVersion=index<0
      ?0
      :Number(rows[index][4])||1;

    /*
     * Bereits keine Static vorhanden:
     * Keine fremde Zuordnung löschen.
     */

    if(raidId===''&&index<0){
      return hubReadStatics_(ss);
    }

    if(previousVersion!==expectedVersion){
      throw new Error(
        'Die Zuordnung wurde inzwischen geändert. '+
        'Bitte aktualisieren und erneut versuchen.'
      );
    }

    /*
     * "Keine Static" löscht die genaue Zeile.
     */

    if(raidId===''){
      sh.deleteRow(index+2);
      SpreadsheetApp.flush();

      const current=hubReadStatics_(ss);

      if(current.some(x=>
        hubStaticKey_(x.legion,x.name)===
        hubStaticKey_(legion,name)
      )){
        throw new Error(
          'Die Static konnte nicht entfernt werden.'
        );
      }

      return current;
    }

    const rowNumber=index<0
      ?sh.getLastRow()+1
      :index+2;

    sh.getRange(rowNumber,1,1,4)
      .setNumberFormat('@');

    sh.getRange(rowNumber,1,1,5)
      .setValues([[
        legion,
        hubAbsenceCell_(member.name),
        raidId,
        new Date().toISOString(),
        previousVersion+1
      ]]);

    SpreadsheetApp.flush();

    return hubReadStatics_(ss);

  }finally{
    lock.releaseLock();
  }
}

/* =========================================================
   ABWESENHEITEN
   ========================================================= */

function hubReadAbsences_(ss) {
  const sh=ss.getSheetByName(HUB.absenceSheet);

  if(!sh)throw new Error('Blatt "Abwesenheiten" fehlt.');
  if(sh.getLastRow()<2)return [];

  return sh.getRange(2,1,sh.getLastRow()-1,9)
    .getDisplayValues()
    .filter(r=>String(r[0]||'').trim())
    .map(r=>({
      id:String(r[0]),
      legion:String(r[1]),
      name:String(r[2]),
      from:String(r[3]),
      to:String(r[4]),
      note:String(r[5]||''),
      createdAt:String(r[6]||''),
      updatedAt:String(r[7]||''),
      version:Number(r[8])||1
    }));
}

function hubAbsenceText_(value,max,field,required) {
  if(typeof value!=='string'){
    throw new Error('Ungültiges Feld: '+field);
  }

  const text=value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,'')
    .trim();

  if(required&&!text){
    throw new Error(field+' darf nicht leer sein.');
  }

  if(text.length>max){
    throw new Error(field+' ist zu lang.');
  }

  return text;
}

function hubAbsenceDate_(value,field) {
  if(
    typeof value!=='string'||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ){
    throw new Error('Ungültiges Datum: '+field);
  }

  const d=new Date(value+'T00:00:00Z');

  if(
    !Number.isFinite(d.getTime())||
    d.toISOString().slice(0,10)!==value
  ){
    throw new Error('Ungültiges Datum: '+field);
  }

  return value;
}

function hubAbsenceCell_(value) {
  const s=String(value);
  return /^[=+\-@]/.test(s)?"'"+s:s;
}

function hubAbsenceRowNumber_(sh,id) {
  if(!id||sh.getLastRow()<2)return -1;

  const ids=sh.getRange(
    2,1,sh.getLastRow()-1,1
  ).getDisplayValues();

  const i=ids.findIndex(r=>r[0]===id);
  return i<0?-1:i+2;
}

function saveHubAbsence(input) {
  if(
    !input||
    typeof input!=='object'||
    Array.isArray(input)
  ){
    throw new Error('Ungültige Eingabe.');
  }

  const legion=input.legion;

  if(!['Dusk','Dawn'].includes(legion)){
    throw new Error('Ungültige Legion.');
  }

  const name=hubAbsenceText_(
    input.name,64,'Charaktername',true
  );

  const from=hubAbsenceDate_(input.from,'Beginn');
  const to=hubAbsenceDate_(input.to,'Ende');

  const note=hubAbsenceText_(
    input.note||'',450,'Notiz',false
  );

  if(to<from){
    throw new Error('Enddatum liegt vor dem Beginn.');
  }

  const id=input.id==null?'':String(input.id);

  if(id&&!/^[a-f0-9-]{36}$/.test(id)){
    throw new Error('Ungültige Eintrags-ID.');
  }

  const lock=LockService.getScriptLock();
  lock.waitLock(15000);

  try{
    const ss=SpreadsheetApp.openById(HUB.sheetId);
    const sh=ss.getSheetByName(HUB.absenceSheet);

    if(!sh){
      throw new Error('Abwesenheitsblatt fehlt.');
    }

    const exists=hubRead_(ss,legion).some(m=>
      hubIdentity_(m.name)===hubIdentity_(name)
    );

    if(!exists){
      throw new Error(
        'Charakter nicht in der Mitgliederliste.'
      );
    }

    const now=new Date().toISOString();

    let row,createdAt,version,targetId;

    if(id){
      row=hubAbsenceRowNumber_(sh,id);

      if(row<0){
        throw new Error('Eintrag wurde bereits gelöscht.');
      }

      const old=sh.getRange(
        row,1,1,9
      ).getDisplayValues()[0];

      const previous=Number(old[8])||1;

      if(Number(input.version)!==previous){
        throw new Error(
          'Der Eintrag wurde geändert. Bitte aktualisieren.'
        );
      }

      createdAt=old[6]||now;
      version=previous+1;
      targetId=id;

    }else{
      if(sh.getLastRow()>=1001){
        throw new Error('Abwesenheitsliste ist voll.');
      }

      row=sh.getLastRow()+1;
      createdAt=now;
      version=1;
      targetId=Utilities.getUuid();
    }

    sh.getRange(row,3,1,6)
      .setNumberFormat('@');

    sh.getRange(row,1,1,9).setValues([[
      targetId,
      legion,
      hubAbsenceCell_(name),
      from,
      to,
      hubAbsenceCell_(note),
      createdAt,
      now,
      version
    ]]);

    SpreadsheetApp.flush();
    return hubReadAbsences_(ss);

  }finally{
    lock.releaseLock();
  }
}

function deleteHubAbsence(id,expectedVersion) {
  if(
    typeof id!=='string'||
    !/^[a-f0-9-]{36}$/.test(id)
  ){
    throw new Error('Ungültige Eintrags-ID.');
  }

  const lock=LockService.getScriptLock();
  lock.waitLock(15000);

  try{
    const ss=SpreadsheetApp.openById(HUB.sheetId);
    const sh=ss.getSheetByName(HUB.absenceSheet);

    if(!sh){
      throw new Error('Abwesenheitsblatt fehlt.');
    }

    const row=hubAbsenceRowNumber_(sh,id);

    if(row<0){
      throw new Error('Eintrag bereits gelöscht.');
    }

    const version=Number(
      sh.getRange(row,9).getDisplayValue()
    )||1;

    if(Number(expectedVersion)!==version){
      throw new Error(
        'Eintrag wurde geändert. Bitte aktualisieren.'
      );
    }

    sh.deleteRow(row);
    SpreadsheetApp.flush();

    return hubReadAbsences_(ss);

  }finally{
    lock.releaseLock();
  }
}

/* =========================================================
   BILDER
   ========================================================= */

function getHubImage(key) {
  if(
    typeof key!=='string'||
    !Object.prototype.hasOwnProperty.call(
      HUB.assets,key
    )
  ){
    throw new Error('Unbekannte Grafik.');
  }

  const asset=HUB.assets[key];
  let blob=null;

  if(asset.original){
    try{
      const candidate=DriveApp
        .getFileById(asset.id).getBlob();

      if(
        /^image\//i.test(candidate.getContentType())&&
        candidate.getBytes().length<7*1024*1024
      ){
        blob=candidate;
      }
    }catch(err){
      Logger.log(err.message);
    }
  }

  if(!blob){
    try{
      const url=
        'https://drive.google.com/thumbnail?id='+
        encodeURIComponent(asset.id)+
        '&sz=w'+(asset.original?1800:800);

      const response=UrlFetchApp.fetch(url,{
        headers:{
          Authorization:
            'Bearer '+ScriptApp.getOAuthToken()
        },
        followRedirects:true,
        muteHttpExceptions:true
      });

      if(response.getResponseCode()!==200){
        throw new Error('Thumbnail nicht verfügbar.');
      }

      blob=response.getBlob();

    }catch(_){
      blob=DriveApp.getFileById(
        asset.id
      ).getThumbnail();
    }
  }

  if(
    !blob||
    !/^image\//i.test(blob.getContentType())
  ){
    throw new Error('Bild nicht verfügbar.');
  }

  return {
    key:key,
    dataUrl:
      'data:'+blob.getContentType()+
      ';base64,'+
      Utilities.base64Encode(blob.getBytes())
  };
}

/* =========================================================
   BESUCHERSTATISTIK
   ========================================================= */

function registerHubVisit(visitorId) {
  const valid=
    typeof visitorId==='string'&&
    /^[a-f0-9]{32}$/.test(visitorId);

  let newKey='',oldKey='';

  if(valid){
    const digest=Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      visitorId,
      Utilities.Charset.UTF_8
    ).map(n=>
      ('0'+(n&255).toString(16)).slice(-2)
    ).join('');

    newKey='hub_seen_'+digest;
    oldKey='visitor_'+digest;
  }

  const lock=LockService.getScriptLock();
  lock.waitLock(15000);

  try{
    const store=
      PropertiesService.getScriptProperties();

    const total=
      Number(
        store.getProperty('hub_total_views')||0
      )+1;

    let unique=
      Number(
        store.getProperty('hub_unique_browsers')||0
      );

    store.setProperty(
      'hub_total_views',String(total)
    );

    if(
      newKey&&
      !store.getProperty(newKey)&&
      !store.getProperty(oldKey)
    ){
      try{
        store.setProperty(newKey,'1');
        unique++;

        store.setProperty(
          'hub_unique_browsers',
          String(unique)
        );
      }catch(err){
        Logger.log(err.message);
      }
    }

    return {total,unique};

  }finally{
    lock.releaseLock();
  }
}

function getHubVisitStats() {
  const p=PropertiesService.getScriptProperties();

  return {
    total:Number(
      p.getProperty('hub_total_views')||0
    ),
    unique:Number(
      p.getProperty('hub_unique_browsers')||0
    )
  };
}

function testCommunityHub() {
  const data=getHubData();

  Logger.log(JSON.stringify({
    counts:data.counts,
    statics:data.statics.length,
    absences:data.absences.length,
    raids:data.raids
  }));
}

/*
 * Prüft den konkreten Namenskonflikt,
 * ohne Daten zu verändern.
 */

function testWarlokkzIdentity() {
  const ss=SpreadsheetApp.openById(HUB.sheetId);
  const members=hubRead_(ss,'Dusk');
  const statics=hubReadStatics_(ss);

  const names=['Warlokkz','Warlòkkz'];

  const result=names.map(name=>{
    const member=members.find(m=>
      hubIdentity_(m.name)===hubIdentity_(name)
    );

    const assigned=statics.find(s=>
      s.legion==='Dusk'&&
      hubIdentity_(s.name)===hubIdentity_(name)
    );

    return {
      name:name,
      memberFound:!!member,
      cp:member?member.cp:null,
      raid:assigned?assigned.raid:'Keine Static'
    };
  });

  Logger.log(JSON.stringify(result,null,2));

  return result;
}

/* =========================================================
   FRONTEND
   ========================================================= */

const HUB_HTML=String.raw`<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#090f1c">
<title>Dusk &amp; Dawn · Community Hub</title>

<style>
:root{
  color-scheme:dark;
  --bg:#090f1c;
  --panel:#111e30;
  --border:#293750;
  --text:#f0f1f4;
  --muted:#91a1b7;
  --dim:#61738d;
  --gold:#e8bc79;
  --cyan:#77d7d1;
  --max:1290px
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{
  margin:0;min-height:100vh;color:var(--text);
  background:
    radial-gradient(ellipse 80% 580px at 76% -160px,#49324b46,transparent 70%),
    radial-gradient(ellipse 760px 500px at -180px 480px,#144c5740,transparent 70%),
    var(--bg);
  font:14px/1.55 system-ui,-apple-system,'Segoe UI',Arial,sans-serif
}
button,input,select,textarea{font:inherit}
button{cursor:pointer}
a{color:inherit;text-decoration:none}
button:focus-visible,a:focus-visible,input:focus-visible,
select:focus-visible,textarea:focus-visible{
  outline:2px solid var(--cyan);
  outline-offset:2px
}
.wrap{max-width:var(--max);margin:auto;padding:0 28px}
.top{
  position:sticky;top:0;z-index:30;
  background:#09111eed;
  backdrop-filter:blur(20px);
  border-bottom:1px solid #3041599c
}
.top-inner{
  min-height:71px;display:flex;
  align-items:center;gap:28px
}
.brand{
  display:flex;align-items:center;
  gap:11px;min-width:246px
}
.mark{
  width:40px;height:40px;flex-shrink:0;
  background:#202c40;border:1px solid #514b61;
  border-radius:11px;display:grid;place-items:center;
  overflow:hidden;color:var(--gold);
  font-size:12px;font-weight:900
}
.mark img{
  display:none;width:100%;height:100%;object-fit:cover
}
.brand-name{
  font-size:14px;font-weight:900;letter-spacing:.105em
}
.brand-sub{
  font-size:9px;font-weight:650;
  letter-spacing:.17em;color:var(--muted)
}
.nav{display:flex;gap:5px;align-self:stretch}
.nav button{
  background:none;border:0;
  border-bottom:2px solid transparent;
  color:#9ba9bf;padding:0 12px;
  font-size:11px;font-weight:800;
  letter-spacing:.045em;white-space:nowrap
}
.nav button.active{
  color:#f4eddf;border-bottom-color:var(--gold)
}
.nav button:hover{color:#fff}
.top-right{
  display:flex;align-items:center;
  gap:8px;margin-left:auto
}
.refresh,.utility-link{
  background:#18263a;border:1px solid #34445e;
  border-radius:8px;color:#bdcbe0;
  padding:8px 12px;font-size:11px;font-weight:700
}
.utility-link{
  background:transparent;color:#8097b0;
  font-size:9px;font-weight:800;letter-spacing:.055em
}
.refresh:hover,.utility-link:hover{background:#243750}
.utility-link.active{
  color:var(--gold);border-color:#887454
}

/* Banner */

.inner-page .hero{display:none}
.inner-page .creator{
  margin-top:12px;padding:7px 12px
}
.inner-page .creator p{display:none}
.hero{
  display:flex;flex-direction:column;
  margin-top:15px;overflow:hidden;
  border:1px solid #51516b99;border-radius:14px;
  background:#172138
}
.hero img{
  display:block;width:100%;height:auto;
  aspect-ratio:3/1;object-fit:contain;
  background:linear-gradient(110deg,#141d34,#302b45,#1c3040)
}
.hero-copy{
  padding:12px 20px;
  border-top:1px solid #564a5f;
  background:linear-gradient(100deg,#101c30,#182538 68%,#241f34);
  display:grid;
  grid-template-columns:minmax(180px,225px) minmax(210px,1fr);
  grid-template-rows:auto auto;
  gap:2px 20px;align-items:center
}
.kicker{
  color:var(--cyan);font-size:10px;
  letter-spacing:.2em;font-weight:900;text-transform:uppercase
}
.hero-copy .kicker{grid-column:1;grid-row:1;font-size:9px}
.hero h1{
  grid-column:1;grid-row:2;margin:0;
  font-size:23px;font-weight:850;
  letter-spacing:-.05em;line-height:1.15
}
.hero h1 span{color:var(--gold)}
.hero p{
  grid-column:2;grid-row:1/span 2;
  font-size:11px;color:#c1ccdc;margin:0
}

/* Community */

.creator{
  margin-top:10px;padding:9px 14px;
  display:flex;align-items:center;
  justify-content:space-between;
  gap:14px;flex-wrap:wrap;
  border:1px solid #514259;border-radius:11px;
  background:linear-gradient(94deg,#261c32b0,#132338 53%,#12273a99);
  box-shadow:inset 3px 0 0 #d4af72
}
.creator-lead{
  display:flex;align-items:center;gap:13px
}
.creator-sigil{
  width:29px;height:29px;
  display:grid;place-items:center;
  border-radius:10px;background:#bd966824;
  color:var(--gold);border:1px solid #b9956566;
  font-size:17px;font-weight:900
}
.creator small{
  display:block;font-size:9px;font-weight:900;
  letter-spacing:.16em;color:#b5a9bc
}
.creator strong{font-size:13px;color:#f5e9d7}
.creator p{font-size:11px;color:#a3adc1;margin:1px 0 0}
.creator-actions{
  display:flex;align-items:center;
  flex-wrap:wrap;gap:8px
}
.watch{
  display:inline-flex;align-items:center;
  justify-content:center;gap:9px;
  min-width:115px;padding:7px 12px;
  border-radius:8px;border:1px solid #66548e;
  font-size:11px;font-weight:900;
  transition:transform .15s
}
.watch:hover{transform:translateY(-1px)}
.watch.twitch{color:#eee6ff;background:#372453}
.watch.youtube{
  color:#ffe8e1;background:#502d33;border-color:#8f4d57
}
.watch.discord{  color:#f1eaff;background:#31274e;border-color:#7567ac
}

/* Inhalt */

.main{padding:18px 0 45px}
.section-heading{
  display:flex;align-items:end;
  justify-content:space-between;
  gap:15px;margin-bottom:13px
}
.section-heading h2{
  margin:0;font-size:21px;letter-spacing:-.035em
}
.section-heading p{
  margin:3px 0 0;font-size:12px;color:var(--muted)
}
.metrics{
  display:flex;align-items:center;flex-wrap:wrap;
  background:#111e30b5;border:1px solid #334057;
  border-radius:10px;padding:10px 14px;
  margin-bottom:15px;min-height:54px
}
.metric{
  display:flex;align-items:baseline;gap:9px;
  padding:0 21px 0 6px;margin-right:16px;
  border-right:1px solid #34445a
}
.metric:last-child{border:0;margin-right:0}
.metric b{
  font-size:20px;font-weight:850;letter-spacing:-.04em
}
.metric label{
  color:#8c9db4;font-size:10px;
  letter-spacing:.1em;font-weight:800;text-transform:uppercase
}
.gold{color:var(--gold)}
.cyan{color:var(--cyan)}
.panel{
  background:#101b2bcc;
  border:1px solid var(--border);
  border-radius:12px;overflow:hidden
}
.toolbar{
  display:grid;
  grid-template-columns:minmax(230px,3fr) minmax(160px,1fr);
  gap:10px;padding:16px;border-bottom:1px solid var(--border)
}
.field{display:flex;flex-direction:column;gap:6px}
.field label{
  color:#8d9fb7;font-size:9px;
  font-weight:850;letter-spacing:.12em
}
.control{
  background:#0a1423;border:1px solid #30425d;
  color:var(--text);border-radius:7px;
  min-height:40px;padding:0 12px;width:100%
}
.control::placeholder{color:#65778e}
.table-wrap{overflow-x:auto}
.member-table{
  width:100%;border-collapse:collapse;
  text-align:left;white-space:nowrap
}
.member-table th{
  background:#17253b;color:#889fb9;
  font-size:9px;letter-spacing:.1em;padding:11px 15px
}
.member-table td{
  border-top:1px solid #26354a;
  padding:11px 15px;font-size:12px
}
.member-table tr:hover td{background:#18283d}
.member-name{font-weight:800;color:#f4efe5}
.tag{
  display:inline-block;padding:3px 8px;
  border-radius:5px;font-size:10px;font-weight:850
}
.tag.dusk{color:#f4d7a7;background:#53402d70}
.tag.dawn{color:#a5f0ed;background:#1c4b5170}
.number{font-variant-numeric:tabular-nums;font-weight:750}
.small-link{
  font-size:10px;font-weight:800;
  color:#b6cce2;margin-right:10px
}
.small-link:hover{text-decoration:underline;color:#fff}
.copy,.pager button{
  border:1px solid #43516a;background:#21334b;
  border-radius:6px;color:#d0dbe9;
  padding:5px 8px;font-size:10px
}
.copy:hover,.pager button:hover{background:#33455f}
.pager{
  padding:11px 16px;border-top:1px solid var(--border);
  display:flex;align-items:center;
  justify-content:space-between;
  gap:10px;color:#9caec3;font-size:11px
}
.pager button:disabled{opacity:.4;cursor:default}
.pager-buttons{display:flex;gap:7px}
.mob-list{display:none}
.muted-note{
  font-size:11px;color:#8a9aaf;margin:11px 1px 0
}

/* Ranking */

.rank{
  display:inline-flex;align-items:center;
  justify-content:center;
  border:1px solid transparent;border-radius:5px;
  padding:2px 6px;font-size:9px;
  font-weight:850;white-space:nowrap
}
.rank-ordinary{
  color:#8093a9;background:#1b2b3d;border-color:#2e4056
}
.rank-1{
  color:#ffe3a4;background:#594127;border-color:#c79b52
}
.rank-2{
  color:#e5ebf5;background:#465369;border-color:#93a4b8
}
.rank-3{
  color:#f8c6a9;background:#583a30;border-color:#ba795d
}
.name-rank{
  display:inline-flex;align-items:center;
  gap:8px;flex-wrap:wrap
}
.row-top-1 td{background:#42331e4a!important}
.row-top-2 td{background:#57647929!important}
.row-top-3 td{background:#6a402c2a!important}
.top-three{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:12px;margin:14px 0 18px
}
.champion{
  padding:18px;border:1px solid #3e4b62;
  border-radius:11px;background:#19263b;overflow:hidden
}
.champion.first{
  background:linear-gradient(135deg,#332a25,#142036 85%);
  border-color:#927049
}
.champion.second{
  background:linear-gradient(135deg,#293343,#142036 85%);
  border-color:#738398
}
.champion.third{
  background:linear-gradient(135deg,#382b2a,#142036 85%);
  border-color:#976c57
}
.champion .place{
  font-size:11px;font-weight:900;
  letter-spacing:.12em;margin-bottom:12px
}
.champion .player{
  font-size:19px;font-weight:900;overflow-wrap:anywhere
}
.champion .details{
  font-size:11px;color:#9fb0c8;margin-top:4px
}
.champion .combat{
  font-size:24px;font-weight:850;margin-top:11px
}
.champion .unit{
  font-size:10px;color:#8a9bb1;margin-left:5px
}

/* Übersicht */

.overview-grid{
  display:grid;grid-template-columns:1fr 1fr;
  gap:13px;margin-top:14px
}
.content-card{
  padding:18px;background:#111e30;
  border:1px solid var(--border);border-radius:11px
}
.content-card h3{font-size:13px;margin:0 0 14px}
.leader{
  display:flex;align-items:center;
  justify-content:space-between;gap:12px;
  padding:9px 0;border-top:1px solid #27364d;
  font-size:12px
}
.leader b{color:#e9e0cf}
.info-list{display:grid;gap:9px}
.info-list a,.info-list button{
  display:flex;align-items:center;
  justify-content:space-between;
  width:100%;padding:11px 13px;
  border:1px solid #37455a;border-radius:8px;
  background:#19283b;color:var(--text);
  font-size:12px;font-weight:750;text-align:left
}

/* Mitglieder */

.member-subnav{
  display:flex;gap:7px;flex-wrap:wrap;
  width:max-content;max-width:100%;
  margin-bottom:14px;padding:5px;
  background:#0e1929;border:1px solid #34455c;
  border-radius:9px
}
.member-subnav button{
  border:0;border-radius:6px;background:transparent;
  color:#9cb0c7;padding:8px 13px;
  font-size:11px;font-weight:800
}
.member-subnav button.active{
  background:#3e342d;color:#f3ddbb;
  box-shadow:inset 0 0 0 1px #816a4f
}
.sub-count{
  margin-left:6px;padding:2px 5px;
  background:#23384c;border-radius:5px;font-size:9px
}

/* Statics */

.static-tabs{
  display:flex;align-items:center;
  gap:7px;flex-wrap:wrap;
  padding:12px 16px;border-bottom:1px solid var(--border)
}
.static-tab{
  background:#142338;border:1px solid #324761;
  border-radius:6px;color:#b5c7dd;
  padding:8px 10px;font-size:10px;
  font-weight:800;min-height:34px
}
.static-tab.active{
  background:#59452d;border-color:#c39a61;color:#ffe0ad
}
.static-tab .count{
  opacity:.65;margin-left:4px;font-size:9px
}
.static-filter-status{
  display:flex;gap:8px;flex-wrap:wrap;
  padding:0 16px;border-bottom:1px solid var(--border)
}
.static-filter-status:not(:empty){
  padding-top:9px;padding-bottom:9px
}
.active-filter{
  background:#213249;border:1px solid #546780;
  border-radius:5px;color:#e4e9f2;
  padding:4px 8px;font-size:10px
}
.class-link,.raid-link{
  border:0;background:transparent;
  color:#a9cfeb;padding:1px 0;
  font-size:11px;font-weight:750;text-align:left
}
.class-link:hover,.raid-link:hover{
  text-decoration:underline;color:#fff
}
.static-value{
  display:flex;align-items:center;
  gap:7px;flex-wrap:wrap;min-width:170px
}
.static-label{
  display:block;color:#8194aa;
  font-size:9px;margin-bottom:4px
}
.static-select{
  width:100%;max-width:190px;
  min-height:35px;background:#14243a;
  border:1px solid #40536c;border-radius:6px;
  color:#d5e0ef;padding:5px 7px;font-size:10px
}
.static-select:disabled{opacity:.55;cursor:progress}
.static-saving{color:var(--gold);font-size:10px}

/* Abwesenheiten */

.member-absence{
  display:inline-flex;align-items:center;
  gap:5px;max-width:220px;padding:3px 7px;
  border:1px solid #44776f;border-radius:5px;
  background:#153633;color:#aff1df;
  font-size:10px;font-weight:800;white-space:normal
}
.member-absence.future{
  border-color:#756344;background:#30291c;color:#ecd5a5
}
.member-absence-text{
  display:block;max-width:220px;
  color:#a7b7c9;font-size:10px;
  white-space:pre-wrap;overflow-wrap:anywhere
}
.mob-absence{
  margin-top:9px;padding-top:7px;
  border-top:1px solid #35445a
}
.abs-form{
  display:grid;
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:12px;padding:18px
}
.abs-form .span-2{grid-column:span 2}
.abs-form .span-all{grid-column:1/-1}
.abs-form textarea{
  min-height:82px;padding:10px;
  resize:vertical;line-height:1.5
}
.abs-toolbar{
  display:flex;align-items:center;gap:10px;flex-wrap:wrap
}
.abs-error{color:#ffb1ad;font-size:12px}
.abs-header{
  display:flex;align-items:center;
  justify-content:space-between;gap:12px;
  padding:14px 18px;border-bottom:1px solid var(--border)
}
.abs-header h3{margin:0;font-size:14px}
.abs-help{
  color:var(--muted);font-size:11px;margin:5px 0 0
}
.abs-options{
  display:flex;align-items:end;gap:12px;flex-wrap:wrap;
  padding:13px 16px;border-bottom:1px solid var(--border)
}
.abs-options .field{min-width:160px;flex:1}
.abs-options .field:first-child{flex:2}
.abs-check{
  display:flex;align-items:center;gap:7px;
  min-height:40px;font-size:11px;color:#c9d5e5
}
.abs-list{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:12px;margin-top:14px
}
.abs-card{
  min-width:0;padding:15px 17px;
  background:#111e30;border:1px solid #31415a;
  border-radius:11px
}
.abs-card.abs-past{opacity:.68}
.abs-card-head{
  display:flex;align-items:center;flex-wrap:wrap;
  gap:8px;margin-bottom:11px
}
.abs-card strong{font-size:14px;overflow-wrap:anywhere}
.abs-state{
  border:1px solid #425670;border-radius:5px;
  color:#bdcee1;padding:3px 7px;
  font-size:9px;font-weight:800
}
.abs-state.now{
  color:#bff2e4;border-color:#407b72;background:#163c3c
}
.abs-state.future{
  color:#e8d8b8;border-color:#71634c;background:#37301f
}
.abs-period{color:#d0dbea;font-size:12px}
.abs-note{
  color:#aebdd0;font-size:12px;margin:10px 0;
  white-space:pre-wrap;overflow-wrap:anywhere
}
.abs-card-foot{
  display:flex;align-items:center;
  justify-content:space-between;gap:10px;flex-wrap:wrap;
  padding-top:11px;margin-top:12px;
  border-top:1px solid #293951
}
.abs-updated{color:#7e90a8;font-size:10px}
.abs-empty{
  grid-column:1/-1;text-align:center;
  padding:30px;color:#8e9fb6;
  border:1px dashed #31415a;border-radius:10px
}

/* Aion Helper */

.helper-intro{
  display:flex;align-items:center;
  justify-content:space-between;
  gap:20px;flex-wrap:wrap;
  padding:22px;margin-bottom:13px;
  background:linear-gradient(120deg,#20293e,#132b35);
  border:1px solid #475068;border-radius:12px
}
.helper-intro h3{
  font-size:21px;margin:6px 0;color:#f3e9db
}
.helper-intro p{
  max-width:620px;margin:0;color:#b6c7d8;
  font-size:12px;line-height:1.65
}
.helper-benefits{
  display:flex;gap:6px;flex-wrap:wrap;margin-top:11px
}
.helper-benefits span{
  font-size:10px;border:1px solid #56687e;
  border-radius:5px;padding:4px 7px;color:#bfd1e0
}
.helper-go{
  background:#d9b47b;color:#201c18;
  padding:11px 17px;font-size:12px;
  font-weight:900;border:1px solid #ddbd8f;
  border-radius:7px
}
.helper-how{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:13px
}
.helper-section{
  padding:18px;background:#111e30;
  border:1px solid #314358;border-radius:11px
}
.helper-section h3{
  font-size:15px;margin:0 0 5px;color:#ebdbc2
}
.helper-section p{color:#a6b8cd;font-size:11px}
.helper-steps{
  margin:9px 0 3px;padding:0;
  list-style:none;counter-reset:guide;
  display:grid;gap:12px
}
.helper-steps li{
  display:grid;grid-template-columns:23px 1fr;
  gap:10px;color:#b8c8da;
  font-size:11px;line-height:1.6;
  counter-increment:guide
}
.helper-steps li:before{
  content:counter(guide);
  display:grid;place-items:center;
  width:23px;height:23px;border-radius:6px;
  background:#433527;color:#f1d4a6;
  border:1px solid #846b4c;
  font-size:10px;font-weight:900
}
.helper-steps strong{color:#e7edf5}
.helper-note{
  margin-top:13px;padding:12px 15px;
  color:#9fb1c6;font-size:11px;line-height:1.65;
  background:#152438;border:1px solid #39495b;
  border-radius:9px
}
.helper-links{
  display:flex;gap:10px;flex-wrap:wrap;margin-top:12px
}

/* Dateien */

.downloads{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:14px
}
.downloads p{color:#94a4b9;font-size:11px}
.actions{display:flex;flex-wrap:wrap;gap:8px}
.action{
  display:inline-flex;align-items:center;
  justify-content:center;padding:8px 12px;
  background:#243248;color:#e0e7ef;
  border:1px solid #48536a;border-radius:7px;
  font-size:11px;font-weight:800
}
.action.primary{
  color:#231b19;background:#e2ba7e;border-color:#e2ba7e
}
.action:hover{filter:brightness(1.13)}
.file-group-title{
  margin:14px 0 8px;color:#8fa5be;
  font-size:11px;font-weight:850;letter-spacing:.09em
}
.files-fold{
  margin-top:16px;background:#101e2f;
  border:1px solid #35475b;border-radius:10px
}
.files-fold summary{
  padding:12px 15px;cursor:pointer;
  color:#bdcee0;font-size:11px;font-weight:850
}
.file-grid{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:14px;padding:12px
}
.file{
  background:#111d30;border:1px solid var(--border);
  border-radius:11px;overflow:hidden
}
.file-preview{
  display:flex;align-items:center;justify-content:center;
  height:118px;background:#172339;overflow:hidden
}
.file-preview img{
  display:none;width:100%;height:100%;object-fit:contain
}
.file-preview span{font-size:10px;color:#6e7f98}
.file-body{padding:15px}
.file-body h3{font-size:13px;margin:0}
.file-body p{
  font-size:10px;color:#8fa1b6;overflow-wrap:anywhere
}
.notice{
  padding:11px 13px;margin-top:12px;
  background:#162236;border:1px solid #39445a;
  border-radius:8px;color:#aebacb;font-size:11px
}

/* Footer */

.footer{
  padding:20px 0 27px;border-top:1px solid #304159;
  background:#08101a66;color:#8192aa;font-size:11px
}
.footer-inner{
  display:flex;align-items:center;
  justify-content:space-between;gap:12px;flex-wrap:wrap
}
.toast{
  position:fixed;right:20px;bottom:21px;z-index:90;
  padding:11px 15px;background:#f0e1ca;color:#271d21;
  border:1px solid #b19a78;border-radius:8px;
  font-size:12px;font-weight:850;
  box-shadow:0 18px 40px #0009;
  opacity:0;transform:translateY(10px);
  pointer-events:none;transition:.2s
}
.toast.show{opacity:1;transform:translateY(0)}
.loading,.empty{
  padding:48px 20px;text-align:center;color:#a2b0c4
}
.loader{
  width:22px;height:22px;margin:0 auto 12px;
  border:2px solid #40516a;
  border-top-color:var(--gold);
  border-radius:50%;animation:spin 1s linear infinite
}
@keyframes spin{to{transform:rotate(360deg)}}

/* Mobil */

@media(max-width:1080px){
  .top-inner{gap:12px}
  .brand{min-width:210px}
  .nav button{padding:0 8px}
  .file-grid,.downloads{
    grid-template-columns:repeat(2,1fr)
  }
}
@media(max-width:740px){
  .wrap{padding:0 14px}
  .top-inner{
    flex-wrap:wrap;gap:0;padding-top:10px
  }
  .brand{width:calc(100% - 52px);min-width:0}
  .top-right{margin-left:auto}
  .top-right .refresh{font-size:0;padding:8px 12px}
  .top-right .refresh:after{content:'↻';font-size:16px}
  .nav{
    order:3;width:100%;height:45px;
    gap:3px;overflow-x:auto;scrollbar-width:thin
  }
  .nav button{
    flex:0 0 auto;padding:0 9px;font-size:10px
  }
  .hero{margin-top:11px}
  .hero-copy{display:block;padding:11px 14px}
  .hero h1{font-size:20px;margin:3px 0}
  .hero p{font-size:10px}
  .creator{padding:11px;gap:11px}
  .creator-actions{width:100%}
  .watch{
    flex:1;min-width:0;padding:8px 6px;font-size:10px
  }
  .section-heading h2{font-size:19px}
  .metric{
    padding:2px 10px 2px 4px;
    margin-right:8px;gap:5px
  }
  .metric b{font-size:17px}
  .toolbar{grid-template-columns:1fr;padding:11px}
  .table-wrap{display:none}
  .mob-list{display:grid;gap:8px;padding:10px}
  .mob-card{
    background:#17263a;border:1px solid #2b3b52;
    padding:12px;border-radius:8px
  }
  .mob-top-1{border-color:#b89152}
  .mob-top-2{border-color:#8799af}
  .mob-top-3{border-color:#ac7c62}
  .mob-head,.mob-values,.mob-actions{
    display:flex;align-items:center;
    justify-content:space-between;gap:10px;flex-wrap:wrap
  }
  .mob-head{margin-bottom:7px}
  .mob-values{
    justify-content:flex-start;
    font-size:11px;color:#c5d2e2
  }
  .mob-actions{
    justify-content:flex-start;
    margin-top:10px;padding-top:9px;
    border-top:1px solid #36445b
  }
  .top-three,.overview-grid,.file-grid,.downloads,
  .helper-how,.abs-list{
    grid-template-columns:1fr
  }
  .champion{padding:14px}
  .champion .combat{font-size:20px}
  .abs-form{grid-template-columns:1fr;padding:13px}
  .abs-form .span-2{grid-column:1/-1}
  .abs-options .field{min-width:100%}
  .member-subnav{width:100%}
  .member-subnav button{flex:1}
  .helper-intro{padding:16px}
  .helper-go{width:100%;text-align:center}
  .static-tabs{gap:5px;padding:10px}
  .static-tab{font-size:9px;padding:7px 8px}
  .static-value{min-width:0}
  .static-select{max-width:100%;min-width:170px}
  .pager{padding:12px}
}
</style>
</head>

<body>
<header class="top">
  <div class="wrap top-inner">
    <a class="brand" href="#" data-nav="overview">
      <div class="mark">
        <span id="logoFallback">D/D</span>
        <img data-asset="logo" alt="Community-Logo">
      </div>
      <div>
        <div class="brand-name">DUSK &amp; DAWN</div>
        <div class="brand-sub">LUMIEL EU · COMMUNITY HUB</div>
      </div>
    </a>

    <nav class="nav">
      <button data-nav="overview">ÜBERSICHT</button>
      <button data-nav="members" class="active">MITGLIEDER</button>
      <button data-nav="helper">AION HELPER</button>
    </nav>

    <div class="top-right">
      <button class="utility-link" data-nav="files">
        ORGA · DATEIEN
      </button>
      <button class="refresh" id="reload">
        ↻ Aktualisieren
      </button>
    </div>
  </div>
</header>

<div class="wrap">

  <section class="hero">
    <img data-asset="banner" alt="Dusk & Dawn Banner">

    <div class="hero-copy">
      <div class="kicker">AION 2 · LUMIEL EU</div>
      <h1>Community <span>Hub.</span></h1>
      <p>
        Die zentrale Anlaufstelle für beide Legionen.
        Mitglieder, Rankings, Profile und Community-Tools.
      </p>
    </div>
  </section>

  <section class="creator">
    <div class="creator-lead">
      <div class="creator-sigil">✦</div>
      <div>
        <small>COMMUNITY · STREAMS &amp; CONTENT</small>
        <strong>SankuraLP</strong>
        <p>Streams und Videos unserer Community.</p>
      </div>
    </div>

    <div class="creator-actions">
      <a class="watch twitch"
        href="https://www.twitch.tv/sankuralp"
        target="_blank" rel="noopener noreferrer">
        ◉ Twitch ansehen ↗
      </a>
      <a class="watch youtube"
        href="https://www.youtube.com/channel/UCWGXBwdwqP4T00NE0MlU4jQ"
        target="_blank" rel="noopener noreferrer">
        ▶ YouTube öffnen ↗
      </a>
      <a class="watch discord"
        href="https://discord.gg/zXbhV4975"
        target="_blank" rel="noopener noreferrer">
        ◆ Discord beitreten ↗
      </a>
    </div>
  </section>

  <main class="main" id="main">
    <div class="loading">
      <div class="loader"></div>
      Mitgliederdaten werden geladen …
    </div>
  </main>

</div>

<footer class="footer">
  <div class="wrap footer-inner">
    <span>© Dusk &amp; Dawn · Lumiel EU</span>
    <span id="lastRead">Tabellendaten werden geladen</span>
    <span id="visitorStats">
      Seitenaufrufe — · Browser —
    </span>
  </div>
</footer>

<div class="toast" id="toast"
  role="status" aria-live="polite"></div>

<script>
'use strict';

const S={
  tab:'members',
  data:null,
  search:'',
  cls:'all',
  raid:'all',
  sort:'cp',
  page:1,
  pageSize:40,
  staticBusy:{},
  images:{},
  loading:{},
  absenceEditId:null,
  absenceVersion:null,
  absenceDirty:false,
  absenceSaving:false,
  absenceSearch:'',
  absenceLegion:'all',
  absenceHistory:false
};

const $=q=>document.querySelector(q);
const $$=q=>Array.from(document.querySelectorAll(q));

const fmt=n=>n==null
  ?'—'
  :new Intl.NumberFormat('de-DE').format(n);

const esc=value=>
  String(value==null?'':value)
    .replace(/[&<>"']/g,c=>({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[c]));

const safe=url=>{
  try{
    const u=new URL(url);
    return u.protocol==='https:'?u.href:'#';
  }catch(_){
    return '#';
  }
};

function toast(message) {
  const el=$('#toast');
  el.textContent=message;
  el.classList.add('show');

  clearTimeout(toast.timer);

  toast.timer=setTimeout(
    ()=>el.classList.remove('show'),
    2700
  );
}

function link(url,label,cls) {
  return '<a class="'+(cls||'small-link')+
    '" href="'+esc(safe(url))+
    '" target="_blank" rel="noopener noreferrer">'+
    esc(label)+'</a>';
}

function pageTitle(name,subtitle) {
  return '<div class="section-heading"><div>'+
    '<h2>'+esc(name)+'</h2>'+
    '<p>'+esc(subtitle)+'</p>'+
    '</div></div>';
}

function metrics() {
  const c=S.data.counts;

  return '<div class="metrics">'+
    '<div class="metric"><label>Dusk</label>'+
      '<b class="gold">'+fmt(c.dusk)+'</b></div>'+
    '<div class="metric"><label>Dawn</label>'+
      '<b class="cyan">'+fmt(c.dawn)+'</b></div>'+
    '<div class="metric"><label>Gesamt</label>'+
      '<b>'+fmt(c.total)+'</b></div>'+
    '</div>';
}

/*
 * Suche:
 * Hier bleiben Akzente absichtlich ignoriert.
 * "Warlokkz" soll beide Schreibweisen finden können.
 */

function normalize(value) {
  return String(value||'')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLocaleLowerCase('de');
}

/*
 * FIX v3.3:
 * Identität ist NICHT dasselbe wie Suche.
 *
 * Hier dürfen Akzente NICHT entfernt werden.
 */

function identity(value) {
  return String(value||'')
    .trim()
    .normalize('NFC')
    .toLocaleLowerCase('de');
}

function sameCharacter(a,b) {
  return identity(a)===identity(b);
}

/* =========================================================
   RANKING
   ========================================================= */

function assignRanks(members) {
  const ranked=members
    .filter(m=>
      Number.isFinite(m.cp)&&m.cp>0
    )
    .slice()
    .sort((a,b)=>
      b.cp-a.cp||
      a.name.localeCompare(b.name,'de')
    );

  let previous=null;
  let rank=0;

  ranked.forEach((m,i)=>{
    if(m.cp!==previous){
      rank=i+1;
      previous=m.cp;
    }

    m.rank=rank;
  });

  members.forEach(m=>{
    if(!Number.isFinite(m.cp)||m.cp<=0){
      m.rank=null;
    }
  });
}

function rankBadge(m) {
  if(m.rank==null)return '';

  return '<span class="rank rank-'+
    (m.rank<=3?m.rank:'ordinary')+'">'+
    (m.rank<=3?'RANK ':'#')+
    m.rank+
    '</span>';
}

function guildBadge(legion) {
  return '<span class="tag '+
    (legion==='Dusk'?'dusk':'dawn')+'">'+
    esc(legion)+'</span>';
}

/* =========================================================
   STATICS — FEHLER KORRIGIERT
   ========================================================= */

function raidDefs() {
  return S.data&&Array.isArray(S.data.raids)
    ?S.data.raids
    :[];
}

function raidLabel(id) {
  const found=raidDefs().find(r=>
    r.id===id
  );

  return found?found.label:(id||'Keine Static');
}

function staticKey(m) {
  /*
   * Vorher: normalize(m.name)
   * Jetzt:  identity(m.name)
   */
  return m.legion+'\u0000'+identity(m.name);
}

function getStatic(m) {
  /*
   * Der wichtige FIX:
   * Warlokkz bekommt nur Warlokkz.
   * Warlòkkz bekommt nur Warlòkkz.
   */

  return (S.data.statics||[]).find(x=>
    x.legion===m.legion&&
    sameCharacter(x.name,m.name)
  )||null;
}

function memberRaid(m) {
  const item=getStatic(m);
  return item?item.raid:'';
}

function staticPicker(m) {
  const item=getStatic(m);
  const current=item?item.raid:'';
  const key=staticKey(m);
  const busy=!!S.staticBusy[key];

  const values=[
    {id:'',label:'Keine Static'}
  ].concat(raidDefs());

  return '<div class="static-value">'+

    (current
      ?'<button class="raid-link" '+
       'data-raid-filter="'+esc(current)+'">'+
       esc(raidLabel(current))+
       '</button>'
      :'')+

    '<select class="static-select" '+
      'data-static-legion="'+esc(m.legion)+'" '+
      'data-static-name="'+esc(m.name)+'" '+
      'aria-label="Static für '+esc(m.name)+'" '+
      (busy?'disabled':'')+
    '>'+

    values.map(r=>
      '<option value="'+esc(r.id)+'" '+
      (r.id===current?'selected':'')+'>'+
      esc(r.label)+
      '</option>'
    ).join('')+

    '</select>'+

    (busy
      ?'<span class="static-saving">Speichern …</span>'
      :'')+

    '</div>';
}

function staticTabs() {
  const counts={};

  raidDefs().forEach(r=>{
    counts[r.id]=0;
  });

  S.data.members.forEach(m=>{
    const r=memberRaid(m);

    if(
      Object.prototype.hasOwnProperty.call(
        counts,r
      )
    ){
      counts[r]++;
    }  });

  const all=[
    {id:'all',label:'Alle Statics'}
  ].concat(raidDefs());

  return all.map(r=>
    '<button class="static-tab '+
    (S.raid===r.id?'active':'')+
    '" data-raid-filter="'+esc(r.id)+'">'+
    esc(r.label)+
    '<span class="count">'+
    (r.id==='all'
      ?S.data.members.length
      :counts[r.id]||0)+
    '</span></button>'
  ).join('');
}

function drawStaticFilters() {
  const tabs=$('#staticTabs');
  if(tabs)tabs.innerHTML=staticTabs();

  const filters=$('#activeFilters');
  if(!filters)return;

  filters.innerHTML=
    (S.cls!=='all'
      ?'<button class="active-filter" data-class-clear>'+
       'Klasse: '+esc(S.cls)+' ×</button>'
      :'')+
    (S.raid!=='all'
      ?'<button class="active-filter" data-raid-filter="all">'+
       esc(raidLabel(S.raid))+' ×</button>'
      :'');
}

function saveStaticSelect(select) {
  if(!S.data)return;

  const m={
    legion:select.dataset.staticLegion,
    name:select.dataset.staticName
  };

  const key=staticKey(m);
  if(S.staticBusy[key])return;

  const original=getStatic(m);

  const previousRaid=original
    ?original.raid
    :'';

  const previousVersion=original
    ?original.version
    :0;

  const next=select.value;

  if(next===previousRaid)return;

  S.staticBusy[key]=true;
  select.disabled=true;

  /*
   * Nur dieselbe exakte Identität deaktivieren.
   * Nicht ähnlich geschriebene Charaktere.
   */

  $$('[data-static-name]').filter(x=>
    x.dataset.staticLegion===m.legion&&
    sameCharacter(x.dataset.staticName,m.name)
  ).forEach(x=>{
    x.disabled=true;
  });

  google.script.run
    .withSuccessHandler(items=>{
      delete S.staticBusy[key];

      S.data.statics=items;

      const saved=getStatic(m);

      if(next===''&&saved){
        toast(
          'Static konnte nicht entfernt werden. Bitte aktualisieren.'
        );
      }else{
        toast(
          next===''
            ?m.name+': Static entfernt'
            :m.name+': '+raidLabel(next)
        );
      }

      if(S.tab==='members'){
        drawMembersList();
      }
    })

    .withFailureHandler(err=>{
      delete S.staticBusy[key];

      toast(
        'Static-Änderung fehlgeschlagen: '+
        (err&&err.message
          ?err.message
          :'Unbekannter Fehler')
      );

      reloadData(true);
    })

    .saveHubStatic(
      m.legion,
      m.name,
      next,
      previousVersion
    );
}

/* =========================================================
   MITGLIEDERFILTER
   ========================================================= */

function filteredMembers() {
  const q=normalize(S.search.trim());

  return S.data.members
    .filter(m=>
      (S.cls==='all'||S.cls===m.cls)&&
      (S.raid==='all'||S.raid===memberRaid(m))&&
      (!q||normalize(m.name).includes(q))
    )
    .sort((a,b)=>{
      if(S.sort==='name'){
        return a.name.localeCompare(b.name,'de');
      }

      if(S.sort==='legion'){
        const g=a.legion.localeCompare(b.legion);
        if(g)return g;
      }

      const field=S.sort==='gs'?'gs':'cp';

      if(a[field]==null&&b[field]!=null)return 1;
      if(a[field]!=null&&b[field]==null)return -1;

      return ((b[field]||0)-(a[field]||0))||
        a.name.localeCompare(b.name,'de');
    });
}

function classButton(m) {
  return '<button class="class-link" '+
    'data-class-filter="'+esc(m.cls)+'">'+
    esc(m.cls)+'</button>';
}

/* =========================================================
   ABWESENHEITEN — NAMENSGENAU
   ========================================================= */

function today() {
  const d=new Date();

  return [
    d.getFullYear(),
    String(d.getMonth()+1).padStart(2,'0'),
    String(d.getDate()).padStart(2,'0')
  ].join('-');
}

function dateLabel(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value||'')
    ?value.slice(8,10)+'.'+
     value.slice(5,7)+'.'+
     value.slice(0,4)
    :esc(value||'—');
}

function absenceState(a) {
  const d=today();
  return a.to<d
    ?'past'
    :a.from>d?'future':'now';
}

function currentAbsences() {
  return (S.data.absences||[])
    .filter(a=>absenceState(a)==='now')
    .length;
}

function memberAbsences(m) {
  /*
   * Auch hier identitätsgenauer Vergleich.
   */

  return (S.data.absences||[])
    .filter(a=>
      a.legion===m.legion&&
      sameCharacter(a.name,m.name)&&
      absenceState(a)!=='past'
    )
    .sort((a,b)=>
      a.from.localeCompare(b.from)
    );
}

function absenceCell(m) {
  const records=memberAbsences(m);
  if(!records.length)return '—';

  return records.map(a=>{
    const current=absenceState(a)==='now';

    return '<div>'+
      '<span class="member-absence '+
      (current?'':'future')+'">'+
      (current?'Abwesend · bis ':'Geplant · ab ')+
      dateLabel(current?a.to:a.from)+
      '</span>'+
      (a.note
        ?'<span class="member-absence-text">'+
         esc(a.note)+'</span>'
        :'')+
      '</div>';
  }).join('');
}

function profileLinks(m) {
  const n=encodeURIComponent(m.name);

  return {
    k:'https://kisk.app/c/eu/lumiel/'+n,
    i:'https://aion2index.com/c/eu/lumiel/'+n
  };
}

/* =========================================================
   MITGLIEDERTABELLE
   ========================================================= */

function playerRow(m) {
  const l=profileLinks(m);

  const rowClass=m.rank&&m.rank<=3
    ?'row-top-'+m.rank
    :'';

  return '<tr class="'+rowClass+'">'+
    '<td><span class="name-rank">'+
      '<strong class="member-name">'+
      esc(m.name)+'</strong>'+
      rankBadge(m)+
      '</span></td>'+
    '<td>'+guildBadge(m.legion)+'</td>'+
    '<td>'+classButton(m)+'</td>'+
    '<td class="number">'+fmt(m.cp)+'</td>'+
    '<td class="number">'+fmt(m.gs)+'</td>'+
    '<td>'+staticPicker(m)+'</td>'+
    '<td>'+absenceCell(m)+'</td>'+
    '<td>'+
      link(l.k,'KISK ↗')+
      link(l.i,'INDEX ↗')+
    '</td>'+
    '<td>'+
      '<button class="copy" data-copy="'+
      esc('/w '+m.name)+'">/w</button>'+
      '<button class="copy" data-copy="'+
      esc('/invite '+m.name)+'">/invite</button>'+
    '</td>'+
    '</tr>';
}

function mobilePlayer(m) {
  const l=profileLinks(m);

  const topClass=m.rank&&m.rank<=3
    ?'mob-top-'+m.rank
    :'';

  return '<article class="mob-card '+topClass+'">'+
    '<div class="mob-head">'+
      '<span class="name-rank">'+
      '<strong>'+esc(m.name)+'</strong>'+
      rankBadge(m)+'</span>'+
      guildBadge(m.legion)+
    '</div>'+
    '<div class="mob-values">'+
      classButton(m)+
      '<span><b>'+fmt(m.cp)+'</b> CP</span>'+
      '<span><b>'+fmt(m.gs)+'</b> GS</span>'+
    '</div>'+
    '<div style="margin-top:9px">'+
      '<span class="static-label">STATIC</span>'+
      staticPicker(m)+
    '</div>'+
    (memberAbsences(m).length
      ?'<div class="mob-absence">'+
       absenceCell(m)+'</div>'
      :'')+
    '<div class="mob-actions">'+
      link(l.k,'KISK ↗')+
      link(l.i,'INDEX ↗')+
      '<button class="copy" data-copy="'+
      esc('/w '+m.name)+'">/w</button>'+
      '<button class="copy" data-copy="'+
      esc('/invite '+m.name)+'">/invite</button>'+
    '</div></article>';
}

function drawMembersList() {
  const data=filteredMembers();

  const pages=Math.max(
    1,Math.ceil(data.length/S.pageSize)
  );

  S.page=Math.max(1,Math.min(S.page,pages));

  const offset=(S.page-1)*S.pageSize;

  const entries=data.slice(
    offset,offset+S.pageSize
  );

  $('#result').innerHTML=entries.length
    ?'<div class="table-wrap">'+
      '<table class="member-table">'+
      '<thead><tr>'+
      '<th>SPIELER / RANG</th>'+
      '<th>LEGION</th>'+
      '<th>KLASSE</th>'+
      '<th>CP</th>'+
      '<th>GS</th>'+
      '<th>STATIC</th>'+
      '<th>ABWESENHEIT</th>'+
      '<th>PROFIL</th>'+
      '<th>INGAME</th>'+
      '</tr></thead>'+
      '<tbody>'+entries.map(playerRow).join('')+
      '</tbody></table></div>'+
      '<div class="mob-list">'+
      entries.map(mobilePlayer).join('')+
      '</div>'
    :'<div class="empty">'+
      'Keine passenden Mitglieder gefunden.'+
      '</div>';

  $('#pager').innerHTML=
    '<span>'+
      (data.length
        ?(offset+1)+'–'+
         Math.min(offset+S.pageSize,data.length)
        :'0')+
      ' von '+data.length+
    '</span>'+
    '<div class="pager-buttons">'+
      '<button data-page="prev" '+
      (S.page===1?'disabled':'')+
      '>Zurück</button>'+
      '<button data-page="next" '+
      (S.page===pages?'disabled':'')+
      '>Weiter</button>'+
    '</div>'+
    '<span>Seite '+S.page+' / '+pages+'</span>';

  drawStaticFilters();
}

function memberSubnav() {
  return '<nav class="member-subnav">'+
    '<button data-nav="members" class="'+
    (S.tab==='members'?'active':'')+
    '">Spielerliste &amp; Ranking</button>'+
    '<button data-nav="absences" class="'+
    (S.tab==='absences'?'active':'')+
    '">Abwesenheiten '+
    '<span class="sub-count">'+
    currentAbsences()+
    '</span></button>'+
    '</nav>';
}

function showMembers() {
  $('#main').innerHTML=
    pageTitle(
      'Mitglieder',
      'Charaktere, gemeinsames CP-Ranking, Statics & Abwesenheiten'
    )+
    memberSubnav()+
    metrics()+
    '<section class="panel">'+
      '<div class="toolbar">'+
        '<div class="field">'+
          '<label for="search">SPIELER SUCHEN</label>'+
          '<input class="control" id="search" type="search" '+
          'placeholder="Name oder Teilname …" '+
          'value="'+esc(S.search)+'">'+
        '</div>'+
        '<div class="field">'+
          '<label for="sort">SORTIERUNG</label>'+
          '<select class="control" id="sort">'+
            '<option value="cp">CP · höchste zuerst</option>'+
            '<option value="gs">GS · höchste zuerst</option>'+
            '<option value="name">Name · A–Z</option>'+
            '<option value="legion">Legion / CP</option>'+
          '</select>'+
        '</div>'+
      '</div>'+
      '<div class="static-tabs" id="staticTabs"></div>'+
      '<div class="static-filter-status" id="activeFilters"></div>'+
      '<div id="result"></div>'+
      '<div class="pager" id="pager"></div>'+
    '</section>';

  $('#sort').value=S.sort;
  drawMembersList();
}

/* =========================================================
   ÜBERSICHT
   ========================================================= */

function champion(m,rank) {
  const kind=rank===1?'first':
    rank===2?'second':'third';

  if(!m){
    return '<article class="champion '+kind+'">'+
      '<div class="place">RANK '+rank+'</div>'+
      '<div>Kein Eintrag</div></article>';
  }

  return '<article class="champion '+kind+'">'+
    '<div class="place">'+rankBadge(m)+'</div>'+
    '<div class="player">'+esc(m.name)+'</div>'+
    '<div class="details">'+
    esc(m.legion)+' · '+esc(m.cls)+'</div>'+
    '<div class="combat">'+fmt(m.cp)+
    '<span class="unit">CP</span></div>'+
    '</article>';
}

function showOverview() {
  const ranked=S.data.members
    .filter(m=>m.rank!=null)
    .slice()
    .sort((a,b)=>
      a.rank-b.rank||
      a.name.localeCompare(b.name,'de')
    );

  function legionTop(legion) {
    const list=S.data.members
      .filter(m=>
        m.legion===legion&&m.cp!=null
      )
      .slice()
      .sort((a,b)=>b.cp-a.cp)
      .slice(0,5);

    return '<section class="content-card">'+
      '<h3 style="color:'+
      (legion==='Dusk'?'var(--gold)':'var(--cyan)')+
      '">'+legion.toUpperCase()+' · TOP CP</h3>'+
      list.map(m=>
        '<div class="leader">'+
        '<span>'+rankBadge(m)+' '+
        esc(m.name)+' · '+esc(m.cls)+'</span>'+
        '<b>'+fmt(m.cp)+'</b>'+
        '</div>'
      ).join('')+
      '</section>';
  }

  $('#main').innerHTML=
    pageTitle(
      'Dusk & Dawn · Ranking',
      'Beide Legionen gemeinsam nach Combat Power bewertet'
    )+
    metrics()+
    '<div class="section-heading"><div>'+
      '<h2>Hall of Fame · Top 3</h2>'+
      '<p>Die stärksten Charaktere aus Dusk und Dawn</p>'+
    '</div></div>'+
    '<div class="top-three">'+
      champion(ranked.find(m=>m.rank===1),1)+
      champion(ranked.find(m=>m.rank===2),2)+
      champion(ranked.find(m=>m.rank===3),3)+
    '</div>'+
    '<div class="overview-grid">'+
      legionTop('Dusk')+
      legionTop('Dawn')+
    '</div>'+
    '<div class="overview-grid">'+
      '<section class="content-card">'+
        '<h3>SCHNELLZUGRIFF</h3>'+
        '<div class="info-list">'+
          '<button data-nav="members">'+
          'Mitglieder, Rankings & Abwesenheiten '+
          '<span>'+currentAbsences()+
          ' aktuell</span></button>'+
          '<button data-nav="helper">'+
          'Aion Helper · Arcana & Daevanion ↗'+
          '</button>'+
        '</div>'+
      '</section>'+
      '<section class="content-card">'+
        '<h3>AKTUALISIERUNG</h3>'+
        '<p style="font-size:12px;color:var(--muted)">'+
        'Die Rangliste verwendet die vorhandenen '+
        'CP-Werte aus der Google-Tabelle.</p>'+
        '<p>Tabellenwerte geladen: '+
        esc(new Date(S.data.loadedAt).toLocaleString('de-DE'))+
        '</p>'+
      '</section>'+
    '</div>';
}

/* =========================================================
   AION HELPER
   ========================================================= */

function showHelper() {
  const url=S.data.links.arcanaPlanner;

  $('#main').innerHTML=
    pageTitle(
      'Aion Helper',
      'Externe AION-Tools mit deutschen Anleitungen'
    )+
    '<section class="helper-intro">'+
      '<div>'+
        '<div class="kicker">EXTERNES COMMUNITY-TOOL</div>'+
        '<h3>Arcana &amp; Daevanion Planner</h3>'+
        '<p>Plane Arcana-Karten, Skill-Level und '+
        'Daevanion-Kristalle. Die externe Seite bietet '+
        'Empfehlungen anhand öffentlich sichtbarer '+
        'Charakterdaten.</p>'+
        '<div class="helper-benefits">'+
          '<span>Skill-Level planen</span>'+
          '<span>Karten-Rolls vermeiden</span>'+
          '<span>Daevanion optimieren</span>'+
        '</div>'+
      '</div>'+
      link(url,'Arcana Planner öffnen ↗','helper-go')+
    '</section>'+
    '<div class="helper-how">'+
      '<section class="helper-section">'+
        '<h3>1 · Arcana-Karten optimieren</h3>'+
        '<p>So verwendest du den externen Planner:</p>'+
        '<ol class="helper-steps">'+
          '<li><div><strong>Charakter laden:</strong> '+
          'Europe auswählen, Namen suchen, Server Lumiel wählen.'+
          '</div></li>'+
          '<li><div><strong>Ziel-Skills wählen:</strong> '+
          'Im Arcana-Reiter die gewünschten Skill-Level auswählen.'+
          '</div></li>'+
          '<li><div><strong>Empfehlung lesen:</strong> '+
          'Keep = behalten, Enhance = verbessern, '+
          'Replace = ersetzen.</div></li>'+
          '<li><div><strong>Alternativen prüfen:</strong> '+
          'Skill-Level über Waffe, Ringe und Guard vergleichen.'+
          '</div></li>'+
        '</ol>'+
      '</section>'+
      '<section class="helper-section">'+
        '<h3>2 · Daevanion planen</h3>'+
        '<p>Kristalle und Knoten vorher durchrechnen:</p>'+
        '<ol class="helper-steps">'+
          '<li><div><strong>Daevanion öffnen:</strong> '+
          'Im externen Tool den Daevanion-Reiter auswählen.'+
          '</div></li>'+
          '<li><div><strong>Ziele festlegen:</strong> '+
          'Wichtige Skills und gewünschte Boni priorisieren.'+
          '</div></li>'+
          '<li><div><strong>Kristalle eingeben:</strong> '+
          'Verfügbare Kristalle aus dem Spiel eintragen.'+
          '</div></li>'+
          '<li><div><strong>Plan prüfen:</strong> '+
          'Empfohlene Knoten und mögliche Rücksetzungen vergleichen.'+
          '</div></li>'+
        '</ol>'+
      '</section>'+
    '</div>'+
    '<div class="helper-note">'+
      '<strong>Hinweis:</strong> Das externe Tool '+
      'liefert Planungshilfen, aber keinen garantierten '+
      'DPS- oder CP-Gewinn.'+
    '</div>'+
    '<div class="helper-links">'+
      link(url,'Planner jetzt öffnen ↗','helper-go')+
    '</div>';
}

/* =========================================================
   DATEIEN UND LINKS
   ========================================================= */

function showFiles() {
  const d=S.data;

  $('#main').innerHTML=
    pageTitle(
      'Dateien & Links',
      'Orga-Bereich · Downloads und Community-Grafiken'
    )+
    '<div class="file-group-title">'+
    'TECHNIK &amp; TOOLS</div>'+
    '<div class="downloads">'+

      '<section class="content-card">'+
        '<h3>Voice Changer</h3>'+
        '<p>Live-Effekte und deutsche KI-Stimmen für Discord.</p>'+
        '<div class="actions">'+
          link(d.links.voiceChanger,
            'Voice Changer öffnen ↗','action primary')+
          link(d.links.vbCableDownload,
            'VB-CABLE ↓','action')+
        '</div>'+
      '</section>'+

      '<section class="content-card">'+
        '<h3>Voice Bridge</h3>'+
        '<p>Discord-Sender und Relay-Paket für Windows.</p>'+
        '<div class="actions">'+
          link(d.links.sender,
            'Sender herunterladen ↓','action primary')+
          link(d.links.package,
            'Gesamtpaket ↓','action')+
        '</div>'+
      '</section>'+

      '<section class="content-card">'+
        '<h3>VB-CABLE</h3>'+
        '<p>Virtueller Audiotreiber für Windows.</p>'+
        '<div class="actions">'+
          link(d.links.vbCableDownload,
            'Treiber ↓','action primary')+
          link(d.links.vbCableOfficial,
            'Hersteller ↗','action')+
        '</div>'+
      '</section>'+

    '</div>'+
    '<details class="files-fold">'+
      '<summary>COMMUNITY-GRAFIKEN &amp; DISCORD-ICONS · '+
      d.assets.length+' DATEIEN</summary>'+
      '<div class="file-grid">'+
      d.assets.map(x=>
        '<article class="file">'+
          '<div class="file-preview">'+
            '<span>VORSCHAU WIRD GELADEN</span>'+
            '<img data-asset="'+esc(x.key)+
            '" alt="'+esc(x.label)+'">'+
          '</div>'+
          '<div class="file-body">'+
            '<h3>'+esc(x.label)+'</h3>'+
            '<p>'+esc(x.filename)+'</p>'+
            '<div class="actions">'+
              link(x.open,'Original ansehen ↗','action')+
              link(x.download,'Download ↓','action primary')+
            '</div>'+
          '</div>'+
        '</article>'
      ).join('')+
      '</div>'+
    '</details>'+
    '<div class="notice">'+
      'Downloads funktionieren nur bei entsprechend '+
      'freigegebenen Google-Drive-Dateien.'+
    '</div>';

  const fold=$('.files-fold');

  if(fold){
    fold.addEventListener('toggle',()=>{
      if(fold.open){
        d.assets.forEach(x=>loadImage(x.key));
      }
    });
  }
}

/* =========================================================
   ABWESENHEITEN VERWALTEN
   ========================================================= */

function absenceMemberValue(m) {
  return encodeURIComponent(m.legion)+
    '|'+encodeURIComponent(m.name);
}

function parseAbsenceMember(value) {
  const p=String(value||'').split('|');

  if(p.length!==2)return null;

  try{
    return {
      legion:decodeURIComponent(p[0]),
      name:decodeURIComponent(p[1])
    };
  }catch(_){
    return null;
  }
}

function showAbsences() {
  const seen=new Set();

  const options=S.data.members
    .filter(m=>{
      const key=staticKey(m);
      if(seen.has(key))return false;
      seen.add(key);
      return true;
    })
    .sort((a,b)=>
      a.name.localeCompare(b.name,'de')
    );

  $('#main').innerHTML=
    pageTitle(
      'Mitglieder · Abwesenheiten',
      'Gemeinsame Planung für Dusk und Dawn'
    )+
    memberSubnav()+
    '<section class="panel">'+
      '<div class="abs-header"><div>'+
        '<h3 id="absenceFormTitle">Abwesenheit eintragen</h3>'+
        '<p class="abs-help">Charakter und Zeitraum auswählen.</p>'+
      '</div></div>'+
      '<form id="absenceForm" class="abs-form">'+

        '<div class="field span-2">'+
          '<label for="absenceName">CHARAKTERNAME</label>'+
          '<select id="absenceName" class="control" required>'+
            '<option value="">Charakter auswählen …</option>'+
            options.map(m=>
              '<option value="'+
              esc(absenceMemberValue(m))+'">'+
              esc(m.name)+' · '+esc(m.legion)+
              '</option>'
            ).join('')+
          '</select>'+
        '</div>'+

        '<div class="field">'+
          '<label for="absenceFrom">VON</label>'+
          '<input id="absenceFrom" class="control" '+
          'type="date" required>'+
        '</div>'+

        '<div class="field">'+
          '<label for="absenceTo">BIS</label>'+
          '<input id="absenceTo" class="control" '+
          'type="date" required>'+
        '</div>'+

        '<div class="field span-all">'+
          '<label for="absenceNote">NOTIZ</label>'+
          '<textarea id="absenceNote" class="control" '+
          'maxlength="450"></textarea>'+
        '</div>'+

        '<div class="span-all abs-toolbar">'+
          '<button id="absenceSave" class="action primary" '+
          'type="submit">Abwesenheit speichern</button>'+
          '<button id="absenceCancel" class="action" '+
          'type="button" hidden>Bearbeiten abbrechen</button>'+
          '<span id="absenceError" class="abs-error"></span>'+
        '</div>'+

      '</form>'+
    '</section>'+
    '<p class="muted-note">'+
      'Die Abwesenheitsliste ist für alle Hub-Besucher bearbeitbar.'+
    '</p>'+
    '<section class="panel" style="margin-top:18px">'+
      '<div class="abs-header"><div>'+
        '<h3>Abwesenheitsübersicht</h3>'+
        '<p class="abs-help" id="absTotal"></p>'+
      '</div></div>'+
      '<div class="abs-options">'+
        '<div class="field">'+
          '<label for="absSearch">SUCHE</label>'+
          '<input id="absSearch" class="control" '+
          'type="search" placeholder="Charakter oder Notiz" '+
          'value="'+esc(S.absenceSearch)+'">'+
        '</div>'+
        '<div class="field">'+
          '<label for="absFilter">LEGION</label>'+
          '<select id="absFilter" class="control">'+
            '<option value="all">Alle Legionen</option>'+
            '<option value="Dusk">Dusk</option>'+
            '<option value="Dawn">Dawn</option>'+
          '</select>'+
        '</div>'+
        '<label class="abs-check">'+
          '<input type="checkbox" id="absHistory" '+
          (S.absenceHistory?'checked':'')+
          '> Vergangene anzeigen</label>'+
      '</div>'+
    '</section>'+
    '<div id="absList" class="abs-list"></div>';

  $('#absFilter').value=S.absenceLegion;
  $('#absenceFrom').value=today();
  $('#absenceTo').value=today();

  if(S.absenceEditId){
    const item=(S.data.absences||[])
      .find(x=>x.id===S.absenceEditId);

    if(item)fillAbsenceForm(item);
    else resetAbsenceForm();
  }

  drawAbsences();
}

function fillAbsenceForm(a) {
  S.absenceEditId=a.id;
  S.absenceVersion=a.version;
  S.absenceDirty=true;

  $('#absenceName').value=absenceMemberValue(a);
  $('#absenceFrom').value=a.from;
  $('#absenceTo').value=a.to;
  $('#absenceNote').value=a.note;

  $('#absenceFormTitle').textContent=
    'Abwesenheit bearbeiten';
  $('#absenceSave').textContent=
    'Änderungen speichern';
  $('#absenceCancel').hidden=false;
}

function resetAbsenceForm() {
  S.absenceEditId=null;
  S.absenceVersion=null;
  S.absenceDirty=false;

  const form=$('#absenceForm');
  if(!form)return;

  form.reset();
  $('#absenceFrom').value=today();
  $('#absenceTo').value=today();
  $('#absenceFormTitle').textContent=
    'Abwesenheit eintragen';
  $('#absenceSave').textContent=
    'Abwesenheit speichern';
  $('#absenceCancel').hidden=true;
  $('#absenceError').textContent='';
}

function drawAbsences() {
  const el=$('#absList');
  if(!el)return;

  const all=S.data.absences||[];
  const q=normalize(S.absenceSearch);

  const items=all
    .filter(a=>
      (S.absenceHistory||absenceState(a)!=='past')&&
      (S.absenceLegion==='all'||
        a.legion===S.absenceLegion)&&
      (!q||
        normalize(a.name).includes(q)||
        normalize(a.note).includes(q))
    )
    .sort((a,b)=>{
      const priority={now:0,future:1,past:2};

      return priority[absenceState(a)]-
        priority[absenceState(b)]||
        a.from.localeCompare(b.from)||
        a.name.localeCompare(b.name,'de');
    });

  $('#absTotal').textContent=
    currentAbsences()+' aktuell abwesend · '+
    all.length+' Einträge';

  if(!items.length){
    el.innerHTML=
      '<div class="abs-empty">Keine passenden Einträge.</div>';
    return;
  }

  const labels={
    now:'AKTUELL ABWESEND',
    future:'GEPLANT',
    past:'ABGELAUFEN'
  };

  el.innerHTML=items.map(a=>{
    const state=absenceState(a);
    const d=new Date(a.updatedAt);

    const stamp=Number.isNaN(d.getTime())
      ?'—'
      :d.toLocaleString('de-DE');

    return '<article class="abs-card '+
      (state==='past'?'abs-past':'')+'">'+
      '<div class="abs-card-head">'+
        '<strong>'+esc(a.name)+'</strong>'+
        guildBadge(a.legion)+
        '<span class="abs-state '+state+'">'+
        labels[state]+'</span>'+
      '</div>'+
      '<div class="abs-period">'+
        dateLabel(a.from)+' – '+dateLabel(a.to)+
      '</div>'+
      '<div class="abs-note">'+
        esc(a.note||'Keine zusätzliche Notiz')+
      '</div>'+
      '<div class="abs-card-foot">'+
        '<span class="abs-updated">Bearbeitet: '+
        esc(stamp)+'</span>'+
        '<div class="actions">'+
          '<button class="copy" data-abs-edit="'+
          esc(a.id)+'">Bearbeiten</button>'+
          '<button class="copy" data-abs-delete="'+
          esc(a.id)+'">Löschen</button>'+
        '</div>'+
      '</div>'+
    '</article>';
  }).join('');
}

function saveAbsence() {
  if(S.absenceSaving)return;

  const member=parseAbsenceMember(
    $('#absenceName').value
  );

  const from=$('#absenceFrom').value;
  const to=$('#absenceTo').value;

  if(!member||!from||!to){
    $('#absenceError').textContent=
      'Bitte Charakter und Zeitraum auswählen.';
    return;
  }

  if(to<from){
    $('#absenceError').textContent=
      'Enddatum darf nicht vor dem Beginn liegen.';
    return;
  }

  S.absenceSaving=true;
  $('#absenceSave').disabled=true;
  $('#absenceError').textContent='Speichern …';

  const payload={
    id:S.absenceEditId,
    version:S.absenceVersion,
    legion:member.legion,
    name:member.name,
    from:from,
    to:to,
    note:$('#absenceNote').value
  };

  google.script.run
    .withSuccessHandler(items=>{
      S.absenceSaving=false;
      S.data.absences=items;

      if(S.tab==='absences'){
        resetAbsenceForm();
        $('#absenceSave').disabled=false;
        drawAbsences();
      }

      toast('Abwesenheit gespeichert');
    })
    .withFailureHandler(err=>{
      S.absenceSaving=false;

      if(S.tab==='absences'){
        $('#absenceSave').disabled=false;
        $('#absenceError').textContent=
          err&&err.message||
          'Speichern fehlgeschlagen.';
      }else{
        toast('Speichern fehlgeschlagen');      }
    })
    .saveHubAbsence(payload);
}

function deleteAbsence(id) {
  const a=(S.data.absences||[])
    .find(x=>x.id===id);

  if(!a||S.absenceSaving)return;

  if(!confirm(
    'Abwesenheit von '+a.name+
    ' wirklich löschen?'
  ))return;

  S.absenceSaving=true;

  google.script.run
    .withSuccessHandler(items=>{
      S.absenceSaving=false;
      S.data.absences=items;

      if(S.absenceEditId===id){
        resetAbsenceForm();
      }

      if(S.tab==='absences'){
        drawAbsences();
      }

      toast('Eintrag gelöscht');
    })
    .withFailureHandler(err=>{
      S.absenceSaving=false;
      toast(err&&err.message||'Löschen fehlgeschlagen');
    })
    .deleteHubAbsence(id,a.version);
}

/* =========================================================
   BILDCACHE
   ========================================================= */

let imageDbPromise=null;

function imageDb() {
  if(imageDbPromise)return imageDbPromise;

  if(!window.indexedDB){
    return Promise.reject(
      Error('IndexedDB nicht verfügbar')
    );
  }

  imageDbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open(
      'dusk-dawn-hub-images-v1',1
    );

    req.onupgradeneeded=()=>{
      if(!req.result.objectStoreNames.contains('images')){
        req.result.createObjectStore('images');
      }
    };

    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
    req.onblocked=()=>reject(Error('Cache blockiert'));
  });

  return imageDbPromise;
}

async function cachedImage(key) {
  try{
    const db=await imageDb();

    return await new Promise(resolve=>{
      const req=db.transaction(
        'images','readonly'
      ).objectStore('images').get(key);

      req.onsuccess=()=>resolve(req.result||null);
      req.onerror=()=>resolve(null);
    });
  }catch(_){
    return null;
  }
}

async function storeImage(key,dataUrl) {
  try{
    const db=await imageDb();

    await new Promise(resolve=>{
      const tx=db.transaction(
        'images','readwrite'
      );

      tx.objectStore('images').put({
        dataUrl:dataUrl,
        savedAt:Date.now()
      },key);

      tx.oncomplete=resolve;
      tx.onerror=resolve;
      tx.onabort=resolve;
    });
  }catch(_){}
}

function applyImages() {
  Object.keys(S.images).forEach(key=>{
    $$('img[data-asset="'+key+'"]').forEach(img=>{
      if(img.getAttribute('src')!==S.images[key]){
        img.src=S.images[key];
      }

      img.style.display='block';

      if(key==='logo'&&$('#logoFallback')){
        $('#logoFallback').style.display='none';
      }

      const preview=img.closest('.file-preview');

      if(preview){
        const span=preview.querySelector('span');
        if(span)span.style.display='none';
      }
    });
  });
}

function fetchImage(key) {
  google.script.run
    .withSuccessHandler(result=>{
      S.loading[key]=false;
      S.images[key]=result.dataUrl;

      applyImages();

      if(key==='logo'||key==='banner'){
        storeImage(key,result.dataUrl);
      }
    })
    .withFailureHandler(err=>{
      S.loading[key]=false;
      console.warn(
        'Bild konnte nicht geladen werden',
        err
      );
    })
    .getHubImage(key);
}

function loadImage(key) {
  if(S.images[key]){
    applyImages();
    return;
  }

  if(S.loading[key])return;
  S.loading[key]=true;

  if(
    !window.google||
    !google.script||
    !google.script.run
  ){
    S.loading[key]=false;
    return;
  }

  if(key!=='logo'&&key!=='banner'){
    fetchImage(key);
    return;
  }

  cachedImage(key).then(record=>{
    if(
      record&&
      record.dataUrl&&
      Date.now()-Number(record.savedAt||0)<
        7*86400000
    ){
      S.images[key]=record.dataUrl;
      S.loading[key]=false;
      applyImages();
    }else{
      fetchImage(key);
    }
  }).catch(()=>fetchImage(key));
}

/* =========================================================
   NAVIGATION UND DATEN
   ========================================================= */

function render() {
  if(!S.data)return;

  $$('[data-nav]').forEach(el=>{
    if(el.tagName!=='BUTTON')return;

    const active=
      el.dataset.nav===S.tab||
      (
        el.dataset.nav==='members'&&
        S.tab==='absences'&&
        !el.closest('.member-subnav')
      );

    el.classList.toggle('active',active);
  });

  document.body.classList.toggle(
    'inner-page',
    !['overview','members','absences'].includes(S.tab)
  );

  if(S.tab==='overview')showOverview();
  else if(S.tab==='members')showMembers();
  else if(S.tab==='absences')showAbsences();
  else if(S.tab==='helper')showHelper();
  else showFiles();

  applyImages();
}

function navigate(tab) {
  if(![
    'overview',
    'members',
    'absences',
    'helper',
    'files'
  ].includes(tab))return;

  if(
    S.tab==='absences'&&
    tab!=='absences'&&
    S.absenceDirty&&
    !confirm('Ungespeicherte Änderungen verwerfen?')
  ){
    return;
  }

  S.tab=tab;
  S.page=1;
  S.absenceEditId=null;
  S.absenceVersion=null;
  S.absenceDirty=false;

  render();

  window.scrollTo({
    top:0,
    behavior:'smooth'
  });
}

function reloadData(silent) {
  if(
    !window.google||
    !google.script||
    !google.script.run
  ){
    $('#main').innerHTML=
      '<div class="empty">'+
      'Bitte die veröffentlichte Web-App öffnen.'+
      '</div>';
    return;
  }

  if(!silent&&!S.absenceDirty){
    $('#main').innerHTML=
      '<div class="loading">'+
      '<div class="loader"></div>'+
      'Mitglieder werden geladen …'+
      '</div>';
  }

  google.script.run
    .withSuccessHandler(data=>{
      S.data=data;
      assignRanks(S.data.members);

      const inputActive=
        silent&&
        document.activeElement&&
        document.activeElement.closest('#main')&&
        ['INPUT','SELECT','TEXTAREA'].includes(
          document.activeElement.tagName
        );

      if(
        S.tab==='absences'&&
        S.absenceDirty
      ){
        drawAbsences();
      }else if(!inputActive){
        render();
      }

      $('#lastRead').textContent=
        'Tabellendaten: '+
        new Date(
          data.loadedAt
        ).toLocaleString('de-DE');

      loadImage('banner');
      loadImage('logo');
    })
    .withFailureHandler(err=>{
      if(!silent){
        $('#main').innerHTML=
          '<div class="empty">'+
          'Daten konnten nicht geladen werden: '+
          esc(
            err&&err.message||
            'Unbekannter Fehler'
          )+
          '</div>';
      }else{
        toast('Aktualisierung fehlgeschlagen');
      }
    })
    .getHubData();
}

/* =========================================================
   BESUCHERZÄHLER
   ========================================================= */

function visitorToken() {
  try{
    const key='dusk_dawn_hub_visitor_id_v1';
    let id=localStorage.getItem(key);

    if(/^[a-f0-9]{32}$/.test(id||'')){
      return id;
    }

    if(!window.crypto||!crypto.getRandomValues){
      return null;
    }

    const bytes=new Uint8Array(16);
    crypto.getRandomValues(bytes);

    id=Array.from(
      bytes,
      n=>n.toString(16).padStart(2,'0')
    ).join('');

    localStorage.setItem(key,id);

    return id;
  }catch(_){
    return null;
  }
}

function recordVisit() {
  if(
    !window.google||
    !google.script||
    !google.script.run
  ){
    return;
  }

  google.script.run
    .withSuccessHandler(stats=>{
      $('#visitorStats').textContent=
        'Seitenaufrufe '+fmt(stats.total)+
        ' · Verschiedene Browser '+
        fmt(stats.unique);
    })
    .withFailureHandler(err=>console.warn(err))
    .registerHubVisit(visitorToken());
}

/* =========================================================
   KOPIERFUNKTION
   ========================================================= */

async function copyText(value) {
  try{
    await navigator.clipboard.writeText(value);
  }catch(_){
    const el=document.createElement('textarea');

    el.value=value;
    el.style.cssText='position:fixed;opacity:0';

    document.body.appendChild(el);
    el.select();

    const ok=document.execCommand('copy');
    el.remove();

    if(!ok){
      toast('Kopieren fehlgeschlagen');
      return;
    }
  }

  toast(value+' kopiert');
}

/* =========================================================
   EVENTS
   ========================================================= */

document.addEventListener('click',event=>{
  const target=event.target;

  const nav=target.closest('[data-nav]');

  if(nav){
    event.preventDefault();
    navigate(nav.dataset.nav);
    return;
  }

  const cls=target.closest('[data-class-filter]');

  if(cls){
    S.cls=S.cls===cls.dataset.classFilter
      ?'all'
      :cls.dataset.classFilter;

    S.raid='all';
    S.page=1;
    drawMembersList();
    return;
  }

  if(target.closest('[data-class-clear]')){
    S.cls='all';
    S.page=1;
    drawMembersList();
    return;
  }

  const raid=target.closest('[data-raid-filter]');

  if(raid){
    const value=raid.dataset.raidFilter;

    S.raid=S.raid===value&&value!=='all'
      ?'all'
      :value;

    S.cls='all';
    S.page=1;
    drawMembersList();
    return;
  }

  const copy=target.closest('[data-copy]');

  if(copy){
    copyText(copy.dataset.copy);
    return;
  }

  const edit=target.closest('[data-abs-edit]');

  if(edit){
    const item=(S.data.absences||[])
      .find(x=>x.id===edit.dataset.absEdit);

    if(item){
      fillAbsenceForm(item);

      $('#absenceForm').scrollIntoView({
        behavior:'smooth',
        block:'center'
      });
    }
    return;
  }

  const remove=target.closest('[data-abs-delete]');

  if(remove){
    deleteAbsence(remove.dataset.absDelete);
    return;
  }

  if(target.closest('#absenceCancel')){
    resetAbsenceForm();
    return;
  }

  const page=target.closest('[data-page]');

  if(page){
    S.page+=page.dataset.page==='next'?1:-1;
    drawMembersList();
    return;
  }

  if(target.closest('#reload')){
    reloadData(false);
  }
});

document.addEventListener('input',event=>{
  const el=event.target;

  if(el.id==='search'){
    S.search=el.value;
    S.page=1;
    drawMembersList();

  }else if(el.id==='absSearch'){
    S.absenceSearch=el.value;
    drawAbsences();

  }else if(el.closest('#absenceForm')){
    S.absenceDirty=true;
  }
});

document.addEventListener('change',event=>{
  const el=event.target;

  if(el.matches('[data-static-name]')){
    saveStaticSelect(el);
    return;
  }

  if(el.id==='sort'){
    S.sort=el.value;
    S.page=1;
    drawMembersList();

  }else if(el.id==='absFilter'){
    S.absenceLegion=el.value;
    drawAbsences();

  }else if(el.id==='absHistory'){
    S.absenceHistory=el.checked;
    drawAbsences();

  }else if(el.closest('#absenceForm')){
    S.absenceDirty=true;
  }
});

document.addEventListener('submit',event=>{
  if(event.target.id!=='absenceForm')return;
  event.preventDefault();
  saveAbsence();
});

/* =========================================================
   START
   ========================================================= */

loadImage('banner');
loadImage('logo');

recordVisit();
reloadData(false);

setInterval(()=>{
  if(S.data&&!document.hidden){
    reloadData(true);
  }
},15*60*1000);

</script>
</body>
</html>`;

/* =========================================================
   OPTIONALER CP-/GS-PROFILABGLEICH
   ========================================================= */

const DD_PROFILE_SYNC=Object.freeze({
  sheetId:HUB.sheetId,
  stateKey:'dd_profile_sync_v1',
  batchSize:18,
  search:'https://api-search.plaync.com/aion2global/search/v2/character',
  info:'https://aion2.plaync.com/api/character/info'
});

function ddProfileKey_(legion,name) {
  return String(legion)+'\u0000'+
    String(name)
      .trim()
      .normalize('NFC')
      .toLocaleLowerCase('de');
}

function ddProfileClean_(value) {
  return String(value==null?'':value)
    .replace(/<[^>]*>/g,'')
    .replace(/&amp;/gi,'&')
    .replace(/&lt;/gi,'<')
    .replace(/&gt;/gi,'>')
    .replace(/&quot;/gi,'"')
    .replace(/&#39;/g,"'")
    .trim()
    .normalize('NFC');
}

function ddProfileNumber_(value,min,max) {
  const text=String(
    value==null?'':value
  ).trim();

  if(!/^\d[\d., ]*$/.test(text))return null;

  const num=Number(
    text.replace(/[., ]/g,'')
  );

  return Number.isSafeInteger(num)&&
    num>=min&&num<=max
      ?num
      :null;
}

function ddProfileJson_(url) {
  const response=UrlFetchApp.fetch(url,{
    muteHttpExceptions:true,
    followRedirects:false,
    headers:{
      Accept:'application/json',
      'User-Agent':'DuskDawnCommunityHub/1.0'
    }
  });

  const status=response.getResponseCode();

  if(status!==200){
    throw new Error('HTTP '+status);
  }

  try{
    return JSON.parse(
      response.getContentText('UTF-8')
    );
  }catch(_){
    throw new Error(
      'Unerwartete Antwort (kein JSON)'
    );
  }
}

function ddProfileLookup_(name,savedClass) {
  const searchUrl=DD_PROFILE_SYNC.search+
    '?keyword='+encodeURIComponent(name)+
    '&region=eu&localeInfo=en-US';

  const search=ddProfileJson_(searchUrl);

  if(!Array.isArray(search.list)){
    throw new Error('Unerwartetes Suchformat');
  }

  const hits=search.list.filter(c=>
    ddProfileKey_('',ddProfileClean_(c.name))===
      ddProfileKey_('',name)&&
    String(c.serverName||'')
      .trim()
      .toLocaleLowerCase('de')==='lumiel'&&
    String(c.region||'eu').toLowerCase()==='eu'
  );

  if(hits.length!==1){
    return {
      reason:hits.length===0
        ?'Kein eindeutiger EU/Lumiel-Treffer'
        :'Mehrdeutiger Charaktername'
    };
  }

  const hit=hits[0];

  if(!hit.characterId||!hit.serverId){
    return {
      reason:'Suchtreffer ohne Character-ID/Server-ID'
    };
  }

  let characterId=String(hit.characterId);

  try{
    characterId=decodeURIComponent(characterId);
  }catch(_){}

  const infoUrl=DD_PROFILE_SYNC.info+
    '?region=eu&lang=en-US'+
    '&characterId='+encodeURIComponent(characterId)+
    '&serverId='+encodeURIComponent(String(hit.serverId));

  const info=ddProfileJson_(infoUrl);
  const profile=info&&info.profile;

  if(!profile){
    return {reason:'Profilantwort ohne Charakterdaten'};
  }

  if(
    ddProfileKey_(
      '',
      ddProfileClean_(profile.characterName)
    )!==ddProfileKey_('',name)
  ){
    return {reason:'Profilname stimmt nicht überein'};
  }

  if(
    profile.serverName&&
    String(profile.serverName)
      .trim()
      .toLocaleLowerCase('de')!=='lumiel'
  ){
    return {reason:'Profil gehört zu anderem Server'};
  }

  if(
    profile.serverId&&
    String(profile.serverId)!==String(hit.serverId)
  ){
    return {reason:'Server-ID stimmt nicht überein'};
  }

  if(
    savedClass&&
    savedClass!=='Unbekannt'&&
    profile.className
  ){
    const normalClass=x=>
      String(x)
        .replace(/\s+/g,'')
        .toLocaleLowerCase('de');

    if(
      normalClass(savedClass)!==
      normalClass(profile.className)
    ){
      return {reason:'Klasse stimmt nicht überein'};
    }
  }

  const cp=ddProfileNumber_(
    profile.combatPower,1000,9999999
  );

  const statList=info.stat&&info.stat.statList;

  const itemStat=Array.isArray(statList)
    ?statList.find(x=>x.type==='ItemLevel')
    :null;

  const gs=itemStat
    ?ddProfileNumber_(itemStat.value,100,99999)
    :null;

  if(cp===null&&gs===null){
    return {
      reason:'CP und Itemlevel fehlen auch im Profil'
    };
  }

  return {cp,gs};
}

function ddProfileFill_(ss,candidate,profile) {
  const sh=ss.getSheetByName(candidate.legion);

  if(!sh){
    throw new Error(
      'Tabellenblatt fehlt: '+candidate.legion
    );
  }

  if(sh.getLastRow()<2)return 0;

  const names=sh.getRange(
    2,2,sh.getLastRow()-1,1
  ).getDisplayValues();

  const matches=[];

  names.forEach((r,i)=>{
    if(
      ddProfileKey_('',r[0])===
      ddProfileKey_('',candidate.name)
    ){
      matches.push(i+2);
    }
  });

  if(matches.length!==1)return 0;

  const row=matches[0];

  const original=sh.getRange(
    row,4,1,5
  ).getValues()[0];

  const next=original.slice();
  let filled=0;

  if(
    (original[0]===''||original[0]===null)&&
    profile.cp!==null
  ){
    next[0]=profile.cp;
    filled++;
  }

  if(
    (original[1]===''||original[1]===null)&&
    profile.gs!==null
  ){
    next[1]=profile.gs;
    filled++;
  }

  if(filled){
    const provenance=String(original[2]||'');

    const note=
      'NCSOFT-Profilwerte (Mitgliedschaft nicht neu bestätigt)';

    next[2]=provenance.includes(note)
      ?provenance
      :(provenance?provenance+' | ':'')+note;

    next[3]=Utilities.formatDate(
      new Date(),
      'Europe/Berlin',
      'dd.MM.yyyy HH:mm'
    )+' Europe/Berlin';

    sh.getRange(
      row,4,1,5
    ).setValues([next]);
  }

  return filled;
}

function ddProfileCandidates_() {
  const ss=SpreadsheetApp.openById(
    DD_PROFILE_SYNC.sheetId
  );

  const candidates=[];

  for(const legion of ['Dusk','Dawn']){
    const sh=ss.getSheetByName(legion);

    if(!sh){
      throw new Error('Tabellenblatt fehlt: '+legion);
    }

    if(sh.getLastRow()<2)continue;

    const rows=sh.getRange(
      2,1,sh.getLastRow()-1,8
    ).getDisplayValues();

    for(const r of rows){
      const name=String(r[1]||'').trim();

      if(name&&(!r[3]||!r[4])){
        candidates.push({
          legion:legion,
          name:name,
          cls:String(r[2]||'')
        });
      }
    }
  }

  return {ss,candidates};
}

function ddProfileRemoveTriggers_() {
  ScriptApp.getProjectTriggers().forEach(t=>{
    if(
      t.getHandlerFunction()==='runMemberProfileSyncBatch'
    ){
      ScriptApp.deleteTrigger(t);
    }
  });
}

function ddProfileLog_(message,state) {
  const ss=SpreadsheetApp.openById(
    DD_PROFILE_SYNC.sheetId
  );

  const log=ss.getSheetByName('Auto-Log');

  if(log){
    log.appendRow([
      Utilities.formatDate(
        new Date(),
        'Europe/Berlin',
        'dd.MM.yyyy HH:mm'
      ),
      'Dusk + Dawn',
      'NCSOFT-PROFILABGLEICH',
      (state.updated||0)+
        ' Werte ergänzt / '+
        Object.keys(state.done||{}).length+
        ' Profile geprüft',
      message
    ]);
  }

  Logger.log(message);
}

function testMemberProfileApi() {
  const result=ddProfileLookup_(
    'Devox','Cleric'
  );

  Logger.log(JSON.stringify(result));
  return result;
}

function startMemberProfileSync() {
  ddProfileRemoveTriggers_();

  const state={
    startedAt:new Date().toISOString(),
    done:{},
    updated:0,
    complete:false,
    retryCount:0,
    failures:[]
  };

  PropertiesService.getScriptProperties()
    .setProperty(
      DD_PROFILE_SYNC.stateKey,
      JSON.stringify(state)
    );

  ScriptApp.newTrigger(
    'runMemberProfileSyncBatch'
  )
    .timeBased()
    .everyMinutes(5)
    .create();

  runMemberProfileSyncBatch();
}

function runMemberProfileSyncBatch() {
  const store=
    PropertiesService.getScriptProperties();

  const raw=store.getProperty(
    DD_PROFILE_SYNC.stateKey
  );

  if(!raw)return;

  const state=JSON.parse(raw);
  if(state.complete)return;

  if(
    state.runningAt&&
    Date.now()-Date.parse(state.runningAt)<240000
  ){
    return;
  }

  state.runningAt=new Date().toISOString();

  store.setProperty(
    DD_PROFILE_SYNC.stateKey,
    JSON.stringify(state)
  );

  try{
    const {ss,candidates}=ddProfileCandidates_();

    const pending=candidates.filter(c=>
      !state.done[
        ddProfileKey_(c.legion,c.name)
      ]
    );
    const batch=pending.slice(
      0,DD_PROFILE_SYNC.batchSize
    );

    let interrupted=false;

    for(const c of batch){
      const key=ddProfileKey_(
        c.legion,c.name
      );

      try{
        const profile=ddProfileLookup_(
          c.name,c.cls
        );

        if(profile.reason){
          state.failures.push(
            c.legion+'/'+c.name+
            ': '+profile.reason
          );
        }else{
          state.updated+=ddProfileFill_(
            ss,c,profile
          );
        }

        state.done[key]=true;
        state.retryCount=0;

      }catch(err){
        const msg=String(
          err&&err.message||err
        );

        if(/HTTP (429|503)\b/.test(msg)){
          interrupted=true;
          state.retryCount++;

          if(state.retryCount>=3){
            throw new Error(
              'API mehrfach überlastet: '+msg
            );
          }

          break;
        }

        if(
          /HTTP (401|403)\b|kein JSON|Suchformat/.test(msg)
        ){
          throw new Error(
            'API nicht zugänglich oder Antwort geändert: '+msg
          );
        }

        state.failures.push(
          c.legion+'/'+c.name+': '+msg
        );

        state.done[key]=true;
      }

      Utilities.sleep(1200);
    }

    const remaining=ddProfileCandidates_()
      .candidates
      .filter(c=>
        !state.done[
          ddProfileKey_(c.legion,c.name)
        ]
      ).length;

    if(remaining===0){
      state.complete=true;
      ddProfileRemoveTriggers_();

      ddProfileLog_(
        'Abgeschlossen: '+
        state.updated+
        ' CP/GS-Felder ergänzt. '+
        state.failures.length+
        ' Profile ohne eindeutiges Ergebnis. '+
        state.failures.slice(0,4).join(' | '),
        state
      );

    }else if(!interrupted){
      Logger.log(
        'Noch '+remaining+
        ' Profile offen. Nächster Block per Trigger.'
      );
    }

  }catch(err){
    state.complete=true;
    ddProfileRemoveTriggers_();

    ddProfileLog_(
      'Abgebrochen: '+
      (err&&err.message||String(err))+
      '. Bereits ergänzte Werte bleiben erhalten.',
      state
    );

    throw err;

  }finally{
    delete state.runningAt;

    store.setProperty(
      DD_PROFILE_SYNC.stateKey,
      JSON.stringify(state)
    );
  }
}

function statusMemberProfileSync() {
  const state=JSON.parse(
    PropertiesService.getScriptProperties()
      .getProperty(
        DD_PROFILE_SYNC.stateKey
      )||'{}'
  );

  Logger.log(JSON.stringify(state,null,2));
  return state;
}

function stopMemberProfileSync() {
  ddProfileRemoveTriggers_();

  const store=
    PropertiesService.getScriptProperties();

  const state=JSON.parse(
    store.getProperty(
      DD_PROFILE_SYNC.stateKey
    )||'{}'
  );

  state.complete=true;

  store.setProperty(
    DD_PROFILE_SYNC.stateKey,
    JSON.stringify(state)
  );
}