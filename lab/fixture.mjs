import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {authorityFromDocuments} from '../functions/pilot-authority.mjs';
export function fixture(){
 const source=readFileSync(new URL('./fixtures/scalini-dining.js',import.meta.url)),manifest=JSON.parse(readFileSync(new URL('./fixtures/source.json',import.meta.url)));
 if(createHash('sha256').update(source).digest('hex')!==manifest.sha256)throw Error('BOH fixture integrity mismatch');
 const box={window:{}};vm.createContext(box);vm.runInContext(source.toString(),box);const menu=structuredClone(box.window.EPICUREAN_SCALINI.prixFixe);
 const entries=menu.dishes.filter(x=>x.voiceKeyword).map(x=>({sourceId:x.id,sourceType:'pf',voiceKeyword:x.voiceKeyword,voiceAliases:x.voiceAliases||[],name:x.name,active:true}));
 const docs={voice_vocab_active:{activeRevision:'lab-'+manifest.sha256.slice(0,16),chunkIds:['lab_vocab']},lab_vocab:{entries},prix_fixe_menus:{list:[menu]},menu:{items:[]},bar:{list:[]},wines:{list:[]},daily_specials:{list:[]}};
 const check={id:'lab-check-14',table:'14',status:'open',guestCount:3,femalePositions:{'2':true},positionIdentities:['1','2','2A','3'],updatedAt:1};
 return {manifest,menu,entries,revision:docs.voice_vocab_active.activeRevision,check,authority:authorityFromDocuments(docs,check)};
}
