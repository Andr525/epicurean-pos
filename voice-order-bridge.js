/* Review-branch bridge: explicit Foodmaster commands, BOH validation, manual POS commits. */
(function(root){
  'use strict';
  var seq=0;
  function context(){
    var slot=STATE.voiceVocab||{}, check=STATE.checks&&STATE.checks[activeCheckId()];
    var ready=!!(STATE.currentServer&&STATE.selectedTable&&check&&check.status==='open'&&slot.index&&!slot.stale&&slot.entries&&slot.entries.length);
    return {table:String(STATE.selectedTable||''),check:activeCheckId(),staff:STATE.currentServer&&String(STATE.currentServer.code),catalog:slot.revision,pricing:STATE.voicePrixFixeId||'a-la-carte',ready:ready,
      reason:'Voice requires a logged-in server, open check and current published BOH vocabulary.'};
  }
  function position(text,fallback){
    var match=String(text).match(/\b(?:seat|position)\s+(\d{1,2})(\s*a)?\b/i);
    if(match) return match[1]+(match[2]?'A':'');
    return fallback||String(STATE.activeSeat)+(isPriorityPosition(STATE.activeSeat)?'A':'');
  }
  function seatParts(seat){var m=String(seat).match(/^([1-9]|1\d|20)(A)?$/);return m&&{seat:Number(m[1]),priority:!!m[2]};}
  function resolve(phrase){
    var parsed={positionTouched:false};
    var heard=voiceResolveVocab(String(phrase).trim(),{deferPrice:true});
    if(heard.action!=='place') {
      var byName=voiceCatalogApi().matchByName(phrase,STATE.voiceVocab.entries,function(id){return voiceSourceName(id);});
      if(byName.action==='match') heard=voiceResolveVocab(byName.keyword+' '+byName.leftover.join(' '),{deferPrice:true});
    }
    if(heard.action!=='place') throw new Error((heard.draft&&heard.draft.need)||'Unresolved dish or required modifier: '+phrase);
    return {itemId:heard.item.id,mods:heard.preset.mods||{},notes:heard.preset.notes||''};
  }
  function targets(meta){
    return meta.proposal.concat((STATE.currentOrder||[]).filter(function(l){return l.voiceOrderOwned&&lineBelongsToCheck(l);}).map(function(l){
      return {proposalId:l.lineId,itemId:l.id,seat:String(l.seat)+(l.seatPriority?'A':''),course:l.serviceCourse,mods:l.mods||{},notes:l.notes||''};
    }));
  }
  function courseOf(text){
    if(/\b(appetizer|starter|first course)\b/i.test(text)) return 2;
    if(/\b(main(?: course)?|entree|entrée)\b/i.test(text)) return 3;
    if(/\bdessert\b/i.test(text)) return 4;
    return null;
  }
  async function interpret(body,meta){
    body=body.replace(/\b((?:position|seat)\s+\d{1,2}a?)(?=(?:appetizer|starter|main|dessert)\b)/ig,'$1 ');
    if(/^(?:no[, ]+)?(?:change what you wrote|change that|correct that)[.!]?$/i.test(body)) return {clarification:'Which dish and position should change, and what should replace it?'};
    // Optional server interpreter has no check-writing capability. Its operations pass the same validator.
    if(root.EPICUREAN_VOICE_INTERPRET) return root.EPICUREAN_VOICE_INTERPRET(body,meta);
    var correction=body.match(/^(?:actually\s+)?(?:replace|change|switch)\s+(?:the\s+)?(.+?)\s+(?:with|to|for)\s+(.+?)[.!]?$/i);
    if(correction){
      var course=courseOf(correction[1]), wantedSeat=position(correction[1],null);
      var pool=targets(meta).filter(function(op){
        if(/\b(seat|position)\b/i.test(correction[1])&&op.seat!==wantedSeat) return false;
        if(course) return op.course===course;
        var item=voiceSourceRecord(op.itemId);
        return item&&voiceCatalogApi().norm(item.name).includes(voiceCatalogApi().norm(correction[1]));
      });
      if(pool.length!==1) return {clarification:'Which exact dish and position should change?'};
      return {operations:[Object.assign(resolve(correction[2]),{action:'replace',target:pool[0].proposalId,proposalId:'proposal-'+(++seq),seat:pool[0].seat,course:pool[0].course})]};
    }
    var mod=body.match(/^(?:actually\s+)?make\s+(?:that|the)\s+(.+?)\s+(medium rare|medium well|well done|medium|rare)(?:\s+instead)?[.!]?$/i);
    if(mod){
      var pool=targets(meta).filter(function(op){var it=voiceSourceRecord(op.itemId); return it&&voiceCatalogApi().norm(it.name+' '+it.voiceKeyword).includes(voiceCatalogApi().norm(mod[1]));});
      if(pool.length!==1) return {clarification:'Which exact dish and position should change?'};
      var item=voiceProjectDish(voiceSourceRecord(pool[0].itemId));
      var temp=voiceCatalogApi().tempChoice(mod[2],voiceTempOptions(item));
      if(!temp) return {clarification:'That temperature is not allowed by BOH.'};
      var mods=Object.assign({},pool[0].mods); mods[voiceTempGroup(item)]=temp;
      return {operations:[Object.assign({},pool[0],{action:'replace',target:pool[0].proposalId,proposalId:'proposal-'+(++seq),mods:mods})]};
    }
    // Split only explicit course/position boundaries; "and" inside a dish name is preserved.
    var parts=body.replace(/\s+and\s+(?=(?:appetizer|starter|first course|main(?: course)?|entree|entrée|dessert|position|seat)\b)/ig,' | ')
      .replace(/\s+(?=(?:appetizer|starter|first course|main course|entree|entrée|dessert)\b)/ig,' | ')
      .split(/\s*\|\s*|\s*[,;]\s*/).filter(Boolean);
    var seat=position(body), operations=[];
    parts.forEach(function(part){
      seat=position(part,seat);
      var course=courseOf(part);
      var phrase=part.replace(/\b(?:seat|position)\s+\d{1,2}\s*a?\b/ig,' ').replace(/\b(?:appetizer|starter|first course|main course|main|entree|entrée|dessert)\b/ig,' ').replace(/\s+/g,' ').trim();
      if(!phrase) return;
      var resolved=resolve(phrase);
      var item=voiceProjectDish(voiceSourceRecord(resolved.itemId));
      operations.push(Object.assign(resolved,{action:'add',target:null,proposalId:'proposal-'+(++seq),seat:seat,course:course||defaultCourse(item)}));
    });
    return {operations:operations};
  }
  function validate(op,ctx){
    function no(reason){return {ok:false,reason:reason};}
    if(!op||!['add','replace'].includes(op.action)||typeof op.itemId!=='string'||!seatParts(op.seat)||![1,2,3,4].includes(op.course)) return no('Invalid operation, course or seat.');
    // Model output must not carry price, availability, identity or arbitrary mutation fields.
    if(typeof op.proposalId!=='string'||!op.proposalId||op.proposalId.length>160||(op.action==='add'&&op.target!==null)||(op.action==='replace'&&typeof op.target!=='string')) return no('Invalid operation identity or correction target.');
    if(Object.keys(op).some(function(k){return !['action','itemId','seat','course','mods','notes','target','proposalId'].includes(k);})) return no('Unexpected interpretation field.');
    if(!context().ready||JSON.stringify(context())!==JSON.stringify(ctx)) return no('Table, login or BOH revision changed. Repeat the command.');
    var pos=seatParts(op.seat), sess=sessionOf(STATE.selectedTable);
    if(pos.seat>sess.guestCount || !!isPriorityPosition(pos.seat)!==pos.priority) return no('Position '+op.seat+' is not an existing seat identity. Use the manual POS to set seats.');
    var entry=(STATE.voiceVocab.entries||[]).filter(function(e){return String(e.sourceId)===op.itemId&&e.active!==false;});
    var item=voiceProjectDish(voiceSourceRecord(op.itemId));
    if(!entry.length||!item||item.active===false||item.eightySixed) return no('Item unavailable in BOH.');
    if(ctx.pricing==='a-la-carte' && !(Number(item.price)>0)) return no('No à la carte price in BOH. Select the prix-fixe menu explicitly, or use the manual POS.');
    if(ctx.pricing!=='a-la-carte') {
      var pf=pricedMenu(ctx.pricing), choice=pf&&menuChoice(pf,op);
      if(!pf||!choice) return no('Dish is not an allowed choice on the selected BOH prix-fixe menu.');
      if(op.action==='replace' && !root.EPICUREAN_ORDER_SESSION.state().proposal.some(function(p){return p.proposalId===op.target;})) return no('Edit an existing prix-fixe choice through the manual POS.');
      if(seatHasPrixFixe(pos.seat)) return no('This seat already has a prix-fixe order. Edit it manually; do not add a duplicate.');
    }
    if(defaultCourse(item)!==op.course) return no('Requested course conflicts with the BOH item course.');
    if(allergenHits(item,pos.seat).length) return no('Allergy conflict — resolve manually.');
    if(!op.mods||typeof op.mods!=='object'||Array.isArray(op.mods)) return no('Invalid modifiers.');
    var groups=item.modifiers||[];
    if(Object.keys(op.mods).some(function(g){return !groups.some(function(group){return group.group===g&&(group.options||[]).some(function(v){return (v.name||v)===op.mods[g];});});})) return no('Modifier not allowed by BOH.');
    if(groups.some(function(g){return !op.mods[g.group];})) return no('Missing BOH-required modifier.');
    if(typeof op.notes!=='string'||op.notes.length>240) return no('Invalid note.');
    if(op.action==='replace') {
      var proposal=root.EPICUREAN_ORDER_SESSION.state().proposal;
      var p=proposal.find(function(p){return p.proposalId===op.target;});
      var line=(STATE.currentOrder||[]).find(function(l){return l.lineId===op.target&&l.voiceOrderOwned&&lineBelongsToCheck(l)&&String(l.table)===ctx.table;});
      if(!p&&!line) return no('Correction target is no longer an owned unsent line.');
      if((p&&p.seat!==op.seat)||(line&&(String(line.seat)+(line.seatPriority?'A':''))!==op.seat)) return no('Corrections cannot silently move seat identities.');
    }
    return {ok:true,value:Object.assign({},op,{mods:Object.assign({},op.mods)})};
  }
  function pricedMenu(id){
    var raw=(STATE.prixFixeMenus||[]).find(function(p){return p.id===id&&p.active!==false&&Number(p.price)>0;});
    return raw ? hydratePrixFixeMenu(raw) : null;
  }
  function menuChoice(pf,op){
    var matches=[];
    (pf.courses||[]).forEach(function(c,ci){
      if(!pfGuestChoiceMode(c)||pfCourseMode(c)==='later'||pfServiceCourseOf(c)!==op.course) return;
      (c.options||[]).forEach(function(o,oi){if(String(o.id)===op.itemId&&o.active!==false&&!o.eightySixed&&!o.chooseCount) matches.push({course:c,ci:ci,oi:oi,option:o});});
    });
    return matches.length===1?matches[0]:null;
  }
  root.setVoicePricingMenu=function(id){
    if(id && !pricedMenu(id)) {STATE.voiceStatus='BOH pricing menu unavailable';return;}
    root.EPICUREAN_ORDER_SESSION.reset();STATE.voicePrixFixeId=id||null;STATE.voiceStatus='Pricing mode selected. Repeat the complete command.';renderOrder();
  };
  root.voicePricingHtml=function(){
    var html='<div class="voice-test"><label for="voice-pricing-menu">VOICE PRICING BASIS</label><select id="voice-pricing-menu" onchange="setVoicePricingMenu(this.value)"><option value="">À la carte — BOH item prices required</option>';
    (STATE.prixFixeMenus||[]).filter(function(p){return p.active!==false&&Number(p.price)>0;}).forEach(function(p){html+='<option value="'+esc(p.id)+'"'+(STATE.voicePrixFixeId===p.id?' selected':'')+'>'+esc(p.name)+' — '+esc(String(p.price))+'</option>';});
    return html+'</select><div class="voice-rev">Choose the menu explicitly. Voice adds an unsent order; SEND and FIRE remain manual.</div></div>';
  };
  function commitDining(ops,ctx){
    if(posSheetOpen()||STATE.pendingItem||document.getElementById('pf-overlay').classList.contains('show')) throw new Error('Finish the manual edit first');
    var pf=pricedMenu(ctx.pricing), grouped={};
    ops.forEach(function(op){
      if(op.action!=='add') throw new Error('Resolve existing dining corrections manually');
      (grouped[op.seat]||(grouped[op.seat]=[])).push(op);
    });
    Object.values(grouped).forEach(function(group){
      if(new Set(group.map(function(o){return o.course;})).size!==group.length) throw new Error('Only one included dish per course and position is allowed');
      if(!group.some(function(o){return o.course===2;})||!group.some(function(o){return o.course===3;})) throw new Error('Specify both appetizer and main before adding the prix-fixe menu');
    });
    var before=STATE.currentOrder, diningBefore=STATE.activeTastingOrders||[], savedSeat=STATE.activeSeat, wasReady=fbReady;
    var persist=root.persistCheck, render=root.renderOrder, toastFn=root.toast, receipts=[], success=false;
    STATE.currentOrder=before.slice();STATE.activeTastingOrders=JSON.parse(JSON.stringify(diningBefore));fbReady=false;
    root.persistCheck=function(){};root.renderOrder=function(){};root.toast=function(){};
    try{
      Object.keys(grouped).forEach(function(seat){
        var pos=seatParts(seat);STATE.activeSeat=pos.seat;
        openPrixFixeSelector(pf.id);
        grouped[seat].forEach(function(op){
          var selected=menuChoice(pf,op), radio=document.querySelector('input[name="pf-course-'+selected.ci+'"][value="'+selected.oi+'"]');
          if(!radio) throw new Error('Manual menu choice unavailable');
          radio.checked=true;
          Object.values(op.mods).forEach(function(value){
            var input=document.querySelector('input[name="pf-temp-'+selected.ci+'-'+selected.oi+'"][value="'+value+'"]');
            if(!input) throw new Error('Manual temperature unavailable');input.checked=true;
          });
          if(op.notes) throw new Error('Resolve dining notes manually in this review implementation');
        });
        var count=STATE.currentOrder.length;confirmPrixFixe(pf.id);
        if(STATE.currentOrder.length!==count+1) throw new Error('Manual prix-fixe validation did not complete');
        var line=STATE.currentOrder[STATE.currentOrder.length-1];line.voiceOrderOwned=true;line.seatPriority=pos.priority;receipts.push(line);
      });success=true;
    }finally{
      root.persistCheck=persist;root.renderOrder=render;root.toast=toastFn;fbReady=wasReady;STATE.activeSeat=savedSeat;closePfSelector();
      if(!success){STATE.currentOrder=before;STATE.activeTastingOrders=diningBefore;}
    }
    // Retain prior dining objects verbatim; only new unsent menus are published.
    var addedDining=STATE.activeTastingOrders.filter(function(d){return !diningBefore.some(function(old){return old.id===d.id;});});
    STATE.activeTastingOrders=diningBefore.concat(addedDining);
    if(wasReady) addedDining.forEach(function(d){fbDb.collection('tasting_orders').add(d);});
    persistCheck(STATE.checks[ctx.check]);renderOrder();return receipts;
  }
  function commit(ops,ctx){
    if(ctx.pricing!=='a-la-carte') return commitDining(ops,ctx);
    if(posSheetOpen()||STATE.pendingItem||STATE._replaceLineId||STATE._editingLineId) throw new Error('Finish the manual edit first');
    var before=STATE.currentOrder, savedSeat=STATE.activeSeat, savedTurn=STATE.voiceTurn;
    var persist=root.persistCheck, render=root.renderOrder, speak=root.voiceSpeak, toastFn=root.toast;
    var receipts=[], success=false;
    // Use existing POS constructors/pricing, but publish only the complete validated transaction.
    STATE.currentOrder=before.slice(); root.persistCheck=function(){}; root.renderOrder=function(){}; root.voiceSpeak=function(){}; root.toast=function(){};
    try{
      ops.forEach(function(op){
        var pos=seatParts(op.seat), item=voiceProjectDish(voiceSourceRecord(op.itemId));
        STATE.activeSeat=pos.seat;
        var ids=STATE.currentOrder.map(function(l){return l.lineId;});
        voicePlaceResolved(item,{seat:pos.seat,priority:pos.priority},{mods:op.mods,notes:op.notes});
        var line=STATE.currentOrder.find(function(l){return !ids.includes(l.lineId);});
        if(!line) throw new Error('POS did not create the validated line');
        line.voiceOrderOwned=true; line.seatPriority=pos.priority; line.course=op.course; line.serviceCourse=op.course;
        if(op.action==='replace') {
          var original=before.find(function(l){return l.lineId===op.target;});
          if(!original) throw new Error('Correction target changed');
          STATE.currentOrder=STATE.currentOrder.filter(function(l){return l!==line;}).map(function(l){return l.lineId===op.target?line:l;});
          line.lineId=original.lineId; line.held=original.held; line.ticketPos=original.ticketPos;
        }
        receipts.push(line);
      });
      success=true;
    }finally{
      root.persistCheck=persist; root.renderOrder=render; root.voiceSpeak=speak; root.toast=toastFn;
      STATE.activeSeat=savedSeat; STATE.voiceTurn=savedTurn; STATE.pendingItem=null; STATE._replaceLineId=null;
      if(!success) STATE.currentOrder=before;
    }
    persistCheck(STATE.checks[ctx.check]); renderOrder();
    return receipts;
  }
  function summary(ops){return ops.map(function(op){if(op.isPrixFixe) return String(op.seat)+(op.seatPriority?'A':'')+'. '+op.name+': '+op.selections.filter(function(s){return !s.noneChoice&&!s.pending;}).map(function(s){return s.choice;}).join('; '); var item=voiceSourceRecord(op.itemId||op.id);return (op.seatPriority!=null?String(op.seat)+(op.seatPriority?'A':''):op.seat)+'. '+((item&&item.name)||op.name||op.itemId)+' ('+({2:'appetizer',3:'main',4:'dessert',1:'drink'}[op.course])+')'+(Object.keys(op.mods||{}).length?' '+Object.values(op.mods).join(', '):'');}).join('; ');}
  root.EPICUREAN_ORDER_SESSION=root.EPICUREAN_VOICE_ORDER.create({context:context,interpret:interpret,validate:validate,commit:commit,summary:summary,
    status:function(text,state){STATE.voiceStatus=text; if(STATE.currentServer&&STATE.selectedTable) renderOrder(); /* Show every proposal, speak only the review/confirmation. */ if(state.phase==='review'||state.phase==='confirmed') voiceSpeak(text);}});
  root.receiveVoiceTranscript=function(text,id){return root.EPICUREAN_ORDER_SESSION.submit(String(text||''),id||'manual-'+(++seq));};
})(window);
