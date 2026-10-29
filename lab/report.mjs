import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
const file=resolve(process.argv[2]||'');
if(!process.argv[2])throw Error('Provide a controlled lab results JSON path');
const report=JSON.parse(readFileSync(file,'utf8'));
if(report.mode!=='mock'||report.physicalAcceptance!=='NOT_ESTABLISHED')throw Error('Expected a mock lab report');
const lines=['# Epicurean Master reproduction report','',`Run: ${report.runId}`,`Physical acceptance: NOT ESTABLISHED`, `Catalog SHA256: ${report.source.sha256}`,`Result: ${report.summary.passed} passed, ${report.summary.failed} failed`,'','Scripted interpretation; inspect JSON and POS screenshots before sharing.'];
for(const c of report.cases){lines.push('',`## ${c.id}: ${c.status}`,'',c.error||'Assertions passed.','', 'Reproduction:');for(const s of c.steps)lines.push('- '+JSON.stringify(s));if(c.status!=='passed')lines.push('','Evidence: corresponding case screenshot and actual/screen fields in results JSON.');}
const output=resolve(dirname(file),'REPRODUCE.md');writeFileSync(output,lines.join('\n')+'\n');console.log(output);
