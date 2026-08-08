const API="https://graphql.anilist.co",JIKAN="https://api.jikan.moe/v4",K="yorumiru-v4.3";
let db=JSON.parse(localStorage.getItem(K)||localStorage.getItem("yorumiru-v4")||'{"list":[],"favorites":[],"favChars":[],"profile":{"name":"Yorumiru User"}}'),genre="";
db.list=db.list||[];db.favorites=db.favorites||[];db.favChars=db.favChars||[];db.profile=db.profile||{name:"Yorumiru User"};

const $=s=>document.querySelector(s),esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])),save=()=>localStorage.setItem(K,JSON.stringify(db));
const Q=`query($search:String,$genre:String){Page(page:1,perPage:24){media(search:$search,genre:$genre,type:ANIME,isAdult:false,sort:[TRENDING_DESC,POPULARITY_DESC]){id idMal title{romaji english}coverImage{large}bannerImage description episodes duration seasonYear averageScore genres status nextAiringEpisode{episode airingAt}characters(sort:ROLE,perPage:12){edges{node{id name{full}image{large}}}}relations{edges{relationType node{id idMal title{romaji english}coverImage{large}episodes seasonYear}}}recommendations(perPage:6){nodes{mediaRecommendation{id idMal title{romaji english}coverImage{large}episodes seasonYear}}}}}}`;
async function api(v){let r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:Q,variables:v})});let j=await r.json();return j?.data?.Page?.media||[]}
async function jikanEpisodes(malId){
  if(!malId)return [];
  try{
    let all=[],page=1;
    while(page<=30){
      let r=await fetch(`${JIKAN}/anime/${malId}/episodes?page=${page}`);
      if(!r.ok)break;
      let j=await r.json(),data=j?.data||[];
      all.push(...data);
      if(!j?.pagination?.has_next_page)break;
      page++;
    }
    return all;
  }catch{return []}
}
const title=m=>m?.title?.english||m?.title?.romaji||"Unknown anime";
function card(m){let e=document.createElement("article");e.className="card";e.innerHTML=`<div class=poster><img src="${esc(m.coverImage?.large||"")}" loading="lazy"></div><div class=body><div class=title>${esc(title(m))}</div><div class=meta>${m.seasonYear||""} · ${m.episodes||"?"} eps</div></div>`;e.onclick=()=>openAnime(m);return e}
async function feed(){let rows=[];try{rows=await api({search:$("#q").value.trim()||null,genre:genre||null})}catch{};$("#feed").innerHTML="";rows.forEach(m=>$("#feed").append(card(m)))}
const genres=["All","Action","Adventure","Comedy","Drama","Fantasy","Horror","Romance","Sci-Fi","Sports","Thriller"];$("#genres").innerHTML=genres.map(g=>`<button data-g="${g==="All"?"":g}">${g}</button>`).join("");document.querySelector("#genres button").classList.add("active");
$("#genres").onclick=e=>{if(e.target.tagName==="BUTTON"){genre=e.target.dataset.g;document.querySelectorAll("#genres button").forEach(b=>b.classList.toggle("active",b.dataset.g===genre));feed()}};$("#q").oninput=()=>feed();$("#search").onclick=()=>{$("#q").focus()};

const MEDIA_FIELDS=`id idMal title{romaji english} coverImage{large} bannerImage description episodes duration seasonYear averageScore genres status nextAiringEpisode{episode airingAt} characters(sort:ROLE,perPage:12){edges{node{id name{full} image{large}}}} relations{edges{relationType node{id idMal title{romaji english} coverImage{large} bannerImage episodes duration seasonYear averageScore status nextAiringEpisode{episode airingAt}}}} recommendations(perPage:8){nodes{mediaRecommendation{id idMal title{romaji english} coverImage{large} episodes seasonYear}}}`;
const MEDIA_Q=`query($id:Int!){Media(id:$id){${MEDIA_FIELDS}}}`;
async function mediaById(id){
  try{
    let r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:MEDIA_Q,variables:{id}})});
    let j=await r.json();return j?.data?.Media||null;
  }catch{return null}
}

// Build the complete mainline anime chain, not just the first direct sequel.
// We walk backwards to the earliest linked entry, then forwards through every
// SEQUEL relation. This also handles split seasons/parts that are separate
// AniList entries (e.g. Final Season / Part 2 / Final Chapters).
async function relationSeasons(m){
  let current=await mediaById(m.id)||m;
  const seen=new Set([current.id]);
  let first=current;
  for(let guard=0;guard<30;guard++){
    const pre=(first.relations?.edges||[]).filter(x=>x.relationType==="PREQUEL").map(x=>x.node).find(n=>n?.id&&!seen.has(n.id));
    if(!pre)break;
    const full=await mediaById(pre.id)||pre;
    if(seen.has(full.id))break;
    seen.add(full.id);first=full;
  }
  let chain=[first];
  seen.clear();
  for(let guard=0;guard<40 && chain.length;guard++){
    const tail=chain[chain.length-1];
    seen.add(tail.id);
    const next=(tail.relations?.edges||[]).filter(x=>x.relationType==="SEQUEL").map(x=>x.node).find(n=>n?.id&&!seen.has(n.id));
    if(!next)break;
    const full=await mediaById(next.id)||next;
    if(seen.has(full.id))break;
    chain.push(full);
  }
  // If the requested entry was not reached by the mainline traversal, keep it
  // visible rather than silently losing it.
  if(!chain.some(x=>x.id===m.id)){
    const idx=chain.findIndex(x=>x.id===current.id);
    if(idx<0)chain.push(current);
  }
  return chain.map((media,i)=>({
    name: seasonLabel(media,i,chain),
    episodes: media.episodes||0,
    mediaId: media.id,
    idMal: media.idMal||null,
    media
  }));
}
function seasonLabel(media,i,chain){
  const t=title(media);
  const lower=t.toLowerCase();
  if(i===0 && !/season|part|cour|final|chapter|2nd|3rd|4th|5th|6th|7th|8th|9th|10th/.test(lower)) return "Season 1";
  // Preserve meaningful database naming for split seasons/parts.
  if(/season|part|cour|chapter|final|2nd|3rd|4th|5th|6th|7th|8th|9th|10th/.test(lower)) return t;
  return `Season ${i+1}`;
}

async function openAnime(m){
  let item=db.list.find(x=>x.id===m.id),chars=m.characters?.edges||[],recs=(m.recommendations?.nodes||[]).map(x=>x.mediaRecommendation).filter(Boolean);
  let seasons=await relationSeasons(m);
  // Put the selected entry first only when it could not be resolved into the
  // main chain; otherwise show the true chronological chain.
  const selected=seasons.find(s=>s.mediaId===m.id)||seasons[0];
  const headingMedia=selected?.media||m;
  $("#anime").innerHTML=`<button class=x onclick="animeDlg.close()">×</button>
  <div class=detailBanner><img src="${esc(m.bannerImage||m.coverImage?.large||"")}"></div>
  <div class=detailHead><div class=detailPoster><img src="${esc(m.coverImage?.large||"")}"></div><div><h1>${esc(title(m))}</h1><div class=muted>${m.seasonYear||""} · ${m.status||""} · ${m.duration||"?"} min/ep</div></div></div>
  <button class=primary id=add>${item?"In watchlist":"＋ Add to watchlist"}</button>
  <section><h3>About</h3><p class=muted>${strip(m.description)||"No description available."}</p></section>
  <section><h3>Characters</h3><div class=chars>${chars.map(c=>`<div class=cmini><img src="${esc(c.node.image?.large||"")}"><small>${esc(c.node.name.full)}</small></div>`).join("")}</div></section>
  <section><h3>Seasons & parts</h3><div id=seasonList>${seasons.map((s,i)=>`<div class="season ${s.mediaId===m.id?"selected-season":""}" data-s="${i}"><span>${esc(s.name)}<br><small class=muted>${s.episodes||"?"} episodes${s.media?.status==="RELEASING"?" · airing":""}</small></span>›</div>`).join("")}</div></section>
  <section><h3>Similar anime</h3><div class=similar>${recs.map(x=>`<div class="sim" data-id="${x.id}"><img src="${esc(x.coverImage?.large||"")}" loading="lazy"><b>${esc(title(x))}</b></div>`).join("")||"<span class=muted>No recommendations available.</span>"}</div></section>
  <section><h3>Comments</h3><div class=muted>Comments will become shared with the account system.</div></section>`;
  $("#add").onclick=()=>add(m);
  document.querySelectorAll("#seasonList .season").forEach(s=>s.onclick=()=>openEpisodes(m,+s.dataset.s,seasons[+s.dataset.s].media));
  document.querySelectorAll(".sim").forEach(s=>s.onclick=async()=>{
    let id=+s.dataset.id,found=recs.find(x=>x.id===id);
    if(found){animeDlg.close();setTimeout(()=>openAnime(found),80);return}
    try{let q=await api({search:s.querySelector("b")?.textContent||null,genre:null});found=q.find(x=>x.id===id)||q[0];if(found){animeDlg.close();setTimeout(()=>openAnime(found),80)}}catch{}
  });
  animeDlg.showModal();
}
function strip(x){return String(x||"").replace(/<[^>]*>/g,"").slice(0,500)}
function add(m){
  if(!db.list.some(x=>x.id===m.id)){
    db.list.push({id:m.id,data:m,seasons:[{name:"Season 1",mediaId:m.id,idMal:m.idMal||null,episodes:Array(m.episodes||0).fill(false),episodeInfo:[]}],last:Date.now()});save();
  }
  $("#add").textContent="In watchlist";renderWatch();
}
function ensureSeason(x,source){
  x.seasons=x.seasons||[];
  const mediaId=source?.id||source?.mediaId||null;
  let s=x.seasons.find(z=>String(z.mediaId)===String(mediaId));
  if(!s){
    s={name:source?.name||"Season "+(x.seasons.length+1),mediaId:mediaId,idMal:source?.idMal||null,episodes:Array(source?.episodes||0).fill(false),episodeInfo:[]};
    x.seasons.push(s);
  }
  s.name=source?.name||s.name;
  s.mediaId=s.mediaId||mediaId;
  s.idMal=s.idMal||source?.idMal||null;
  s.episodes=Array.isArray(s.episodes)?s.episodes:[];
  s.episodeInfo=Array.isArray(s.episodeInfo)?s.episodeInfo:[];
  return s;
}
async function openEpisodes(m,si,source){
  let x=db.list.find(z=>z.id===m.id);if(!x){add(m);x=db.list.find(z=>z.id===m.id)}
  let season=ensureSeason(x,source||{id:m.id,idMal:m.idMal,name:`Season ${si+1}`,episodes:m.episodes}),eps=season.episodes,info=season.episodeInfo||[];
  const displayTitle=source?.name||season.name||title(m);
  $("#eps").innerHTML=`<button class=x onclick="epDlg.close()">×</button><h2>${esc(title(m))} — ${esc(displayTitle)}</h2><div id=epLoading class=muted>Loading complete aired episode list…</div><button class=secondary id=all disabled>Mark full season watched</button><div id=epList></div>`;
  epDlg.showModal();
  let fetched=await jikanEpisodes(season.idMal);
  // Jikan is used for the actual episode list because AniList's episode count
  // alone cannot tell us titles, airing dates, or the currently aired count.
  if(fetched.length){
    info=fetched.filter(ep=>!ep.airdate || new Date(ep.airdate+"T23:59:59")<=new Date());
    season.episodeInfo=info;
    if(eps.length<info.length)eps.push(...Array(info.length-eps.length).fill(false));
    if(eps.length>info.length && info.length)eps.length=info.length;
  }else if(!eps.length && (source?.episodes||m.episodes)){
    eps=season.episodes=Array(source?.episodes||m.episodes).fill(false);
  }
  if(!eps.length){
    $("#epLoading").textContent="No aired episode data is available for this season yet.";
    $("#all").disabled=true;save();return;
  }
  $("#epLoading").textContent=info.length?`${info.length} aired episodes`:`${eps.length} episodes`;
  $("#all").disabled=false;
  $("#all").textContent=eps.length&&eps.every(Boolean)?"Unmark season":"Mark full season watched";
  $("#epList").innerHTML=eps.map((d,i)=>{let ep=info[i]||{};return `<div class="episode ${d?"done":""}" data-i="${i}">
    <div class=num>${d?"✓":i+1}</div><div><b>Episode ${i+1}${ep.title?` — ${esc(ep.title)}`:""}</b><div class=muted>${ep.synopsis?esc(strip(ep.synopsis)):(ep.duration||source?.duration||m.duration||"?")+" min"}${ep.aired?` · ${esc(ep.aired)}`:""}</div></div><span>${d?"WATCHED":"›"}</span></div>`}).join("");
  $("#all").onclick=()=>{let next=!eps.every(Boolean);eps.fill(next);x.last=Date.now();save();openEpisodes(m,si,source)};
  document.querySelectorAll("#epList .episode").forEach(e=>e.onclick=()=>{
    let i=+e.dataset.i;
    if(!eps[i]){
      let missing=eps.slice(0,i).some(v=>!v);
      if(missing){if(confirm(`Have you watched all episodes up to Episode ${i+1}?\nOK = mark 1–${i+1}.\nCancel = only Episode ${i+1}.`))eps.fill(true,0,i+1);else eps[i]=true}else eps[i]=true;
    }else eps[i]=false;
    x.last=Date.now();save();openEpisodes(m,si,source);renderWatch();
  });
  save();
}
function renderWatch(){let tab=document.querySelector("[data-tab].active")?.dataset.tab||"list";if(tab==="upcoming"){$("#watchContent").innerHTML="<p class=muted>Upcoming episodes from your watchlist will appear here when airing dates are available.</p>";return}let w=db.list.filter(x=>{let e=x.seasons.flatMap(s=>s.episodes||[]);return e.some(Boolean)&&!e.every(Boolean)}).sort((a,b)=>b.last-a.last),p=db.list.filter(x=>x.seasons.flatMap(s=>s.episodes||[]).every(v=>!v));$("#watchContent").innerHTML=rows("WATCHING",w)+rows("PLAN TO WATCH",p)}
function rows(h,a){return`<section><b>${h}</b>${a.length?a.map(x=>{let e=x.seasons.flatMap(s=>s.episodes||[]),w=e.filter(Boolean).length;return`<div class=watch data-id="${x.id}"><div class=thumb><img src="${esc(x.data.coverImage?.large||"")}"></div><div><b>${esc(title(x.data))}</b><div class=muted>${w}/${e.length} episodes</div><div class=bar><i style="width:${e.length?w/e.length*100:0}%"></i></div></div></div>`}).join(""):"<p class=muted>Nothing here yet.</p>"}</section>`}
function profile(){let w=db.list.reduce((n,x)=>n+x.seasons.flatMap(s=>s.episodes||[]).filter(Boolean).length,0);let mins=db.list.reduce((n,x)=>n+x.seasons.flatMap(s=>s.episodes||[]).filter(Boolean).length*(x.data.duration||24),0);$("#episodes").textContent=w;$("#hours").textContent=Math.round(mins/60)+"h";$("#username").textContent=db.profile.name;$("#favShows").innerHTML=db.list.filter(x=>db.favorites.includes(x.id)).map(x=>`<div class=mini><img src="${esc(x.data.coverImage?.large||"")}"><b>${esc(title(x.data))}</b></div>`).join("")||"<span class=muted>No favorites yet.</span>";$("#favChars").innerHTML=db.favChars.map(c=>`<div class=char><img src="${esc(c.image||"")}"><small>${esc(c.name)}</small></div>`).join("")||"<span class=muted>Add characters you like.</span>";$("#collection").innerHTML=["Watching","Completed","Plan to Watch"].map((n,i)=>`<div class=season><span>${n}</span><b>${count(i)}</b></div>`).join("")}
function count(i){return db.list.filter(x=>{let e=x.seasons.flatMap(s=>s.episodes||[]);return i===0?e.some(Boolean)&&!e.every(Boolean):i===1?e.length&&e.every(Boolean):e.every(v=>!v)}).length}
document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>{document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));$("#"+b.dataset.page).classList.add("active");document.querySelectorAll(".nav").forEach(n=>n.classList.toggle("active",n===b));if(b.dataset.page==="watch")renderWatch();if(b.dataset.page==="profile")profile()});
document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-tab]").forEach(x=>x.classList.remove("active"));b.classList.add("active");renderWatch()});
$("#dots").onclick=()=>{$("#name").value=db.profile.name;settingsDlg.showModal()};$("#save").onclick=()=>{db.profile.name=$("#name").value.trim()||"Yorumiru User";save();settingsDlg.close();profile()};document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$(b.dataset.close).close());
document.addEventListener("click",e=>{let r=e.target.closest(".watch");if(r){let x=db.list.find(z=>z.id==r.dataset.id);if(x)openAnime(x.data)}});feed();renderWatch();profile();
