// Reserve an upper bound BEFORE any paid call. Failed/unknown calls keep their reservation.
export const HARD_LIMIT_MICRO_USD=25_000_000;
export function requirePaidApproval(policy){
 if(policy?.approved!==true||policy.pricingVerified!==true||policy.liveEnabled!==true)throw new Error('Paid providers disabled: approval and verified pricing required');
 if(!Number.isInteger(policy.limitMicroUsd)||policy.limitMicroUsd<=0||policy.limitMicroUsd>HARD_LIMIT_MICRO_USD)throw new Error('Invalid spending limit');
 if(policy.projectId==='epicurean-house-at-the-choc-st'||!policy.projectId)throw new Error('An isolated pilot project is required');
}
export function reserveCost(policy,{inputBytes,maxOutputTokens,audioSeconds=0}){
 const rates=policy.rates;
 if(!rates||![rates.textInputPerMillion,rates.textOutputPerMillion,rates.sttPerMinute].every(r=>Number.isFinite(r)&&r>=0))throw new Error('Verified provider rates required');
 // One token per UTF-8 byte is conservative for bounded ASCII/UTF-8 text; no cached-input discount.
 return Math.ceil(inputBytes*rates.textInputPerMillion + maxOutputTokens*rates.textOutputPerMillion + audioSeconds/60*rates.sttPerMinute*1_000_000);
}
export class MemoryBudget {
 constructor(){this.total=0;this.reservations=new Map();}
 async reserve(id,cost,limit){
  if(!Number.isInteger(cost)||cost<=0)throw new Error('Invalid cost reservation');
  if(this.reservations.has(id))throw new Error('Provider reservation already consumed; no automatic retry');
  if(this.total+cost>Math.min(limit,HARD_LIMIT_MICRO_USD))throw new Error('Experiment spending limit reached');
  this.reservations.set(id,cost);this.total+=cost;return this.total;
 }
}
export class FirestoreBudget {
 constructor(db,experimentId){this.db=db;this.ref=db.collection('voice_pilot_budgets').doc(experimentId);}
 async reserve(id,cost,limit){
  if(!Number.isInteger(cost)||cost<=0||!Number.isInteger(limit)||limit>HARD_LIMIT_MICRO_USD)throw new Error('Invalid budget reservation');
  return this.db.runTransaction(async tx=>{
   const receipt=this.ref.collection('reservations').doc(id);
   const [budget,existing]=await Promise.all([tx.get(this.ref),tx.get(receipt)]);
   if(existing.exists)throw new Error('Provider reservation already consumed; no automatic retry');
   const total=(budget.data()?.reservedMicroUsd||0)+cost;
   if(total>limit)throw new Error('Experiment spending limit reached');
   tx.set(this.ref,{reservedMicroUsd:total,limitMicroUsd:limit},{merge:true});tx.create(receipt,{reservedMicroUsd:cost,createdAt:Date.now()});return total;
  });
 }
}
