import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {search,parseQuery,validData} from '../public/core.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../public/catalog.json',import.meta.url),'utf8'));
const data=JSON.parse(fs.readFileSync(new URL('../.private/data.json',import.meta.url),'utf8'));
test('64 unique hexagrams, 384 lines, 64 unique trigram pairs, all hidden references valid',()=>{
  assert.ok(validData(data));assert.equal(new Set(catalog.map(g=>g.bits)).size,64);assert.equal(new Set(catalog.map(g=>g.upper+g.lower)).size,64);
  for(const g of data)for(const line of g.lines)assert.ok(data[line.hiddenId-1].lines[line.hiddenPosition-1]);
});
test('small-image text is present for every line and mapped by upper and lower trigrams',()=>{
  const samples=[
    [1,1,'潜龙勿用，阳在下也。'],
    [2,1,'履霜坚冰，阴始凝也。'],
    [3,1,'虽磐桓，志行正也。']
  ];
  assert.equal(data.flatMap(g=>g.lines).filter(l=>typeof l.xiaoxiang==='string'&&l.xiaoxiang.length>0).length,384);
  for(const [id,p,expected] of samples)assert.equal(data[id-1].lines[p-1].xiaoxiang,expected);
  for(const g of data)for(const l of g.lines)assert.ok(data[l.hiddenId-1].lines[l.hiddenPosition-1].xiaoxiang);
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
test('public files contain no private text or raw CSV',()=>{
  const files=fs.readdirSync(new URL('../public/',import.meta.url));
  for(const file of files){assert.ok(!file.endsWith('.csv'));const text=fs.readFileSync(new URL('../public/'+file,import.meta.url),'utf8');assert.ok(!text.includes(data[0].lines[0].text),file);assert.ok(!text.includes(data[0].judgment),file);}
});
