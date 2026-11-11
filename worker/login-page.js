export const LOGIN_HTML = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#243f38"><title>易の書庫 — ログイン</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f5f3ed;color:#283b35;min-height:100vh;display:grid;place-items:center;font:14px/1.9 'Yu Gothic',sans-serif;padding:24px}.card{background:#fffefa;border:1px solid #dedfd5;border-radius:12px;padding:48px 35px;text-align:center;width:440px;max-width:100%;box-shadow:0 12px 40px #243f3808}.seal{display:inline-grid;place-items:center;border:1px solid #a6533b;color:#a6533b;width:48px;height:54px;font:34px 'Yu Mincho',serif;border-radius:3px}.eyebrow{font-size:10px;letter-spacing:.18em;color:#79817a;margin:22px 0 12px}h1{font:500 29px 'Yu Mincho',serif;letter-spacing:.12em;margin:12px 0 25px}.description{color:#69776e;font-size:13px}form{text-align:left;margin-top:27px}label{display:block;font-size:11px;margin-bottom:7px;color:#69776e}input{width:100%;font:16px sans-serif;padding:13px 12px;border:1px solid #bdc7b8;border-radius:6px;background:#fffefa;color:#243f38}button{cursor:pointer;font:inherit;border:0;border-radius:6px}.primary{display:block;width:100%;background:#243f38;color:white;padding:12px;margin-top:15px}.primary:hover{background:#35594e}.primary:disabled{opacity:.5;cursor:wait}.show{display:block;margin:8px 0 0 auto;font-size:10px;background:transparent;color:#69776e;padding:3px}#message{font-size:12px;color:#a6533b;min-height:24px;margin:15px 0 0}.foot{font-size:10px;color:#92978e;border-top:1px solid #e5e6dd;padding-top:22px;margin-top:24px}button:focus-visible,input:focus-visible{outline:3px solid #a6533b;outline-offset:4px}
</style><script src="/auth/login.js" defer></script></head>
<body><main class="card"><span class="seal" aria-hidden="true">易</span><p class="eyebrow">PRIVATE I CHING LIBRARY</p><h1>易の書庫</h1><p class="description">六十四卦、三百八十四爻。<br>専用パスワードで、書庫をひらきます。</p><form id="login-form"><label for="password">パスワード</label><input id="password" name="password" type="password" autocomplete="current-password" required minlength="16" maxlength="128" autocapitalize="none" spellcheck="false"><button type="button" class="show" id="show-password" aria-pressed="false">パスワードを表示</button><button type="submit" class="primary" id="submit" disabled>書庫をひらく →</button></form><p id="message" role="status">ログインを準備しています…</p><p class="foot">個人用の閲覧室です。<br>パスワードを知っている人だけが利用できます。</p></main></body></html>`;

export const LOGIN_JS = `
(async () => {
  const message=document.getElementById('message'), button=document.getElementById('submit'), password=document.getElementById('password');
  document.getElementById('show-password').addEventListener('click',event=>{
    const show=password.type==='password';password.type=show?'text':'password';
    event.target.setAttribute('aria-pressed',String(show));event.target.textContent=show?'パスワードを隠す':'パスワードを表示';
  });
  let nonce;
  try {
    const response=await fetch('/auth/config',{cache:'no-store',credentials:'same-origin'});
    if(!response.ok)throw Error('setup');
    nonce=(await response.json()).nonce;button.disabled=false;message.textContent='';
  } catch {message.textContent='ただいま書庫の設定を準備中です。しばらくしてから再度お試しください。';}
  document.getElementById('login-form').addEventListener('submit',async event=>{
    event.preventDefault();if(!nonce)return;button.disabled=true;message.textContent='確認しています…';
    try {
      const response=await fetch('/auth/password',{
        method:'POST',credentials:'same-origin',cache:'no-store',
        headers:{'Content-Type':'application/json','X-Eki-CSRF':nonce},body:JSON.stringify({password:password.value})
      });
      if(response.ok){password.value='';location.replace('/'+location.hash);return;}
      const error=await response.json().catch(()=>({}));
      message.textContent=response.status===429?'試行回数が多いため、1分ほど待ってからお試しください。':error.error==='Login denied'?'パスワードを確認して、もう一度お試しください。':'ログイン画面の有効期限が切れた可能性があります。ページを再読み込みしてください。';
    } catch {message.textContent='通信に失敗しました。もう一度お試しください。';}
    button.disabled=false;
  });
})();`;
