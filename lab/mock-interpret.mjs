// Exact scripted expectations, never language recognition. Unknown turns fail closed.
import {interpretOrder} from '../functions/interpret-order.mjs';
import {validateOperation} from '../functions/pilot-authority.mjs';
const op=(itemId,seat,course,temperature,action='add',target=null)=>({action,itemId,seat,course,mods:temperature?[{group:'Temperature',option:temperature}]:[],notes:'',target});
export async function mockInterpret(body,authority){
 if(!body||typeof body.text!=='string'||body.text.length>2000||!Array.isArray(body.proposal)||body.proposal.length>40||!['a-la-carte','pf_scalini_89'].includes(body.pricing))throw Error('Invalid mock interpretation request');
 const text=body.text.trim().replace(/[.!]$/,'');let data;
 if(text==='position 2A appetizer pescatore and main course pork chop medium')data={clarification:null,operations:[op('sf_p_linguini','2A',2),op('sf_m_pork','2A',3,'Medium')]};
 else if(text==='position 1 appetizer pescatore and main course pork chop medium')data={clarification:null,operations:[op('sf_p_linguini','1',2),op('sf_m_pork','1',3,'Medium')]};
 else if(text==='position 2 appetizer pescatore and main course pork chop medium')data={clarification:null,operations:[op('sf_p_linguini','2',2),op('sf_m_pork','2',3,'Medium')]};
 else if(text==='position 2 appetizer pescatore, position 2A appetizer porcini')data={clarification:null,operations:[op('sf_p_linguini','2',2),op('sf_p_porcini','2A',2)]};
 else if(text==='replace the appetizer at position 2A with porcini ravioli'){
  const target=body.proposal.find(p=>p.seat==='2A'&&p.course===2);if(!target)throw Error('Mock correction target unavailable');
  data={clarification:null,operations:[op('sf_p_porcini','2A',2,null,'replace',target.proposalId)]};
 }else if(text==='position 2A dessert chocolate cake')data={clarification:null,operations:[op('sf_d_cake','2A',4)]};
 else throw Error('No scripted interpretation for this turn; no live provider fallback');
 const result=await interpretOrder({text,context:{table:'14',catalog:authority.revision,pricing:body.pricing,seats:authority.seats},catalog:authority.items,proposal:body.proposal,history:[],apiKey:'mock-only',model:'scripted-fixture',fetchImpl:async()=>Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(data)}]}]})});
 result.operations.forEach(o=>validateOperation(o,authority,body.pricing,body.proposal));return result;
}
