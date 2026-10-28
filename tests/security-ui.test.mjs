import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../baw-oneclick/index.html', import.meta.url), 'utf8');
function fn(name) {
  const match = html.match(new RegExp('(?:async )?function ' + name + '\\([^]*?(?=\\n(?:async )?function |\\n/\\*|\\nlet |\\nconst |$)'));
  assert.ok(match, name); return match[0];
}
for (const [name, endpoint] of [['dexBuy','/api/dex-buy'],['dexSellGeneric','/api/dex-sell'],['buyGang','/api/gang/buy'],['gangSell','/api/gang/sell']]) {
  test(`${name}: preview performs quotes but never calls ${endpoint}`, async () => {
    const calls = [], nodes = new Map();
    const $ = selector => {
      if (!nodes.has(selector)) nodes.set(selector, { value: selector.toLowerCase().includes('amount') || selector.includes('Bnb') ? '0.01' : '0x'+'1'.repeat(40), checked: selector === '#dryRun', innerHTML: '' });
      return nodes.get(selector);
    };
    const context = { $, state:{account:'0x'+'2'.repeat(40)}, dexSellPct:100, gangSellPct:100, JSON, Number, String, BigInt,
      log(){}, logLink(){}, short:s=>s, esc:s=>String(s), errDetail:s=>String(s), bridgeErr:(_e,p)=>p,
      tradeOptions:()=>({slippage:'1'}), preflight:async()=>{},
      quoteDexBuy:async()=>({quote:{toCoinAmount:'1',toCoinSymbol:'MOCK'}}),
      quoteDexSellGeneric:async()=>({token:'0x'+'1'.repeat(40),amount:'1',q:{quote:{toCoinAmount:'1'}},pct:100}),
      quoteGangBuy:async()=>({gangAmount:'1',tokensOut:'1',minTokensOut:'1',symbol:'MOCK'}),
      bridge:async path=>{calls.push(path);return{ok:true,tokensIn:'1',gangOut:'1',minGangOut:'1',symbol:'MOCK',order:{toTokenActualQty:'1'},txHash:'0x'+'a'.repeat(64)};}
    };
    vm.createContext(context);
    await vm.runInContext(fn('openRows')+'\n'+fn(name)+`;${name}(true)`, context);
    assert.ok(!calls.includes(endpoint), JSON.stringify(calls));
  });
}
test('quick mode preserves preview on first use and when the user saved preview', () => {
  for (const saved of [null,'1']) {
    const data = new Map(saved === null ? [] : [['baw.dry', saved]]), dry = {checked:true};
    const context = { localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)}, $:()=>dry,
      quickTrade:true,syncMode(){},renderQuickTrade(){},log(){} };
    vm.createContext(context); vm.runInContext(fn('setQuickTrade')+';setQuickTrade(true,true)',context);
    assert.equal(dry.checked,true); assert.notEqual(data.get('baw.dry'),'0');
  }
});
test('chain-controlled symbols are escaped in token rendering', () => {
  const nodes = new Map(), payload='<img src=x onerror=window.x=1>';
  const context = {state:{info:{tokenSym:payload,quoteSym:payload,market:'market',probe:'probe',token:'token',decimals:18,native:false,status:{PHASE:'1',BUY_OK:'1'},pos:{SELL_OK:'1'}}},
    $:s=>{if(!nodes.has(s))nodes.set(s,{style:{}});return nodes.get(s);}, short:s=>s,
    esc:s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
    renderBuyMode(){},selectUnifiedTradeTab(){} };
  vm.createContext(context);
  const kv = html.match(/^const kv = .*$/m)[0], kvCopy = html.match(/^const kvCopy = .*$/m)[0];
  vm.runInContext(kv+'\n'+kvCopy+'\n'+fn('renderToken')+';renderToken()',context);
  assert.ok(!nodes.get('#tokenInfo').innerHTML.includes('<img'));
  assert.ok(nodes.get('#tokenInfo').innerHTML.includes('&lt;img'));
});
