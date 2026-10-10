import http from 'node:http';import https from 'node:https';import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';import {resolve,dirname} from 'node:path';import {fileURLToPath} from 'node:url';import {randomBytes} from 'node:crypto';import {isIP} from 'node:net';
import {fixture} from './fixture.mjs';import {mockInterpret} from './mock-interpret.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const assets=new Set(['cellar.js','scalini-dining.js','voice-vocab.js','voice-engine.js','voice-turn.js','voice-catalog.js','voice-cocktails.js','voice-price.js','voice-service.js','voice-order.js','voice-order-bridge.js','icon-192.png','icon-512.png']);
const csp="default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'self'; media-src 'self' blob:; worker-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'";
export function isolatedHtml(source,token,screenOnly=false){
 let html=source.replace(/<script\b[^>]*src=["']https?:\/\/[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*(?:href=["']https?:\/\/|rel=["']manifest)[^>]*>/gi,'');
 html=html.replace(/var firebaseConfig = \{[\s\S]*?\};/,"var firebaseConfig = {projectId:'demo-epicurean-lab',apiKey:'fixture-only'};");
 html=html.replace("window.EPICUREAN_VOICE_TRANSCRIBE_URL='https://us-central1-epicurean-house-at-the-choc-st.cloudfunctions.net/voiceTranscribe';","window.EPICUREAN_VOICE_TRANSCRIBE_URL='/lab/transcribe';");
 html=html.replace('</head>',`<script>window.EPICUREAN_LAB_SCREEN_ONLY=${screenOnly};window.EPICUREAN_LAB_TOKEN=${JSON.stringify(token)};</script><script src="/lab/containment.js"></script></head>`);
 return html.replace('</body>','<script src="/lab/bootstrap.js"></script><script src="/lab/suite.js"></script></body>');
}
export async function startLab({port=0,host='127.0.0.1',tls=null,ownerApproval=null,artifactDir=resolve(root,'lab/artifacts'),screenOnly=false,sessionMs=3600000}={}){
 const loopback=['127.0.0.1','localhost','::1'].includes(host);
 if(!loopback){
  if(tls)throw Error('Physical HTTPS disabled pending independent certificate/iOS verification');
  if(!screenOnly||isIP(host)!==4||!(/^192\.168\.\d{1,3}\.\d{1,3}$|^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$|^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/).test(host)||!ownerApproval?.deviceAccessApproved||ownerApproval.host!==host||ownerApproval.scope!=='isolated-pos-fixture-only'||ownerApproval.additionalSpendingLimitMicroUsd!==0||Date.parse(ownerApproval.expiresAt)<=Date.now()||Date.parse(ownerApproval.expiresAt)-Date.now()>3600000||!Number.isFinite(Date.parse(ownerApproval.expiresAt)))throw Error('LAN serving requires explicit unexpired owner device approval, private host, screen-only mode and $0 cap');
 }
 const data=fixture(),token=randomBytes(32).toString('hex'),reports=[],audio=[],requests=[];
 const app=async(req,res)=>{
  res.setHeader('Content-Security-Policy',csp);res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Permissions-Policy',`camera=(), geolocation=(), payment=(), microphone=${screenOnly?'()':'(self)'}`);
  try{
   const expectedHost=`${host.includes(':')?'['+host+']':host}:${server.address().port}`;
   if(req.headers.host!==expectedHost)throw Error('Host not allowed');
   const requestUrl=new URL(req.url,'http://lab.invalid'),path=requestUrl.pathname;
   if(!loopback){
    if(Date.now()>=Date.parse(ownerApproval.expiresAt))throw Error('Owner device authorization expired');
    if(path==='/'&&requestUrl.searchParams.get('access')===token){res.setHeader('Set-Cookie',`lab_access=${token}; HttpOnly; ${tls?'Secure; ':''}SameSite=Strict; Path=/; Max-Age=3600`);res.writeHead(302,{Location:'/'});res.end();return;}
    if(!(req.headers.cookie||'').split(';').some(c=>c.trim()==='lab_access='+token))throw Error('Owner test capability required');
   }
   requests.push({method:req.method,path});if(requests.length>2000)requests.shift();
   if(req.method==='GET'&&path==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(isolatedHtml(readFileSync(resolve(root,'index.html'),'utf8'),token,screenOnly));return;}
   if(req.method==='GET'&&path==='/lab/fixture'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({manifest:data.manifest,menu:data.menu,entries:data.entries,revision:data.revision,check:data.check}));return;}
   if(req.method==='GET'&&(/^\/lab\/(containment|bootstrap|suite)\.js$/.test(path)||assets.has(path.slice(1)))){
    const name=path==='/scalini-dining.js'?resolve(root,'lab/fixtures/scalini-dining.js'):path.startsWith('/lab/')?resolve(root,path.slice(1)):resolve(root,path.slice(1));
    res.setHeader('Content-Type',path.endsWith('.js')?'application/javascript':'image/png');res.end(readFileSync(name));return;
   }
   if(req.method!=='POST'||!['/lab/interpret','/lab/transcribe','/lab/evidence'].includes(path)){res.writeHead(404);res.end('Local test route only');return;}
   const origin=`${tls?'https':'http'}://${expectedHost}`;
   if(req.headers['x-lab-token']!==token||req.headers.origin!==origin)throw Error('Local token and exact origin required');
   let bytes=0;const chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>(path==='/lab/transcribe'?2_000_000:500_000))throw Error('Lab request too large');chunks.push(chunk);}const raw=Buffer.concat(chunks);
   let result;
   if(path==='/lab/transcribe'){
    if(screenOnly)throw Error('Microphone/transcription disabled in screen-only session');
    if(!/^audio\//.test(req.headers['content-type']||'')||!raw.length)throw Error('Audio payload required');
    const key=req.headers['x-lab-transcript'];const allowed={'two-course':'Foodmaster position 2A appetizer pescatore and main course pork chop medium','guest':'I would like pork chop, what do you recommend?','restart':'Foodmaster position 1 appetizer pescatore and main course pork chop medium'};
    if(!Object.hasOwn(allowed,key))throw Error('No scripted transcript; paid fallback forbidden');
    audio.push({bytes:raw.length,mime:req.headers['content-type'],fixture:key});if(audio.length>100)audio.shift();result={transcript:allowed[key],mock:true};
   }else{
    if(!(req.headers['content-type']||'').startsWith('application/json'))throw Error('JSON required');const body=JSON.parse(raw.toString());
    if(path==='/lab/interpret')result=await mockInterpret(body,data.authority);
    else{
     if(!body||body.schemaVersion!==1||typeof body.runId!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(body.runId)||!Array.isArray(body.cases)||body.cases.length>30)throw Error('Invalid evidence');
     // Bounded test-only report fields; never screenshots/raw audio/credentials. Fixtures and controlled scenarios must be used.
     const allowed=['schemaVersion','runId','mode','interaction','physicalAcceptance','source','cases','summary','limitations'];
     if(Object.keys(body).some(k=>!allowed.includes(k))||body.mode!=='mock'||body.physicalAcceptance!=='NOT_ESTABLISHED'||body.source?.sha256!==data.manifest.sha256||body.cases.some(c=>!c||Object.keys(c).some(k=>!['id','name','status','steps','error','issue','actual','screen'].includes(k))||!['passed','failed','aborted'].includes(c.status)||!Array.isArray(c.steps)||c.steps.length>100))throw Error('Unexpected evidence fields or state');
     const serialized=JSON.stringify(body);if(serialized.includes(token)||serialized.includes('Bearer '))throw Error('Credential in evidence');
     reports.push(body);if(reports.length>100)reports.shift();mkdirSync(artifactDir,{recursive:true});writeFileSync(resolve(artifactDir,body.runId+'.json'),JSON.stringify(body,null,2));result={saved:true,runId:body.runId};
    }
   }
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));
  }catch(e){res.writeHead(409,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}));}
 };
 const server=tls?https.createServer(tls,app):http.createServer(app);server.requestTimeout=15000;server.headersTimeout=10000;server.maxConnections=8;
 await new Promise((r,j)=>{server.once('error',j);server.listen(port,host,r);});const url=`${tls?'https':'http'}://${host.includes(':')?'['+host+']':host}:${server.address().port}`;
 const deadline=Math.min(Date.now()+Math.max(1,Math.min(sessionMs,3600000)),ownerApproval?Date.parse(ownerApproval.expiresAt):Infinity);
 let closed=false;const close=()=>new Promise(r=>{clearTimeout(expiryTimer);if(closed){r();return;}closed=true;server.closeAllConnections();server.close(r);});
 const expiryTimer=setTimeout(()=>{console.log('Lab session expired: listener and connections closed.');void close();},Math.max(1,deadline-Date.now()));
 return {server,url,launchUrl:loopback?url:url+'/?access='+token,token,data,reports,audio,requests,close};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const args=Object.fromEntries(process.argv.slice(2).map(v=>{const at=v.indexOf('=');if(at<0)throw Error('Use --name=value arguments');return [v.slice(2,at),v.slice(at+1)];}));
 const tls=args.cert&&args.key?{cert:readFileSync(args.cert),key:readFileSync(args.key)}:null;
 const ownerApproval=args.approval?JSON.parse(readFileSync(args.approval,'utf8')):null;
 const lab=await startLab({port:Number(args.port)||9443,host:args.host||'127.0.0.1',tls,ownerApproval,screenOnly:args.mode==='screen-only'});
 console.log(`LOCAL MOCK POS: ${lab.launchUrl}\nProvider spending: $0. No external services. Ctrl+C stops the test server.`);
 process.on('SIGINT',async()=>{await lab.close();process.exit(0);});
}
