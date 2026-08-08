const API="https://graphql.anilist.co",JIKAN="https://api.jikan.moe/v4",K="yorumiru-v4.5";
let db=JSON.parse(localStorage.getItem(K)||localStorage.getItem("yorumiru-v4.4.3")||localStorage.getItem("yorumiru-v4.4.2")||localStorage.getItem("yorumiru-v4.4")||localStorage.getItem("yorumiru-v4.3")||localStorage.getItem("yorumiru-v4")||'{"list":[],"favorites":[],"favChars":[],"profile":{"name":"Yorumiru User"}}'),genre="";
db.list=db.list||[];db.favorites=db.favorites||[];db.favChars=db.favChars||[];db.profile=db.profile||{name:"Yorumiru User"};db.profile.banner=db.profile.banner||"";db.profile.avatar=db.profile.avatar||"";

const imageProxy=u=>{u=String(u||"");return /^https?:\/\//.test(u)&&!u.includes("images.weserv.nl")?"https://images.weserv.nl/?url="+encodeURIComponent(u):u};
window.imgFallback=el=>{if(!el||el.dataset.fallbackDone)return;const src=el.dataset.original||el.currentSrc||el.src;if(!src||src.startsWith("data:")||src.includes("images.weserv.nl")){el.style.opacity=".35";return}el.dataset.fallbackDone="1";el.src=imageProxy(src)};
const imageTag=(src,extra="")=>`<img src="${esc(src)}" data-original="${esc(src)}" onerror="imgFallback(this)" ${extra}>`;
const $=s=>document.querySelector(s),esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])),save=()=>localStorage.setItem(K,JSON.stringify(db));

const ICONS={
  search:`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 5 5"/></svg>`,
  shuffle:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h3c5 0 6 10 11 10h4"/><path d="m18 14 3 3-3 3"/><path d="M3 17h3c1.8 0 3-1.1 3.8-2.5"/><path d="M15.2 9.5C16 8.1 17.2 7 19 7h2"/><path d="m18 4 3 3-3 3"/></svg>`,
  more:`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>`,
  edit:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16.5-.8 4.3 4.3-.8L19 8.5a2.1 2.1 0 0 0-3-3z"/><path d="m14.5 7.5 2 2"/></svg>`,
  plus:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`,
  home:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>`,
  list:`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>`,
  user:`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.8-3.3 3-5 6.5-5s5.7 1.7 6.5 5"/></svg>`,
  heart:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.8c0 5.3-8.8 10-8.8 10S3.2 14.1 3.2 8.8A4.3 4.3 0 0 1 11 6.2a4.3 4.3 0 0 1 7.8 2.6Z"/></svg>`,
  play:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 9 6-9 6z"/></svg>`
};
function mountIcons(){document.querySelectorAll('.iconSlot').forEach(el=>{const k=el.dataset.icon;if(ICONS[k])el.innerHTML=ICONS[k]})}
mountIcons();
const Q=`query($search:String,$genre:String,$sort:[MediaSort]){Page(page:1,perPage:36){media(search:$search,genre:$genre,type:ANIME,isAdult:false,sort:$sort){id idMal title{romaji english}coverImage{large}bannerImage description episodes duration seasonYear averageScore genres status nextAiringEpisode{episode airingAt}characters(sort:ROLE,perPage:12){edges{node{id name{full}image{large}}}}relations{edges{relationType node{id idMal title{romaji english}coverImage{large}episodes seasonYear}}}recommendations(perPage:6){nodes{mediaRecommendation{id idMal title{romaji english}coverImage{large}episodes seasonYear}}}}}}`;
async function api(v){let r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:Q,variables:v})});let j=await r.json();return j?.data?.Page?.media||[]}
function shuffle(a){for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
let exploreTimer=null,lastExploreShuffle=Date.now(),explorePools={trending:[],classic:[],recent:[]};
async function fetchPool(sort,limit=18){
  try{return await api({search:null,genre:genre||null,sort})}catch(e){console.warn("Explore pool failed",sort,e);return []}
}
function uniqueRows(rows){const seen=new Set();return rows.filter(m=>m&& !seen.has(m.id)&&(seen.add(m.id),true))}
function miniCard(m,opts={}){
  const el=document.createElement("article");el.className="railCard";
  const prog=opts.getProgress?opts.getProgress(m):{watched:opts.watched||0,total:opts.total||m.episodes||0}; const watched=prog.watched,total=prog.total;
  el.innerHTML=`<div class="railPoster">${imageTag(m.coverImage?.large||"","loading=\"lazy\"")}<button class="railFav ${isFav(m.id)?"on":""}" aria-label="Favorite">${isFav(m.id)?"♥":"♡"}</button>${opts.badge?`<span class="railBadge">${esc(opts.badge)}</span>`:""}</div><div class="railTitle">${esc(title(m))}</div><div class="railMeta">${m.seasonYear||""}${m.averageScore?` · ${Math.round(m.averageScore/10*10)/10}/10`:""}</div>${opts.progress?`<div class="railProgress"><i style="width:${total?Math.min(100,watched/total*100):0}%"></i></div>`:""}`;
  el.onclick=e=>{
    if(e.target.closest('.railFav')){e.stopPropagation();let on=toggleFav(m);let b=el.querySelector('.railFav');b.classList.toggle('on',on);b.textContent=on?'♥':'♡';return}
    openAnime(m)
  };
  return el
}
function renderRail(id,rows,opts={}){
  const el=$(id);if(!el)return;el.innerHTML="";
  rows.forEach(m=>el.appendChild(miniCard(m,opts)));
  if(!rows.length)el.innerHTML='<span class="railEmpty">Nothing to show right now.</span>';
}
function renderContinue(){
  const active=db.list.filter(x=>{let e=x.seasons.flatMap(s=>s.episodes||[]),w=e.filter(Boolean).length;return w>0&&e.some(v=>!v)}).sort((a,b)=>b.last-a.last).slice(0,8);
  const section=$("#continueSection");
  section.hidden=!active.length;
  renderRail("#continueRail",active.map(x=>x.data),{progress:true,badge:"Continue",getProgress:m=>{const x=active.find(z=>z.id===m.id);const e=x?x.seasons.flatMap(s=>s.episodes||[]):[];return {watched:e.filter(Boolean).length,total:e.length}}});
}
function renderSpotlight(rows){
  const m=shuffle(rows.slice()).find(x=>x.bannerImage)||rows[0];
  if(!m){$("#spotlight").innerHTML="";return}
  $("#spotlight").innerHTML=`<article class="spotlight" data-id="${m.id}"><div class="spotImage">${imageTag(m.bannerImage||m.coverImage?.large||"")}</div><div class="spotShade"></div><div class="spotCopy"><small>YOROMIRU PICK</small><h1>${esc(title(m))}</h1><div class="spotMeta">${m.seasonYear||""} · ${m.duration||"?"} min/ep${m.averageScore?` · ★ ${(m.averageScore/10).toFixed(1)}`:""}</div><p>${esc(strip(m.description)||"Discover something worth watching next.")}</p><button class="primary spotBtn">View anime</button></div></article>`;
  $("#spotlight .spotlight").onclick=e=>{if(e.target.closest('.spotBtn')||!e.target.closest('button'))openAnime(m)};
}
async function buildExplore(){
  const [trending,popular,recent]=await Promise.all([fetchPool(["TRENDING_DESC"]),fetchPool(["POPULARITY_DESC"]),fetchPool(["START_DATE_DESC"])]);
  explorePools.trending=shuffle(uniqueRows(trending).slice(0,18));
  explorePools.classic=shuffle(uniqueRows(popular).slice(0,18));
  explorePools.recent=shuffle(uniqueRows(recent).slice(0,18));
  renderSpotlight([...explorePools.trending,...explorePools.classic]);
  renderContinue();
  renderRail("#trendingRail",shuffle(explorePools.trending.slice(0,10)));
  renderRail("#classicRail",shuffle(explorePools.classic.slice(0,10)));
  renderRail("#recentRail",shuffle(explorePools.recent.slice(0,10)));
  lastExploreShuffle=Date.now();
}
async function feed(){
  const query=$("#q").value.trim();
  const discovery=$("#discovery"),searchResults=$("#searchResults");
  if(!query){discovery.hidden=false;searchResults.hidden=true;await buildExplore();return}
  discovery.hidden=true;searchResults.hidden=false;searchResults.innerHTML='<p class="muted searchLoading">Searching…</p>';
  let rows=[];try{rows=await api({search:query,genre:genre||null,sort:["SEARCH_MATCH_DESC"]})}catch(e){console.warn("Search failed",e)}
  searchResults.innerHTML="";uniqueRows(rows).forEach(m=>searchResults.append(card(m)));
  if(!rows.length)searchResults.innerHTML='<div class="searchEmpty"><b>No anime found</b><p class="muted">Try another title or remove the genre filter.</p></div>';
}
function scheduleExploreShuffle(){
  clearInterval(exploreTimer);
  exploreTimer=setInterval(()=>{if($("#explore")?.classList.contains("active")&&!$("#q").value.trim())buildExplore()},8*60*1000)
}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&Date.now()-lastExploreShuffle>=8*60*1000&&$("#explore")?.classList.contains("active")&&!$("#q").value.trim())buildExplore()});

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function fetchJikanPage(malId,page,attempt=0){
  try{
    const r=await fetch(`${JIKAN}/anime/${malId}/episodes?page=${page}`,{cache:"no-store"});
    if(r.ok)return await r.json();
    if((r.status===429||r.status>=500)&&attempt<4){
      const retry=Number(r.headers.get("Retry-After"));
      await sleep(Number.isFinite(retry)&&retry>0?retry*1000:Math.min(8000,1500*(attempt+1)));
      return fetchJikanPage(malId,page,attempt+1);
    }
  }catch{}
  if(attempt<3){await sleep(Math.min(6000,1200*(attempt+1)));return fetchJikanPage(malId,page,attempt+1)}
  return null;
}
async function jikanEpisodes(malId,startPage=1,onPage){
  if(!malId)return {items:[],hasMore:false,nextPage:1,failed:false};
  let all=[],page=startPage,lastPage=null,failed=false;
  while(page<=30){
    const j=await fetchJikanPage(malId,page);
    if(!j){failed=true;break}
    const data=Array.isArray(j.data)?j.data:[];
    all.push(...data);
    lastPage=j?.pagination?.last_visible_page||lastPage;
    const hasNext=!!j?.pagination?.has_next_page;
    if(onPage)onPage({page,loaded:all.length,totalPages:lastPage||null,hasNext});
    if(!hasNext)break;
    page++;
    // Jikan documents a 3 requests/second limit; stay comfortably below it.
    await sleep(450);
  }
  return {items:all,hasMore:failed||!!(lastPage&&page<lastPage),nextPage:page,failed};
}
const title=m=>m?.title?.english||m?.title?.romaji||"Unknown anime";
function isFav(id){return db.favorites.includes(id)}
function toggleFav(m){
  if(isFav(m.id)) db.favorites=db.favorites.filter(id=>id!==m.id);
  else db.favorites.push(m.id);
  save(); profile();
  return isFav(m.id);
}
function card(m){
  let e=document.createElement("article");e.className="card";
  e.innerHTML=`<div class=poster>${imageTag(m.coverImage?.large||"","loading=\"lazy\"")}<button class="favBtn ${isFav(m.id)?"on":""}" aria-label="Favorite">${isFav(m.id)?"♥":"♡"}</button></div><div class=body><div class=title>${esc(title(m))}</div><div class=meta>${m.seasonYear||""} · ${m.episodes||"?"} eps</div></div>`;
  e.onclick=ev=>{
    if(ev.target.closest(".favBtn")){
      ev.stopPropagation();
      let on=toggleFav(m),b=e.querySelector(".favBtn");
      b.classList.toggle("on",on);b.textContent=on?"♥":"♡";
      return;
    }
    openAnime(m);
  };
  return e
}
const genres=["All","Action","Adventure","Comedy","Drama","Fantasy","Horror","Romance","Sci-Fi","Sports","Thriller"];$("#genres").innerHTML=genres.map(g=>`<button data-g="${g==="All"?"":g}">${g}</button>`).join("");document.querySelector("#genres button").classList.add("active");
$("#genres").onclick=e=>{if(e.target.tagName==="BUTTON"){genre=e.target.dataset.g;document.querySelectorAll("#genres button").forEach(b=>b.classList.toggle("active",b.dataset.g===genre));feed()}};
let searchDebounce;
$("#q").oninput=()=>{clearTimeout(searchDebounce);searchDebounce=setTimeout(()=>feed(),260)};
$("#search").onclick=()=>{$("#q").focus()};
$("#shuffleExplore").onclick=()=>{if(!$("#q").value.trim())buildExplore()};
document.querySelectorAll(".railShuffle").forEach(b=>b.onclick=()=>{const key=b.dataset.rail,rows=explorePools[key]||[];renderRail("#"+key+"Rail",shuffle(rows.slice(0,10)))});

function relationSeasons(m){
  let seasons=[{name:"Season 1",episodes:m.episodes||0,media:m}];
  m.relations?.edges?.filter(x=>x.relationType==="SEQUEL").forEach((x,i)=>seasons.push({name:`Season ${i+2}`,episodes:x.node.episodes||0,id:x.node.id,media:x.node}));
  return seasons;
}
function openAnime(m){
  let item=db.list.find(x=>x.id===m.id),chars=m.characters?.edges||[],recs=(m.recommendations?.nodes||[]).map(x=>x.mediaRecommendation).filter(Boolean),seasons=relationSeasons(m);
  $("#anime").innerHTML=`<button class=x onclick="animeDlg.close()">×</button>
  <div class=detailBanner>${imageTag(m.bannerImage||m.coverImage?.large||"")}</div>
  <div class=detailHead><div class=detailPoster>${imageTag(m.coverImage?.large||"")}</div><div><h1>${esc(title(m))}</h1><div class=muted>${m.seasonYear||""} · ${m.status||""} · ${m.duration||"?"} min/ep</div></div></div>
  <div class="detailActions"><button class=primary id=add>${item?"In watchlist":"＋ Add to watchlist"}</button><button class="favoriteAction ${isFav(m.id)?"on":""}" id=favAnime>${isFav(m.id)?"♥ Favorited":"♡ Favorite"}</button></div>
  <section><h3>About</h3><p class=muted>${strip(m.description)||"No description available."}</p></section>
  <section><h3>Characters</h3><div class=chars>${chars.map(c=>`<div class=cmini>${imageTag(c.node.image?.large||"")}<small>${esc(c.node.name.full)}</small></div>`).join("")}</div></section>
  <section><h3>Seasons</h3>${seasons.map((s,i)=>`<div class=season data-s="${i}"><span>${s.name}<br><small class=muted>${s.episodes||"?"} episodes</small></span>›</div>`).join("")}</section>
  <section><h3>Similar anime</h3><div class=similar>${recs.map(x=>`<div class="sim" data-id="${x.id}">${imageTag(x.coverImage?.large||"","loading=\"lazy\"")}<b>${esc(title(x))}</b></div>`).join("")||"<span class=muted>No recommendations available.</span>"}</div></section>
  <section><h3>Comments</h3><div class=muted>Comments will become shared with the account system.</div></section>`;
  $("#add").onclick=()=>add(m);$("#favAnime").onclick=()=>{let on=toggleFav(m);$("#favAnime").classList.toggle("on",on);$("#favAnime").textContent=on?"♥ Favorited":"♡ Favorite"};
  document.querySelectorAll(".season").forEach(s=>s.onclick=()=>openEpisodes(m,+s.dataset.s,seasons[+s.dataset.s].media));
  document.querySelectorAll(".sim").forEach(s=>s.onclick=async()=>{
    let id=+s.dataset.id, found=recs.find(x=>x.id===id);
    if(found){animeDlg.close();setTimeout(()=>openAnime(found),80);return}
    try{
      let q=await api({search:s.querySelector("b")?.textContent||null,genre:null});
      found=q.find(x=>x.id===id)||q[0];
      if(found){animeDlg.close();setTimeout(()=>openAnime(found),80)}
    }catch{}
  });
  animeDlg.showModal()
}
function strip(x){return String(x||"").replace(/<[^>]*>/g,"").slice(0,500)}
function add(m){
  if(!db.list.some(x=>x.id===m.id)){
    db.list.push({id:m.id,data:m,seasons:[{name:"Season 1",mediaId:m.id,idMal:m.idMal||null,episodes:Array(m.episodes||0).fill(false),episodeInfo:[]}],last:Date.now()});save()
  }
  $("#add").textContent="In watchlist";renderWatch()
}
function ensureSeason(x,si,source){
  if(!x.seasons[si])x.seasons[si]={name:"Season "+(si+1),mediaId:source?.id||null,idMal:source?.idMal||null,episodes:Array(source?.episodes||0).fill(false),episodeInfo:[]};
  x.seasons[si].mediaId=x.seasons[si].mediaId||source?.id||null;
  x.seasons[si].idMal=x.seasons[si].idMal||source?.idMal||null;
  x.seasons[si].episodes=x.seasons[si].episodes||[];
  x.seasons[si].episodeInfo=x.seasons[si].episodeInfo||[];
  return x.seasons[si]
}
async function openEpisodes(m,si,source){
  let x=db.list.find(z=>z.id===m.id);if(!x){add(m);x=db.list.find(z=>z.id===m.id)}
  let season=ensureSeason(x,si,source||m),eps=season.episodes||[],info=season.episodeInfo||[];
  const expected=Number(source?.episodes||m.episodes||0);
  const cachedPages=Math.floor(info.length/100)+1;
  season.episodeInfo=info;
  if(expected&&eps.length<expected)eps.push(...Array(expected-eps.length).fill(false));
  season.episodes=eps;
  const renderEpisodes=(hasMore=false)=>{
    const total=expected||info.length||eps.length;
    $("#epLoading").textContent=info.length
      ? `${info.length}${total?` / ${total}`:""} episodes loaded${hasMore?" · more available":""}`
      : (total?`${total} episodes`:`Episode data isn't available for this title yet.`);
    $("#all").disabled=!eps.length;
    $("#all").textContent=eps.length&&eps.every(Boolean)?"Unmark season":"Mark full season watched";
    $("#epList").innerHTML=eps.map((d,i)=>{
      let ep=info[i]||{};
      return `<div class="episode ${d?"done":""}" data-i="${i}">
        <div class=num>${d?"✓":i+1}</div>
        <div><b>Episode ${i+1}${ep.title?` — ${esc(ep.title)}`:""}</b><div class=muted>${ep.synopsis?esc(strip(ep.synopsis)):(m.duration||"?")+" min"}</div></div>
        <span>${d?"WATCHED":"›"}</span>
      </div>`
    }).join("");
    let more=$("#loadMoreEpisodes");
    if(more){more.hidden=!hasMore;more.disabled=false;more.textContent=hasMore?`Load more episodes (${info.length}${total?` / ${total}`:""})`:"No more episodes"}
    bindEpisodeClicks();
  };
  const loadMore=async()=>{
    const btn=$("#loadMoreEpisodes");
    if(btn){btn.disabled=true;btn.textContent="Loading more episodes…"}
    const start=Math.floor(info.length/100)+1;
    const result=await jikanEpisodes(season.idMal,start,p=>{
      $("#epLoading").textContent=`Loading episodes… ${info.length+p.loaded}${expected?` / ${expected}`:""}`;
    });
    if(result.items.length){
      info=info.concat(result.items);
      season.episodeInfo=info;
      if(eps.length<info.length)eps.push(...Array(info.length-eps.length).fill(false));
      if(expected&&eps.length<expected)eps.push(...Array(expected-eps.length).fill(false));
      save();
    }
    renderEpisodes(result.hasMore);
  };
  const bindEpisodeClicks=()=>{
    document.querySelectorAll("#epList .episode").forEach(e=>e.onclick=()=>{
      let i=+e.dataset.i;
      if(!eps[i]){
        let missing=eps.slice(0,i).some(v=>!v);
        if(missing){
          if(confirm(`Have you watched all episodes up to Episode ${i+1}?\nOK = mark 1–${i+1}.\nCancel = only Episode ${i+1}.`))eps.fill(true,0,i+1);else eps[i]=true
        }else eps[i]=true
      }else eps[i]=false;
      x.last=Date.now();save();renderEpisodes(false);renderWatch();
    });
  };
  $("#eps").innerHTML=`<button class=x onclick="epDlg.close()">×</button><h2>${esc(title(m))} — ${esc(season.name)}</h2><div id=epLoading class=muted>Loading complete episode list…</div><button class=secondary id=all>Mark full season watched</button><button class="secondary loadMore" id="loadMoreEpisodes" hidden>Load more episodes</button><div id=epList></div>`;
  epDlg.showModal();

  // Use cached episode pages first. If the cache stops at 100, continue from page 2.
  const startPage=info.length?Math.floor(info.length/100)+1:1;
  const result=await jikanEpisodes(season.idMal,startPage,p=>{
    $("#epLoading").textContent=`Loading episodes… ${info.length+p.loaded}${expected?` / ${expected}`:""}`;
  });
  if(result.items.length){
    info=info.concat(result.items);
    season.episodeInfo=info;
    if(eps.length<info.length)eps.push(...Array(info.length-eps.length).fill(false));
  }else if(!info.length&&expected&&!eps.length){
    eps=season.episodes=Array(expected).fill(false);
  }
  if(expected&&eps.length<expected)eps.push(...Array(expected-eps.length).fill(false));
  save();
  renderEpisodes(result.hasMore);
  $("#all").onclick=()=>{
    const next=!eps.every(Boolean);
    if(next&&expected&&info.length<expected){
      if(!confirm(`This season has ${expected} episodes but only ${info.length} episode details are loaded.\nMark all ${expected} episodes watched anyway?`))return;
    }
    eps.fill(next);x.last=Date.now();save();renderEpisodes(result.hasMore);renderWatch();
  };
  $("#loadMoreEpisodes").onclick=loadMore;
}
const UPCOMING_Q=`query($ids:[Int]){Page(page:1,perPage:50){media(id_in:$ids,type:ANIME){id title{romaji english}coverImage{large}episodes duration seasonYear status nextAiringEpisode{episode airingAt}}}}`;
async function refreshUpcoming(){
  const ids=db.list.map(x=>Number(x.id)).filter(Number.isFinite);
  if(!ids.length)return [];
  try{
    const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:UPCOMING_Q,variables:{ids}})});
    if(!r.ok)throw new Error("AniList request failed");
    const j=await r.json();
    const media=j?.data?.Page?.media||[];
    media.forEach(m=>{const x=db.list.find(z=>Number(z.id)===Number(m.id));if(x)x.data={...x.data,...m};});
    save();
    return media;
  }catch(err){console.warn("Upcoming refresh failed",err);return db.list.map(x=>x.data).filter(Boolean)}
}
function dateText(ts){
  const d=new Date(Number(ts)*1000);
  return d.toLocaleString(undefined,{weekday:"short",day:"numeric",month:"short",year:"numeric",hour:"numeric",minute:"2-digit"});
}
function countdown(ts){
  const ms=Number(ts)*1000-Date.now();
  if(ms<=0)return "Airing now";
  const mins=Math.floor(ms/60000), days=Math.floor(mins/1440), hrs=Math.floor((mins%1440)/60);
  if(days>0)return `in ${days}d ${hrs}h`;
  if(hrs>0)return `in ${hrs}h ${mins%60}m`;
  return `in ${Math.max(1,mins)}m`;
}
function upcomingRows(items){
  if(!items.length)return `<div class="upEmpty"><b>No upcoming episodes found</b><p class="muted">Your watchlist is checked automatically. Shows without a scheduled next episode are left out.</p></div>`;
  return `<section><b>UPCOMING EPISODES</b><div class="upList">${items.map(x=>{
    const a=x.nextAiringEpisode; return `<div class="upCard" data-id="${x.id}">
      <div class="upThumb">${imageTag(x.coverImage?.large||"")}</div>
      <div class="upInfo"><h3>${esc(title(x))}</h3><div class="upEp">Episode ${a.episode}</div><div class="muted">${dateText(a.airingAt)}</div><strong>${countdown(a.airingAt)}</strong></div>
      <span class="chev">›</span>
    </div>`
  }).join("")}</div></section>`;
}
async function renderUpcoming(){
  $("#watchContent").innerHTML=`<div class="upLoading">Checking your watchlist for upcoming episodes…</div>`;
  const media=await refreshUpcoming();
  const now=Math.floor(Date.now()/1000)-120;
  const items=media.filter(m=>m?.nextAiringEpisode?.airingAt && Number(m.nextAiringEpisode.airingAt)>now).sort((a,b)=>Number(a.nextAiringEpisode.airingAt)-Number(b.nextAiringEpisode.airingAt));
  $("#watchContent").innerHTML=upcomingRows(items);
  document.querySelectorAll(".upCard").forEach(el=>el.onclick=()=>{const x=db.list.find(z=>Number(z.id)===Number(el.dataset.id));if(x)openAnime(x.data)});
}
function renderWatch(){
  let tab=document.querySelector("[data-tab].active")?.dataset.tab||"list";
  if(tab==="upcoming"){renderUpcoming();return}
  let w=db.list.filter(x=>{let e=x.seasons.flatMap(s=>s.episodes||[]);return e.some(Boolean)&&!e.every(Boolean)}).sort((a,b)=>b.last-a.last),p=db.list.filter(x=>x.seasons.flatMap(s=>s.episodes||[]).every(v=>!v));
  $("#watchContent").innerHTML=rows("WATCHING",w)+rows("PLAN TO WATCH",p)
}
function rows(h,a){return`<section><b>${h}</b>${a.length?a.map(x=>{let e=x.seasons.flatMap(s=>s.episodes||[]),w=e.filter(Boolean).length;return`<div class=watch data-id="${x.id}"><div class=thumb>${imageTag(x.data.coverImage?.large||"")}</div><div><b>${esc(title(x.data))}</b><div class=muted>${w}/${e.length} episodes</div><div class=bar><i style="width:${e.length?w/e.length*100:0}%"></i></div></div></div>`}).join(""):"<p class=muted>Nothing here yet.</p>"}</section>`}
function profile(){
  let w=db.list.reduce((n,x)=>n+x.seasons.flatMap(s=>s.episodes||[]).filter(Boolean).length,0);
  let mins=db.list.reduce((n,x)=>n+x.seasons.flatMap(s=>s.episodes||[]).filter(Boolean).length*(x.data.duration||24),0);
  $("#episodes").textContent=w;
  $("#hours").textContent=Math.round(mins/60)+"h";
  $("#username").textContent=db.profile.name;

  let fav=db.list.filter(x=>db.favorites.includes(x.id));
  $("#favShows").innerHTML=fav.length
    ? fav.map(x=>`<div class="mini favMini" data-fav-id="${x.id}"><div class="miniImg">${imageTag(x.data.coverImage?.large||"")}<button class="miniHeart">♥</button></div><b>${esc(title(x.data))}</b></div>`).join("")
    : "<span class=muted>No favorites yet. Favorite an anime with ♡ to see it here.</span>";

  $("#favChars").innerHTML=db.favChars.map((c,i)=>`<div class="char"><div class="charImg">${imageTag(c.image||"")}<button class="removeChar" data-char="${i}">×</button></div><small>${esc(c.name)}</small></div>`).join("")||"<span class=muted>Add characters you like.</span>";

  $("#collection").innerHTML=["Watching","Completed","Plan to Watch"].map((n,i)=>`<div class="season collectionItem" data-status="${i}"><span>${n}</span><b>${count(i)}</b><span class="chev">›</span></div>`).join("");

  applyProfileImages();
}
function count(i){return db.list.filter(x=>{let e=x.seasons.flatMap(s=>s.episodes||[]);return i===0?e.some(Boolean)&&!e.every(Boolean):i===1?e.length&&e.every(Boolean):e.every(v=>!v)}).length}
document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>{document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));$("#"+b.dataset.page).classList.add("active");document.querySelectorAll(".nav").forEach(n=>n.classList.toggle("active",n===b));if(b.dataset.page==="watch")renderWatch();if(b.dataset.page==="profile")profile()});
document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-tab]").forEach(x=>x.classList.remove("active"));b.classList.add("active");renderWatch()});
$("#dots").onclick=()=>{$("#name").value=db.profile.name;settingsDlg.showModal()};$("#save").onclick=()=>{db.profile.name=$("#name").value.trim()||"Yorumiru User";save();settingsDlg.close();profile()};document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$(b.dataset.close).close());
document.addEventListener("click",e=>{let r=e.target.closest(".watch");if(r){let x=db.list.find(z=>z.id==r.dataset.id);if(x)openAnime(x.data)}});
function applyProfileImages(){
  let b=$("#profileBanner"),a=$("#profileAvatar");
  if(b){
    b.style.backgroundImage=db.profile.banner?`url("${imageProxy(db.profile.banner)}")`:"";
    b.classList.toggle("hasImage",!!db.profile.banner);
  }
  if(a){
    if(db.profile.avatar){a.style.backgroundImage=`url("${imageProxy(db.profile.avatar)}")`;a.textContent=""}
    else{a.style.backgroundImage="";a.textContent=(db.profile.name||"Y")[0].toUpperCase()}
  }
}
function imageData(file,maxW,maxH,quality=.8){
  return new Promise((resolve,reject)=>{
    let fr=new FileReader();
    fr.onload=()=>{
      let im=new Image();
      im.onload=()=>{
        let scale=Math.min(1,maxW/im.width,maxH/im.height),c=document.createElement("canvas");
        c.width=Math.max(1,Math.round(im.width*scale));c.height=Math.max(1,Math.round(im.height*scale));
        c.getContext("2d").drawImage(im,0,0,c.width,c.height);
        resolve(c.toDataURL("image/jpeg",quality));
      };
      im.onerror=reject;im.src=fr.result;
    };
    fr.onerror=reject;fr.readAsDataURL(file);
  });
}
async function setProfileImage(type,file){
  if(!file)return;
  try{
    db.profile[type]=await imageData(file,type==="banner"?1400:600,type==="banner"?600:600);
    save();applyProfileImages();
  }catch(err){console.error(err)}
}
function openFile(id){let x=$("#"+id);if(x)x.click()}

$("#avatarEdit").onclick=e=>{e.stopPropagation();openFile("avatarFile")};
$("#profileAvatar").onclick=()=>openFile("avatarFile");
$("#bannerFile").onchange=e=>setProfileImage("banner",e.target.files?.[0]);
$("#avatarFile").onchange=e=>setProfileImage("avatar",e.target.files?.[0]);

$("#settingsAvatar").onclick=()=>{settingsDlg.close();openFile("avatarFile")};

$("#addChar").onclick=()=>{
  $("#cq").value="";
  $("#chars").innerHTML="<p class=muted>Search for a character above.</p>";
  charDlg.showModal();
};
$("#cq").oninput=async()=>{
  let q=$("#cq").value.trim();
  if(q.length<2){$("#chars").innerHTML="<p class=muted>Type at least 2 letters.</p>";return}
  $("#chars").innerHTML="<p class=muted>Searching…</p>";
  try{
    let r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      query:`query($s:String){Page(page:1,perPage:12){characters(search:$s,sort:FAVOURITES_DESC){id name{full}image{large}}}}`,
      variables:{s:q}
    })});
    let j=await r.json(),list=j?.data?.Page?.characters||[];
    $("#chars").innerHTML=list.length?list.map(c=>`<button class=result data-cid="${c.id}" data-cname="${esc(c.name.full)}" data-cimg="${esc(c.image?.large||"")}">${imageTag(c.image?.large||"")}<span>${esc(c.name.full)}</span></button>`).join(""):"<p class=muted>No character found.</p>";
  }catch{$("#chars").innerHTML="<p class=muted>Could not search right now.</p>"}
};

document.addEventListener("click",e=>{
  let fav=e.target.closest(".favMini");
  if(fav){
    let x=db.list.find(z=>String(z.id)===String(fav.dataset.favId));
    if(x)openAnime(x.data);
    return;
  }
  let col=e.target.closest(".collectionItem");
  if(col){
    document.querySelectorAll(".nav").forEach(n=>n.classList.toggle("active",n.dataset.page==="watch"));
    document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id==="watch"));
    renderWatch();
    return;
  }
  let result=e.target.closest(".result");
  if(result){
    let id=String(result.dataset.cid);
    if(!db.favChars.some(c=>String(c.id)===id))
      db.favChars.push({id:result.dataset.cid,name:result.dataset.cname,image:result.dataset.cimg});
    save();charDlg.close();profile();
    return;
  }
  let rm=e.target.closest(".removeChar");
  if(rm){
    db.favChars.splice(Number(rm.dataset.char),1);
    save();profile();
  }
});

async function loadBanners(query=""){
  $("#bannerList").innerHTML="<p class=muted>Loading anime banners…</p>";
  try{
    let rows=await api({search:query.trim()||null,genre:null});
    rows=rows.filter(m=>m.bannerImage).slice(0,24);
    $("#bannerList").innerHTML=rows.length?rows.map(m=>`<button class="bannerChoice" data-banner="${esc(m.bannerImage)}" data-title="${esc(title(m))}">${imageTag(m.bannerImage||"")}<span>${esc(title(m))}</span></button>`).join(""):"<p class=muted>No banners found for that anime.</p>";
  }catch{$("#bannerList").innerHTML="<p class=muted>Could not load banners right now.</p>"}
}
function openBannerPicker(){
  $("#bq").value="";
  bannerDlg.showModal();
  loadBanners();
}
$("#bannerEdit").onclick=e=>{e.stopPropagation();openBannerPicker()};
$("#profileBanner").onclick=()=>openBannerPicker();
$("#settingsBanner").onclick=()=>{settingsDlg.close();openBannerPicker()};
$("#bSearch").onclick=()=>loadBanners($("#bq").value);
$("#bq").onkeydown=e=>{if(e.key==="Enter")loadBanners(e.target.value)};
$("#bannerList").onclick=e=>{
  let b=e.target.closest(".bannerChoice");if(!b)return;
  db.profile.banner=b.dataset.banner;save();applyProfileImages();bannerDlg.close();
};
feed();scheduleExploreShuffle();renderWatch();profile();
