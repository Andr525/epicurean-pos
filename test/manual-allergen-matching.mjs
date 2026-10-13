// Independent label/boundary regression; metadata variants are adversarial inputs, not published BOH changes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {JSDOM,VirtualConsole} from 'jsdom';
const source=process.env.POS_SOURCE_COMMIT?execFileSync('git',['show',process.env.POS_SOURCE_COMMIT+':index.html'],{encoding:'utf8'}):readFileSync(new URL('../index.html',import.meta.url),'utf8');
const w=new JSDOM(source.replace(/<script\b[^>]*src=[^>]*>[\s\S]*?<\/script>/gi,''),{url:'http://127.0.0.1/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:new VirtualConsole()}).window;
const results=[];
const snapshot=()=>JSON.stringify({order:w.STATE.currentOrder,dining:w.STATE.activeTastingOrders,orders:w.STATE.orders,allergies:w.sessionOf('14').allergies});
try{
 w.eval(readFileSync(new URL('../lab/fixtures/scalini-dining.js',import.meta.url),'utf8'));
 w.eval(readFileSync(new URL('../lab/fixtures/cellar.js',import.meta.url),'utf8'));
 w.fbReady=false;w.STATE.currentServer={name:'LAB',code:'5000',role:'manager'};w.STATE.selectedTable='14';
 w.sessionOf('14').guestCount=3;w.ensureOpenCheck('14').positionIdentities=['1','2','2A','3'];w.setActivePositionIdentity('2A');
 const cases=[['Nuts','Tree Nut'],['Tree Nut','Nuts'],['Nuts','Peanut'],['Peanut','Nuts'],['Nut','Tree Nuts'],['tree-nut(s)','NUTS'],['Nuts','Groundnuts'],['Peanuts','peanut'],['TREE_NUTS','Tree Nut'],['Eggs','Egg'],['Sulphites','Sulfite']];
 for(const label of ['hazelnut','Hazelnuts','almond','Almonds','walnut','Walnuts','cashew','pecans','pistachios','macadamia','Brazil nuts','Pine nuts','Tree Nut (hazelnut)','Tree Nuts (almonds, walnuts)','Peanut (roasted)','Unknown nuts','mysterynut','Nut ingredient (unclassified)']){
  cases.push(['Nuts',label],[label,'Nuts']);
  if(!label.startsWith('Peanut')) cases.push(['Tree Nut',label],[label,'Tree Nut']);
 }
 cases.push(['Peanut','Unknown nuts']);
 for(const [guest,item] of cases){
  w.sessionOf('14').allergies={table:[],2:[],'2A':[guest]};
  const candidate={lineId:'LAB-label-probe',table:'14',checkId:w.activeCheckId(),seat:2,seatPriority:true,name:'LAB metadata probe',allergens:[item],mods:{},modifiers:[],notes:'Remove nuts; safe',allergyConfirmed:true};
  // No product or price created: conflicting metadata must be rejected before order creation.
  assert.equal(w.allergensConflict(guest,item),true);
  assert.equal(w.allergenHits(candidate,'2A').length,1);assert.equal(w.allergenHits({...candidate,seatPriority:false},'2').length,0);
  assert.equal(w.guestAllergyHits([item]).length,1);
  assert.equal(w.manualMenuAllergyWarning([{name:candidate.name,allergens:[item]}],'2A','14'),true);
  w.STATE.pendingItem=candidate;const before=snapshot();w.commitPendingItem();assert.equal(snapshot(),before,guest+' vs '+item+' mutated order');
  assert.match(w.document.querySelector('#sheet-overlay').textContent,/Position 2A/);
  w.STATE._editingLineId='LAB-existing';w.commitPendingItem();assert.equal(snapshot(),before);w.STATE._editingLineId=null;
  w.STATE._replaceLineId='LAB-existing';w.commitPendingItem();assert.equal(snapshot(),before);w.STATE._replaceLineId=null;
  assert.equal(w.sessionOf('14').allergies['2'].length,0);assert.deepEqual(Array.from(w.sessionOf('14').allergies['2A']),[guest]);
  results.push({guest,item,result:'PASS',evidence:'synthetic label metadata; direct mutation blocked, order unchanged'});
 }
 for(const [a,b] of [['Tree Nut','Peanut'],['Tree Nuts','Groundnuts'],['Peanut','Tree Nut'],['Fish','Shellfish'],['Nutmeg','Nuts'],['Nuts','Donut'],['Nuts','Doughnuts'],['Tree Nut','Nutmeg'],['Tree Nut','Peanut (roasted)'],['Peanut','Tree Nut (hazelnut)'],['Peanut','Almonds']]){
  assert.equal(w.allergensConflict(a,b),false);w.sessionOf('14').allergies={'2A':[a]};
  assert.equal(w.manualMenuAllergyWarning([{name:'LAB compatible metadata',allergens:[b]}],'2A','14'),false);
  results.push({guest:a,item:b,result:'PASS',evidence:'specific categories remain separate'});
 }
 // Actual priced BOH beverage can still be added with broad allergy and keeps exact guest identity.
 w.closeSheet();w.STATE.pendingItem=null;w.STATE.prixFixeMenus=[w.hydratePrixFixeMenu(w.EPICUREAN_SCALINI.prixFixe)];w.STATE.tastingMenus=[w.EPICUREAN_SCALINI.tasting];w.STATE.menuLive=true;w.STATE.foodItems=[];w.STATE.wines=[];w.STATE.bar=w.BINWISE_CELLAR.beers;w.rebuildPosCatalog();
 w.sessionOf('14').allergies={table:['Nuts'],2:['Peanut'],'2A':['Nuts']};
 const beer=w.STATE.menuItems.find(i=>i.source==='bar'&&!i.eightySixed);assert(beer);
 w.beginAddItem(beer.id);assert.equal(w.STATE.currentOrder.length,1);assert.equal(w.orderPositionIdentity(w.STATE.currentOrder[0]),'2A');assert.equal(w.STATE.currentOrder[0].price,beer.price);
 w.sessionOf('14').allergies={table:[],2:['Peanut'],'2A':['Nuts']};w.setActivePositionIdentity('2');w.beginAddItem(beer.id);assert.equal(w.STATE.currentOrder.length,2);assert.equal(w.orderPositionIdentity(w.STATE.currentOrder[1]),'2');assert.equal(w.orderPositionIdentity(w.STATE.currentOrder[0]),'2A');
 results.push({result:'PASS',evidence:'authentic compatible beverage added at 2A with original BOH price'});
 console.log(JSON.stringify({results,limitations:['Label variants use synthetic metadata only; no authentic peanut-bearing published dish supplied','No database, kitchen transport or physical device test']},null,2));
}finally{w.close();}
