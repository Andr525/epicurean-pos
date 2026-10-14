/* Isolated manual pilot only. No kitchen transport or allergen-free certification. */
(function(){
 'use strict';
 if(window.EPICUREAN_LAB_MANUAL!==true||window.EPICUREAN_LAB_SCREEN_ONLY!==true)return;
 const clone=x=>JSON.parse(JSON.stringify(x));
 const requestStyle=document.createElement('style');requestStyle.textContent='[data-lab-request] h3{font-size:16px;margin:8px 0}[data-lab-request] fieldset{margin:8px 0;padding:8px}[data-lab-request] textarea{width:100%;box-sizing:border-box;font-size:16px;min-height:48px}[data-lab-request] button{min-height:36px;padding:6px;margin:3px}[data-lab-request] .sheet-sub{font-size:12px;line-height:1.35}';document.head.appendChild(requestStyle);
 const notice='Modified dishes may still involve allergen cross-contact. Ingredient removal does not certify an allergen-free dish. Kitchen review is required before modified preparation.';
 let action=null,proposal=null,review=null,selector=null;
 const requestName=c=>String(c.choice||c.name||c.course||'').split(' · ')[0];
 const requestToken=c=>requestName(c)+'|'+(c.serviceCourse??'')+'|'+(c.optionId||c.id||'');
 const audit=()=>STATE.labAllergyAudit||(STATE.labAllergyAudit=[]);
 function entries(){const out=[];for(const line of STATE.currentOrder||[]){
  const to=(STATE.activeTastingOrders||[]).find(t=>t._boundLine===line.lineId||t.id===line.diningOrderId);
  if(to){diningCourses(to).forEach((item,index)=>out.push({key:'course:'+to.id+':'+index,item,parent:to,line,index}));}
  else out.push({key:'line:'+line.lineId,item:line,parent:line,line});
 }return out;}
 function get(key){if(fbReady!==false||fbDb!==null)return null;return entries().find(e=>e.key===key&&String(e.parent.table)===String(STATE.selectedTable)&&e.line.checkId===activeCheckId());}
 function context(e){return exactPositionAllergyContext(orderPositionIdentity(e.parent),e.parent.table);}
 function conflicts(courses,identity,table){const ctx=exactPositionAllergyContext(identity,table);return (courses||[]).filter(c=>!c.noneChoice&&!c.headingOnly&&!c.pending).map(c=>({item:c,hits:asList(c.allergens).filter(a=>ctx.effectiveAllergens.some(b=>allergensConflict(a,b)))})).filter(c=>c.hits.length);}
 function fingerprint(e){return JSON.stringify({name:e.item.choice||e.item.name,id:e.item.optionId||e.item.id,allergens:e.item.allergens||[],notes:e.item.notes,modNote:e.item.modNote,temp:e.item.selectedTemp,scoops:e.item.scoopChoice,mods:e.item.mods,qty:e.item.qty,menuQuantity:e.line.qty,pending:e.item.pending,noneChoice:e.item.noneChoice,skipped:e.item.skipped,position:orderPositionIdentity(e.parent),context:context(e),course:e.item.serviceCourse||e.item.course});}
 function stamp(e,kind,reason,original){const record={id:genId(),kind,time:new Date().toISOString(),actor:kind.startsWith('kitchen-')?'SIMULATED LAB Kitchen reviewer':(STATE.currentServer?.name||'LAB staff'),table:String(e.parent.table),checkId:e.line.checkId,position:orderPositionIdentity(e.parent),key:e.key,reason:String(reason||''),item:clone(e.item),...(original?{original:clone(original)}:{})};audit().push(record);return record;}
 function sync(e){if(e.index!=null){const property=e.line.isTasting?'courses':'selections';if(e.line[property])e.line[property][e.index]=clone(e.item);
   if(e.line.isPrixFixe){const pf=findPrixFixeMenu(e.line.prixFixeId);if(pf){e.line.price=Number(pf.price)+diningCourses(e.parent).reduce((n,c)=>n+(c.pending||c.noneChoice?0:Number(c.upcharge)||0),0);e.parent.totalPrice=e.line.price;}}}
  const check=STATE.checks[e.line.checkId];if(check){check.labAllergyAudit=clone(audit().filter(r=>r.checkId===check.id));persistCheck(check);}}
 function summary(e){const hits=conflicts([e.item],orderPositionIdentity(e.parent),e.parent.table);return {position:orderPositionIdentity(e.parent),table:String(e.parent.table),checkId:e.line.checkId,course:e.item.serviceCourse||e.item.course,allergyContext:clone(context(e)),bohAllergens:asList(e.item.allergens),warnings:hits.flatMap(h=>h.hits)};}
 function stable(){return JSON.stringify({table:STATE.selectedTable,check:activeCheckId(),position:selectedPositionIdentity(),pending:STATE.pendingItem,allergies:sessionOf(STATE.selectedTable).allergies,lines:STATE.currentOrder,dining:STATE.activeTastingOrders,choices:[...document.querySelectorAll('#pf-overlay input[name]:checked,#pf-overlay select')].map(e=>[e.name||e.id,e.value])});}
 function saveChange(before){for(const e of entries()){
  const old=before.get(e.key);if(old&&old.signature===fingerprint(e))continue;
  const safety=summary(e),hit=safety.warnings.length>0;
  const matched=review?.requests.find(r=>(r.optionId? r.optionId===(e.item.optionId||e.item.id):r.name===requestName(e.item))&&(r.course==null||String(r.course)===String(e.item.serviceCourse)));
  if(hit&&!e.item.pending&&!e.item.noneChoice&&!matched)throw Error('Review request does not identify the exact changed dish');
  if(old){stamp(e,'item-replaced','Customer change / preparation revision',old.item);}
  const instructions=matched?.instructions||String(e.item.notes||e.item.modNote||'').trim();
  const requiresReview=!e.item.pending&&!e.item.noneChoice&&(hit||safety.allergyContext.effectiveAllergens.length>0&&instructions.length>0);
  e.item.labSafety={...safety,status:requiresReview?'awaiting-kitchen-review':'draft',instructions,guestInformed:!!review?.guestInformed,guestInformedAt:review?.guestInformed?new Date().toISOString():null,allergenFreeCertified:false,simulationOnly:true,revision:genId(),decisions:[],replacesKey:old?e.key:[...before.values()].find(o=>!entries().some(n=>n.key===o.entry.key)&&orderPositionIdentity(o.entry.parent)===orderPositionIdentity(e.parent))?.entry.key||null};
  if(instructions&&e.item.modNote!==instructions)e.item.modNote=[e.item.modNote,instructions].filter(Boolean).join(' · ');
  if(review?.guestInformed)stamp(e,'guest-informed',notice);
  if(requiresReview)stamp(e,'modification-requested',instructions);
  sync(e);
 }
 // Removed ordinary lines remain in the local audit, including all warnings/instructions.
 for(const [key,old] of before){if(!entries().some(e=>e.key===key)){const e=old.entry;stamp(e,entries().some(n=>!before.has(n.key))?'item-replaced':'item-canceled','Customer replacement / cancellation',old.item);const check=STATE.checks[e.line.checkId];if(check){check.labAllergyAudit=clone(audit().filter(r=>r.checkId===check.id));persistCheck(check);}}}
 }
 function snapshot(){return new Map(entries().map(e=>[e.key,{signature:fingerprint(e),item:clone(e.item),entry:e}]));}
 function transaction(fn,args){if(fbReady!==false||fbDb!==null)throw Error('Lab workflow requires Firebase disabled');if(action)return fn(...args);const before=snapshot(),rollback=clone({currentOrder:STATE.currentOrder,activeTastingOrders:STATE.activeTastingOrders,checks:STATE.checks,labAllergyAudit:audit()});action={fn,args};try{const result=fn(...args);
   for(const line of STATE.currentOrder||[]){const to=(STATE.activeTastingOrders||[]).find(t=>t._boundLine===line.lineId);if(to){to.seat=line.seat;to.seatPriority=line.seatPriority;}}
   for(const e of entries()){const old=before.get(e.key);if(old&&e.line.isTasting&&requestName(old.item)!==requestName(e.item)&&!replacementOptions(e).some(o=>o.name===requestName(e.item)))throw Error('No BOH-approved replacement choices for this tasting course');if(old&&old.signature!==fingerprint(e)&&needsAcknowledgment(old.entry,old.item))throw Error('Kitchen acknowledgment required before changing preparation');}
   for(const [key,old] of before)if(!entries().some(e=>e.key===key)&&needsAcknowledgment(old.entry,old.item))throw Error('Kitchen acknowledgment required before replacement');
   saveChange(before);if([...before.keys()].join()!==entries().map(e=>e.key).join()||entries().some(e=>before.get(e.key)?.signature!==fingerprint(e)))toast('Unsent draft updated · simulated review only · SEND/FIRE disabled');return result;
  }catch(error){Object.assign(STATE,rollback);toast(error.message);return false;}finally{action=null;review=null;}
}
 const originalWarn=window.manualMenuAllergyWarning;
 window.manualMenuAllergyWarning=function(courses,identity,table){const selected=(courses||[]).map(c=>action?.fn.name==='confirmDessert'&&isEntremetCourse(c)?Object.assign({},c,{pending:false}):c).filter(c=>!c.pending);const hits=conflicts(selected,identity,table);
  if(!hits.length)return false;
  if(review&&action){review.requests.push(...hits.map(h=>({name:requestName(h.item),course:h.item.serviceCourse,optionId:h.item.optionId||h.item.id,instructions:review.notes[requestToken(h.item)]||''})));return false;}
  const blocked=originalWarn(selected,identity,table);
  if(action){proposal={...action,signature:stable(),identity:String(identity),table:String(table??STATE.selectedTable),hits:hits.map(h=>({name:requestName(h.item),token:requestToken(h.item),allergens:asList(h.item.allergens),hits:h.hits}))};renderRequest();}
  return blocked;
 };
 function renderRequest(){const target=document.querySelector('[data-manual-allergy-block]')||document.querySelector('#sheet-overlay .sheet');if(!target||!proposal)return;
  target.querySelector('[data-lab-request]')?.remove();if(target.hasAttribute('data-manual-allergy-block'))target.innerHTML='';const box=document.createElement('section');box.dataset.labRequest='1';
  box.innerHTML='<h3>Modification request — pending review</h3><p class="manual-preadd-warning">Table '+esc(proposal.table)+' · Position '+esc(proposal.identity)+' · '+esc(exactPositionAllergyContext(proposal.identity,proposal.table).effectiveAllergens.map(a=>'NO '+(normalizeAllergenLabel(a)==='tree nut'?'NUTS':a.toUpperCase())).join(' — '))+'</p><p class="sheet-sub">'+esc(notice)+'</p>'+proposal.hits.map((h,i)=>'<fieldset><legend>'+esc(h.name)+'</legend><p>BOH allergens: '+esc(h.allergens.join(', '))+'</p><div>'+['NO NUTS','NO DAIRY','REMOVE TOPPING'].map(t=>'<button type="button" data-lab-quick="'+esc(t)+'" data-request-index="'+i+'">'+t+'</button>').join('')+'</div><textarea data-lab-instruction="'+i+'" placeholder="Exact dish preferences / kitchen instructions"></textarea></fieldset>').join('')+'<label><input id="lab-guest-informed" type="checkbox"> Guest informed about cross-contact</label><button class="primary-btn" id="lab-request-review" type="button">Save unsent request for kitchen review</button><p>No SEND/FIRE. The original BOH allergens remain recorded.</p>';
  target.appendChild(box);
 }
 window.labSubmitAllergyRequest=function(){if(!proposal)return false;
  if(proposal.signature!==stable()){toast('Order context changed. Review the selected dish again.');return false;}
  const notes={};for(let i=0;i<proposal.hits.length;i++){const value=String(document.querySelector('[data-lab-instruction="'+i+'"]')?.value||'').trim();if(!value){toast('Add instructions for each conflicting dish');return false;}notes[proposal.hits[i].token]=value;}
  const saved=proposal;proposal=null;review={notes,requests:[],guestInformed:!!document.getElementById('lab-guest-informed')?.checked};
  const result=transaction(saved.fn,saved.args);renderOrder();return result!==false;
 };
 // Only explicit supported UI actions can create requests. Direct lower-level guards remain blocking.
 ['applyOptionToDiningCourse','commitPendingItem','confirmPrixFixe','confirmDessert','confirmDiningCourseEdit','addTastingMenu','saveTastingCourseModify','saveCourseNote','confirmTastingTemps','moveLineSeat','bumpLineQty','removeLine','eraseOrderLine','erasePrixFixeLine','eraseDiningCourse','removeItem'].forEach(name=>{const original=window[name];window[name]=function(...args){return transaction(original,args);};});
 window.maybeAllergyThenAdd=function(){return window.commitPendingItem();};
 const oldRenderModifier=window.renderModifierSheet;
 window.renderModifierSheet=function(){oldRenderModifier();const p=STATE.pendingItem;if(!p)return;const ctx=exactPositionAllergyContext(orderPositionIdentity(p),p.table);const target=document.querySelector('#sheet-overlay .sheet');if(!target)return;
  const box=document.createElement('section');box.innerHTML='<p class="manual-preadd-warning">Position '+esc(orderPositionIdentity(p))+' · '+esc(ctx.effectiveAllergens.map(a=>'NO '+a.toUpperCase()).join(' — ')||'No allergies recorded')+'</p><p>'+esc(notice)+'</p>'+['NO NUTS','NO DAIRY','REMOVE TOPPING'].map(t=>'<button type="button" data-lab-pending-note="'+t+'">'+t+'</button>').join('');target.prepend(box);
 };
 function needsAcknowledgment(e,item=e.item){const s=item.labSafety;return !!(item.fired||s?.status==='preparing'||s?.status==='cancellation-requested'||s?.preparationStartedAt)&&!s?.cancellationAcknowledgedAt;}
 function replacementOptions(e){
  // A fixed tasting course cannot borrow another menu's choices or pricing policy.
  if(e.line.isTasting){const menu=findTastingMenu(e.line.tastingId),published=menu?.courses?.[e.index];return (published?.options||[]).filter(o=>o&&!o.headingOnly&&o.name);}
  return diningCourseOptions(e.parent,e.item).filter(o=>o&&!o.headingOnly&&o.name);
 }
 function preparationEligible(e){const s=e.item.labSafety;if(!s||e.item.pending||e.item.noneChoice)return false;
  if(JSON.stringify(s.allergyContext)!==JSON.stringify(context(e)))return false;
  if(s.status==='draft')return conflicts([e.item],orderPositionIdentity(e.parent),e.parent.table).length===0;
  return s.status==='approved-for-modified-preparation'&&s.instructions.trim().length>0;
 }
 window.labKitchenDecision=function(key,decision,reason){const e=get(key);if(!e||!reason?.trim())return false;const s=e.item.labSafety;if(!s)return false;
  if(decision==='ack-cancel'){if(s.status!=='cancellation-requested')return false;s.status='canceled';s.cancellationAcknowledgedAt=new Date().toISOString();}
  else if(decision==='start'){if(!preparationEligible(e))return false;s.status='preparing';s.preparationStartedAt=new Date().toISOString();}
  else{if(s.status!=='awaiting-kitchen-review')return false;if(JSON.stringify(s.allergyContext)!==JSON.stringify(context(e)))return false;if(!['approve','reject'].includes(decision)||decision==='approve'&&!s.instructions.trim())return false;s.status=decision==='approve'?'approved-for-modified-preparation':'rejected';}
  const d={id:genId(),decision,reason:reason.trim(),time:new Date().toISOString(),reviewer:'SIMULATED LAB Kitchen reviewer',table:String(e.parent.table),checkId:e.line.checkId,position:orderPositionIdentity(e.parent),course:e.item.serviceCourse||e.item.course,revision:s.revision};s.decisions.push(d);stamp(e,'kitchen-'+decision,reason);sync(e);window.labOpenEntry(key);return true;
 };
 window.labRequestCancellation=function(key,reason){const e=get(key);if(!e||!reason?.trim())return false;const s=e.item.labSafety;if(!s||['canceled','cancellation-requested'].includes(s.status))return false;
  const started=s.status==='preparing'||!!s.preparationStartedAt||!!e.item.fired;s.status=started?'cancellation-requested':'canceled';stamp(e,'cancellation-requested',reason);sync(e);window.labOpenEntry(key);return true;
 };
 window.labChangeItem=function(key){const e=get(key);if(!e)return false;const s=e.item.labSafety;
  if(needsAcknowledgment(e)){toast('Request cancellation and obtain simulated kitchen acknowledgment first');return false;}
  if(e.index==null&&e.line.pfExtra){openSheet('<h2>Change extra dish · Position '+esc(orderPositionIdentity(e.parent))+'</h2>'+listPrixFixeExtraDishes().filter(d=>d.kind===e.line.pfCourseKind).map(d=>'<button data-lab-extra-key="'+esc(d.key)+'" data-lab-key="'+esc(key)+'">'+esc(d.name)+'</button>').join(''));return true;}
  if(e.index==null){STATE.selectedLineIds={[e.line.lineId]:true};replaceSelectedItem();closeSheet();return true;}
  const options=replacementOptions(e);if(!options.length){toast('No BOH-approved replacement choices for this course');return false;}
  const html='<h2>Change Item · Position '+esc(orderPositionIdentity(e.parent))+'</h2><p>Price uses the existing BOH menu and selected option upcharge.</p>'+options.map((o,i)=>'<button type="button" data-lab-replacement="'+i+'" data-lab-key="'+esc(key)+'">'+esc(o.name)+(o.upcharge?' +$'+Number(o.upcharge).toFixed(2):'')+'</button>').join('')+'<button onclick="closeSheet()">Back</button>';
  openSheet(html);return true;
 };
 function replaceCourse(key,option){const e=get(key);if(!e)return false;const s=e.item.labSafety;if(needsAcknowledgment(e))return false;
  const opts=replacementOptions(e),opt=opts[option];if(!opt)return false;
  const temps=prixFixeTempOptions(opt.askTemp,opt);if(temps.length){openSheet('<h2>Replacement temperature</h2>'+temps.map(t=>'<button data-lab-temp="'+esc(t)+'" data-lab-key="'+esc(key)+'" data-lab-option="'+option+'">'+esc(t)+'</button>').join(''));return false;}
  return replaceCourseWithExtras(key,opt,{});
 }
 function replaceCourseWithExtras(key,opt,extras){return transaction(function(){const e=get(key);if(!e)return false;const s=e.item.labSafety;if(needsAcknowledgment(e))return false;
  const oldPrice=Number(e.item.upcharge)||0;
  if(applyOptionToDiningCourse(e.item,opt,extras)===false)return false;
  e.item.modNote='';e.item.notes='';
  if(e.item.labSafety?.cancellationAcknowledgedAt){e.item.fired=false;e.item.firedAt=null;}
  const delta=(Number(e.item.upcharge)||0)-oldPrice;e.line.price=Number(e.line.price)+delta;e.parent.totalPrice=e.line.price;
  applyDiningAllergyNotes();closeSheet();renderOrder();return true;
 },[]);}
 window.labOpenEntry=function(key){const e=get(key);if(!e)return;const s=e.item.labSafety||{status:e.item.pending?'selection-pending':'draft',instructions:'',decisions:[]};
  openSheet('<h2>'+esc(e.item.choice||e.item.name||e.item.course)+'</h2><p>Table '+esc(e.parent.table)+' · Position '+esc(orderPositionIdentity(e.parent))+' · Course '+esc(e.item.serviceCourse||e.item.course)+'</p><p class="manual-preadd-warning">'+esc(context(e).effectiveAllergens.map(a=>'NO '+a.toUpperCase()).join(' — ')||'No recorded guest allergies')+'</p><p>BOH allergens: '+esc(asList(e.item.allergens).join(', ')||'none listed')+'</p><b>SIMULATED: '+esc(s.status)+'</b><p>'+esc(s.instructions||e.item.modNote||e.item.notes||'')+'</p><p>'+esc(notice)+'</p><p>Guest informed: '+(s.guestInformed?'recorded':'not recorded')+'</p><button data-lab-informed="'+esc(key)+'">Record guest informed</button><button data-lab-change="'+esc(key)+'">Change Item</button><button data-lab-cancel="'+esc(key)+'">Request cancellation</button><textarea id="lab-decision-reason" placeholder="Reason for simulated kitchen decision / cancellation"></textarea>'+['approve','reject','start','ack-cancel'].map(d=>'<button data-lab-decision="'+d+'" data-lab-key="'+esc(key)+'">SIMULATE '+d+'</button>').join('')+'<details><summary>Local audit history</summary><pre style="white-space:pre-wrap">'+esc(JSON.stringify(audit().filter(r=>r.key===key||r.key===s.replacesKey),null,2))+'</pre></details><button onclick="closeSheet()">Back to order</button>');STATE.manualOrderingPosition=orderPositionIdentity(e.parent);
 };
 window.labOpenItem=function(lineId){const list=entries().filter(e=>e.line.lineId===lineId);if(list.length===1)return window.labOpenEntry(list[0].key);openSheet('<h2>Ordered dishes</h2>'+list.filter(e=>!e.item.headingOnly&&!e.item.noneChoice).map(e=>'<button data-lab-entry="'+esc(e.key)+'">'+esc(e.item.choice||e.item.name||e.item.course)+' · '+esc(e.item.labSafety?.status||'selection-pending')+'</button>').join('')+'<button onclick="closeSheet()">Back</button>');};
 window.labWorkflowLineHtml=function(line){const statuses=entries().filter(e=>e.line.lineId===line.lineId&&!e.item.pending&&!e.item.noneChoice).map(e=>e.item.labSafety?.status).filter(Boolean);return '<small>SIMULATED REVIEW: '+esc([...new Set(statuses)].join(', ')||'draft')+'</small><button onclick="labOpenItem('+esc(JSON.stringify(line.lineId))+')">Review / Change Item</button>';};
 window.labSelectorAllergenHits=function(){if(!selector||!document.querySelector('#pf-overlay.show'))return [];
  let courses=[],identity=selector.identity;
  if(selector.name==='openPrixFixeSelector'){const pf=findPrixFixeMenu(selector.args[0]),picked={};document.querySelectorAll('#pf-overlay input[name^="pf-course-"]:checked').forEach(r=>picked[Number(r.name.replace('pf-course-',''))]=r.value==='none'?'none':Number(r.value));courses=buildPrixFixeSelections(pf,picked);}
  else{const to=(STATE.activeTastingOrders||[]).find(t=>t.id===selector.args[0]);if(!to)return [];identity=orderPositionIdentity(to);
   if(selector.name==='openDessertSelector'){const options=dessertOptionsFor(to),selected=document.querySelector('#pf-overlay input[name="dessert-opt"]:checked'),opt=options[Number(selected?.value)];if(opt){const scoopNames=[...document.querySelectorAll('[id^="scoop-'+selected.value+'-"]')].map(e=>e.value);courses=[{name:opt.name,allergens:asList(opt.allergens).concat((opt.scoops||[]).filter(sc=>scoopNames.includes(sc.name)).flatMap(sc=>asList(sc.allergens)))}];}if(selected)courses=courses.concat(diningCourses(to).filter(isEntremetCourse).map(c=>({...c,pending:false})));}
   else{const c=diningCourses(to)[selector.args[1]],options=diningCourseOptions(to,c),selected=document.querySelector('#pf-overlay input[name="pf-edit-opt"]:checked');const opt=options[Number(selected?.value)];if(selected&&opt)courses=[opt];}
  }
  return conflicts(courses,identity).flatMap(h=>h.hits);
 };
 function refresh(){document.querySelectorAll('#pf-overlay .pf-opt-label').forEach(label=>{label.querySelectorAll('.allergy-flag').forEach(x=>x.remove());});
  const target=document.querySelector('#add-items-pane');if(target&&!target.querySelector('[data-lab-disclosure]')){const p=document.createElement('p');p.dataset.labDisclosure='1';p.className='sheet-sub';p.setAttribute('role','note');p.textContent=notice;target.prepend(p);}}
 const render=window.renderOrder;window.renderOrder=function(...args){const r=render(...args);refresh();return r;};
 ['openPrixFixeSelector','openDiningCourseEditor','openDessertSelector'].forEach(name=>{const original=window[name];window[name]=function(...args){const result=original(...args);selector={name,args,identity:STATE.manualOrderingPosition||selectedPositionIdentity()};refresh();return result;};});
 document.addEventListener('change',refresh);
 document.addEventListener('click',event=>{const b=event.target.closest('button');if(!b)return;const d=b.dataset;
  if(b.id==='lab-request-review')window.labSubmitAllergyRequest();
  if(d.labQuick){const input=document.querySelector('[data-lab-instruction="'+d.requestIndex+'"]');input.value=[input.value,d.labQuick].filter(Boolean).join(' · ');}
  if(d.labPendingNote){STATE.pendingItem.notes=[STATE.pendingItem.notes,d.labPendingNote].filter(Boolean).join(' · ');const n=document.getElementById('mod-notes');if(n)n.value=STATE.pendingItem.notes;}
  if(d.labEntry)window.labOpenEntry(d.labEntry);
  if(d.labChange)window.labChangeItem(d.labChange);
  if(d.labCancel)window.labRequestCancellation(d.labCancel,document.getElementById('lab-decision-reason')?.value);
  if(d.labDecision)window.labKitchenDecision(d.labKey,d.labDecision,document.getElementById('lab-decision-reason')?.value);
  if(d.labExtraKey){const e=get(d.labKey);if(e&&!needsAcknowledgment(e)){STATE._replaceLineId=e.line.lineId;beginAddPrixFixeExtra(d.labExtraKey);assignPendingPosition(orderPositionIdentity(e.parent));STATE.pendingItem.course=e.line.course;STATE.pendingItem.serviceCourse=e.line.serviceCourse;STATE.pendingItem.ticketPos=e.line.ticketPos;renderModifierSheet();}}
  if(d.labReplacement!=null)replaceCourse(d.labKey,Number(d.labReplacement));
  if(d.labTemp){const e=get(d.labKey);if(e){const opts=replacementOptions(e);replaceCourseWithExtras(d.labKey,opts[Number(d.labOption)],{temp:d.labTemp});}}
  if(d.labInformed){const e=get(d.labInformed);if(e){e.item.labSafety=e.item.labSafety||{...summary(e),status:'draft',instructions:'',simulationOnly:true,allergenFreeCertified:false,revision:genId(),decisions:[]};e.item.labSafety.guestInformed=true;e.item.labSafety.guestInformedAt=new Date().toISOString();stamp(e,'guest-informed',notice);sync(e);window.labOpenEntry(e.key);}}
  requestAnimationFrame(refresh);
 });
 window.LabAllergyWorkflow={entries:()=>entries(),reset:()=>{STATE.labAllergyAudit=[];proposal=null;review=null;action=null;selector=null;},preparationEligible:key=>{const e=get(key);return !!e&&preparationEligible(e);},notice};
})();
