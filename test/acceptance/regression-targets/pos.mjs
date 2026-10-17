// Eight fixed review findings. All order/payment actions terminate in the existing MOCK transport.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {suite,clone} from './harness.mjs';import {MOCK_CARD_SDK,BOH_ROOT} from '../lib.mjs';
const root=process.env.POS_ROOT||fileURLToPath(new URL('../../../',import.meta.url));
const baseline='4d3aabedf2b6fc4e45ae293dd8dcbf7b5dae7b7e';
const established=JSON.parse(fs.readFileSync(path.join(BOH_ROOT,'test/acceptance/fixtures/established-cloud.json')));
const s=await suite({name:'phase0-pos-regression-targets',root,baseline,ids:['B04','B05','B06','B07','B08','I02','I03','I04']});
const seed=()=>clone(established),db=p=>p.evaluate(()=>__MOCK_DB__.__dump());
const openPos=(ctx,source=seed(),options={})=>ctx.open(source,{login:'pos',extraHead:MOCK_CARD_SDK,...options});
async function sent(p){
 const ids=await p.evaluate(()=>{
  const cid=activeCheckId(),ticket={id:'review-ticket',table:'1',checkId:cid,status:'new',sentAt:1,items:[{id:'review-item',name:'MOCK sent item',lineId:'review-sent-line',checkId:cid,seat:1,price:10,qty:1,station:'Hot',allergens:['Gluten'],verified:true}]};
  STATE.currentOrder=[];STATE.parkedLines=[];STATE.orders=[ticket];STATE._localOrders=[];STATE.activeTastingOrders=[];
  __MOCK_DB__.__rawSet('orders',ticket.id,ticket);persistCheck(STATE.checks[cid]);return {cid,ticketId:ticket.id,lineId:'review-sent-line'};
 });await p.waitForTimeout(100);return ids;
}
async function payScreen(p,even=null){
 await p.evaluate(()=>openPayment(checkTotals().grand));
 await p.waitForFunction(()=>squareCard&&document.getElementById('charge-btn'));
 if(even)await p.locator('#payment-card .even-split button').filter({hasText:new RegExp('^/'+even+'$')}).click();
 await p.waitForFunction(()=>squareCard&&document.getElementById('charge-btn'));
}
async function charge(p){await p.locator('#charge-btn').click();await p.waitForFunction(()=>!Object.values(STATE._payInFlight||{}).some(Boolean));await p.waitForTimeout(100);}
async function installPaymentFault(p,{lostAck=false}={}){
 await p.evaluate(({lostAck})=>{
  const original=__MOCK_DB__.collection.bind(__MOCK_DB__);window.__reviewReceiptCommitted=0;
  __MOCK_DB__.collection=function(name){const c=original(name);if(name!=='payments')return c;const doc=c.doc;c.doc=function(id){const ref=doc(id),set=ref.set;ref.set=function(data,opts){return set(data,opts).then(()=>{if(!window.__reviewReceiptCommitted){window.__reviewReceiptCommitted++;if(lostAck)throw Error('MOCK payment receipt committed but acknowledgment lost');window.__MOCK_FAIL_WRITES__=['checks/*','orders/*'];}});};return ref;};return c;};
 },{lostAck});
}
async function addMock(p,{id='review-draft',price=12,seat='2A',allergens=['Gluten'],verified=true,modifiers=[]}={}){
 return p.evaluate(({id,price,seat,allergens,verified,modifiers})=>{
  const item={id,name:'MOCK regression dish '+id,price,category:'Entrées',station:'Hot',modifiers,allergens,verified};
  STATE.menuItems=STATE.menuItems.filter(i=>i.id!==id).concat([item]);STATE.activeSeat=seat;beginAddItem(id);
  return STATE.currentOrder.find(l=>l.id===id)?.lineId||null;
 },{id,price,seat,allergens,verified,modifiers});
}
async function logInAgain(p,code){for(const digit of code)await p.getByRole('button',{name:digit,exact:true}).first().click();await p.waitForFunction(code=>String(STATE.currentServer?.code)===code,code);await p.evaluate(()=>selectTable('1'));await p.waitForTimeout(100);}
await s.run('B04','Transfers preserve fresh remote checks, exact positions and unpaid drafts through partial failure and retry',async ctx=>{
 const {check,tick}=ctx;
 const normal=await openPos(ctx);const n=await sent(normal.page);
 await normal.page.evaluate(()=>transferCheckTo('2'));await normal.page.waitForFunction(()=>!STATE._moving);await tick(normal.page);
 check('control: ordinary transfer retargets its ticket',(await db(normal.page)).orders[n.ticketId].table,'2',{control:true});
 for(const failFirst of [false,true]){
  const {page:p}=await openPos(ctx);const ids=await sent(p);
  const remote=await p.evaluate(({cid,failFirst})=>{
   const ch={...JSON.parse(JSON.stringify(STATE.checks[cid])),guestCount:3,allergies:{'2':['Dairy'],'2A':['Fish']},kitchenNote:'MOCK remote kitchen restriction',unsentLines:[{id:'remote-product',name:'MOCK another owner draft',lineId:'remote-unsent',table:'1',checkId:cid,ownerCode:'3001',ownerName:'Fixture owner',seat:'2A',course:3,price:12,qty:1}]};
   __MOCK_DB__.__rawSet('checks',cid,ch);if(failFirst)window.__MOCK_FAIL_WRITES__=['orders/review-ticket'];return ch;
  },{...ids,failFirst});
  await p.evaluate(()=>transferCheckTo('2'));await p.waitForFunction(()=>!STATE._moving);await tick(p);
  if(failFirst){
   check('control: partial write failure is not reported as success',await p.evaluate(()=>/Moved to table 2/.test(document.getElementById('toast').innerText)),false,{control:true});
   check('partial failure cannot erase remote allergies',(await db(p)).checks[ids.cid].allergies,remote.allergies);
   check('partial failure cannot erase another owner draft',(await db(p)).checks[ids.cid].unsentLines.map(l=>l.lineId),['remote-unsent']);
   await p.evaluate(()=>{window.__MOCK_FAIL_WRITES__=null;retryTableMove('1','2');});await p.waitForFunction(()=>!STATE._moving);await tick(p);
  }
  const moved=await db(p),ch=moved.checks[ids.cid],label=failFirst?'retry':'move';
  check(label+': authoritative allergies survive',ch.allergies,remote.allergies);
  check(label+': authoritative kitchen note survives',ch.kitchenNote,remote.kitchenNote);
  check(label+': authoritative guest count survives',ch.guestCount,3);
  check(label+': unpaid line retains identity/position/owner/price and follows the table',(ch.unsentLines||[]).map(l=>({lineId:l.lineId,seat:l.seat,ownerCode:l.ownerCode,price:l.price,table:String(l.table),checkId:l.checkId})),[{lineId:'remote-unsent',seat:'2A',ownerCode:'3001',price:12,table:'2',checkId:ids.cid}]);
  check(label+': ticket and check are both moved',[moved.orders[ids.ticketId].table,ch.table],['2','2']);
  const other=await openPos(ctx,moved,{table:'2'});await tick(other.page);
  check(label+': new device restores the draft exactly once on the destination',await other.page.evaluate(()=>STATE.currentOrder.filter(l=>l.lineId==='remote-unsent'&&String(l.table)==='2'&&String(l.seat)==='2A').length),1);
 }
});
await s.run('B05','Payment receipts finalize exactly once after write failures, lost acknowledgments and device restart',async ctx=>{
 const {check,tick}=ctx;
 const normal=await openPos(ctx);const ids=await sent(normal.page);await payScreen(normal.page);await charge(normal.page);
 let data=await db(normal.page);
 check('control: normal payment creates one receipt',Object.keys(data.payments||{}).length,1,{control:true});
 check('control: normal payment closes only the paid check',data.checks[ids.cid].status,'paid',{control:true});
 check('control: normal payment marks its ticket item paid',data.orders[ids.ticketId].items[0].paid,true,{control:true});
 await normal.page.evaluate(()=>processPayment(10));await tick(normal.page);
 check('control: stale charge cannot create another receipt',Object.keys((await db(normal.page)).payments||{}).length,1,{control:true});
 for(const scenario of [{name:'finalization writes fail',lostAck:false,even:null},{name:'payment acknowledgment lost',lostAck:true,even:null},{name:'first even share finalization fails',lostAck:false,even:3}]){
  const {page:p}=await openPos(ctx);const x=await sent(p);await installPaymentFault(p,scenario);await payScreen(p,scenario.even);await charge(p);
  const pending=await db(p);
  check(scenario.name+': control receipt was durably stored before fault',Object.keys(pending.payments||{}).length,1,{control:true});
  check(scenario.name+': control card was tokenized once',await p.evaluate(()=>window.__mockTokenized||0),1,{control:true});
  const finalized=pending.checks[x.cid].status==='paid'&&pending.orders[x.ticketId].items[0].paid===true;
  const falseSuccess=await p.evaluate(()=>{const text=document.getElementById('payment-card').innerText+' '+document.getElementById('toast').innerText;return /Payment Successful/i.test(text)&&!/pending|recover|retry|not complete/i.test(text);});
  if(!finalized&&!scenario.even)check(scenario.name+': incomplete finalization cannot claim fully settled success',falseSuccess,false);
  // New browser context with ONLY persisted mock documents: no process-local payment lock survives.
  const {page:q}=await openPos(ctx,pending);await payScreen(q,scenario.even);await charge(q);
  const recovered=await db(q);
  check(scenario.name+': retry never creates a second receipt',Object.keys(recovered.payments||{}).length,1);
  check(scenario.name+': receipt recovery never tokenizes another card',await q.evaluate(()=>window.__mockTokenized||0),0);
  if(scenario.even){
   const split=recovered.checks[x.cid].evenSplit;
   check(scenario.name+': persisted split progress is recovered',split?{n:split.n,totalCents:split.totalCents,paid:split.paid}:{n:null,totalCents:null,paid:[]},{n:3,totalCents:1000,paid:[333]});
   check(scenario.name+': unfinished split remains open',recovered.checks[x.cid].status,'open');
   check(scenario.name+': unfinished split does not prematurely pay its line',!!recovered.orders[x.ticketId].items[0].paid,false);
  }else{
   check(scenario.name+': receipt recovery finishes the check',recovered.checks[x.cid].status,'paid');
   check(scenario.name+': receipt recovery finishes its exact line',!!recovered.orders[x.ticketId].items[0].paid,true);
  }
 }
});
await s.run('B06','An employee cannot pay/close a check that contains another owner’s unpaid parked drafts',async ctx=>{
 const {check,tick}=ctx;const {page:p}=await openPos(ctx);const cid=await p.evaluate(()=>activeCheckId());
 const ownerLine=await addMock(p,{id:'owner-A-draft',price:12,seat:'2A'});check('control: first owner added an unpaid line',!!ownerLine,true,{control:true});
 await p.evaluate(()=>logout());await logInAgain(p,'4001');
 check('control: second employee does not inherit the draft',await p.evaluate(()=>STATE.currentOrder.some(l=>l.id==='owner-A-draft')),false,{control:true});
 await addMock(p,{id:'owner-B-item',price:10,seat:1});await p.evaluate(()=>sendOrder({stay:true}));await tick(p);
 check('control: other owner’s draft is parked and persisted',(await db(p)).checks[cid].unsentLines.map(l=>l.lineId),[ownerLine],{control:true});
 await payScreen(p);await charge(p);const after=await db(p);
 check('unresolved parked draft prevents a payment receipt',Object.keys(after.payments||{}).length,0);
 check('unresolved parked draft prevents card tokenization',await p.evaluate(()=>window.__mockTokenized||0),0);
 check('check remains open for every owner’s unpaid work',after.checks[cid].status,'open');
 check('parked line remains durably recoverable',after.checks[cid].unsentLines.map(l=>l.lineId),[ownerLine]);
 const restored=await openPos(ctx,after);
 check('owner returns on a new device and receives the exact unpaid draft',await restored.page.evaluate(lid=>STATE.currentOrder.filter(l=>l.lineId===lid&&String(l.seat)==='2A'&&l.price===12).length,ownerLine),1);
 // Healthy control starts independently; do not fabricate an unpaid state by deleting a real mock receipt.
 const normal=await openPos(ctx);const normalCid=await normal.page.evaluate(()=>activeCheckId());
 const removable=await addMock(normal.page,{id:'legitimately-removed',price:12});await normal.page.evaluate(lid=>removeLine(lid),removable);
 await normal.page.evaluate(()=>logout());await logInAgain(normal.page,'4001');await addMock(normal.page,{id:'healthy-owner-B',price:10,seat:1});await normal.page.evaluate(()=>sendOrder({stay:true}));await tick(normal.page);await payScreen(normal.page);await charge(normal.page);
 check('control: legitimate draft removal permits normal settlement',(await db(normal.page)).checks[normalCid].status,'paid',{control:true});
});
await s.run('B07','New remote seat allergies and kitchen notes remain authoritative through refresh, save, send and restart',async ctx=>{
 const {check,tick}=ctx;const {page:p}=await openPos(ctx);const cid=await p.evaluate(()=>activeCheckId());
 await p.evaluate(()=>{sessionOf('1').allergies={'2':['Dairy']};sessionOf('1').kitchenNote='MOCK previous note';persistCheck(STATE.checks[activeCheckId()]);});await tick(p);
 const remote=await p.evaluate(cid=>{
  const ch={...JSON.parse(JSON.stringify(STATE.checks[cid])),allergies:{'2':['Dairy'],'2A':['Tree Nut'],'3':['Fish']},kitchenNote:'MOCK latest kitchen restrictions',updatedAt:Date.now()+1000};
  __MOCK_DB__.__rawSet('checks',cid,ch);ingestOpenChecks([ch]);return ch;
 },cid);await tick(p);
 check('control: original position 2 restriction is retained',await p.evaluate(()=>flagsForSeat('2','1')),['Dairy'],{control:true});
 check('fresh position 2A restriction is applied',await p.evaluate(()=>flagsForSeat('2A','1')),['Tree Nut']);
 check('fresh position 3 restriction is applied',await p.evaluate(()=>flagsForSeat('3','1')),['Fish']);
 check('fresh kitchen note replaces a clean stale local note',await p.evaluate(()=>sessionOf('1').kitchenNote),remote.kitchenNote);
 await addMock(p,{id:'new-fish-request',seat:3,allergens:['Fish'],verified:true});
 check('newly flagged guest cannot silently receive a conflicting item',await p.evaluate(()=>STATE.currentOrder.some(l=>l.id==='new-fish-request')),false);
 await p.evaluate(()=>{closeSheet();persistCheck(STATE.checks[activeCheckId()]);});await tick(p);
 check('later save cannot erase fresh cloud restrictions',(await db(p)).checks[cid].allergies,remote.allergies);
 await addMock(p,{id:'compatible-after-refresh',seat:'2A',allergens:['Gluten'],verified:true});await p.evaluate(()=>sendOrder({stay:true}));await tick(p);
 const data=await db(p),ticket=Object.values(data.orders||{}).find(o=>(o.items||[]).some(i=>i.id==='compatible-after-refresh'));
 check('new kitchen line carries the exact guest restriction',ticket?.items.find(i=>i.id==='compatible-after-refresh').guestAllergies||[],['Tree Nut']);
 check('new ticket carries the latest kitchen note',ticket?.kitchenNote||'',remote.kitchenNote);
 const fresh=await openPos(ctx,data);
 check('new device restores both distinct positions',await fresh.page.evaluate(()=>({'2':flagsForSeat('2','1'),'2A':flagsForSeat('2A','1'),'3':flagsForSeat('3','1')})),remote.allergies);
});
await s.run('B08','Selected modifier allergens and specific nut labels produce correct warnings without 2/2A crossover',async ctx=>{
 const {check}=ctx;const {page:p}=await openPos(ctx);
 const risks=await p.evaluate(()=>{
  const cases=[['Nuts','Almond',true],['Tree Nut','Almond',true],['Tree Nuts','Hazelnuts',true],['Tree Nut','Walnut',true],['Nuts','Tree Nut (hazelnut)',true],['Nuts','Peanut',true],['Peanut','Tree Nut',false],['Tree Nut','Peanut',false],['Nuts','Nutmeg',false],['Nuts','Donut',false],['Nuts','unclassified nut ingredient',true],['Fish','Fish',true],['Fish','Gluten',false]];
  return cases.map(([flag,label,warn])=>{sessionOf('1').allergies={'2A':[flag]};const r=allergenRisk({verified:true,allergens:[label]},'2A','1');return {flag,label,warn,actual:r.flags.length>0&&(r.conflicts.length>0||r.unverified)};});
 });
 for(const r of risks)check('label '+r.flag+' vs '+r.label,r.actual,r.warn,{control:['Fish vs Fish','Fish vs Gluten'].includes(r.flag+' vs '+r.label)});
 for(const [seat,conflicting]of [['2A',true],['2',false]]){
  const {page:q}=await openPos(ctx);
  await q.evaluate(seat=>{
   sessionOf('1').allergies={'2':['Dairy'],'2A':['Tree Nut']};
   STATE.modGroups.push({id:'review-garnish',name:'MOCK garnish',required:false,multi:false,options:[{id:'review-nut',name:'MOCK nut topping',up:1,allergens:['Tree Nut'],verified:true}]});
   const item={id:'review-base',name:'MOCK verified base',price:10,station:'Hot',category:'Entrées',verified:true,allergens:['Gluten'],modGroupIds:['review-garnish']};
   STATE.menuItems.push(attachFoodModifiers(item,item));STATE.activeSeat=seat;beginAddItem(item.id);
  },seat);
  check(seat+': control base item is compatible before selecting garnish',await q.evaluate(()=>{const r=allergenRisk(STATE.pendingItem,STATE.pendingItem.seat);return r.conflicts.length===0&&!r.unverified;}),true,{control:true});
  await q.getByRole('button',{name:/^MOCK nut topping/}).click();
  await q.getByRole('button',{name:/^(Add to order|Add & keep ordering)$/}).click();
  const added=await q.evaluate(()=>STATE.currentOrder.filter(l=>l.id==='review-base').map(l=>({seat:String(l.seat),price:l.price})));
  if(conflicting){
   check('Tree Nut garnish cannot silently commit at flagged 2A',added,[]);
   check('selected allergen is visibly warned before commit',await q.evaluate(()=>/allergy warning/i.test(document.getElementById('sheet-overlay').innerText)),true);
  }else check('compatible guest 2 remains independent and retains modifier price',added,[{seat:'2',price:11}],{control:true});
 }
});
await s.run('I02','EVEN /n selected from Split remains selected on the first Payment screen and charges exact shares',async ctx=>{
 const {check}=ctx;const {page:p}=await openPos(ctx);await sent(p);
 // Explicitly exercise Split -> EVEN -> /3, not the different /3 button inside Payment.
 await p.evaluate(()=>openSplitOverlay());await p.getByRole('button',{name:'EVEN',exact:true}).click();await p.getByRole('button',{name:'/3',exact:true}).click();
 await p.waitForFunction(()=>squareCard&&document.getElementById('charge-btn'));
 const first=await p.evaluate(()=>({n:STATE.payEven,share:Math.round(payShare(checkTotals().grand)*100),pct:STATE.tipPercent,label:document.getElementById('charge-btn').innerText}));
 check('Split /3 survives opening Payment',first.n,3);
 check('first /3 share has the correct principal cents',first.share,333);
 const labelCents=Math.round(Number(first.label.match(/\$([0-9.]+)/)?.[1]||0)*100);
 check('Charge label uses requested share plus the selected tip',labelCents,333+Math.round(333*first.pct/100));
 // Positive control uses the separate Payment selector; actual three recorded principals must sum to $10 exactly.
 const {page:q}=await openPos(ctx);const ids=await sent(q);
 for(let i=0;i<3;i++){await payScreen(q,3);await charge(q);}
 const d=await db(q),payments=Object.values(d.payments||{}).sort((a,b)=>a.shareIndex-b.shareIndex);
 check('control: Payment selector still yields exact 333/333/334 principals',payments.map(p=>p.subtotal),[333,333,334],{control:true});
 check('control: exact shares settle the check',d.checks[ids.cid].status,'paid',{control:true});
});
await s.run('I03','Required modifier groups use stable identities even when their display names are identical',async ctx=>{
 const {check}=ctx;
 for(const sameName of [false,true]){
  const {page:p}=await openPos(ctx);
  await p.evaluate(sameName=>{
   const groups=[{id:'review-temperature',name:'MOCK preparation',required:true,multi:false,options:[{id:'review-rare',name:'MOCK rare',up:1}]},{id:'review-side',name:sameName?'MOCK preparation':'MOCK side',required:true,multi:false,options:[{id:'review-fries',name:'MOCK fries',up:2}]}];STATE.modGroups.push(...groups);
   const item={id:'review-two-groups',name:'MOCK required groups',price:10,station:'Hot',category:'Entrées',allergens:['Gluten'],verified:true,modGroupIds:groups.map(g=>g.id)};STATE.menuItems.push(attachFoodModifiers(item,item));beginAddItem(item.id);
  },sameName);
  await p.getByRole('button',{name:/^MOCK rare/}).click();
  const early=await p.evaluate(()=>STATE.currentOrder.filter(i=>i.id==='review-two-groups').length);
  check((sameName?'same':'different')+' names: first choice cannot satisfy both required groups',early,0,{control:!sameName});
  // If the buggy application already committed, still run the remaining assertions; do not cause a missing-button setup error.
  if(!early)await p.getByRole('button',{name:/^MOCK fries/}).click();
  const final=await p.evaluate(()=>STATE.currentOrder.find(i=>i.id==='review-two-groups'));
  check((sameName?'same':'different')+' names: both stable group/option IDs are retained',(final?.modifierSelections||[]).map(m=>[m.groupId,m.optionId]).sort(),[['review-side','review-fries'],['review-temperature','review-rare']],{control:!sameName});
  check((sameName?'same':'different')+' names: both deltas contribute exactly once',final?.price??null,13,{control:!sameName});
 }
});
await s.run('I04','Rejected SEND preserves an unpaid recoverable draft and retry creates exactly one durable kitchen ticket',async ctx=>{
 const {check,tick}=ctx;
 const normal=await openPos(ctx);const line=await addMock(normal.page,{id:'normal-send',price:10});await normal.page.evaluate(()=>sendOrder({stay:true}));await tick(normal.page);
 check('control: normal SEND durably publishes one ticket',Object.values((await db(normal.page)).orders||{}).filter(o=>o.items?.some(i=>i.lineId===line)).length,1,{control:true});
 const {page:p}=await openPos(ctx);const cid=await p.evaluate(()=>activeCheckId()),lid=await addMock(p,{id:'retry-send',price:10});
 await p.evaluate(()=>{window.__MOCK_FAIL_WRITES__=['orders/*'];sendOrder({stay:true});});await tick(p);
 const failed=await db(p);
 check('control: rejected transport did not create a kitchen ticket',Object.keys(failed.orders||{}).length,0,{control:true});
 check('rejected SEND cannot display a sent-success message',await p.evaluate(()=>/Sent — staying|Order sent to kitchen|Course fired to kitchen/.test(document.getElementById('toast').innerText)),false);
 check('unacknowledged line remains in the active recoverable draft',await p.evaluate(lid=>STATE.currentOrder.some(l=>l.lineId===lid),lid),true);
 check('unacknowledged line is durably preserved for its owner',(failed.checks[cid].unsentLines||[]).map(l=>l.lineId),[lid]);
 const {page:q}=await openPos(ctx,failed);
 check('new device restores the unpaid item before retry',await q.evaluate(lid=>STATE.currentOrder.some(l=>l.lineId===lid),lid),true);
 await q.evaluate(()=>sendOrder({stay:true}));await tick(q);
 const retried=await db(q),tickets=Object.values(retried.orders||{}).filter(o=>o.items?.some(i=>i.lineId===lid));
 check('retry after restart publishes the original identity once',tickets.length,1);
 check('retry keeps the original unpaid $10 line billable',await q.evaluate(()=>checkTotals().grand),10);
 await q.evaluate(()=>sendOrder({stay:true}));await tick(q);
 check('second retry cannot duplicate the ticket',Object.values((await db(q)).orders||{}).filter(o=>o.items?.some(i=>i.lineId===lid)).length,1);
});
await s.finish();
