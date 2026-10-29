import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawnSync} from 'node:child_process';
import {startLab} from '../server.mjs';import {sessionQR} from './session-qr.mjs';
const [host,mode,approvalPath]=process.argv.slice(2);
// startLab verifies owner scope/private binding/$0 and starts before any URL is encoded.
const lab=await startLab({host,port:9443,ownerApproval:JSON.parse(readFileSync(approvalPath,'utf8')),screenOnly:true,manual:mode==='manual-screen'});
console.log(`LOCAL MOCK POS: ${lab.launchUrl}\nFixture PIN: 5000. Provider spending: $0. Ctrl+C stops the server. Automatic shutdown within 60 minutes.`);
let qrDir;
try{
 const qr=sessionQR(lab.launchUrl);qrDir=mkdtempSync(join(tmpdir(),'epicurean-qr-'));
 const image=join(qrDir,'session.svg');writeFileSync(image,qr.svg,{mode:0o600});
 console.log('Scan with iPhone Camera on the same private Wi-Fi:\n'+qr.terminal);
 console.log(`Local QR image backup: ${image}`);
 if(!process.stdout.isTTY||(process.stdout.columns||0)<qr.width){
  if(process.platform==='darwin'){
   const opened=spawnSync('/usr/bin/open',[image],{stdio:'ignore'});
   if(opened.status!==0)console.warn('Could not open QR image; use the printed URL or image path.');
  }
 }
}catch(e){console.warn('QR unavailable; use the printed URL. '+e.message);}
const cleanup=()=>{if(qrDir)rmSync(qrDir,{recursive:true,force:true});};
lab.server.once('close',cleanup);process.once('exit',cleanup);
process.once('SIGINT',async()=>{await lab.close();process.exit(0);});
process.once('SIGTERM',async()=>{await lab.close();process.exit(0);});
