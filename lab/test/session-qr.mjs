// Offline verification only: no listener, owner session, browser or external request.
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {sessionQR} from '../mac/session-qr.mjs';
import QRCode from '../mac/vendor/QRCode/index.js';
import QRRSBlock from '../mac/vendor/QRCode/QRRSBlock.js';
const urls=['http://192.168.1.25:9443/?access='+'a'.repeat(64),'http://10.0.0.2:9443/?access='+'0123456789abcdef'.repeat(4),'http://172.31.255.254:9443/?access='+'f'.repeat(64)];
// Independently read QR's serialized byte-mode payload (undo RS interleaving), not just the input string.
function payload(qr){const blocks=QRRSBlock.getRSBlocks(qr.typeNumber,0);const streams=blocks.map(()=>[]);let p=0;
 for(let i=0;i<Math.max(...blocks.map(b=>b.dataCount));i++)blocks.forEach((b,j)=>{if(i<b.dataCount)streams[j].push(qr.dataCache[p++]);});
 const bits=streams.flat().map(b=>b.toString(2).padStart(8,'0')).join('');assert.equal(bits.slice(0,4),'0100');const countBits=qr.typeNumber<10?8:16;const n=parseInt(bits.slice(4,4+countBits),2);let text='';for(let i=0;i<n;i++)text+=String.fromCharCode(parseInt(bits.slice(4+countBits+i*8,12+countBits+i*8),2));return text;}
for(const url of urls){
 const result=sessionQR(url);assert(result.terminal.includes('\x1b[30;47m'));assert(!result.svg.includes('http://192.')&&!result.svg.includes('script')&&!result.svg.includes('href='));
 const qr=new QRCode(-1,0);qr.addData(url);qr.make();assert.equal(payload(qr),url);
 const cells=new Set([...result.svg.matchAll(/<rect x="(\d+)" y="(\d+)" width="1" height="1"\/>/g)].map(m=>m[1]+','+m[2]));
 for(let y=0;y<result.width;y++)for(let x=0;x<result.width;x++)assert.equal(cells.has(x+','+y),x>=4&&y>=4&&x<result.width-4&&y<result.width-4&&qr.isDark(y-4,x-4),'SVG module/quiet zone');
 const rows=result.terminal.replace(/\x1b\[[0-9;]*m/g,'').trimEnd().split('\n');
 for(let y=0;y<result.width;y++)for(let x=0;x<result.width;x++){const c=rows[Math.floor(y/2)]?.[x]||' ';assert.equal(y%2?c==='█'||c==='▄':c==='█'||c==='▀',cells.has(x+','+y),'Terminal modules');}
}
for(const url of ['https://192.168.1.25:9443/?access='+'a'.repeat(64),'http://8.8.8.8:9443/?access='+'a'.repeat(64),'http://192.168.1.25:9443/?access=bad'])assert.throws(()=>sessionQR(url));
const runner=readFileSync(new URL('../mac/run-session.mjs',import.meta.url),'utf8');assert(runner.indexOf('await startLab(')<runner.indexOf('sessionQR(lab.launchUrl)'));assert(runner.includes("lab.server.once('close',cleanup)"));assert(runner.includes("process.once('SIGINT'"));
const launcher=readFileSync(new URL('../mac/start-session.sh',import.meta.url),'utf8');assert(launcher.includes('bash mac/preflight.sh'));assert(launcher.includes('Date.now()+3600000'));assert(launcher.includes('additionalSpendingLimitMicroUsd:0'));assert(launcher.includes('node mac/run-session.mjs'));
console.log('PASS: 3 exact capability URL payloads, SVG and terminal module/quiet-zone checks, 3 unsafe URL rejections, launcher lifecycle checks. No server started. Physical iPhone scanning remains unverified.');
