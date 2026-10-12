import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM,VirtualConsole} from 'jsdom';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8').replace(/<script\b[^>]*src=[^>]*>[\s\S]*?<\/script>/gi,'');
const dom=new JSDOM(html,{url:'http://127.0.0.1/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:new VirtualConsole()}),w=dom.window;
try{
 w.fbReady=false;w.STATE.currentServer={name:'LAB',code:'5000',role:'manager'};w.STATE.selectedTable='14';const s=w.sessionOf('14');s.guestCount=2;s.femalePositions={'2':true};const c=w.ensureOpenCheck('14');
 s.allergies={'table':['Sulfites'],'2':['Fish']};assert.deepEqual(Array.from(w.seatAllergies('2A')),['Fish'],'Legacy A label must preserve numeric restrictions');
 c.positionIdentities=['1','2','2A'];s.allergies={'table':['Sulfites'],'2':['Fish'],'2A':['Dairy']};
 assert.deepEqual(Array.from(w.allergenHits({allergens:['Fish','Dairy','Sulfites'],seatPriority:false},2)),['Fish','Sulfites']);assert.deepEqual(Array.from(w.allergenHits({allergens:['Fish','Dairy','Sulfites'],seatPriority:true},2)),['Dairy','Sulfites']);
 assert.deepEqual(Array.from(w.allergenHits({allergens:['Fish','Dairy'],seatPriority:true},'2A')),['Dairy'],'Explicit identity must not acquire a second suffix');
 w.setActivePositionIdentity('2A');assert.equal(w.STATE.allergySeat,'2A');assert.match(w.renderGuestAllergyStrip(),/Seat 2A/);
 const before=JSON.stringify(s.allergies);w.toggleAllergy('9','Fish');w.toggleAllergy('2A','NotAnApprovedAllergen');assert.equal(JSON.stringify(s.allergies),before,'Invalid identity/allergen changed restrictions');
 w.toggleAllergy('2A','Dairy',true);assert.deepEqual(Array.from(s.allergies['2']),['Fish']);assert.deepEqual(Array.from(s.allergies['2A']),[]);assert.deepEqual(Array.from(s.allergies.table),['Sulfites']);
 console.log('PASS: exact 2/2A, legacy keys, table restrictions and invalid allergy mutation guards. No backend/Voice/kitchen.');
}finally{dom.window.close();}
