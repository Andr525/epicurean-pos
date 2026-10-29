import http from 'node:http';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {actualBohFixture} from './boh-fixture.mjs';
import {authorityFromDocuments} from '../functions/pilot-authority.mjs';
import {MemorySessions} from '../functions/pilot-store.mjs';
import {createPilotService,createPilotHandler} from '../functions/pilot-service.mjs';
import {interpretOrder} from '../functions/interpret-order.mjs';
export async function startMockPilot(){
 const fixture=actualBohFixture(),authority=authorityFromDocuments(fixture.docs,fixture.check),store=new MemorySessions(),responses=[],inputs=[],transcripts=[],audioClips=[];
 const handler=createPilotHandler(createPilotService({mode:'mock',store,authorize:async token=>token==='Bearer mock-foodmaster'?{uid:'test-staff',foodmaster:true,tables:['14']}:null,
 loadAuthority:async({table,checkId})=>{if(table!==authority.table||checkId!==authority.checkId)throw new Error('Check/table mismatch');return authority;},
 interpret:async input=>interpretOrder({...input,apiKey:'mock-no-provider',model:'mock',fetchImpl:async(url,options)=>{
  inputs.push(JSON.parse(options.body));const next=responses.shift();if(!next)throw new Error('No scripted model response: live calls forbidden');
  const data=typeof next==='function'?await next(input):next;
  return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(data)}]}]});
 }})}));
 const server=http.createServer(async(req,res)=>{
  try{
   if(req.url==='/mock-transcribe'&&req.method==='POST'){
    if(req.headers.authorization!=='Bearer mock-foodmaster')throw new Error('Unauthorized audio');
    let size=0;for await(const chunk of req){size+=chunk.length;if(size>2000000)throw new Error('Audio too large');}
    if(!size||!transcripts.length)throw new Error('Mock transcript unavailable; no paid fallback');
    audioClips.push({size,type:req.headers['content-type']});res.setHeader('Content-Type','application/json');res.end(JSON.stringify({transcript:transcripts.shift(),mock:true}));return;
   }
   if(req.method==='GET'){res.setHeader('Content-Type','text/html');res.end(readFileSync(new URL('./pilot.html',import.meta.url)));return;}
   let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>16000)throw new Error('Request too large');}
   const out=await handler(new Request('http://localhost/session',{method:req.method,headers:req.headers,body}));res.writeHead(out.status,Object.fromEntries(out.headers));res.end(await out.text());
  }catch(e){res.writeHead(409);res.end(JSON.stringify({error:e.message}));}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {server,url:'http://127.0.0.1:'+server.address().port,authority,store,responses,inputs,transcripts,audioClips,close:()=>new Promise(resolve=>server.close(resolve))};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const pilot=await startMockPilot();console.log('MOCK ONLY: '+pilot.url+' (scripted responses supplied by tests; no paid calls)');
}
