import { interpretOrder, ORDER_SCHEMA } from './interpret-order.mjs';
import { requirePaidApproval,reserveCost } from './pilot-budget.mjs';
export function paidInterpreter({policy,budget,apiKey,fetchImpl=fetch}) {
 return async input=>{
  requirePaidApproval(policy);
  if(!apiKey)throw new Error('Server interpreter credential unavailable');
  const inputBytes=Buffer.byteLength(JSON.stringify(input));
  if(inputBytes>24000)throw new Error('Bounded model context exceeded');
  // Reserve serialized context plus schema and a conservative system/transport allowance.
  const boundedBytes=inputBytes+Buffer.byteLength(JSON.stringify(ORDER_SCHEMA))+8000;
  const cost=reserveCost(policy,{inputBytes:boundedBytes,maxOutputTokens:1800});
  await budget.reserve(input.requestId,cost,policy.limitMicroUsd);
  return interpretOrder({...input,model:policy.model,apiKey,fetchImpl});
 };
}
