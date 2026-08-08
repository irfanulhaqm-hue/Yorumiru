const KEY='yorumiru-v2';
const API='https://graphql.anilist.co';
let A=JSON.parse(localStorage.getItem(KEY)||'[]');
let filter='all', cid=null, cs=0, selected=null;

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const save=()=>localStorage.setItem(KEY,JSON.stringify(A));

function totals(a){
  let total=0,watched=0;
  (a.seasons||[]).forEach(s=>{
    total+=(s.episodes||[]).length;
    watched+=(s.episodes||[]).filter(Boolean).length;
  });
  return {total,watched,p:total?watched/total:0};
}
function stat(a){
  const t=totals(a);
  if(!t.total||t.watched===0)return 'planned';
  return t.watched===t.total?'completed':'watching';
}
function cover(a){
  return a.cover?`<img src="${esc(a.cover)}" alt="">`:'<span>✦</span>';
}

function render(){
  const shown=A.filter(a=>filter==='all'||stat(a)===filter);
  const w=A.reduce((n,a)=>n+totals(a).watched,0);
  const t=A.reduce((n,a)=>n+totals(a).total,0);
  $('#stats').innerHTML=`${A.length} anime<br><b>${w}/${t}</b> episodes watched`;
  $('#list').innerHTML='';
  shown.forEach(a=>{
    const x=totals(a),s=stat(a);
    const e=document.createElement('article');
    e.className='card';
    e.innerHTML=`
      <div class="poster">${cover(a)}</div>
      <div>
        <div class="title">${esc(a.title)}</div>
        <div class="meta">${a.year||''}${a.year?' · ':''}${x.watched}/${x.total||'?'} episodes</div>
        <div class="bar"><div class="fill" style="width:${x.p*100}%"></div></div>
        <div class="status ${s}">${s.toUpperCase()}</div>
      </div><div class="chev">›</div>`;
    e.onclick=()=>detail(a.id);
    $('#list').append(e);
  });
  $('#empty').classList.toggle('show',shown.length===0);
}

async function aniList(query){
  const q=`query($search:String!){
    Page(page:1,perPage:12){
      media(search:$search,type:ANIME,isAdult:false,sort:POPULARITY_DESC){
        id
        title{romaji english native}
        coverImage{large medium}
        episodes
        nextAiringEpisode{episode}
        season
        seasonYear
        format
        status
        averageScore
      }
    }
  }`;
  const r=await fetch(API,{
    method:'POST',
    headers:{'Content-Type':'application/json','Accept':'application/json'},
    body:JSON.stringify({query:q,variables:{search:query}})
  });
  if(!r.ok) throw new Error('AniList request failed');
  const j=await r.json();
  if(j.errors) throw new Error(j.errors[0]?.message||'AniList error');
  return j.data.Page.media;
}

function titleOf(m){return m.title.english||m.title.romaji||m.title.native||'Untitled'}
function episodeCount(m){
  if(Number.isInteger(m.episodes)&&m.episodes>0)return m.episodes;
  if(m.nextAiringEpisode?.episode>1)return m.nextAiringEpisode.episode-1;
  return 0;
}

function resultCard(m){
  const ep=episodeCount(m);
  const el=document.createElement('button');
  el.className='result';
  el.innerHTML=`
    <div class="rposter"><img src="${esc(m.coverImage?.large||m.coverImage?.medium||'')}" alt=""></div>
    <div class="rinfo">
      <b>${esc(titleOf(m))}</b>
      <span>${m.seasonYear||'Year ?'} · ${esc(m.format||'ANIME')} · ${ep?ep+' episodes':'Episode count unavailable'}</span>
    </div><span class="plus">＋</span>`;
  el.onclick=()=>choose(m);
  return el;
}

async function search(){
  const q=$('#searchInput').value.trim();
  if(!q)return;
  $('#searchMsg').textContent='Searching…';
  $('#results').innerHTML='';
  try{
    const rows=await aniList(q);
    if(!rows.length){$('#searchMsg').textContent='No anime found.';return;}
    $('#searchMsg').textContent=`Found ${rows.length} results. Tap one to select it.`;
    rows.forEach(m=>$('#results').append(resultCard(m)));
  }catch(e){
    $('#searchMsg').textContent='Could not reach AniList. Check your connection and try again.';
  }
}

function choose(m){
  selected=m;
  const ep=episodeCount(m);
  $('#selectedAnime').innerHTML=`
    <div class="selected">
      <div class="bigPoster"><img src="${esc(m.coverImage?.large||m.coverImage?.medium||'')}" alt=""></div>
      <div>
        <small class="label">SELECTED ANIME</small>
        <h2>${esc(titleOf(m))}</h2>
        <div class="meta">${m.seasonYear||'Unknown year'} · ${esc(m.format||'ANIME')} · ${ep?ep+' episodes':'Episode count unavailable'}</div>
        ${m.averageScore?`<div class="score">★ ${(m.averageScore/10).toFixed(1)}/10</div>`:''}
      </div>
    </div>
    ${ep?`<p class="muted">Yorumiru will create ${ep} episode slots automatically. You only tap episodes as you watch them.</p>`:`<p class="muted">AniList did not provide a total episode count for this title. You can still add it, but episode tracking will need a manual count later.</p>`}`;
  $('#searchDlg').close();
  $('#addDlg').showModal();
}

function openSearch(){
  $('#searchInput').value='';
  $('#results').innerHTML='';
  $('#searchMsg').textContent='Search AniList for an anime.';
  $('#searchDlg').showModal();
  setTimeout(()=>$('#searchInput').focus(),100);
}
function openAdd(){openSearch()}

function addSelected(){
  if(!selected)return;
  const title=titleOf(selected);
  if(A.some(x=>x.anilistId===selected.id)){
    $('#addDlg').close();
    alert(`${title} is already in your watchlist.`);
    return;
  }
  const n=episodeCount(selected);
  const count=n||1;
  A.push({
    id:Date.now(),
    anilistId:selected.id,
    title,
    nativeTitle:selected.title.native||'',
    cover:selected.coverImage?.large||selected.coverImage?.medium||'',
    year:selected.seasonYear||'',
    format:selected.format||'',
    status:selected.status||'',
    score:selected.averageScore||null,
    seasons:[{number:1,episodes:Array(count).fill(false)}]
  });
  save();
  $('#addDlg').close();
  selected=null;
  render();
}

$('#add').onclick=openAdd;
$('#emptyAdd').onclick=openAdd;
$('#searchClose').onclick=()=>$('#searchDlg').close();
$('#addClose').onclick=()=>$('#addDlg').close();
$('#backToSearch').onclick=()=>{$('#addDlg').close();$('#searchDlg').showModal()};
$('#searchBtn').onclick=search;
$('#searchInput').addEventListener('keydown',e=>{if(e.key==='Enter')search()});
$('#confirmAdd').onclick=addSelected;

document.querySelectorAll('#filters button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('#filters button').forEach(x=>x.classList.remove('on'));
  b.classList.add('on'); filter=b.dataset.f; render();
});

function detail(id){
  cid=id;cs=0;drawDetail();$('#detailDlg').showModal();
}
function drawDetail(){
  const a=A.find(x=>x.id===cid); if(!a)return;
  const t=totals(a),s=a.seasons[cs];
  $('#detail').innerHTML=`
    <button class="x" id="detailClose">×</button>
    <div class="detailTop">
      <div class="dposter">${cover(a)}</div>
      <div><small class="label">ANIME</small><h2>${esc(a.title)}</h2>
      <div class="meta">${t.watched}/${t.total||'?'} watched ${a.year?'· '+a.year:''}</div></div>
    </div>
    <div class="tabs">${a.seasons.map((x,i)=>`<button class="tab ${i===cs?'on':''}" data-i="${i}">Season ${x.number}</button>`).join('')}</div>
    <div class="eps">${s.episodes.map((d,i)=>`
      <div class="ep ${d?'done':''}" data-e="${i}">
        <div class="num">${d?'✓':i+1}</div><span>Episode ${i+1}</span>${d?'<span class="watch">WATCHED</span>':''}
      </div>`).join('')}</div>
    <div class="detailBtns">
      <button class="secondary" id="all">${s.episodes.every(Boolean)?'Unwatch season':'Mark season watched'}</button>
      <button class="secondary danger" id="del">Delete</button>
    </div>`;
  $('#detailClose').onclick=()=>$('#detailDlg').close();
  document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{cs=+b.dataset.i;drawDetail()});
  document.querySelectorAll('.ep').forEach(e=>e.onclick=()=>{
    s.episodes[+e.dataset.e]=!s.episodes[+e.dataset.e];save();render();drawDetail();
  });
  $('#all').onclick=()=>{
    const v=!s.episodes.every(Boolean);
    s.episodes=s.episodes.map(()=>v);save();render();drawDetail();
  };
  $('#del').onclick=()=>{
    if(confirm('Remove '+a.title+' from Yorumiru?')){
      A=A.filter(x=>x.id!==a.id);save();$('#detailDlg').close();render();
    }
  };
}

if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
render();
