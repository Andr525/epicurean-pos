import assert from 'node:assert/strict';
import {interpretOrder} from '../functions/interpret-order.mjs';
let request;
const common={text:'Replace the appetizer with porcini ravioli',context:{table:'4',seats:['2A']},catalog:[{id:'sf_p_porcini',name:'Porcini ravioli'}],proposal:[],apiKey:'local-test-only',model:'gpt-4.1-mini',fetchImpl:async(url,options)=>{
 assert.equal(url,'https://api.openai.com/v1/responses');request=JSON.parse(options.body);
 return new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({clarification:null,operations:[{action:'replace',itemId:'sf_p_porcini',seat:'2A',course:2,mods:[],notes:'',target:'proposal-1'}]})}]}]}));
}};
const result=await interpretOrder(common);
assert.equal(result.operations[0].target,'proposal-1');assert.equal(result.operations[0].itemId,'sf_p_porcini');
assert.equal(request.store,false);assert.equal(request.text.format.strict,true);
assert.equal('price' in request.text.format.schema.properties.operations.items.properties,false);
await assert.rejects(interpretOrder({...common,fetchImpl:async()=>new Response('{}',{status:429})}),/HTTP 429/);
await assert.rejects(interpretOrder({...common,fetchImpl:async()=>new Response(JSON.stringify({status:'incomplete'}))}),/incomplete/);
await assert.rejects(interpretOrder({...common,catalog:[]}),/unknown item/);
console.log('Provider contract checks passed using controlled HTTP responses; no live LLM invocation.');
