import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {JSDOM,VirtualConsole} from 'jsdom';
const source=process.env.POS_SOURCE_COMMIT?execFileSync('git',['show',process.env.POS_SOURCE_COMMIT+':index.html'],{cwd:new URL('..',import.meta.url),encoding:'utf8'}):readFileSync(new URL('../index.html',import.meta.url),'utf8');
const html=source.replace(/<script\b[^>]*src=[^>]*>[\s\S]*?<\/script>/gi,'');
const w=new JSDOM(html,{url:'http://127.0.0.1/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:new VirtualConsole()}).window;
try{
 w.eval(readFileSync(new URL('../lab/fixtures/scalini-dining.js',import.meta.url),'utf8'));w.fbReady=false;w.STATE.currentServer={name:'LAB',role:'manager',code:'5000'};w.STATE.selectedTable='14';const c=w.ensureOpenCheck('14');c.positionIdentities=['1','2','2A','3'];w.STATE.prixFixeMenus=[w.hydratePrixFixeMenu(w.EPICUREAN_SCALINI.prixFixe)];w.STATE.tastingMenus=[w.EPICUREAN_SCALINI.tasting];w.setActivePositionIdentity('2A');w.sessionOf('14').allergies={table:[],'2':['Fish'],'2A':['Tree Nut']};
 assert(!w.listPrixFixeExtraDishes().some(d=>d.id==='sf_e_sorbet'),'Entremet exposed as extra dessert');
 w.openPrixFixeSelector(w.EPICUREAN_SCALINI.prixFixe.id);w.document.querySelector('#pf-mod-note').value='Replace granola: allergy confirmed';w.confirmPrixFixe(w.EPICUREAN_SCALINI.prixFixe.id);assert.equal(w.STATE.currentOrder.length,0,'Free-text note bypassed Tree Nut conflict');assert.match(w.document.querySelector('[data-manual-allergy-block]').textContent,/Position 2A/);assert.match(w.document.querySelector('[data-manual-allergy-block]').textContent,/Tree Nut/);
 w.closePfSelector();w.addTastingMenu(w.EPICUREAN_SCALINI.tasting.id);assert.equal(w.STATE.currentOrder.length,0,'Tasting bypassed pre-add allergy warning');assert.match(w.document.querySelector('#sheet-overlay').textContent,/substitution note does not remove BOH allergens/);
 w.closeSheet();w.sessionOf('14').allergies['2A']=[];w.openPrixFixeSelector(w.EPICUREAN_SCALINI.prixFixe.id);w.confirmPrixFixe(w.EPICUREAN_SCALINI.prixFixe.id);assert.equal(w.STATE.currentOrder.length,1);assert.equal(w.orderPositionIdentity(w.STATE.currentOrder[0]),'2A');assert.equal(w.STATE.currentOrder[0].price,w.EPICUREAN_SCALINI.prixFixe.price);w.setActivePositionIdentity('3');w.addTastingMenu(String(w.EPICUREAN_SCALINI.tasting.id));assert.equal(w.STATE.currentOrder.length,2,'Numeric BOH tasting ID rejected by UI string');assert.equal(w.STATE.currentOrder[1].price,w.EPICUREAN_SCALINI.tasting.price);assert.equal(w.STATE.orders.length,0);
 console.log('PASS: authentic Tree Nut entremet blocks PF/tasting before add; notes cannot clear allergens; exact 2A preserved; entremet excluded from extra sale. No transport/database.');
}finally{w.close();}
