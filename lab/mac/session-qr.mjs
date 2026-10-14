// Vendored QRCode encoder: offline, no package installation or network access.
import QRCode from './vendor/QRCode/index.js';
import levels from './vendor/QRCode/QRErrorCorrectLevel.js';
export function sessionQR(url){
 const parsed=new URL(url);
 if(parsed.protocol!=='http:'||parsed.pathname!=='/'||!/^\d+\.\d+\.\d+\.\d+$/.test(parsed.hostname)||!(/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(parsed.hostname))||!/^\d+$/.test(parsed.port)||!/^\?access=[a-f0-9]{64}$/.test(parsed.search))throw Error('QR requires the private LAN fixture session URL');
 const qr=new QRCode(-1,levels.M);qr.addData(url);qr.make();
 const quiet=4,size=qr.getModuleCount()+quiet*2;
 const dark=(x,y)=>x>=quiet&&y>=quiet&&x<size-quiet&&y<size-quiet&&qr.isDark(y-quiet,x-quiet);
 let terminal='';for(let y=0;y<size;y+=2){for(let x=0;x<size;x++)terminal+=dark(x,y)?(dark(x,y+1)?'█':'▀'):(dark(x,y+1)?'▄':' ');terminal+='\n';}
 let cells='';for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(dark(x,y))cells+=`<rect x="${x}" y="${y}" width="1" height="1"/>`;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size*8}" height="${size*8}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="white"/><g fill="black">${cells}</g></svg>`;
 // Explicit colours prevent terminal themes from inverting the QR.
 return {terminal:'\x1b[30;47m'+terminal+'\x1b[0m',svg,width:size};
}
