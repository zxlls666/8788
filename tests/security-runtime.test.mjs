import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { AutoBuyBudget } from '../baw-oneclick/auto-budget.mjs';
import { executionScope, assertCliExecution, assertLiveExecution } from '../baw-oneclick/request-policy.mjs';

const wallet='0x'+'1'.repeat(40), token='0x'+'2'.repeat(40), day='2026-10-28';
function directory(t) { const p=mkdtempSync(join(tmpdir(),'8788-security-'));t.after(()=>rmSync(p,{recursive:true,force:true}));return p; }
test('execution defaults to preview and remains isolated across concurrent requests',async()=>{
  assert.throws(()=>assertLiveExecution(),/预演禁止/);
  for(const headers of [{},{'x-baw-preview-only':'1'},{'x-baw-preview-only':'false'}]) {
    executionScope(headers,()=>{
      assert.throws(()=>assertCliExecution(['market-order','swap']),/预演禁止/);
      assert.throws(()=>assertCliExecution(['contract-call','execute']),/预演禁止/);
      assert.doesNotThrow(()=>assertCliExecution(['contract-call','preview']));
    });
  }
  await Promise.all([true,false].map(preview=>executionScope({'x-baw-preview-only':preview?'1':'0'},async()=>{
    await new Promise(r=>setTimeout(r,2));
    if(preview)assert.throws(()=>assertCliExecution(['contract-call','execute']),/预演禁止/);
    else assert.doesNotThrow(()=>assertCliExecution(['contract-call','execute']));
  })));
});
test('budget caps survive a new instance, reject duplicates and separate wallets/days',t=>{
  const path=directory(t), budget=new AutoBuyBudget(path);
  budget.reserve(wallet,day,token);assert.throws(()=>new AutoBuyBudget(path).reserve(wallet,day,token),/不重复/);
  for(let n=3;n<=11;n++)new AutoBuyBudget(path).reserve(wallet,day,'0x'+n.toString(16).padStart(40,'0'));
  assert.equal(new AutoBuyBudget(path).snapshot(wallet,day).count,10);
  assert.throws(()=>new AutoBuyBudget(path).reserve(wallet,day,'0x'+'3'.repeat(40)),/上限/);
  assert.equal(budget.reserve(wallet,'2026-10-29',token).count,1);
  assert.equal(budget.reserve('0x'+'4'.repeat(40),day,token).count,1);
});
test('malformed or locked budget fails closed without replacing prior reservations',t=>{
  const path=directory(t), budget=new AutoBuyBudget(path);budget.reserve(wallet,day,token);
  const before=readFileSync(budget.file,'utf8');writeFileSync(budget.file+'.lock','owned by another process');
  assert.throws(()=>budget.reserve(wallet,day,'0x'+'3'.repeat(40)),/EEXIST/);
  assert.equal(readFileSync(budget.file,'utf8'),before);
  writeFileSync(budget.file,'{broken');assert.throws(()=>budget.snapshot(wallet,day));
});
test('stopping or rearming during preview revokes the old buy before execute',async t=>{
  const source=readFileSync(new URL('../baw-oneclick/preset-autobuy.mjs',import.meta.url),'utf8');
  const cls=source.slice(source.indexOf('class PresetAutoBuyer'),source.indexOf('export const presetAutoBuyer'));
  for(const rearm of [false,true]) {
    let reached,release;const waiting=new Promise(r=>reached=r),blocked=new Promise(r=>release=r),calls=[];
    const context={AutoBuyBudget,defaultDataDirectory:()=>directory(t),dayKey:()=>day,presetWatch:{onEvent(){}},PRESET_ID:'preset',BUDGET_BNB:'0.1',BUDGET:100n,MIN_GAS:1n,MAX_DAILY:10,MAX_FEE_BPS:500,SLIPPAGE_BPS:5000,
      CORE:'core',VERIFIED_ZAP:'zap',EXCLUDED_QUOTES:new Set(),SUPPORTED_QUOTES:new Map([['quote','Q']]),coreABI:{encodeFunctionData:()=> 'data'},viewABI:{},toolsABI:{},same:(a,b)=>a===b,short:s=>s,sleep:async()=>{},
      call:async(_to,_abi,name)=>({tokens:{exists:true,paused:false,presetId:'preset',token,quoteAsset:'quote',vault:'vault'},phase:[1],zapRouter:['zap'],registry:['registry'],openFourTool:['tools'],estimateBuyByBudget:[{tokenAmount:100n,userPays:100n,curveQuote:100n,totalFee:1n}]}[name]),
      runBaw:async args=>{calls.push(args[1]);if(args[1]==='preview'){reached();await blocked;return{json:{success:true,data:{requestId:'fake',requireConfirmation:false}}};}return{json:{success:true,data:{}}};},Date,Intl,Set,Number,String,BigInt};
    vm.createContext(context);const buyer=vm.runInContext(cls+';new PresetAutoBuyer()',context);buyer.armed=true;buyer.wallet=wallet;
    const inFlight=buyer.buy({token,symbol:'AUDIT'});await waiting;buyer.disarm();if(rearm)buyer.armed=true;release();await inFlight;
    assert.deepEqual(calls,['preview']);assert.equal(buyer.budget.snapshot(wallet,day).count,0);
  }
});
