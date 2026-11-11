import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,createHmac} from 'node:crypto';
import worker from '../worker/index.js';
import {CHALLENGE_COOKIE,SESSION_COOKIE,signLocal,verifyPassword} from '../worker/auth.js';

const password=randomBytes(24).toString('base64url'),key=randomBytes(32);
const env={SITE_ORIGIN:'https://eki.example',SESSION_SECRET:randomBytes(32).toString('base64url'),PASSWORD_KEY:key.toString('base64url'),PASSWORD_VERIFIER:createHmac('sha256',key).update(password).digest('base64url'),LOGIN_LIMITER:{limit:async()=>({success:true})},ASSETS:{fetch:async()=>new Response('<h1>Private library</h1>',{headers:{'Content-Type':'text/html','Cache-Control':'public, max-age=3600'}})}};
const req=(path,options={})=>new Request(env.SITE_ORIGIN+path,options);
async function challenge(){
  const page=await worker.fetch(req('/login'),env);
  const cookie=page.headers.getSetCookie()[0].split(';')[0];
  const config=await worker.fetch(req('/auth/config',{headers:{Cookie:cookie}}),env);
  return {cookie,...await config.json()};
}
function loginRequest(c,value,headers={}){
  return req('/auth/password',{method:'POST',headers:{Origin:env.SITE_ORIGIN,Cookie:c.cookie,'Content-Type':'application/json','X-Eki-CSRF':c.nonce,...headers},body:JSON.stringify({password:value})});
}
test('unauthenticated visitors cannot read HTML, assets, API or forge identity headers',async()=>{
  for(const path of ['/','/index.html','/app.js','/catalog.json','/.private/data.json','/api/data']){
    const result=await worker.fetch(req(path,{headers:{'Cf-Access-Authenticated-User-Email':'imaron0812@gmail.com',Authorization:'Bearer forged'}}),env);
    assert.equal(result.status,path.startsWith('/api/')?401:303,path);assert.equal(result.headers.get('cache-control'),'private, no-store');
    if(result.status===303)assert.equal(result.headers.get('location'),'/login');
  }
});
test('correct password creates a secure session and unlocks full site and data',async()=>{
  const c=await challenge(),result=await worker.fetch(loginRequest(c,password),env);
  assert.equal(result.status,200);
  const cookies=result.headers.getSetCookie(),signed=cookies.find(v=>v.startsWith(SESSION_COOKIE+'='));
  assert.match(signed,/Secure; HttpOnly; SameSite=Strict/);assert.match(signed,/Max-Age=43200/);
  assert.ok(cookies.some(v=>v.startsWith(CHALLENGE_COOKIE+'=;')&&v.includes('Max-Age=0')));
  const headers={Cookie:signed.split(';')[0]},res=await worker.fetch(req('/api/data',{headers}),env),data=await res.json();
  assert.equal(data.length,64);assert.equal(data.reduce((n,g)=>n+g.lines.length,0),384);
  const site=await worker.fetch(req('/',{headers}),env);assert.equal(site.status,200);assert.equal(site.headers.get('cache-control'),'private, no-store');assert.match(await site.text(),/Private library/);
});
test('favicon and repeated login-page requests do not replace an active challenge',async()=>{
  const c=await challenge();
  const favicon=await worker.fetch(req('/favicon.ico'),env);
  assert.equal(favicon.status,204);assert.equal(favicon.headers.get('set-cookie'),null);
  const second=await worker.fetch(req('/login',{headers:{Cookie:c.cookie}}),env);
  assert.equal(second.status,200);assert.equal(second.headers.get('set-cookie'),null);
  assert.equal((await worker.fetch(loginRequest(c,password),env)).status,200);
});
test('password verifier rejects wrong passwords and malformed input',async()=>{
  assert.ok(await verifyPassword(password,env));
  for(const wrong of ['wrong-password-value',password+'x','',null,{},'x'.repeat(129)])assert.equal(await verifyPassword(wrong,env),false);
  const c=await challenge();assert.equal((await worker.fetch(loginRequest(c,'wrong-password-value'),env)).status,403);
});
test('login rejects missing cookies, cross-site POST, absent CSRF and oversized body',async()=>{
  const c=await challenge();
  for(const headers of [{Origin:'https://attacker.example'},{Origin:''},{Cookie:''},{'X-Eki-CSRF':''},{'X-Eki-CSRF':'bad'},{'Sec-Fetch-Site':'cross-site'}])assert.equal((await worker.fetch(loginRequest(c,password,headers),env)).status,403);
  assert.equal((await worker.fetch(loginRequest(c,'x'.repeat(21000)),env)).status,400);
  assert.equal((await worker.fetch(req('/auth/password'),env)).status,405);
});
test('login attempts are rate limited and limiter failure denies login',async()=>{
  const c=await challenge();
  const limited=await worker.fetch(loginRequest(c,password),{...env,LOGIN_LIMITER:{limit:async()=>({success:false})}});
  assert.equal(limited.status,429);assert.equal(limited.headers.get('retry-after'),'60');
  assert.equal((await worker.fetch(loginRequest(c,password),{...env,LOGIN_LIMITER:{limit:async()=>{throw Error('unavailable');}}})).status,503);
});
test('expired, forged, wrong-subject, wrong-purpose and duplicate sessions cannot bypass the gate',async()=>{
  const valid=await signLocal({sub:'owner'},'session',env,3600);
  const invalid=['forged',await signLocal({sub:'owner'},'session',env,-1),await signLocal({sub:'other'},'session',env,3600),await signLocal({sub:'owner'},'challenge',env,3600)];
  for(const token of invalid)assert.equal((await worker.fetch(req('/api/data',{headers:{Cookie:`${SESSION_COOKIE}=${token}`}}),env)).status,401);
  assert.equal((await worker.fetch(req('/api/data',{headers:{Cookie:`${SESSION_COOKIE}=${valid}; ${SESSION_COOKIE}=${valid}`}}),env)).status,401);
  assert.equal((await worker.fetch(req('/api/data',{headers:{Cookie:`${SESSION_COOKIE}=${valid}`}}),{...env,SESSION_SECRET:randomBytes(32).toString('base64url')})).status,401);
});
test('missing configuration and alternate deployment origins never expose the site',async()=>{
  for(const changed of [{SESSION_SECRET:''},{PASSWORD_KEY:''},{PASSWORD_VERIFIER:''},{SITE_ORIGIN:''},{LOGIN_LIMITER:undefined}]){
    assert.equal((await worker.fetch(req('/api/data'),{...env,...changed})).status,503);assert.equal((await worker.fetch(req('/'),{...env,...changed})).status,503);
  }
  assert.equal((await worker.fetch(new Request('https://preview.example/api/data'),env)).status,503);
});
test('logout requires same-origin POST and clears both cookies',async()=>{
  assert.equal((await worker.fetch(req('/auth/logout'),env)).status,405);
  assert.equal((await worker.fetch(req('/auth/logout',{method:'POST',headers:{Origin:'https://attacker.example','X-Eki-CSRF':'logout'}}),env)).status,403);
  const res=await worker.fetch(req('/auth/logout',{method:'POST',headers:{Origin:env.SITE_ORIGIN,'X-Eki-CSRF':'logout'}}),env);
  assert.equal(res.status,200);assert.equal(res.headers.getSetCookie().length,2);assert.ok(res.headers.getSetCookie().every(c=>c.includes('Max-Age=0')));
});
