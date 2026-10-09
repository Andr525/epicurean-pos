/* Offline fixture made from the selected BOH checkout. Products, prices and options
   are the actual tracked BOH data; check identities/auth are isolated test metadata. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { digest } from '../functions/pilot-authority.mjs';
export function actualBohFixture(){
 const filename=fileURLToPath(new URL('../../epicurean-boh/scalini-dining.js',import.meta.url));
 const source=readFileSync(filename,'utf8'),sandbox={window:{}};vm.createContext(sandbox);vm.runInContext(source,sandbox);
 const menu=structuredClone(sandbox.window.EPICUREAN_SCALINI.prixFixe);
 const entries=menu.dishes.filter(i=>i.voiceKeyword).map(i=>({sourceId:i.id,sourceType:'pf',scope:'pf',voiceKeyword:i.voiceKeyword,voiceAliases:i.voiceAliases||[]}));
 const docs={voice_vocab_active:{activeRevision:'offline-boh-'+digest(source).slice(0,16),chunkIds:['voice_pilot_fixture_0']},voice_pilot_fixture_0:{entries},
  prix_fixe_menus:{list:[menu]},menu:{items:[]},bar:{list:[]},wines:{list:[]},daily_specials:{list:[]}};
 const check={id:'pilot-check',table:'14',status:'open',guestCount:3,positionIdentities:['1','2','2A'],updatedAt:1,allergies:{}};
 return {docs,check,sourceFile:filename};
}
