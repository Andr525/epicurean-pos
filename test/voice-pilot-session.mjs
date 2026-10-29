import assert from 'node:assert/strict';
import {startMockPilot} from '../pilot/mock-server.mjs';
import {MemoryBudget,requirePaidApproval} from '../functions/pilot-budget.mjs';
const p=await startMockPilot();let state,n=0;
const op=(id,seat,course,temp,action='add',target=null)=>({action,itemId:id,seat,course,mods:temp?[{group:'Temperature',option:temp}]:[],notes:'',target});
async function request(body,token='mock-foodmaster'){const res=await fetch(p.url+'/session',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:res.status,data:await res.json()};}
async function turn(text,response){if(response)p.responses.push(response);const out=await request({action:'turn',sessionId:state.sessionId,revision:state.revision,requestId:'t'+(++n),text});assert.equal(out.status,200);state=out.data;return state;}
async function open(){const r=await request({action:'open',table:'14',checkId:'pilot-check',pricing:'pf_scalini_89'});assert.equal(r.status,200);state=r.data;return state;}
try{
 assert.equal((await request({action:'open',table:'14',checkId:'pilot-check',pricing:'pf_scalini_89'},'guest')).status,403);
 await open();assert.deepEqual(state.positions,['1','2','2A']);
 await turn('I would like pork chop');assert.equal(state.conversation,true);assert.equal(p.inputs.length,0);
 await turn('Foodmaster, position 2 appetizer pescatore and main pork chop. Position 2A appetizer porcini and main chicken.',{clarification:'What temperature for position 2 pork chop?',operations:[]});assert.equal(state.proposal.length,0);
 await turn('Medium',{clarification:null,operations:[op('sf_p_linguini','2',2),op('sf_m_pork','2',3,'Medium'),op('sf_p_porcini','2A',2),op('sf_m_chicken','2A',3)]});
 assert.equal(state.proposal.length,4);assert.equal(state.error,undefined);
 await turn('Foodmaster, position 1 appetizer porcini and main pork chop medium well.',{clarification:null,operations:[op('sf_p_porcini','1',2),op('sf_m_pork','1',3,'Medium Well')]});assert.equal(state.proposal.length,6);
 await turn('Foodmaster, desserts: position 1 chocolate cake, position 2 napoleon, position 2A tart.',{clarification:null,operations:[op('sf_d_cake','1',4),op('sf_d_napoleon','2',4),op('sf_d_tart','2A',4)]});assert.equal(state.proposal.length,9);
 await turn('No, change what you wrote.',{clarification:'Which position and course should change?',operations:[]});assert.equal(state.proposal.length,9);
 const target=state.proposal.find(x=>x.seat==='2'&&x.course===2).proposalId;
 await turn('Position 2 appetizer to porcini.',{clarification:null,operations:[op('sf_p_porcini','2',2,null,'replace',target)]});assert.equal(state.proposal.length,9);assert.equal(state.proposal.find(x=>x.proposalId===target).itemId,'sf_p_porcini');
 const confirm={action:'confirm',sessionId:state.sessionId,revision:state.revision,requestId:'confirm1'};
 const first=await request(confirm);state=first.data;assert.equal(first.status,200);assert.equal(state.envelope.orders.length,3);assert.equal(state.envelope.send,false);assert.equal(state.envelope.fire,false);assert.equal(state.envelope.state,'unsent');assert.equal(state.envelope.orders.find(o=>o.positionId==='2A').lines.length,3);
 assert.deepEqual((await request(confirm)).data,first.data);
 const again=await request({...confirm,revision:state.revision,requestId:'confirm2'});assert.equal(again.data.envelope.confirmationId,state.envelope.confirmationId); // Retry never creates another draft.
 const old=state.sessionId;await open();assert.notEqual(state.sessionId,old);await turn('Foodmaster, position 2 appetizer pescatore, main pork chop medium.',{clarification:null,operations:[op('sf_p_linguini','2',2),op('sf_m_pork','2',3,'Medium')]});assert.equal(state.proposal.length,2);
 const before=structuredClone(state.proposal);
 await turn('Foodmaster, invent a steak.',{clarification:null,operations:[op('invented','2',3)]});assert.deepEqual(state.proposal,before);assert.ok(state.error);
 await turn('Foodmaster, change to position 9.',{clarification:null,operations:[op('sf_p_porcini','9',2)]});assert.deepEqual(state.proposal,before);
 await turn('Foodmaster, change something.',{clarification:'Which course?',operations:[op('sf_p_porcini','1',2)]});assert.deepEqual(state.proposal,before);assert.ok(state.error);
 let release;const delayed=new Promise(r=>release=r);p.responses.push(async()=>{await delayed;return {clarification:null,operations:[op('sf_p_porcini','1',2)]};});
 const pending=request({action:'turn',sessionId:state.sessionId,revision:state.revision,requestId:'late',text:'Foodmaster, add appetizer position 1.'});
 while(!((await p.store.read(state.sessionId)).busy))await new Promise(r=>setTimeout(r,1));
 const interrupted=await request({action:'interrupt',sessionId:state.sessionId});release();await pending;assert.equal(interrupted.data.phase,'interrupted');assert.deepEqual((await p.store.read(state.sessionId)).proposal,before);
 const budget=new MemoryBudget();await budget.reserve('one',20_000_000,25_000_000);await assert.rejects(()=>budget.reserve('two',6_000_000,25_000_000),/limit/);await assert.rejects(()=>budget.reserve('one',1,25_000_000),/consumed/);assert.throws(()=>requirePaidApproval({approved:false}),/disabled/);
 assert.ok(JSON.parse(p.inputs[1].input).history.some(h=>/temperature|Medium/.test(h.text)));console.log('PASS: HTTP complete multi-guest clarification, correction, confirmation, retry, restart, guest gate, malicious output, interruption and budget. Mock LLM; no acoustic or iPhone claim.');
}finally{await p.close();}
