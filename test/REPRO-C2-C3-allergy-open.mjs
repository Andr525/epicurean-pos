// Investigation only: intentional nonzero exit while these unresolved defects reproduce.
// No Firebase/storage/kitchen calls; serialize and re-ingest actual check projection locally.
import {readFileSync} from 'node:fs';import {JSDOM,VirtualConsole} from 'jsdom';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8').replace(/<script\b[^>]*src=[^>]*>[\s\S]*?<\/script>/gi,'');const dom=new JSDOM(html,{url:'http://127.0.0.1/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:new VirtualConsole()}),w=dom.window,cases=[];
try{
 w.eval(readFileSync(new URL('../lab/fixtures/scalini-dining.js',import.meta.url),'utf8'));w.fbReady=false;w.STATE.currentServer={name:'LAB',code:'5000',role:'manager'};w.STATE.selectedTable='14';const sess=w.sessionOf('14');sess.guestCount=3;sess.femalePositions={'2':true};const check=w.ensureOpenCheck('14');check.positionIdentities=['1','2','2A','3'];sess.allergies={table:[],2:['Fish'],'2A':['Dairy'],3:[]};w.persistCheck(check);const saved=JSON.parse(JSON.stringify(check));
 w.STATE.tableSessions={};w.STATE.checks={};w.STATE.viewCheckId=null;w.ingestOpenChecks([saved]);const restored=w.sessionOf('14').allergies;
 cases.push({id:'C2-local-check-roundtrip',status:restored['2']?.includes('Fish')&&restored['2A']?.includes('Dairy')?'passed':'failed',persistedAllergies:saved.allergies||null,restored,limitation:'Actual persistCheck serialization + ingestOpenChecks; no live Firebase or physical reload'});
 w.sessionOf('14').guestCount=3;w.openPositionSubSheet('welcome');const controls=[...w.document.querySelectorAll('.pos-sub-input')].map(e=>e.dataset.seat);cases.push({id:'C3-substitution-editor',status:controls.includes('2')&&controls.includes('2A')?'passed':'failed',controls});
 const pf=w.EPICUREAN_SCALINI.prixFixe,course=w.buildPrixFixeSelections(pf,{}).find(c=>w.isWelcomeTrioCourse(c));const menu={seat:2,seatPriority:true,positionSubs:{welcome:{'2':'LAB NOTE FOR 2','2A':'LAB NOTE FOR 2A'}}};const note=w.diningPositionSubNote(menu,course);cases.push({id:'C3-exact-substitution-lookup',status:note.includes('LAB NOTE FOR 2A')?'passed':'failed',actual:note,expected:'2A — LAB NOTE FOR 2A'});
 console.log(JSON.stringify({mode:'source-backed local investigation',cases,kitchenActions:0,firebaseWrites:0},null,2));if(cases.some(c=>c.status==='failed'))process.exitCode=1;
}finally{w.close();}
