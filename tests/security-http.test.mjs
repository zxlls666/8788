import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { createHash } from 'node:crypto';
import { startFixture } from './server-fixture.mjs';
import { extensionId } from '../native-install.mjs';
import { fileURLToPath } from 'node:url';

test('HTTP blocks foreign origins/hosts and write requests lacking explicit live intent',async t=>{
  const f=await startFixture();t.after(()=>f.close());
  const call=(path,headers={},method='GET')=>new Promise((resolve,reject)=>{
    const req=request(f.url+path,{method,headers},res=>{let body='';res.setEncoding('utf8');res.on('data',d=>body+=d);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));});
    req.on('error',reject);req.end(method==='POST'?'{}':undefined);
  });
  const auth={'x-bridge-token':'test-only-token','content-type':'application/json'};
  const page=await call('/');assert.equal(page.status,200);
  const script=page.body.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  const hash=createHash('sha256').update(script).digest('base64');
  assert.ok(page.headers['content-security-policy'].includes(`'sha256-${hash}'`));
  assert.ok(!page.headers['content-security-policy'].includes('unsafe-inline'));
  const extension='chrome-extension://'+extensionId(fileURLToPath(new URL('../',import.meta.url)));
  assert.ok(page.headers['content-security-policy'].includes(`frame-ancestors 'self' ${extension}`));
  assert.equal((await call('/',{host:'evil.invalid:8787'})).status,403);
  assert.equal((await call('/api/launcher-status',{origin:extension,'sec-fetch-site':'cross-site'})).status,200);
  assert.equal((await call('/api/multi/state',{...auth,origin:'https://evil.invalid'})).status,403);
  assert.equal((await call('/api/multi/state',{...auth,'sec-fetch-site':'cross-site'})).status,403);
  assert.equal((await call('/api/health')).status,401);
  for(const path of ['/api/dex-buy','/api/dex-sell','/api/swap','/api/gang/buy','/api/gang/sell','/api/send-key','/api/preset-autobuy/arm']) {
    for(const mode of [undefined,'1']) {
      const headers={...auth,...(mode===undefined?{}:{'x-baw-preview-only':mode})};
      const result=await call(path,headers,'POST');assert.equal(result.status,403,path);assert.match(result.body,/预演禁止/);
    }
  }
});
