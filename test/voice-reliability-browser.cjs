/* Chromium integration: real MediaRecorder + WAV conversion + HTTP multipart +
   real voice HTTP/handler + controlled STT transcripts + real POS commits.
   No external services, production data, camera or deployment are used. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root=path.resolve(__dirname,'..');
async function main(){
 const {createVoiceHandler}=await import('../functions/handler.js');
 let transcript='', requests=0, release=null, delay=false, calls=[];
 const handler=createVoiceHandler({apiKey:'local-test-only',verifyToken:async h=>h==='Bearer local-test',fetchImpl:async(url,options)=>{
   requests++; assert.equal(options.headers.Authorization,'Token local-test-only');
   assert.ok(options.body.size>100,'encoded audio delivered to transcription');
   calls.push({bytes:options.body.size,mime:options.headers['Content-Type']});
   const result=transcript;
   if(delay) await new Promise(r=>{release=r;});
   return new Response(JSON.stringify({results:{channels:[{alternatives:[{transcript:result}]}]}}),{status:200});
 }});
 const server=http.createServer(async(req,res)=>{
  if(req.url==='/transcribe'){
   let chunks=[];for await(const chunk of req) chunks.push(chunk);
   req.rawBody=Buffer.concat(chunks);req.get=n=>req.headers[n.toLowerCase()];
   res.set=(k,v)=>res.setHeader(k,v);res.status=s=>{res.statusCode=s;return res;};res.send=b=>res.end(b);
   await handler(req,res);return;
  }
  let file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}
 });
 await new Promise(r=>server.listen(8765,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
 try{
  const page=await browser.newPage();
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.goto('http://127.0.0.1:8765/index.html');
  await page.waitForFunction(()=>typeof receiveVoiceTranscript==='function'&&typeof STATE!=='undefined');
  await page.evaluate(()=>{
   fbReady=false;window.fbAuth={currentUser:{getIdToken:async()=> 'local-test'}};
   STATE.currentServer={name:'Fixture server',role:'manager',code:'5000'};
   STATE.selectedTable='4';STATE.activeSeat=2;STATE.currentOrder=[];STATE.orders=[];STATE.checks={};STATE.tableSessions={};STATE.viewCheckId=null;
   sessionOf('4').guestCount=4;sessionOf('4').femalePositions={'2':true};
   ensureOpenCheck('4');
   // BOH-shaped fixture: real dish definitions; illustrative local prices only.
   const ids=['sf_p_raviolo','sf_p_porcini','sf_m_pork','sf_d_basque'];
   const prices=[28,26,48,16];
   STATE.menuItems=ids.map((id,i)=>Object.assign(voiceProjectDish(voiceSourceRecord(id)),{price:prices[i],active:true}));
   const entries=STATE.menuItems.map(it=>({sourceId:it.id,voiceKeyword:it.voiceKeyword,name:it.name,voiceAliases:it.voiceAliases||[],active:true}));
   STATE.voiceVocab={revision:'LOCAL-BOH-FIXTURE',stale:false,entries,index:EPICUREAN_VOICE_ENGINE.buildIndex(entries)};
   window.EPICUREAN_VOICE_TRANSCRIBE_URL='/transcribe';
   // Disable audible TTS in the harness; the media/HTTP path remains real.
   window.voiceSpeak=function(text){STATE.voiceEcho=text;STATE.voiceEchoAt=Date.now();};
   STATE.activeTab='order';renderOrder();
   window._testSends=0;window.sendOrder=()=>{window._testSends++;throw new Error('Voice must never SEND');};
   window.fireDiningCourse=()=>{window._testSends++;throw new Error('Voice must never FIRE');};
  });
  async function clip(text){
   transcript=text;
   const before=requests;
   await page.evaluate(()=>startVoiceMicrophone());
   await page.waitForFunction(()=>STATE._voiceRec&&STATE._voiceRec.recorder.state==='recording');
   await page.waitForTimeout(400);
   await page.evaluate(()=>{STATE._voiceRec.heard=true;stopVoiceCapture(false);});
   await page.waitForFunction(()=>!!STATE.voiceLastTranscript);
   for(let i=0;i<100;i++){
    if(await page.evaluate(t=>STATE.voiceLastTranscript===t&&EPICUREAN_ORDER_SESSION.state().phase!=='interpreting',text))break;
    await page.waitForTimeout(25);
   }
   assert.ok(requests>before,'real browser clip reached HTTP handler');
   await page.evaluate(()=>stopVoiceSession());
  }
  await clip("I'll have the pork chop. What do you recommend for position 2A?");
  assert.equal(await page.evaluate(()=>STATE.currentOrder.length),0,'guest conversation cannot order even with seat words');
  await clip('Foodmaster position 2A appetizer soft egg yolk raviolo and main course pork chop medium and dessert basque cheesecake');
  let proposal=await page.evaluate(()=>EPICUREAN_ORDER_SESSION.state());
  assert.equal(proposal.phase,'review',JSON.stringify(proposal));assert.equal(proposal.proposal.length,3);
  assert.equal(await page.evaluate(()=>STATE.currentOrder.length),0,'no partial check writes during interpretation');
  await clip('Foodmaster actually replace the appetizer with porcini ravioli');
  proposal=await page.evaluate(()=>EPICUREAN_ORDER_SESSION.state());
  assert.equal(proposal.proposal.length,3);assert.equal(proposal.proposal[0].itemId,'sf_p_porcini');
  await clip('Foodmaster confirm');
  let lines=await page.evaluate(()=>STATE.currentOrder);
  assert.equal(lines.length,3);assert.deepEqual(lines.map(l=>l.id),['sf_p_porcini','sf_m_pork','sf_d_basque']);
  assert.deepEqual(lines.map(l=>l.course),[2,3,4]);assert.deepEqual(lines.map(l=>l.price),[26,48,16]);
  assert.ok(lines.every(l=>l.seat===2&&l.seatPriority&&l.voiceOrderOwned));
  const originalMain=lines[1].lineId;
  await clip('Foodmaster make that pork chop medium well instead');await clip('Foodmaster confirm');
  lines=await page.evaluate(()=>STATE.currentOrder);
  assert.equal(lines.length,3);assert.equal(lines[1].lineId,originalMain);assert.match(JSON.stringify(lines[1].mods),/MW|medium well/i);
  await page.evaluate(async()=>{await receiveVoiceTranscript('Foodmaster confirm','duplicate');await receiveVoiceTranscript('Foodmaster confirm','duplicate');});
  assert.equal(await page.evaluate(()=>STATE.currentOrder.length),3,'duplicate delivery does not duplicate check lines');
  // In-flight audio after logout must not mutate any check or restart the old recorder.
  delay=true;transcript='Foodmaster position 2A dessert basque cheesecake';release=null;
  await page.evaluate(()=>startVoiceMicrophone());await page.waitForFunction(()=>STATE._voiceRec&&STATE._voiceRec.recorder.state==='recording');await page.waitForTimeout(400);
  await page.evaluate(()=>{STATE._voiceRec.heard=true;stopVoiceCapture(false);});
  for(let i=0;i<100&&!release;i++)await page.waitForTimeout(25);
  assert.ok(release,'transcription is in flight');
  await page.evaluate(()=>logout());release();delay=false;
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>STATE.voiceSession.on),false);
  assert.equal(await page.evaluate(()=>EPICUREAN_ORDER_SESSION.state().proposal.length),0);
  assert.equal(await page.evaluate(()=>STATE.currentOrder.length),3);
  await page.evaluate(()=>{finishLogin({name:'Fixture server',role:'manager',code:'5000'});STATE.activeTab='order';STATE.activeSeat=2;renderOrder();});
  await clip('Foodmaster position 2A dessert basque cheesecake');await clip('Foodmaster confirm');
  assert.equal(await page.evaluate(()=>STATE.currentOrder.length),4,'new voice order after logout/login works');
  assert.equal(await page.evaluate(()=>_testSends),0);assert.equal(await page.evaluate(()=>STATE.orders.length),0);
  // BOH change during review blocks the entire commit.
  await clip('Foodmaster position 2A appetizer soft egg yolk raviolo');
  await page.evaluate(()=>{STATE.menuItems.find(it=>it.id==='sf_p_raviolo').eightySixed=true;});
  await clip('Foodmaster confirm');
  assert.equal(await page.evaluate(()=>STATE.currentOrder.length),4);assert.equal(await page.evaluate(()=>EPICUREAN_ORDER_SESSION.state().phase),'clarify');
  await page.evaluate(async()=>{
   await receiveVoiceTranscript('Foodmaster cancel');
   // An LLM is an untrusted proposal source: its price field must never reach the POS.
   window.EPICUREAN_VOICE_INTERPRET=async()=>({operations:[{action:'add',itemId:'sf_d_basque',seat:'2A',course:4,mods:{},notes:'',target:null,proposalId:'malicious',price:0.01}]});
   await receiveVoiceTranscript('Foodmaster dessert cheesecake');
   if(!/Unexpected/.test(EPICUREAN_ORDER_SESSION.state().error)) throw new Error('price injection accepted');
   delete window.EPICUREAN_VOICE_INTERPRET;
   await receiveVoiceTranscript('Foodmaster cancel');
  });
  assert.equal(await page.evaluate(()=>STATE.currentOrder.length),4);
  // Full command failure cannot partially stage or commit a valid dessert.
  await clip('Foodmaster position 2A dessert basque cheesecake and appetizer nonexistent dish');
  assert.equal(await page.evaluate(()=>EPICUREAN_ORDER_SESSION.state().proposal.length),0);
  assert.equal(await page.evaluate(()=>STATE.currentOrder.length),4);
  await page.evaluate(async()=>{
   await receiveVoiceTranscript('Foodmaster cancel');
   const line=STATE.currentOrder[0]; line.voiceOrderOwned=false;
   window.EPICUREAN_VOICE_INTERPRET=async()=>({operations:[{action:'replace',itemId:'sf_p_porcini',seat:'2A',course:2,mods:{},notes:'',target:line.lineId,proposalId:'manual-target'}]});
   await receiveVoiceTranscript('Foodmaster replace the appetizer');
   if(!/owned unsent/.test(EPICUREAN_ORDER_SESSION.state().error)) throw new Error('manual line was editable by voice');
   line.voiceOrderOwned=true;delete window.EPICUREAN_VOICE_INTERPRET;await receiveVoiceTranscript('Foodmaster cancel');
   let release;window.EPICUREAN_VOICE_INTERPRET=()=>new Promise(r=>release=r);
   const pending=receiveVoiceTranscript('Foodmaster dessert cheesecake');
   logout();
   release({operations:[{action:'add',itemId:'sf_d_basque',seat:'2A',course:4,mods:{},notes:'',target:null,proposalId:'late-model'}]});
   await pending;
   if(EPICUREAN_ORDER_SESSION.state().proposal.length) throw new Error('late model result survived logout');
   delete window.EPICUREAN_VOICE_INTERPRET;
  });
  assert.equal(await page.evaluate(()=>STATE.currentOrder.length),4);
  // User's exact restaurant dishes: zero standalone prices must not become free/extra plates.
  await page.evaluate(()=>{
   finishLogin({name:'Fixture server',role:'manager',code:'5000'});
   STATE.selectedTable='14';STATE.activeSeat=2;STATE.viewCheckId=null;
   sessionOf('14').guestCount=2;sessionOf('14').femalePositions={};ensureOpenCheck('14');STATE.activeTab='order';
   STATE.menuItems=[];
   STATE.menuItems=['sf_p_linguini','sf_p_porcini','sf_m_pork'].map(id=>voiceProjectDish(voiceSourceRecord(id)));
   const entries=STATE.menuItems.map(it=>({sourceId:it.id,voiceKeyword:it.voiceKeyword,name:it.name,voiceAliases:it.voiceAliases||[],active:true}));
   STATE.voiceVocab={revision:'LOCAL-PUBLISHED-PF-FIXTURE',stale:false,entries,index:EPICUREAN_VOICE_ENGINE.buildIndex(entries)};
   setVoicePricingMenu('');renderOrder();
  });
  await clip('Foodmaster position 2 appetizer pescatore main course pork chop medium');
  assert.equal(await page.evaluate(()=>STATE.currentOrder.length),4,'no fabricated standalone pricing');
  assert.match(await page.evaluate(()=>EPICUREAN_ORDER_SESSION.state().error),/No à la carte price/);
  const menu=await page.evaluate(()=>{
   const pf=STATE.prixFixeMenus.find(p=>(p.courses||[]).some(c=>(c.options||[]).some(o=>o.id==='sf_p_linguini')));
   if(!pf) throw new Error('Real bundled BOH menu missing');setVoicePricingMenu(pf.id);return {id:pf.id,price:pf.price};
  });
  await clip('Foodmaster position 2appetizer pescatore main course pork chop medium');
  assert.equal(await page.evaluate(()=>EPICUREAN_ORDER_SESSION.state().proposal.length),2);
  await clip('Foodmaster no, change what you wrote');
  assert.match(await page.evaluate(()=>EPICUREAN_ORDER_SESSION.state().error),/Which dish and position/);
  assert.equal(await page.evaluate(()=>EPICUREAN_ORDER_SESSION.state().proposal.length),2,'vague correction preserves both dishes');
  await clip('Foodmaster replace the appetizer with porcini ravioli');
  await clip('Foodmaster confirm');
  const diningLine=await page.evaluate(()=>STATE.currentOrder[STATE.currentOrder.length-1]);
  assert.equal(diningLine.isPrixFixe,true);assert.equal(diningLine.seat,2);assert.equal(diningLine.seatPriority,false);
  assert.equal(diningLine.price,menu.price,'manual menu base price retained; no extra plate charge');
  assert.ok(diningLine.selections.some(s=>s.optionId==='sf_p_porcini'));
  assert.ok(diningLine.selections.some(s=>s.optionId==='sf_m_pork'&&s.selectedTemp==='Medium'));
  assert.equal(await page.evaluate(()=>STATE.currentOrder.length),5);assert.equal(await page.evaluate(()=>_testSends),0);
  console.log(JSON.stringify({passed:true,checkLines:5,prixFixe:menu,actualBrowserAudioRequests:requests,audio:calls,demonstrated:['guest gate','three courses','proposal correction','BOH prices','stable-line modifier correction','duplicate delivery','logout with pending HTTP','new session order','BOH 86 blocks confirmation','no SEND/FIRE','model price injection rejected','invalid multi-course atomicity','manual line protection','late model result rejected','exact pescatore/pork command','joined seat/course boundary','unpriced dishes fail safely','explicit prix-fixe basis','vague correction clarification','manual prix-fixe pricing and included courses']},null,2));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
