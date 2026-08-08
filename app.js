const API="https://graphql.anilist.co",JIKAN="https://api.jikan.moe/v4",K="yorumiru-v4.4";
let db=JSON.parse(localStorage.getItem(K)||localStorage.getItem("yorumiru-v4.3")||localStorage.getItem("yorumiru-v4")||'{"list":[],"favorites":[],"favChars":[],"profile":{"name":"Yorumiru User"}}'),genre="";
db.list=db.list||[];db.favorites=db.favorites||[];db.favChars=db.favChars||[];db.profile=db.profile||{name:"Yorumiru User"};db.profile.banner=db.profile.banner||"";db.profile.avatar=db.profile.avatar||"";

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
function isFav(id){return db.favorites.includes(id)}
function toggleFav(m){
  if(isFav(m.id)) db.favorites=db.favorites.filter(id=>id!==m.id);
  else db.favorites.push(m.id);
  save(); profile();
  return isFav(m.id);
}
function card(m){
  let e=document.createElement("article");e.className="card";
  e.innerHTML=`<div class=poster><img src="${esc(m.coverImage?.large||"")}" loading="lazy"><button class="favBtn ${isFav(m.id)?"on":""}" aria-label="Favorite">${isFav(m.id)?"♥":"♡"}</button></div><div class=body><div class=title>${esc(title(m))}</div><div class=meta>${m.seasonYear||""} · ${m.episodes||"?"} eps</div></div>`;
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
  <div class="detailActions"><button class=primary id=add>${item?"In watchlist":"＋ Add to watchlist"}</button><button class="favoriteAction ${isFav(m.id)?"on":""}" id=favAnime>${isFav(m.id)?"♥ Favorited":"♡ Favorite"}</button></div>
  <section><h3>About</h3><p class=muted>${strip(m.description)||"No description available."}</p></section>
  <section><h3>Characters</h3><div class=chars>${chars.map(c=>`<div class=cmini><img src="${esc(c.node.image?.large||"")}"><small>${esc(c.node.name.full)}</small></div>`).join("")}</div></section>
  <section><h3>Seasons</h3>${seasons.map((s,i)=>`<div class=season data-s="${i}"><span>${s.name}<br><small class=muted>${s.episodes||"?"} episodes</small></span>›</div>`).join("")}</section>
  <section><h3>Similar anime</h3><div class=similar>${recs.map(x=>`<div class="sim" data-id="${x.id}"><img src="${esc(x.coverImage?.large||"")}" loading="lazy"><b>${esc(title(x))}</b></div>`).join("")||"<span class=muted>No recommendations available.</span>"}</div></section>
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
function profile(){
  let w=db.list.reduce((n,x)=>n+x.seasons.flatMap(s=>s.episodes||[]).filter(Boolean).length,0);
  let mins=db.list.reduce((n,x)=>n+x.seasons.flatMap(s=>s.episodes||[]).filter(Boolean).length*(x.data.duration||24),0);
  $("#episodes").textContent=w;
  $("#hours").textContent=Math.round(mins/60)+"h";
  $("#username").textContent=db.profile.name;

  let fav=db.list.filter(x=>db.favorites.includes(x.id));
  $("#favShows").innerHTML=fav.length
    ? fav.map(x=>`<div class="mini favMini" data-fav-id="${x.id}"><div class="miniImg"><img src="${esc(x.data.coverImage?.large||"")}><button class="miniHeart">♥</button></div><b>${esc(title(x.data))}</b></div>`).join("")
    : "<span class=muted>No favorites yet. Favorite an anime with ♡ to see it here.</span>";

  $("#favChars").innerHTML=db.favChars.map((c,i)=>`<div class="char"><div class="charImg"><img src="${esc(c.image||"")}><button class="removeChar" data-char="${i}">×</button></div><small>${esc(c.name)}</small></div>`).join("")||"<span class=muted>Add characters you like.</span>";

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
    b.style.backgroundImage=db.profile.banner?`url("${db.profile.banner}")`:"";
    b.classList.toggle("hasImage",!!db.profile.banner);
  }
  if(a){
    if(db.profile.avatar){a.style.backgroundImage=`url("${db.profile.avatar}")`;a.textContent=""}
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
    $("#chars").innerHTML=list.length?list.map(c=>`<button class=result data-cid="${c.id}" data-cname="${esc(c.name.full)}" data-cimg="${esc(c.image?.large||"")}"><img src="${esc(c.image?.large||"")}"><span>${esc(c.name.full)}</span></button>`).join(""):"<p class=muted>No character found.</p>";
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
    $("#bannerList").innerHTML=rows.length?rows.map(m=>`<button class="bannerChoice" data-banner="${esc(m.bannerImage)}" data-title="${esc(title(m))}"><img src="${esc(m.bannerImage)}"><span>${esc(title(m))}</span></button>`).join(""):"<p class=muted>No banners found for that anime.</p>";
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
feed();renderWatch();profile();
