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

function relationSeasons(m){
  let seasons=[{name:"Season 1",episodes:m.episodes||0,media:m}];
  m.relations?.edges?.filter(x=>x.relationType==="SEQUEL").forEach((x,i)=>seasons.push({name:`Season ${i+2}`,episodes:x.node.episodes||0,id:x.node.id,media:x.node}));
  return seasons;
}
function openAnime(m){
  let item=db.list.find(x=>x.id===m.id),chars=m.characters?.edges||[],recs=(m.recommendations?.nodes||[]).map(x=>x.mediaRecommendation).filter(Boolean),seasons=relationSeasons(m);
  $("#anime").innerHTML=`<button class=x onclick="animeDlg.close()">×</button>
  <div class=detailBanner><img src="${esc(m.bannerImage||m.coverImage?.large||"")}"></div>
  <div class=detailHead><div class=detailPoster><img src="${esc(m.coverImage?.large||"")}"></div><div><h1>${esc(title(m))}</h1><div class=muted>${m.seasonYear||""} · ${m.status||""} · ${m.duration||"?"} min/ep</div></div></div>
  <button class=primary id=add>${item?"In watchlist":"＋ Add to watchlist"}</button>
  <section><h3>About</h3><p class=muted>${strip(m.description)||"No description available."}</p></section>
  <section><h3>Characters</h3><div class=chars>${chars.map(c=>`<div class=cmini><img src="${esc(c.node.image?.large||"")}"><small>${esc(c.node.name.full)}</small></div>`).join("")}</div></section>
  <section><h3>Seasons</h3>${seasons.map((s,i)=>`<div class=season data-s="${i}"><span>${s.name}<br><small class=muted>${s.episodes||"?"} episodes</small></span>›</div>`).join("")}</section>
  <section><h3>Similar anime</h3><div class=similar>${recs.map(x=>`<div class="sim" data-id="${x.id}"><img src="${esc(x.coverImage?.large||"")}" loading="lazy"><b>${esc(title(x))}</b></div>`).join("")||"<span class=muted>No recommendations available.</span>"}</div></section>
  <section><h3>Comments</h3><div class=muted>Comments will become shared with the account system.</div></section>`;
  $("#add").onclick=()=>add(m);
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
  let season=ensureSeason(x,si,source||m),eps=season.episodes,info=season.episodeInfo||[];
  $("#eps").innerHTML=`<button class=x onclick="epDlg.close()">×</button><h2>${esc(title(m))} — ${esc(season.name)}</h2><div id=epLoading class=muted>Loading episode list…</div><button class=secondary id=all disabled>Mark full season watched</button><div id=epList></div>`;
  epDlg.showModal();
  let fetched=await jikanEpisodes(season.idMal);
  if(fetched.length){
    info=fetched;season.episodeInfo=info;
    if(eps.length<info.length)eps.push(...Array(info.length-eps.length).fill(false));
  }else if(!eps.length && (source?.episodes||m.episodes)){
    eps=season.episodes=Array(source?.episodes||m.episodes).fill(false);
  }
  if(!eps.length){
    $("#epLoading").textContent="Episode data isn't available for this title yet.";
    $("#all").disabled=true;save();return;
  }
  $("#epLoading").textContent=info.length?`${info.length} episodes`:`${eps.length} episodes`;
  $("#all").disabled=false;
  $("#all").textContent=eps.length&&eps.every(Boolean)?"Unmark season":"Mark full season watched";
  $("#epList").innerHTML=eps.map((d,i)=>{let ep=info[i]||{};return `<div class="episode ${d?"done":""}" data-i="${i}">
    <div class=num>${d?"✓":i+1}</div><div><b>Episode ${i+1}${ep.title?` — ${esc(ep.title)}`:""}</b><div class=muted>${ep.synopsis?esc(strip(ep.synopsis)):(m.duration||"?")+" min"}</div></div><span>${d?"WATCHED":"›"}</span></div>`}).join("");
  $("#all").onclick=()=>{let next=!eps.every(Boolean);eps.fill(next);x.last=Date.now();save();openEpisodes(m,si,source)};
  document.querySelectorAll("#epList .episode").forEach(e=>e.onclick=()=>{
    let i=+e.dataset.i;
    if(!eps[i]){
      let missing=eps.slice(0,i).some(v=>!v);
      if(missing){
        if(confirm(`Have you watched all episodes up to Episode ${i+1}?\nOK = mark 1–${i+1}.\nCancel = only Episode ${i+1}.`))eps.fill(true,0,i+1);else eps[i]=true
      }else eps[i]=true
    }else eps[i]=false;
    x.last=Date.now();save();openEpisodes(m,si,source);renderWatch()
  });
  save()
}
function renderWatch(){let tab=document.querySelector("[data-tab].active")?.dataset.tab||"list";if(tab==="upcoming"){$("#watchContent").innerHTML="<p class=muted>Upcoming episodes from your watchlist will appear here when airing dates are available.</p>";return}let w=db.list.filter(x=>{let e=x.seasons.flatMap(s=>s.episodes||[]);return e.some(Boolean)&&!e.every(Boolean)}).sort((a,b)=>b.last-a.last),p=db.list.filter(x=>x.seasons.flatMap(s=>s.episodes||[]).every(v=>!v));$("#watchContent").innerHTML=rows("WATCHING",w)+rows("PLAN TO WATCH",p)}
function rows(h,a){return`<section><b>${h}</b>${a.length?a.map(x=>{let e=x.seasons.flatMap(s=>s.episodes||[]),w=e.filter(Boolean).length;return`<div class=watch data-id="${x.id}"><div class=thumb><img src="${esc(x.data.coverImage?.large||"")}"></div><div><b>${esc(title(x.data))}</b><div class=muted>${w}/${e.length} episodes</div><div class=bar><i style="width:${e.length?w/e.length*100:0}%"></i></div></div></div>`}).join(""):"<p class=muted>Nothing here yet.</p>"}</section>`}
function profile(){let w=db.list.reduce((n,x)=>n+x.seasons.flatMap(s=>s.episodes||[]).filter(Boolean).length,0);let mins=db.list.reduce((n,x)=>n+x.seasons.flatMap(s=>s.episodes||[]).filter(Boolean).length*(x.data.duration||24),0);$("#episodes").textContent=w;$("#hours").textContent=Math.round(mins/60)+"h";$("#username").textContent=db.profile.name;$("#favShows").innerHTML=db.list.filter(x=>db.favorites.includes(x.id)).map(x=>`<div class=mini><img src="${esc(x.data.coverImage?.large||"")}"><b>${esc(title(x.data))}</b></div>`).join("")||"<span class=muted>No favorites yet.</span>";$("#favChars").innerHTML=db.favChars.map(c=>`<div class=char><img src="${esc(c.image||"")}"><small>${esc(c.name)}</small></div>`).join("")||"<span class=muted>Add characters you like.</span>";$("#collection").innerHTML=["Watching","Completed","Plan to Watch"].map((n,i)=>`<div class=season><span>${n}</span><b>${count(i)}</b></div>`).join("")}
function count(i){return db.list.filter(x=>{let e=x.seasons.flatMap(s=>s.episodes||[]);return i===0?e.some(Boolean)&&!e.every(Boolean):i===1?e.length&&e.every(Boolean):e.every(v=>!v)}).length}
document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>{document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));$("#"+b.dataset.page).classList.add("active");document.querySelectorAll(".nav").forEach(n=>n.classList.toggle("active",n===b));if(b.dataset.page==="watch")renderWatch();if(b.dataset.page==="profile")profile()});
document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-tab]").forEach(x=>x.classList.remove("active"));b.classList.add("active");renderWatch()});
$("#dots").onclick=()=>{$("#name").value=db.profile.name;settingsDlg.showModal()};$("#save").onclick=()=>{db.profile.name=$("#name").value.trim()||"Yorumiru User";save();settingsDlg.close();profile()};document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$(b.dataset.close).close());
document.addEventListener("click",e=>{let r=e.target.closest(".watch");if(r){let x=db.list.find(z=>z.id==r.dataset.id);if(x)openAnime(x.data)}});feed();renderWatch();profile();
