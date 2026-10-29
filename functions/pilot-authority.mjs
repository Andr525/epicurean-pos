import { createHash } from 'node:crypto';
export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const copy = value => structuredClone(value);
const list = d => Array.isArray(d?.list) ? d.list : [];
const courseNumber = c => /dolce|dessert/i.test(c) ? 4 : /primi|appetizer|starter|small/i.test(c) ? 2 : /bar|drink|wine|cocktail/i.test(c) ? 1 : 3;
const options = group => (group.options || []).map(o => typeof o === 'string' ? o : o.name);
function groups(item) {
 const result=(item.modifiers||[]).map(g=>({group:g.group,options:options(g)}));
 if(item.askTemp && !(item.askTemp==='pork' && /medallion/i.test(item.name||'')) && !result.some(g=>/temp/i.test(g.group))) {
  // Exact options used by the existing manual POS, not model-supplied temperatures.
  const values=item.askTemp==='pork'?['Medium','Medium Well','Well Done']:item.askTemp==='salmon'?['Rare','Medium Rare','Medium','Well Done']:item.askTemp==='steak'?['Rare','Medium Rare','Medium','Medium Well','Well Done']:[];
  if(values.length) result.push({group:'Temperature',options:values});
 }
 return result;
}
export function authorityFromDocuments(docs,check) {
 const control=docs.voice_vocab_active;
 if(!control?.activeRevision || !Array.isArray(control.chunkIds) || !control.chunkIds.length) throw new Error('Published BOH vocabulary unavailable');
 const entries=control.chunkIds.flatMap(id=>{if(!Array.isArray(docs[id]?.entries))throw new Error('BOH vocabulary chunk unavailable');return docs[id].entries;});
 const menus=list(docs.prix_fixe_menus).filter(m=>m.active!==false).map(m=>({id:m.id,name:m.name,price:Number(m.price),courses:m.courses||[]}));
 const catalog=new Map();
 const names=new Map();
 for(const e of entries){const key=String(e.sourceId);if(names.has(key)&&names.get(key).sourceType!==e.sourceType)throw new Error('Ambiguous BOH source type');names.set(key,e);}
 const add=(record,course,menuId=null)=>{
  if(!record?.id || !names.has(String(record.id))) return;
  const id=String(record.id),prior=catalog.get(id),entry=names.get(id);
  const item={id,name:record.name,course,station:record.station||null,price:Number(record.price)||0,upcharge:Number(record.upcharge)||0,
   active:record.active!==false,eightySixed:!!(record.eightySixed||record.is86),allergens:record.allergens||[],modifiers:groups(record),
   voiceAliases:entry.voiceAliases||[],voiceKeyword:entry.voiceKeyword,menuIds:menuId?[menuId]:[],
   wine:record.vin?{vin:String(record.vin),producer:record.producer||'',vintage:String(record.vintage||''),size:String(record.size||'')}:null};
  if(prior) {
   if(prior.name!==item.name||prior.course!==item.course||prior.price!==item.price||prior.upcharge!==item.upcharge||prior.active!==item.active||prior.eightySixed!==item.eightySixed||JSON.stringify(prior.allergens)!==JSON.stringify(item.allergens)||JSON.stringify(prior.modifiers)!==JSON.stringify(item.modifiers)) throw new Error('Conflicting BOH source identity: '+id);
   if(menuId&&!prior.menuIds.includes(menuId)) prior.menuIds.push(menuId);
  }else catalog.set(id,item);
 };
 for(const item of docs.menu?.items||[])add(item,courseNumber([item.category,...(item.catIds||[])].join(' ')));
 for(const item of list(docs.daily_specials))add(item,courseNumber(item.course));
 for(const item of list(docs.bar))add(item,1);
 for(const item of list(docs.wines))add(item,1);
 for(const key of Object.keys(docs).filter(k=>/^wines_\d+$/.test(k)))for(const item of list(docs[key]))add(item,1);
 for(const menu of menus)for(const c of menu.courses)if(!c.auto&&!c.fireEach&&!['auto','entremets'].includes(c.mode))for(const item of c.options||[])add({...item,station:item.station||c.station},courseNumber(c.label||c.name||''),menu.id);
 if(!catalog.size)throw new Error('BOH catalog unavailable');
 if(!check||check.status!=='open')throw new Error('Open check required');
 // Explicit BOH/check identities can contain both 2 and 2A. Never infer a new identity from speech.
 const seats=check.positionIdentities || Array.from({length:check.guestCount||0},(_,i)=>String(i+1)+(check.femalePositions?.[String(i+1)]?'A':''));
 if(!Array.isArray(seats)||!seats.length||new Set(seats).size!==seats.length||seats.some(s=>!/^([1-9]|1\d|20)A?$/.test(s)))throw new Error('Authoritative positions unavailable');
 const revision=digest({control,docs});
 return {revision,vocabRevision:String(control.activeRevision),items:[...catalog.values()],menus,seats,checkId:check.id,table:String(check.table),checkRevision:check.updatedAt,allergies:check.allergies||{}};
}
export function firestoreAuthority(db) {
 return async ({checkId,table})=>{
  if(!/^[A-Za-z0-9_-]{1,120}$/.test(checkId))throw new Error('Invalid check');
  const ids=['voice_vocab_active','menu','prix_fixe_menus','daily_specials','bar','wines'];
  const snapshots=await db.getAll(...ids.map(id=>db.collection('boh_shared').doc(id)),db.collection('checks').doc(checkId));
  const docs=Object.fromEntries(ids.map((id,i)=>[id,snapshots[i].exists?snapshots[i].data():null]));
  const checkSnap=snapshots.at(-1),check=checkSnap.exists?{...checkSnap.data(),id:checkId}:null;
  if(!check||String(check.table)!==String(table))throw new Error('Check/table mismatch');
  const chunks=docs.voice_vocab_active?.chunkIds;
  if(!Array.isArray(chunks)||chunks.length>100||chunks.some(id=>typeof id!=='string'||! /^[A-Za-z0-9_-]{1,120}$/.test(id)))throw new Error('Invalid BOH vocabulary publication');
  const wineCount=Number(docs.wines?.chunkCount)||1;
  if(wineCount>100)throw new Error('Invalid BOH cellar publication');
  const extra=[...chunks,...Array.from({length:Math.max(0,wineCount-1)},(_,i)=>'wines_'+(i+1))];
  const loaded=extra.length?await db.getAll(...extra.map(id=>db.collection('boh_shared').doc(id))):[];
  extra.forEach((id,i)=>{if(!loaded[i].exists)throw new Error('Incomplete BOH publication');docs[id]=loaded[i].data();});
  return authorityFromDocuments(docs,check);
 };
}
export function validateOperation(op,authority,pricing,targets) {
 const allowed=['action','itemId','seat','course','mods','notes','target','proposalId'];
 if(!op||Object.keys(op).some(k=>!allowed.includes(k))||!['add','replace','remove'].includes(op.action))throw new Error('Invalid interpreted operation');
 const item=authority.items.find(i=>i.id===op.itemId);
 if(!item||!item.active||item.eightySixed)throw new Error('Item unavailable in actual BOH catalog');
 if(!authority.seats.includes(op.seat)||op.course!==item.course)throw new Error('Invalid BOH position or course');
 if(op.notes!=='')throw new Error('Unapproved free-text modifications are not allowed');
 if(!op.mods||typeof op.mods!=='object'||Array.isArray(op.mods))throw new Error('Invalid modifications');
 for(const [group,value] of Object.entries(op.mods))if(!item.modifiers.some(g=>g.group===group&&g.options.includes(value)))throw new Error('Modification is not approved by BOH');
 const allergies=[...(authority.allergies.table||[]),...(authority.allergies[op.seat]||[])];
 if(item.allergens.some(a=>allergies.some(b=>String(a).toLowerCase()===String(b).toLowerCase())))throw new Error('Allergy conflict requires manual resolution');
 if(op.action==='add'&&op.target!==null)throw new Error('An add cannot carry a correction target');
 if(op.action!=='add') {
  const target=targets.find(t=>t.proposalId===op.target);
  if(!target||target.seat!==op.seat||target.course!==op.course)throw new Error('Correction requires an exact owned target and position');
 }
 if(pricing==='a-la-carte') {if(!(item.price>0))throw new Error('No BOH standalone price; choose the actual menu');}
 else {
  const menu=authority.menus.find(m=>m.id===pricing&&m.price>0);
  if(!menu||!item.menuIds.includes(pricing))throw new Error('Choice unavailable on selected BOH menu');
 }
 if(op.action!=='remove'&&item.modifiers.some(g=>!op.mods[g.group]))throw new Error('BOH required modification is missing');
 return {...op,mods:{...op.mods}};
}
export function kitchenEnvelope(session,authority,confirmationId) {
 const orders=[];
 for(const seat of [...new Set(session.proposal.map(o=>o.seat))]) {
  const selected=session.proposal.filter(o=>o.seat===seat);
  if(session.pricing!=='a-la-carte'&&(!selected.some(o=>o.course===2)||!selected.some(o=>o.course===3)))throw new Error('Each prix-fixe guest needs appetizer and main');
  if(session.pricing!=='a-la-carte'&&new Set(selected.map(o=>o.course)).size!==selected.length)throw new Error('Only one included dish per course/position');
  const menu=authority.menus.find(m=>m.id===session.pricing);
  const lines=selected.map(op=>{
   const item=authority.items.find(i=>i.id===op.itemId);
   return {lineId:op.proposalId,sourceId:item.id,name:item.name,positionId:seat,course:op.course,station:item.station,quantity:1,modifiers:{...op.mods},wine:item.wine,status:'unsent',fired:false};
  });
  const price=menu?menu.price+selected.reduce((n,op)=>n+(authority.items.find(i=>i.id===op.itemId).upcharge||0),0):selected.reduce((n,op)=>n+authority.items.find(i=>i.id===op.itemId).price,0);
  orders.push({orderId:session.id+'-'+seat,positionId:seat,menuId:menu?.id||null,menuName:menu?.name||null,pricing:{currency:'USD',total:price,authority:'BOH'},lines});
 }
 return {schemaVersion:1,confirmationId,sessionId:session.id,table:session.table,checkId:session.checkId,catalogRevision:authority.revision,vocabRevision:authority.vocabRevision,state:'unsent',send:false,fire:false,orders};
}
