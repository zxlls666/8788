// Optional real-Chrome check. Only fake wallets, temporary profile, loopback HTTP and stubbed RPC.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { startFixture } from './server-fixture.mjs';

const chrome = process.env.BAW_TEST_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
async function dump(url) {
  const profile = mkdtempSync(join(tmpdir(), '8788-chrome-test-'));
  try {
    return await new Promise((resolve, reject) => {
      const child = spawn(chrome, ['--headless=new','--no-first-run','--no-default-browser-check','--disable-extensions',
        '--disable-background-networking','--disable-component-update','--disable-sync','--metrics-recording-only',
        '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1','--user-data-dir='+profile,
        '--dump-dom','--virtual-time-budget=3000',url], { stdio:['ignore','pipe','pipe'] });
      let output='',error=''; child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
      child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>error+=d);
      const timer=setTimeout(()=>child.kill('SIGKILL'),20000);
      child.on('error',e=>{clearTimeout(timer);reject(e);});
      child.on('close',code=>{clearTimeout(timer);code===0?resolve(output):reject(new Error('Chrome failed: '+error.slice(-1000)));});
    });
  } finally { rmSync(profile,{recursive:true,force:true}); }
}
const f=await startFixture();
try {
  const dom=await dump(f.url);
  assert.match(dom,/id="mw-wallet-select"/,'real application module executes under its CSP');
  assert.match(dom,/id="mw-wallets"/,'management UI initialized');
} finally { await f.close(); }

const html=readFileSync(new URL('../baw-oneclick/index.html',import.meta.url),'utf8');
const renderer=html.match(/function renderToken\([^]*?(?=\nfunction renderPosition)/)[0];
const payload='<img src=x onerror=window.x=1>';
const hex=Buffer.from(payload).toString('hex');
const abi='0x'+(32).toString(16).padStart(64,'0')+Buffer.byteLength(payload).toString(16).padStart(64,'0')+hex.padEnd(64,'0');
const helperLines=['esc','kv','kvCopy'].map(name=>html.match(new RegExp('^const '+name+' = .*$', 'm'))[0]).join('\n');
const page=`<!doctype html><html><head><meta charset="utf-8"></head><body><div id="tokenInfo"></div><div id="posCard"></div><pre id="proof"></pre><script type="module">
window.fetch=async()=>({ok:true,json:async()=>({result:${JSON.stringify(abi)}})});
const P=await import('/protocol.js');const symbol=await P.erc20Symbol('0x'+'1'.repeat(40));
const state={info:{tokenSym:symbol,quoteSym:symbol,market:'market',probe:'probe',token:'token',decimals:18,native:false,status:{PHASE:'1',BUY_OK:'1'},pos:{SELL_OK:'1'}}};
const $=s=>document.querySelector(s),short=s=>s,renderBuyMode=()=>{},selectUnifiedTradeTab=()=>{};
${helperLines}
${renderer}
renderToken();setTimeout(()=>{$('#proof').textContent=JSON.stringify({executed:window.x===1,images:$('#tokenInfo').querySelectorAll('img').length,textPreserved:$('#tokenInfo').textContent.includes(symbol)});},100);
</script></body></html>`;
const server=createServer((req,res)=>{
  res.setHeader('content-type',req.url==='/protocol.js'?'text/javascript; charset=utf-8':'text/html; charset=utf-8');
  res.end(req.url==='/protocol.js'?readFileSync(new URL('../baw-oneclick/protocol.js',import.meta.url)):page);
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
try {
  const dom=await dump('http://127.0.0.1:'+server.address().port);
  const match=dom.match(/<pre id="proof">([^]*?)<\/pre>/);assert.ok(match,'renderer proof available');
  const proof=JSON.parse(match[1]);assert.deepEqual(proof,{executed:false,images:0,textPreserved:true});
  console.log('PASS Chrome: application bootstrap under CSP; malicious symbol stays text without CSP.');
} finally { await new Promise(resolve=>server.close(resolve)); }
