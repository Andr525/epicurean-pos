/* Command-only proposal coordinator. Interpretation never owns price or sends tickets. */
(function(root){
  'use strict';
  function create(adapter){
    var state={phase:'idle', proposal:[], receipt:[], error:'', revision:0};
    var generation=0, seen=new Set(), busy=false;
    function reset(){ generation++; seen.clear(); busy=false; state={phase:'idle',proposal:[],receipt:[],error:'',revision:0}; }
    function contextKey(c){ return JSON.stringify([c.table,c.check,c.staff,c.catalog,c.pricing]); }
    function fail(message){ state.phase='clarify'; state.error=message; adapter.status(message,state); return state; }
    async function submit(text,id){
      if (seen.has(id)) return state;
      if (busy) return fail('Still processing the previous command. Please repeat when ready.');
      seen.add(id); if(seen.size>256) seen.delete(seen.values().next().value);
      if (!/^\s*food\s*master\b[,:]?/i.test(text)) { adapter.status('Conversation — no order change',state); return state; }
      var body=String(text).replace(/^\s*food\s*master\b[,:]?\s*/i,'').trim();
      var context=adapter.context(), key=contextKey(context), epoch=generation;
      if (!context.ready) return fail(context.reason||'Open a table and load the BOH catalog first.');
      if (state.context && state.context!==key) { reset(); epoch=generation; }
      state.context=key;
      if (/^cancel[.!]?$/i.test(body)) { state.proposal=[]; state.phase='idle'; state.error=''; adapter.status('Proposal cancelled. Check unchanged.',state); return state; }
      busy=true;
      try {
        if (/^confirm[.!]?$/i.test(body)) {
          if (!state.proposal.length || state.error) return fail('Resolve the complete proposal before confirming.');
          var validated=state.proposal.map(function(op){return adapter.validate(op,context);});
          var invalid=validated.find(function(v){return !v.ok;});
          if(invalid) return fail(invalid.reason);
          // Commit is synchronous, atomic and restricted to the current unsent check.
          var receipt=adapter.commit(validated.map(function(v){return v.value;}),context);
          state.receipt=receipt; state.proposal=[]; state.phase='confirmed'; state.error=''; state.revision++;
          adapter.status('Added to unsent check. '+adapter.summary(receipt),state);
          return state;
        }
        state.phase='interpreting';
        var result=await adapter.interpret(body,{context:context,proposal:state.proposal,receipt:state.receipt});
        if(epoch!==generation || key!==contextKey(adapter.context())) return state;
        if (!result || !Array.isArray(result.operations) || result.operations.length<1 || result.operations.length>12) return fail((result&&result.clarification)||'Please specify dishes, courses and positions.');
        var next=state.proposal.slice();
        for(var i=0;i<result.operations.length;i++){
          var op=result.operations[i];
          var checked=adapter.validate(op,context);
          if(!checked.ok) return fail(checked.reason);
          op=checked.value;
          if(op.action==='replace') {
            var at=next.findIndex(function(p){return p.proposalId===op.target || (p.action==='replace'&&p.target===op.target);});
            if(at>=0) next[at]=Object.assign({},op,{action:next[at].action,target:next[at].target,proposalId:next[at].proposalId});
            else next.push(op);
          } else next.push(op);
        }
        state.proposal=next; state.error=''; state.phase='review'; state.revision++;
        adapter.status('Review. '+adapter.summary(next)+'. Say Foodmaster confirm, correct, or cancel.',state);
        return state;
      } catch(e){
        if(epoch===generation) return fail('Voice command failed: '+(e.message||'unavailable')+'. Check unchanged.');
        return state;
      } finally { if(epoch===generation) busy=false; }
    }
    return {submit:submit,reset:reset,state:function(){return state;}};
  }
  root.EPICUREAN_VOICE_ORDER={create:create};
  if(typeof module!=='undefined'&&module.exports) module.exports=root.EPICUREAN_VOICE_ORDER;
})(typeof window!=='undefined'?window:globalThis);
