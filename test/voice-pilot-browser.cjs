const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const {startMockPilot}=await import('../pilot/mock-server.mjs');const p=await startMockPilot();
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
 try{
  const page=await browser.newPage();await page.goto(p.url);await page.click('#login');await page.waitForFunction(()=>document.querySelector('#state').textContent.includes('"phase": "idle"'));
  const op=(itemId,course,temp)=>({action:'add',itemId,seat:'2',course,mods:temp?[{group:'Temperature',option:temp}]:[],notes:'',target:null});
  p.responses.push({clarification:null,operations:[op('sf_p_linguini',2),op('sf_m_pork',3,'Medium')]});
  p.transcripts.push('Foodmaster, position 2 appetizer pescatore, main pork chop medium.');await page.click('#mic');await page.waitForTimeout(300);await page.click('#stop');await page.waitForFunction(()=>document.querySelector('#state').textContent.includes('"phase": "review"'));
  await page.click('#confirm');await page.waitForFunction(()=>document.querySelector('#state').textContent.includes('"envelope"'));let state=JSON.parse(await page.locator('#state').textContent());assert.equal(state.envelope.orders[0].lines.length,2);assert.equal(state.envelope.send,false);assert.ok(p.audioClips[0].size>0);assert.ok(p.audioClips[0].type.startsWith('audio/'));
  const old=state.sessionId;await page.click('#logout');await page.click('#login');await page.waitForFunction(()=>document.querySelector('#state').textContent.includes('"phase": "idle"'));state=JSON.parse(await page.locator('#state').textContent());assert.notEqual(state.sessionId,old);
  p.responses.push({clarification:null,operations:[op('sf_p_porcini',2),op('sf_m_pork',3,'Medium Well')]});p.transcripts.push('Foodmaster, position 2 appetizer porcini, main pork chop medium well.');await page.click('#mic');await page.waitForTimeout(300);await page.click('#stop');await page.waitForFunction(()=>document.querySelector('#state').textContent.includes('"phase": "review"'));assert.equal(JSON.parse(await page.locator('#state').textContent()).proposal.length,2);
  const modelCalls=p.inputs.length;p.transcripts.push('We want pork chop, can I get another drink?');await page.click('#mic');await page.waitForTimeout(300);await page.click('#stop');await page.waitForFunction(()=>document.querySelector('#state').textContent.includes('\"conversation\": true'));assert.equal(p.inputs.length,modelCalls);assert.equal(JSON.parse(await page.locator('#state').textContent()).proposal.length,2);
  console.log('PASS: actual Chromium UI/HTTP/server/model-adapter confirmation and logout/login restart. Actual MediaRecorder HTTP audio after logout/login; scripted ASR/LLM. Acoustic accuracy and iPhone not proven.');
 }finally{await browser.close();await p.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
