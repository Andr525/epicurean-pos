// Independently created from the owner's supplied C1 steps; not Claude's original attachment.
// Uses the actual tracked BOH Fish dish metadata; no invented standalone price or backend.
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';import {JSDOM,VirtualConsole} from 'jsdom';
const source=process.env.POS_SOURCE_COMMIT?execFileSync('git',['show',process.env.POS_SOURCE_COMMIT+':index.html'],{encoding:'utf8'}):readFileSync(new URL('../index.html',import.meta.url),'utf8');
const html=source.replace(/<script\b[^>]*src=[^>]*>[\s\S]*?<\/script>/gi,'');
const dom=new JSDOM(html,{url:'http://127.0.0.1/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:new VirtualConsole()}),w=dom.window;
try{
 w.eval(readFileSync(new URL('../lab/fixtures/scalini-dining.js',import.meta.url),'utf8'));w.fbReady=false;w.STATE.currentServer={name:'LAB',role:'manager',code:'5000'};w.STATE.selectedTable='14';const sess=w.sessionOf('14');sess.guestCount=3;sess.femalePositions={'2':true};const check=w.ensureOpenCheck('14');check.positionIdentities=['1','2','2A','3'];sess.allergies={table:[],2:['Fish'],'2A':['Dairy'],3:['Fish']};
 const dish=w.EPICUREAN_SCALINI.prixFixe.dishes.find(d=>d.id==='sf_m_sole');assert.ok(dish.allergens.some(a=>a.toLowerCase()==='fish'));
 function pending(){w.STATE.currentOrder=[];w.STATE.pendingItem={...JSON.parse(JSON.stringify(dish)),lineId:'lab-c1',table:'14',checkId:check.id,seat:2,seatPriority:true,qty:1,course:3,mods:{},modifiers:[],notes:''};w.renderModifierSheet();}
 function clickSeat(id){const buttons=[...w.document.querySelectorAll('#sheet-overlay .seat-pick-list button')];const b=buttons.find(b=>b.dataset.pendingPosition===id||b.textContent.trim()==='Seat '+id);assert.ok(b,'Missing exact modifier position '+id);b.click();}
 // Baseline C1 reproduction: changing numeric3 alone retains seatPriority:true.
 pending();clickSeat('3');assert.equal(w.orderPositionIdentity(w.STATE.pendingItem),'3','Phantom 3A position: stale priority suffix survived modifier-seat switch');w.maybeAllergyThenAdd();assert.match(w.document.querySelector('#sheet-overlay').textContent,/Seat 3 flagged: Fish/);assert.equal(w.STATE.currentOrder.length,0,'Fish warning bypassed');
 // All transitions must agree with exact identity and warn only on the registered guest.
 for(const id of ['2A','2','3','2A','3','2']){pending();clickSeat(id);assert.equal(w.orderPositionIdentity(w.STATE.pendingItem),id);assert.ok(check.positionIdentities.includes(w.orderPositionIdentity(w.STATE.pendingItem)));w.maybeAllergyThenAdd();if(id!=='2A'){assert.match(w.document.querySelector('#sheet-overlay').textContent,new RegExp('Seat '+id+' flagged: Fish'));assert.equal(w.STATE.currentOrder.length,0);}else{assert.equal(w.STATE.currentOrder.length,1);assert.equal(w.orderPositionIdentity(w.STATE.currentOrder[0]),'2A');}}
 pending();w.setPendingPosition('3A');assert.equal(w.orderPositionIdentity(w.STATE.pendingItem),'2A','Invalid setter mutated identity');w.STATE.pendingItem.seat=3;w.STATE.pendingItem.seatPriority=true;w.commitPendingItem();assert.equal(w.STATE.currentOrder.length,0,'Forged phantom identity committed');
 pending();w.setPendingPosition('table');assert.equal(w.STATE.pendingItem.seatPriority,false,'Share inherited priority');w.STATE.pendingItem.seatPriority=true;w.commitPendingItem();assert.equal(w.STATE.currentOrder.length,0,'Forged tableA committed');
 console.log('PASS:C1 exact modifier2/2A/3 transitions; no phantom and Fish warning retained. No standalone-price or durable claim.');
}finally{w.close();}
