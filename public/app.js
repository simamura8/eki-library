import { labels, search, validData } from './core.js';
const $ = s => document.querySelector(s);
const escape = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let catalog=[], data=null, selected=1, position=1, view='list', toastTimer;
const readStore = key => {try{const v=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(v)?v.filter(x=>typeof x==='string'&&/^\d{1,2}-[1-6]$/.test(x)&&+x.split('-')[0]>=1&&+x.split('-')[0]<=64):[];}catch{return[];}};
let saved=readStore('eki-saved'), recent=readStore('eki-recent');
function store(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{toast('このブラウザでは履歴を保存できません。');}}
function toast(message){clearTimeout(toastTimer);$('#status').textContent=message;$('#status').hidden=false;toastTimer=setTimeout(()=>$('#status').hidden=true,3500);}
const symbol = id => String.fromCodePoint(0x4dc0+id-1);
function go(id,p=1,scroll=false){
  selected=Math.max(1,Math.min(64,Number(id)));position=Math.max(1,Math.min(6,Number(p)));
  const hash=`#${selected}-${position}`;
  if(location.hash!==hash)location.hash=hash;
  const key=`${selected}-${position}`;recent=[key,...recent.filter(x=>x!==key)].slice(0,6);store('eki-recent',recent);
  render();$('#search-results').hidden=true;
  if(scroll && window.innerWidth<=720)$('#reader').scrollIntoView({behavior:'smooth',block:'start'});
}
function renderNav(){
  const card=g=>`<button class="gua-item ${selected===g.id?'active':''}" data-gua="${g.id}" ${selected===g.id?'aria-current="true"':''}><span class="number">${String(g.id).padStart(2,'0')}</span><span class="symbol" aria-hidden="true">${symbol(g.id)}</span><span>${escape(g.name)}</span></button>`;
  if(view==='list')$('#nav-content').innerHTML=`<div class="gua-list">${catalog.map(card).join('')}</div>`;
  else if(view==='matrix'){
    const trigrams=['天','沢','火','雷','風','水','山','地'];
    $('#nav-content').innerHTML=`<p class="matrix-caption">縦：上卦　／　横：下卦</p><div class="matrix-scroll"><table class="matrix"><thead><tr><th></th>${trigrams.map(t=>`<th scope="col">${t}</th>`).join('')}</tr></thead><tbody>${trigrams.map(u=>`<tr><th scope="row">${u}</th>${trigrams.map(l=>{const g=catalog.find(g=>g.upper===u&&g.lower===l);return `<td><button data-gua="${g.id}" title="${escape(g.name)}" aria-label="${escape(g.name)}" class="${g.id===selected?'active':''}">${g.id}</button></td>`;}).join('')}</tr>`).join('')}</tbody></table></div>`;
  } else $('#nav-content').innerHTML=saved.length?`<div class="gua-list">${saved.map(key=>{const [id,p]=key.split('-').map(Number),g=catalog[id-1];return `<button class="gua-item ${id===selected&&p===position?'active':''}" data-gua="${id}" data-position="${p}"><span class="symbol" aria-hidden="true">${symbol(id)}</span>${escape(g.name)} ${labels[p-1]}</button>`;}).join('')}</div>`:'<p class="empty">気になる爻に「しおり」を付けると、<br>ここからすぐにひらけます。</p>';
  $('#nav-count').textContent=view==='saved'?`${saved.length} 件`:'64 卦';
  $('#recent').innerHTML=recent.length?`<h3>最近ひらいた爻</h3>${recent.map(key=>{const [id,p]=key.split('-').map(Number);return `<button data-gua="${id}" data-position="${p}">${escape(catalog[id-1].name)} ${labels[p-1]}</button>`;}).join('')}`:'';
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
}
function renderReader(){
  const g=catalog[selected-1], full=data?.[selected-1], line=full?.lines[position-1], key=`${selected}-${position}`;
  const hidden=line?data[line.hiddenId-1]:null, hiddenLine=hidden?.lines[line.hiddenPosition-1];
  $('#reader').innerHTML=`<div class="reader-top"><div><p class="reader-kicker">第 ${String(g.id).padStart(2,'0')} 卦　／　上卦 ${g.upper}・下卦 ${g.lower}</p><h2 class="gua-title"><span class="symbol" aria-hidden="true">${symbol(g.id)}</span>${escape(g.name)}</h2></div><button id="save" class="save" aria-pressed="${saved.includes(key)}">${saved.includes(key)?'◆ しおり済み':'◇ しおり'}</button></div>
  ${full?`<div class="judgment"><p class="label">卦辞</p><p class="quote">${escape(full.judgment)}</p></div>`:''}
  <div class="line-tabs" role="tablist" aria-label="爻を選ぶ">${labels.map((label,i)=>`<button id="tab-${i+1}" role="tab" aria-selected="${position===i+1}" aria-controls="line-panel" tabindex="${position===i+1?0:-1}" data-line="${i+1}">${label}</button>`).join('')}</div>
  <div id="line-panel" role="tabpanel" aria-labelledby="tab-${position}"><div class="line-header"><h3>${labels[position-1]}</h3><small>${position} / 6</small></div>
  ${line?`<p class="line-text">${escape(line.text)}</p><div class="meaning"><p class="label">意味</p><p>${escape(line.meaning)}</p></div><div class="hidden-gua"><p class="label">伏卦</p><div class="hidden-heading"><h3>${escape(hidden.name)} ${hiddenLine.label}</h3><button data-gua="${hidden.id}" data-position="${hiddenLine.position}">この爻をひらく →</button></div><p class="quote">${escape(hiddenLine.text)}</p><p class="hidden-meaning">${escape(hiddenLine.meaning)}</p></div>`:`<div class="lock-panel"><div class="lock-icon" aria-hidden="true">⌑</div><h3>あなただけの、易の書庫。</h3><p>卦辞・爻辞の本文は、<br>ログイン後にひらきます。</p><button class="primary" data-login>ログインして本文をひらく</button><div class="diagram" aria-label="卦の形（下から初爻）">${[...g.bits].reverse().map((bit,i)=>`<button data-line="${6-i}" class="${position===6-i?'selected':''}" aria-label="${labels[5-i]}">${bit==='1'?'<i></i>':'<i></i><i></i>'}</button>`).join('')}</div></div>`}</div>
  <div class="reader-bottom"><button data-prev>← 前の爻</button><button id="copy-link">リンクをコピー</button><button data-next>次の爻 →</button></div>`;
  document.title=`${g.name} ${labels[position-1]} — 易の書庫`;
}
function render(){renderNav();renderReader();}
function login(){ location.assign('/login'+location.hash); }
function runSearch(){
  const value=$('#search').value;if(!value.trim()){$('#search-results').hidden=true;return;}
  const results=search(catalog,data,value);
  $('#search-results').innerHTML=results.length?results.map(r=>`<button data-gua="${r.id}" data-position="${r.position}"><strong>${escape(r.title)}</strong><small>${escape(r.excerpt.slice(0,95))}</small></button>`).join(''):`<p>該当する項目がありません。${data?'卦名・卦番号・本文の言葉をお試しください。':'本文の検索はログイン後に利用できます。'}</p>`;
  $('#search-results').hidden=false;
}
document.addEventListener('click',async event=>{
  const b=event.target.closest('button');
  if(!event.target.closest('.search-section'))$('#search-results').hidden=true;
  if(!b)return;
  if(b.dataset.gua){go(b.dataset.gua,b.dataset.position||1,true);$('#search').value='';}
  else if(b.dataset.line)go(selected,b.dataset.line);
  else if(b.dataset.view){view=b.dataset.view;renderNav();}
  else if(b.hasAttribute('data-login'))login();
  else if(b.id==='save'){const key=`${selected}-${position}`;saved=saved.includes(key)?saved.filter(x=>x!==key):[key,...saved];store('eki-saved',saved);render();}
  else if(b.hasAttribute('data-prev')){if(position>1)go(selected,position-1);else go(selected===1?64:selected-1,6);}
  else if(b.hasAttribute('data-next')){if(position<6)go(selected,position+1);else go(selected===64?1:selected+1,1);}
  else if(b.id==='copy-link'){try{await navigator.clipboard.writeText(location.href);toast('この爻へのリンクをコピーしました。');}catch{toast('アドレスバーのURLをコピーしてください。');}}
});
$('#auth').addEventListener('click',async()=>{
  try{
    const response=await fetch('/auth/logout',{method:'POST',credentials:'same-origin',headers:{'X-Eki-CSRF':'logout'}});
    if(!response.ok)throw Error('logout');
    data=null;$('#reader').replaceChildren();location.replace('/login');
  }catch{toast('ログアウトできませんでした。通信を確認して再度お試しください。');}
});
$('#search').addEventListener('input',runSearch);
$('#search').addEventListener('keydown',event=>{if(event.key==='Enter'){const first=$('#search-results button');if(first)first.click();}else if(event.key==='Escape')$('#search-results').hidden=true;else if(event.key==='ArrowDown'){event.preventDefault();$('#search-results button')?.focus();}});
document.addEventListener('keydown',event=>{
  if(event.key==='/' && !/INPUT|TEXTAREA/.test(event.target.tagName)){event.preventDefault();$('#search').focus();}
  if(event.target.getAttribute('role')==='tab' && ['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
    event.preventDefault();go(selected,event.key==='Home'?1:event.key==='End'?6:((position-1+(event.key==='ArrowRight'?1:5))%6)+1);$(`#tab-${position}`).focus();
  }
});
function readHash(){const m=location.hash.match(/^#(\d{1,2})-([1-6])$/);if(m&&+m[1]>=1&&+m[1]<=64){selected=+m[1];position=+m[2];}render();}
window.addEventListener('hashchange',readHash);
try{
  const get=async url=>{const response=await fetch(url,{credentials:'same-origin',cache:'no-store'});if(response.status===401){login();throw Error('login');}if(!response.ok)throw Error('load');return response.json();};
  const [loadedCatalog,loadedData]=await Promise.all([get('./catalog.json'),get('/api/data')]);
  if(!validData(loadedData))throw Error('data');
  catalog=loadedCatalog;data=loadedData;readHash();
}catch{$('#reader').innerHTML='<p>書庫を読み込めませんでした。ページを再読み込みしてください。</p>';}
