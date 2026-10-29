/* Immutable baseline reproduction, independent of repaired working files. */
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {JSDOM,VirtualConsole}=require('jsdom');
const path=require('node:path');
const root=path.resolve(__dirname,'..'), revision='cfeceb8b211b334e4dc080f2dbed82c8c0e4e27f';
const read=name=>execFileSync('git',['show',revision+':'+name],{cwd:root,encoding:'utf8'});
async function main(){
 let html=read('index.html').replace(/<script[^>]*src="https:[^"]+"[^>]*><\/script>/g,'');
 for(const name of ['scalini-dining.js','voice-vocab.js','voice-engine.js','voice-turn.js','voice-catalog.js','voice-price.js','voice-service.js','voice-cocktails.js'])
  html=html.replace(new RegExp('<script src="'+name.replace('.','\\.')+'[^\"]*"><\\/script>'),()=>'<script>'+read(name)+'</script>');
 html=html.replace(/<script src="cellar[^\"]*"><\/script>/,'');
 const dom=new JSDOM(html,{url:'http://127.0.0.1:8765/',pretendToBeVisual:true,runScripts:'dangerously',virtualConsole:new VirtualConsole()});
 const w=dom.window;
 try{
  w.fbReady=false;w.STATE.currentServer={name:'Test',role:'manager',code:'5000'};w.STATE.selectedTable='4';w.STATE.activeSeat=2;
  w.STATE.currentOrder=[];w.STATE.orders=[];w.STATE.checks={};w.STATE.tableSessions={};w.STATE.viewCheckId=null;
  w.sessionOf('4').guestCount=4;w.sessionOf('4').femalePositions={'2':true};w.ensureOpenCheck('4');
  const ids=['sf_p_raviolo','sf_p_porcini','sf_m_pork','sf_d_basque'];
  w.STATE.menuItems=ids.map(id=>Object.assign(w.voiceProjectDish(w.voiceSourceRecord(id)),{price:28,active:true}));
  const entries=w.STATE.menuItems.map(it=>({sourceId:it.id,voiceKeyword:it.voiceKeyword,name:it.name,voiceAliases:it.voiceAliases||[],active:true}));
  w.STATE.voiceVocab={revision:'LOCAL-BOH-FIXTURE',stale:false,entries,index:w.EPICUREAN_VOICE_ENGINE.buildIndex(entries)};
  w.voiceSpeak=()=>{};
  const appetizer=w.voiceResolveVocab('soft egg yolk raviolo');
  assert.equal(appetizer.action,'draft');assert.match(appetizer.draft.need,/soft egg yolk/);
  w.applyVoiceCommand('Position 2A appetizer soft egg yolk raviolo main course pork chop medium confirm');
  assert.equal(w.STATE.currentOrder.length,1);assert.equal(w.STATE.currentOrder[0].id,'sf_m_pork');
  const multiCourse={utterance:'Position 2A appetizer soft egg yolk raviolo main course pork chop medium confirm',lines:w.STATE.currentOrder.map(l=>l.id),drafts:w.STATE.voiceDrafts.map(d=>d.need)};
  const before=w.STATE.currentOrder[0].lineId;
  w.applyVoiceCommand('Actually make that pork chop medium well instead');
  assert.equal(w.STATE.currentOrder[0].lineId,before);assert.notEqual(w.STATE.currentOrder[0].mods.Temperature,'MW');
  const correction={utterance:'Actually make that pork chop medium well instead',mods:w.STATE.currentOrder[0].mods,draft:w.STATE.voiceDrafts[0].need};
  // Begin an actual baseline async clip completion, then log out before STT returns.
  let resolve, lateApplied=0;const originalApply=w.applyVoiceCommand;w.applyVoiceCommand=function(text){lateApplied++;return originalApply(text);};
  w.EPICUREAN_VOICE_TRANSCRIBE=()=>new Promise(r=>resolve=r);
  w.STATE.currentOrder=[];w.STATE.voiceTurn=null;w.STATE._voiceToken=99;w.STATE.voiceSession={on:true,stream:null};
  w.STATE._voiceRec={token:99,chunks:['synthetic audio'],mime:'audio/mp4',heard:true,monitored:false};
  w.finishVoiceClip();await new Promise(r=>setTimeout(r,0));w.logout();
  assert.equal(w.STATE.voiceSession.on,true,'baseline logout incorrectly keeps the voice session live');
  resolve('2A pork chop medium');await new Promise(r=>setTimeout(r,20));
  assert.equal(w.STATE.currentServer,null);assert.equal(lateApplied,1,'late baseline STT is applied after logout');
  const logoutEvidence={server:w.STATE.currentServer,voiceStillOn:w.STATE.voiceSession.on,lateTranscriptApplied:lateApplied};
  w.stopVoiceSession();w.applyVoiceCommand=originalApply;w.STATE.currentServer={name:'Test',role:'manager',code:'5000'};
  w.STATE.currentOrder=[];w.STATE.menuItems=[];w.STATE.voiceTurn=null;w.STATE.voiceDrafts=[];w.STATE.activeTastingOrders=[];
  w.STATE.menuItems=['sf_p_linguini','sf_m_pork'].map(id=>w.voiceProjectDish(w.voiceSourceRecord(id)));
  const realEntries=w.STATE.menuItems.map(it=>({sourceId:it.id,voiceKeyword:it.voiceKeyword,name:it.name,voiceAliases:it.voiceAliases||[],active:true}));
  w.STATE.voiceVocab={revision:'LOCAL-PF-FIXTURE',stale:false,entries:realEntries,index:w.EPICUREAN_VOICE_ENGINE.buildIndex(realEntries)};
  const joined=w.voiceResolveVocab('position 2appetizer pescatore');
  const unpriced=w.voiceResolveVocab('pork chop medium');
  assert.match(joined.draft.need,/unparsed: position 2appetizer/);assert.match(unpriced.draft.need,/no à la carte price.*Medium/);
  const exactFailure={joinedSeatCourse:joined.draft.need,porkPriceGuard:unpriced.draft.need};
  console.log(JSON.stringify({baseline:revision,exactFailure,appetizer:appetizer.draft.need,multiCourse,correction,logout:logoutEvidence},null,2));
 }finally{w.stopVoiceSession();w.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
