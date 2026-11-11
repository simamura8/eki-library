import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {search,parseQuery,validData} from '../public/core.js';
import worker from '../worker/index.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../public/catalog.json',import.meta.url),'utf8'));
const data=JSON.parse(fs.readFileSync(new URL('../.private/data.json',import.meta.url),'utf8'));
const env={ALLOWED_EMAIL:'imaron0812@gmail.com',SITE_ORIGIN:'https://simamura8.github.io'};
test('64 unique hexagrams, 384 lines, 64 unique trigram pairs, all hidden references valid',()=>{
  assert.ok(validData(data));assert.equal(new Set(catalog.map(g=>g.bits)).size,64);assert.equal(new Set(catalog.map(g=>g.upper+g.lower)).size,64);
  for(const g of data)for(const line of g.lines)assert.ok(data[line.hiddenId-1].lines[line.hiddenPosition-1]);
});
test('all 384 positions are directly searchable by number and name',()=>{
  for(const g of catalog)for(let p=1;p<=6;p++)for(const query of [`${g.id}-${p}`,`${g.name}${p}爻`]){
    const found=search(catalog,data,query);assert.equal(found[0]?.id,g.id,query);assert.equal(found[0]?.position,p,query);
  }
  assert.deepEqual(parseQuery('兌為澤三爻'),{query:'兌為沢',position:3});
  assert.deepEqual(parseQuery('乾為天九三'),{query:'乾為天',position:3});
  assert.equal(search(catalog,null,'58')[0].id,58);
  assert.equal(search(catalog,data,'潜龍')[0].id,1);
  assert.equal(search(catalog,null,'潜龍').length,0);
});
test('API rejects absent Access context and forged headers',async()=>{
  for(const headers of [{},{'Cf-Access-Authenticated-User-Email':env.ALLOWED_EMAIL,'Cf-Access-Jwt-Assertion':'forged'}]){
    const res=await worker.fetch(new Request('https://private.example/connect?nonce=12345678-1234-1234-1234-123456789012',{headers}),env,{});
    assert.equal(res.status,403);assert.ok(!(await res.text()).includes(data[0].lines[0].text));
  }
});
test('API rejects wrong identity and errors, validates nonce, releases data only to exact origin',async()=>{
  const req=new Request('https://private.example/connect?nonce=12345678-1234-1234-1234-123456789012');
  for(const email of ['someone@gmail.com',undefined])assert.equal((await worker.fetch(req,env,{access:{getIdentity:async()=>({email})}})).status,403);
  assert.equal((await worker.fetch(req,env,{access:{getIdentity:async()=>{throw Error('failed');}}})).status,403);
  const ctx={access:{getIdentity:async()=>({email:env.ALLOWED_EMAIL})}};
  assert.equal((await worker.fetch(new Request('https://private.example/connect'),env,ctx)).status,400);
  const res=await worker.fetch(req,env,ctx),html=await res.text();
  assert.equal(res.status,200);assert.equal(res.headers.get('cache-control'),'private, no-store');
  assert.ok(html.includes('"https://simamura8.github.io"'));assert.ok(html.includes('"type":"eki-data"'));
  assert.ok(res.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
});
test('public files contain no private text or raw CSV',()=>{
  const files=fs.readdirSync(new URL('../public/',import.meta.url));
  for(const file of files){assert.ok(!file.endsWith('.csv'));const text=fs.readFileSync(new URL('../public/'+file,import.meta.url),'utf8');assert.ok(!text.includes(data[0].lines[0].text),file);assert.ok(!text.includes(data[0].judgment),file);}
});
