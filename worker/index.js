// No static assets binding: ctx.access must describe this invocation directly.
import DATA from '../.private/data.json' with { type: 'json' };
export default {
  async fetch(request, env, ctx) {
    const headers={'Cache-Control':'private, no-store','Content-Type':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cross-Origin-Opener-Policy':'unsafe-none'};
    const reply=(text,status=200,extra={})=>new Response(text,{status,headers:{...headers,...extra}});
    // Fail closed, including if Access is accidentally removed or a preview URL is used.
    if(!ctx.access)return reply('認証が必要です。',403);
    let identity;
    try{identity=await ctx.access.getIdentity();}catch{return reply('認証を確認できません。',403);}
    if(identity?.email?.toLowerCase()!==env.ALLOWED_EMAIL)return reply('このアカウントは許可されていません。',403);
    const url=new URL(request.url);
    if(request.method!=='GET')return reply('Method not allowed',405,{'Allow':'GET'});
    if(url.pathname!=='/connect')return reply('Not found',404);
    const nonce=url.searchParams.get('nonce');
    if(!/^[0-9a-f-]{36}$/.test(nonce||''))return reply('書庫のログインボタンから開いてください。',400);
    const scriptNonce=crypto.randomUUID();
    const payload=JSON.stringify({type:'eki-data',nonce,data:DATA}).replace(/</g,'\\u003c');
    const origin=JSON.stringify(env.SITE_ORIGIN);
    const html=`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>易の書庫 — 認証完了</title><body><h1>認証が完了しました。</h1><p id="message">書庫に戻ってください。</p><script nonce="${scriptNonce}">if(window.opener){window.opener.postMessage(${payload},${origin});document.getElementById('message').textContent='書庫に本文を読み込みました。このウィンドウを閉じてください。';}else{document.getElementById('message').textContent='書庫のログインボタンから、もう一度開いてください。';}</script></body></html>`;
    return reply(html,200,{'Content-Security-Policy':`default-src 'none'; script-src 'nonce-${scriptNonce}'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`});
  }
};
