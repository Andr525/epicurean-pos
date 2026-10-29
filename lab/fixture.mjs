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
 const cellarSource=readFileSync(new URL('./fixtures/cellar.js',import.meta.url)),cellarManifest=JSON.parse(readFileSync(new URL('./fixtures/cellar-source.json',import.meta.url)));if(createHash('sha256').update(cellarSource).digest('hex')!==cellarManifest.sha256)throw Error('BOH cellar fixture integrity mismatch');vm.runInContext(cellarSource.toString(),box);const cellar=box.window.BINWISE_CELLAR;
 const manualCatalog={provenance:[manifest,cellarManifest],wines:structuredClone(cellar.wines),bar:structuredClone([...(cellar.beers||[]),...(cellar.spirits||[])]),tasting:structuredClone(box.window.EPICUREAN_SCALINI.tasting),missing:['Published BOH ordinary-food/cocktail/daily-special documents','Current 86/stock revisions','Live staff permissions']};
 return {manifest,menu,manualCatalog,entries,revision:docs.voice_vocab_active.activeRevision,check,authority:authorityFromDocuments(docs,check)};
}
