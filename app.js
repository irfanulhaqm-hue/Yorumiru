const KEY='yorumiru-v2';
const API='https://graphql.anilist.co';
let A=JSON.parse(localStorage.getItem(KEY)||'[]'),filter='all',cid=null,cs=0,searchTimer=null;

const $=s=>document.querySelector(s);
const save=()=>localStorage.setItem(KEY,JSON.stringify(A));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
function norm(a){
  a.seasons=(a.seasons||[]).map((s,i)=>({number:s.number||i+1,title:s.title||'',episodes:Array.isArray(s.episodes)?s.episodes.map(Boolean):Array(s.episodes||0).fill(false)}));
  a.favorite=!!a.favorite; a.poster=a.poster||a.cover||''; return a;
}
A=A.map(norm);save();

function totals(a){let total=0,watched=0;(a.seasons||[]).forEach(s=>{total+=s.episodes.length;watched+=s.episodes.filter(Boolean).length});return{total,watched,p:total?watched/total:0}}
function stat(a){let t=totals(a);return t.watched===0?'planned':t.watched===t.total?'completed':'watching'}
function render(){
  let shown=A.filter(a=>filter==='all'||filter==='favorites'? (filter==='all'||a.favorite) : stat(a)===filter);
  let w=A.reduce((n,a)=>n+totals(a).watched,0),t=A.reduce((n,a)=>n+totals(a).total,0);
  $('#stats').innerHTML=`${A.length} anime<br><b>${w}/${t}</b> episodes watched`;
  $('#list').innerHTML='';
  shown.forEach(a=>{
    let x=totals(a),s=stat(a),e=document.createElement('article');e.className='card';
    e.innerHTML=`<img class=poster src="${esc(a.poster)}" onerror="this.style.visibility='hidden'"><div><div class=title>${a.favorite?'♥ ':''}${esc(a.title)}</div><div class=meta>${a.seasons.length} season${a.seasons.length>1?'s':''} · ${x.watched}/${x.total} episodes</div><div class=bar><div class=fill style="width:${x.p*100}%"></div></div><div class=status ${s}>${s.toUpperCase()}</div></div><div class=chev>›</div>`;
    e.onclick=()=>detail(a.id);$('#list').append(e)
  });
  $('#empty').classList.toggle('show',shown.length===0);
}

async function gql(query,variables={}){
  const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,variables})});
  if(!r.ok)throw new Error('Network error'); const j=await r.json(); if(j.errors)throw new Error(j.errors[0].message); return j.data;
}
const searchQuery=`query($q:String){Page(perPage:8){media(search:$q,type:ANIME,sort:SEARCH_MATCH){id,title{romaji english native},coverImage{large},episodes,seasonYear,format,averageScore,relations{edges{relationType node{id title{romaji english} coverImage{large} episodes seasonYear format}}}}}}`;
function animeName(x){return x.title.english||x.title.romaji||x.title.native||'Unknown anime'}

function openAdd(){ $('#search').value='';$('#results').innerHTML='<p class=meta>Type an anime title to search.</p>';$('#selected').classList.add('hidden');$('#selected').innerHTML='';$('#addDlg').showModal();$('#search').focus() }
$('#add').onclick=openAdd;$('#emptyAdd').onclick=openAdd;$('#close').onclick=()=>$('#addDlg').close();$('#cancel').onclick=()=>$('#addDlg').close();

$('#search').oninput=()=>{
  clearTimeout(searchTimer);let q=$('#search').value.trim();if(!q){$('#results').innerHTML='';return}
  $('#results').innerHTML='<p class=meta>Searching…</p>';
  searchTimer=setTimeout(async()=>{try{
    let d=await gql(searchQuery,{q});let m=d.Page.media;
    $('#results').innerHTML=m.map(x=>`<div class=result><img src="${esc(x.coverImage?.large||'')}" onerror="this.style.visibility='hidden'"><div><b>${esc(animeName(x))}</b><small>${x.seasonYear||''} · ${x.format||''} · ${x.episodes||'?'} episodes · ${(x.averageScore||0)/10}/10</small></div><button class=primary data-id="${x.id}">Select</button></div>`).join('')||'<p class=meta>No anime found.</p>';
    $('#results').querySelectorAll('button').forEach(b=>b.onclick=()=>selectAnime(m.find(x=>x.id==b.dataset.id)));
  }catch(e){$('#results').innerHTML='<p class=meta>Could not reach AniList. Check your connection.</p>'}},350)
};

async function selectAnime(x){
  $('#results').innerHTML='';$('#selected').classList.remove('hidden');
  $('#selected').innerHTML=`<img src="${esc(x.coverImage?.large||'')}" onerror="this.style.visibility='hidden'"><h3>${esc(animeName(x))}</h3><p>${x.seasonYear||''} · ${x.format||''} · ${x.episodes||'?'} episodes</p><div class=seasonPick id=seasonPick><p class=meta>Loading related seasons…</p></div><div class=actions><button class=primary id=addSelected>Add to watchlist</button></div>`;
  let candidates=[x];
  try{
    let rel=x.relations?.edges||[];
    let related=rel.filter(e=>['SEQUEL','PREQUEL'].includes(e.relationType)&&e.node).map(e=>e.node).filter(n=>n.format==='TV'||n.format==='ONA');
    // Put likely prequel first, then sequels. This keeps the same franchise together.
    related.sort((a,b)=>(a.seasonYear||9999)-(b.seasonYear||9999));
    candidates=[...candidates,...related];
  }catch{}
  candidates=[...new Map(candidates.map(n=>[n.id,n])).values()];
  $('#seasonPick').innerHTML=candidates.slice(0,8).map((n,i)=>`<label class=seasonRow><span><b>Season ${i+1}</b> — ${esc(animeName(n))}<small class=meta> ${n.episodes||'?'} eps · ${n.seasonYear||''}</small></span><input type=checkbox class=seasonCheck data-id="${n.id}" ${i===0?'checked':''}></label>`).join('');
  $('#addSelected').onclick=()=>{
    let chosen=candidates.filter(n=>$('#seasonPick').querySelector(`[data-id="${n.id}"]`)?.checked);
    if(!chosen.length)chosen=[x];
    let title=animeName(x),existing=A.find(a=>a.title.toLowerCase()===title.toLowerCase());
    if(existing){chosen.forEach(n=>{if(!existing.seasons.some(s=>s.sourceId===n.id))existing.seasons.push({number:existing.seasons.length+1,title:animeName(n),sourceId:n.id,episodes:Array(n.episodes||0).fill(false)})});}
    else A.push({id:Date.now(),title,poster:x.coverImage?.large||'',year:x.seasonYear||'',favorite:false,seasons:chosen.map((n,i)=>({number:i+1,title:animeName(n),sourceId:n.id,episodes:Array(n.episodes||0).fill(false)}))});
    save();$('#addDlg').close();render();
  };
}

function detail(id){cid=id;cs=0;drawDetail();$('#detailDlg').showModal()}
function drawDetail(){
  let a=A.find(x=>x.id===cid),t=totals(a);
  $('#detail').innerHTML=`<button class=x onclick="$('#detailDlg').close()">×</button>
  <div class=detailTop><img src="${esc(a.poster)}" onerror="this.style.visibility='hidden'"><div><small class=label>ANIME</small><h2>${esc(a.title)}</h2><div class=meta>${t.watched}/${t.total} watched</div><button class="favBtn ${a.favorite?'on':''}" id=fav>${a.favorite?'♥ Favorite':'♡ Add to favorites'}</button></div></div>
  <div class=tabs>${a.seasons.map((s,i)=>`<button class="tab ${i===cs?'on':''}" data-i=${i}>Season ${s.number}</button>`).join('')}</div>
  <div class=eps>${a.seasons[cs].episodes.map((d,i)=>`<div class="ep ${d?'done':''}" data-e=${i}><div class=num>${d?'✓':i+1}</div><span>${esc(a.seasons[cs].episodeTitles?.[i]||'Episode '+(i+1))}</span>${d?'<span class=watch>WATCHED</span>':''}</div>`).join('')}</div>
  <div class=detailBtns><button class=secondary id=all>${a.seasons[cs].episodes.every(Boolean)?'Unwatch season':'Mark season watched'}</button><button class=secondary id=del>Delete</button></div>`;
  document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{cs=+b.dataset.i;drawDetail()});
  $('#fav').onclick=()=>{a.favorite=!a.favorite;save();render();drawDetail()};
  document.querySelectorAll('.ep').forEach(e=>e.onclick=()=>{
    let i=+e.dataset.e,s=a.seasons[cs];
    if(s.episodes[i]){s.episodes[i]=false;save();render();drawDetail();return}
    if(i>0 && s.episodes.slice(0,i).some(v=>!v)){
      if(confirm(`Did you watch all episodes up to Episode ${i+1}?\n\nOK = mark Episodes 1–${i+1} watched\nCancel = mark only Episode ${i+1}`)){
        for(let j=0;j<=i;j++)s.episodes[j]=true;
      }else s.episodes[i]=true;
    }else s.episodes[i]=true;
    save();render();drawDetail();
  });
  $('#all').onclick=()=>{let v=!a.seasons[cs].episodes.every(Boolean);a.seasons[cs].episodes=a.seasons[cs].episodes.map(()=>v);save();render();drawDetail()};
  $('#del').onclick=()=>{if(confirm('Remove '+a.title+' from Yorumiru?')){A=A.filter(x=>x.id!==a.id);save();$('#detailDlg').close();render()}}
}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('nav button').forEach(x=>x.classList.remove('on'));b.classList.add('on');filter=b.dataset.f;render()});
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js');
render();
