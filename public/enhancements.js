/* Production page enhancements: dedicated streaming hub and linked home sections. */
const baseSection=section,baseLivescore=livescore,basePredictions=predictions,baseHome=home,baseLoadStreams=loadStreams;
loadStreams=async function(page=1,fast=false){return baseLoadStreams(page,fast)};
section=function(title,html,klass=''){
  const routes={'Live Stream Bola':'/livescore?tab=live','Highlight Pertandingan':'/highlights','Prediksi':'/prediksi','Klasemen':'/klasemen','Berita Olahraga':'/berita'};
  const label=routes[title]?`<a class="section-title" href="${routes[title]}">${title} ›</a>`:`<span class="section-title">${title} ›</span>`;
  return `<section class="section">${label}<div class="${klass}">${html}</div></section>`;
};

function streamState(x){
  const s=String(x.match_status||x.status||'').toLowerCase();
  if(['live','1h','2h','ht','et','p'].includes(s))return 'live';
  const kick=Number(x.match_time||x.timestamp||0)*1000;
  return kick&&kick<Date.now()?'finished':'scheduled';
}
function streamPairKey(home,away){
  const n=value=>String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\b(fc|cf|sc|afc|club|women|ladies|w)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim();
  return [n(home),n(away)].sort().join('::');
}
function hubStreamCard(x){
  const t=streamTeams(x),mid=x.match_slug||x.fixtureId||x.match_id||x.id||x.slug||encodeURIComponent(`${t.home.name}-vs-${t.away.name}`),status=streamState(x),kick=Number(x.match_time||x.timestamp||0)*1000,target=(status==='scheduled'&&x.fixtureId&&x.stream_ready===false)?`/detail/${esc(x.fixtureId)}`:`/match/${esc(mid)}`;
  return `<a class="live-hub-card" data-stream-status="${status}" href="${target}"><div class="live-ribbon ${status}">${status==='live'?'● LIVE':status==='finished'?'BERAKHIR':'PERTANDINGAN AKAN DATANG'}</div><div class="live-league">${esc(x.league_name||x.league||'Sepak Bola')}</div><div class="live-hub-teams">${team(t.home)}<strong>${status==='live'?esc((x.score_home??0)+' : '+(x.score_away??0)):'VS'}</strong>${team(t.away)}</div><div class="live-watch" ${status==='scheduled'&&kick?`data-rapid-countdown="${kick}"`:''}>${status==='live'?'▣ Nonton Sekarang':kick?'Menghitung waktu pertandingan...':'Pertandingan Akan Datang'}</div></a>`;
}
function startRapidUpcomingCountdowns(){
  const tick=()=>document.querySelectorAll('[data-rapid-countdown]').forEach(el=>{const kick=Number(el.dataset.rapidCountdown||0),diff=kick-Date.now();if(!kick)return;if(diff<=0){el.textContent='SEGERA DIMULAI';return}const s=Math.floor(diff/1000),d=Math.floor(s/86400),h=Math.floor((s%86400)/3600),m=Math.floor((s%3600)/60),sec=s%60;el.textContent=`Pertandingan Akan Datang • ${d?d+' hari ':''}${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`});tick();clearInterval(startRapidUpcomingCountdowns._timer);startRapidUpcomingCountdowns._timer=setInterval(tick,1000)
}
function sarangLiveRail(activeId){
  const rows=(state.streams||[]).filter(x=>streamState(x)==='live');
  if(!rows.length)return '';
  return `<section class="match-live-rail"><a href="/livescore?tab=live">Live Stream Bola ›</a><div>${rows.map(x=>{const t=streamTeams(x),mid=x.match_slug||x.fixtureId||x.match_id||x.id,score=x.score_home==null?'LIVE':`${x.score_home} : ${x.score_away??0}`;return `<a class="mini-live-card ${String(mid)===String(activeId)?'active':''}" href="/match/${esc(mid)}"><small>● LIVE</small><span>${esc(x.league_name||'Sepak Bola')}</span><div>${team(t.home)}<strong>${esc(score)}</strong>${team(t.away)}</div><b>Nonton Sekarang</b></a>`}).join('')}</div></section>`;
}
async function liveStreamHub(){
  app.innerHTML='<div class="loading"><span></span> Memuat pertandingan live...</div>';
  try{
    // STRICT PROVIDER-ONLY: jangan pernah menambahkan fixture API-Football yang tidak dikirim RapidAPI.
    const provider=await loadStreams().catch(()=>[]),streams=(Array.isArray(provider)?provider:[]).filter(x=>x.stream_provider==='rapidapi-1xapi'&&['live','upcoming'].includes(String(x.match_status||'').toLowerCase()));state.streams=streams;
    const liveTotal=streams.filter(x=>streamState(x)==='live').length,upcomingTotal=streams.filter(x=>streamState(x)==='scheduled').length;
    app.innerHTML=`<div class="container live-hub"><div class="live-hub-heading"><div><small>LIVE STREAMING</small><h1>Live Stream Bola</h1><p>Hanya pertandingan yang memang disediakan RapidAPI. Pertandingan akan datang tampil maksimal 24 jam sebelum kickoff.</p></div><a class="btn" href="/livescore">Lihat Semua Skor</a></div><div class="live-hub-filters"><input id="liveSearch" placeholder="🔍 Cari tim atau liga..."><button class="filter-active" data-live-filter="all">Semua (${streams.length})</button><button data-live-filter="live">Live (${liveTotal})</button><button data-live-filter="scheduled">Akan Datang (${upcomingTotal})</button></div><div id="liveGrid" class="live-hub-grid">${streams.map(hubStreamCard).join('')||'<div class="service-empty"><img src="/favicon.svg"><div><b>Belum ada pertandingan dari RapidAPI</b><span>Live dan jadwal akan muncul otomatis hanya ketika RapidAPI menyediakannya.</span></div></div>'}</div></div>`;
    const apply=()=>{const q=(document.querySelector('#liveSearch')?.value||'').toLowerCase(),f=document.querySelector('[data-live-filter].filter-active')?.dataset.liveFilter||'all';document.querySelectorAll('.live-hub-card').forEach(c=>c.hidden=!(c.textContent.toLowerCase().includes(q)&&(f==='all'||c.dataset.streamStatus===f)))};
    document.querySelector('#liveSearch')?.addEventListener('input',apply);
    document.querySelectorAll('[data-live-filter]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-live-filter]').forEach(x=>x.classList.remove('filter-active'));b.classList.add('filter-active');apply()});
    startRapidUpcomingCountdowns();
  }catch(e){app.innerHTML=`<div class="container live-hub">${configError({message:friendlyApiError(e.message,'stream')})}</div>`}
}

async function liveSideStandings(){
  const box=document.querySelector('.livescore-page .standings');if(!box)return;
  try{const d=await api('/api/football/standings?league=39&season='+new Date().getFullYear()),rows=d.response?.[0]?.league?.standings?.[0]||[];box.innerHTML=`<h3>Premier League</h3><small>KLASEMEN TERKINI</small><table class="side-table"><thead><tr><th>#</th><th>Tim</th><th>PL</th><th>PTS</th></tr></thead><tbody>${rows.slice(0,20).map(r=>`<tr><td>${r.rank}</td><td><img src="${esc(r.team.logo)}">${esc(r.team.name)}</td><td>${r.all.played}</td><td><b>${r.points}</b></td></tr>`).join('')}</tbody></table><a class="btn standings-more" href="/klasemen?league=39">Klasemen Lengkap</a>`}catch{}
}
livescore=async function(){
  if(new URLSearchParams(location.search).get('tab')==='live')return liveStreamHub();
  await baseLivescore();liveSideStandings();
};

let liveLeagueId='',liveStatus='all';
function liveStatusMatch(x,status){const s=x.fixture?.status?.short||'NS';if(status==='all')return true;if(status==='live')return ['1H','2H','HT','ET','P','BT'].includes(s);if(status==='running')return ['1H','2H','HT','ET','P','BT','INT'].includes(s);if(status==='finished')return ['FT','AET','PEN'].includes(s);return ['NS','TBD'].includes(s)}
function wibDateValue(offset=0){const d=new Date(Date.now()+offset*86400000);return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}
function wibFixtureDate(value){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value))}
async function updateLiveLeagueStandings(id){const box=document.querySelector('.sarang-live-layout .standings');if(!box)return;const item=topLeagues.find(x=>x[0]===String(id)),name=item?.[1]||'Klasemen Liga';box.innerHTML=`<h3>${esc(name)}</h3><div class="loading side-loading"><span></span></div>`;try{const meta=await api(`/api/football/leagues?id=${id}`),seasons=meta.response?.[0]?.seasons||[],season=(seasons.find(x=>x.current)||seasons.sort((a,b)=>b.year-a.year)[0])?.year||new Date().getFullYear(),d=await api(`/api/football/standings?league=${id}&season=${season}`),rows=d.response?.[0]?.league?.standings?.[0]||[];box.innerHTML=`<h3>${esc(name)}</h3><small>${esc(d.response?.[0]?.league?.country||'')}</small>${rows.length?`<table class="side-table"><thead><tr><th>#</th><th>Tim</th><th>PL</th><th>GD</th><th>PTS</th></tr></thead><tbody>${rows.slice(0,20).map(r=>`<tr><td>${r.rank}</td><td><img src="${esc(r.team.logo)}">${esc(r.team.name)}</td><td>${r.all.played}</td><td class="${r.goalsDiff>0?'positive':r.goalsDiff<0?'negative':''}">${r.goalsDiff>0?'+':''}${r.goalsDiff}</td><td><b>${r.points}</b></td></tr>`).join('')}</tbody></table>`:'<div class="detail-empty">Kompetisi ini memakai sistem knockout.</div>'}<a class="btn standings-more" href="/klasemen?league=${id}">Lihat Kompetisi</a>`}catch{box.innerHTML=`<h3>${esc(name)}</h3><div class="detail-empty">Klasemen belum tersedia.</div>`}}
function renderScores(list){
  if(!liveLeagueId)liveLeagueId=new URLSearchParams(location.search).get('league')||'';
  const all=list||[],streamNames=new Set((state.streams||[]).filter(x=>streamState(x)==='live').map(x=>{const t=streamTeams(x);return streamPairKey(t.home.name,t.away.name)})),filtered=all.filter(x=>(!liveLeagueId||String(x.league?.id)===String(liveLeagueId))&&liveStatusMatch(x,liveStatus)),groups=Object.values(filtered.reduce((a,x)=>{const k=x.league?.id||'x';(a[k]??={league:x.league,rows:[]}).rows.push(x);return a},{})),countries=[...new Set(all.map(x=>x.league?.country).filter(Boolean))].sort(),leagues=[...new Map(all.map(x=>[String(x.league?.id),x.league])).values()],liveCount=all.filter(x=>liveStatusMatch(x,'live')).length,date=new URLSearchParams(location.search).get('date')||wibDateValue();
  app.innerHTML=`<div class="container livescore-page sarang-livescore"><div class="sport-tabs"><b>Sepak Bola</b><span>Bola Basket</span><span>Bola Voli</span><span>Baseball</span><span>Tenis</span><span>Badminton</span><span>Hockey</span></div><div class="sarang-live-layout"><aside class="top-column"><input id="liveSearch" class="live-search" placeholder="⌕  Pencarian..."><div class="sidebar top-league"><div class="sidebar-title"><h3>Top Liga</h3><button id="leagueReset">Reset</button></div>${topLeagues.map(([id,name])=>`<button class="top-league-btn ${String(liveLeagueId)===id?'active':''}" data-league="${id}"><img src="https://media.api-sports.io/football/leagues/${id}.png"><span>${name}</span></button>`).join('')}</div></aside><main><div class="live-controls"><div class="status-tabs"><button class="${liveStatus==='all'?'active':''}" data-live-status="all">Semua</button><button class="${liveStatus==='live'?'active':''}" data-live-status="live">Live (${liveCount})</button><button class="${liveStatus==='running'?'active':''}" data-live-status="running">Berlangsung</button><button class="${liveStatus==='finished'?'active':''}" data-live-status="finished">Berakhir</button><button class="${liveStatus==='scheduled'?'active':''}" data-live-status="scheduled">Dijadwalkan</button></div><div class="live-date-label">${new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',weekday:'short',day:'numeric',month:'short',year:'numeric'}).format(new Date(date+'T12:00:00Z'))} ▦</div></div><div class="date-strip">${[0,1,2,3,4,5,6].map((_,i)=>{const val=wibDateValue(i),d=new Date(val+'T12:00:00Z');return `<button class="${val===date?'active':''}" data-live-date="${val}"><b>${i===0?'HARI INI':new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'2-digit'}).format(d)}</b><span>${new Intl.DateTimeFormat('id-ID',{weekday:'long'}).format(d)}</span></button>`}).join('')}</div><div class="live-selects"><select id="countryFilter"><option value="">Pilih Negara</option>${countries.map(c=>`<option>${esc(c)}</option>`).join('')}</select><select id="leagueFilter"><option value="">Pilih Liga</option>${leagues.map(l=>`<option value="${l.id}" ${String(l.id)===String(liveLeagueId)?'selected':''}>${esc(l.name)}</option>`).join('')}</select><button id="applyLeague">Tampilkan</button><button id="resetLive">Reset</button></div><div id="liveResults">${groups.map(g=>`<section class="league-group"><div class="league-head"><img src="${esc(g.league?.logo||'/favicon.svg')}"><div><b>${esc(g.league?.name)}</b><small>${esc(g.league?.round||g.league?.country||'')}</small></div></div>${g.rows.sort((a,b)=>new Date(a.fixture.date)-new Date(b.fixture.date)).map(x=>scoreRow(x,streamNames)).join('')}</section>`).join('')||'<div class="no-matches"><b>Tidak ada pertandingan</b><span>Tidak ditemukan hasil untuk filter ini</span></div>'}</div></main><aside class="standings"><h3>Klasemen Liga</h3><p>Pilih liga di menu Top Liga.</p></aside></div></div>`;
  document.querySelectorAll('[data-league]').forEach(b=>b.onclick=()=>{liveLeagueId=b.dataset.league;renderScores(state.fixtures);updateLiveLeagueStandings(liveLeagueId)});document.querySelector('#leagueReset').onclick=()=>{liveLeagueId='';renderScores(state.fixtures)};document.querySelectorAll('[data-live-status]').forEach(b=>b.onclick=()=>{liveStatus=b.dataset.liveStatus;renderScores(state.fixtures);if(liveLeagueId)updateLiveLeagueStandings(liveLeagueId)});document.querySelectorAll('[data-live-date]').forEach(b=>b.onclick=async()=>{try{const next=await loadFixtures('date='+b.dataset.liveDate);state.fixtures=next;history.replaceState({},'',`/livescore?date=${b.dataset.liveDate}${liveLeagueId?'&league='+liveLeagueId:''}`);renderScores(next);if(liveLeagueId)updateLiveLeagueStandings(liveLeagueId)}catch(e){alert(friendlyApiError(e.message))}});document.querySelector('#applyLeague').onclick=()=>{liveLeagueId=document.querySelector('#leagueFilter').value;renderScores(state.fixtures);if(liveLeagueId)updateLiveLeagueStandings(liveLeagueId)};document.querySelector('#resetLive').onclick=()=>{liveLeagueId='';liveStatus='all';renderScores(state.fixtures)};document.querySelector('#countryFilter').onchange=e=>{const c=e.target.value;document.querySelectorAll('#leagueFilter option').forEach(o=>{if(!o.value)return;o.hidden=c&&leagues.find(l=>String(l.id)===o.value)?.country!==c})};
  document.querySelector('#liveSearch').oninput=e=>{const q=e.target.value.toLowerCase();document.querySelectorAll('.score-row').forEach(r=>r.hidden=!r.textContent.toLowerCase().includes(q));document.querySelectorAll('#liveResults .league-group').forEach(g=>g.hidden=![...g.querySelectorAll('.score-row')].some(r=>!r.hidden))};if(liveLeagueId)updateLiveLeagueStandings(liveLeagueId);
}

function homePredictionCard(x){
  const h=x.teams?.home||{},a=x.teams?.away||{};
  return `<a class="home-pred-card" href="/detail/${x.fixture.id}"><div class="home-cover-brand">BOLA <b>UTAMA</b></div><div class="home-cover-teams"><img src="${esc(h.logo||'/favicon.svg')}"><span>${x.goals?.home!=null&&x.goals?.away!=null?`${x.goals.home} : ${x.goals.away}`:'VS'}</span><img src="${esc(a.logo||'/favicon.svg')}"></div><strong>Prediksi Sepak Bola</strong><time>${fmtDate(x.fixture.date)}</time><small>${esc(h.name)} vs ${esc(a.name)}</small></a>`;
}
function polishHome(){
  const configured=new Set(String(state.boot.settings.featuredLeagues||'2,3,848,39,140,135,78,61,88,179').split(',').map(Number)),priority=[2,3,848,39,140,135,78,61,88,179],fixtures=state.fixtures.filter(x=>configured.has(Number(x.league?.id))&&x.teams?.home?.name&&x.teams?.away?.name).sort((a,b)=>{const ai=priority.indexOf(Number(a.league?.id)),bi=priority.indexOf(Number(b.league?.id));return (ai<0?99:ai)-(bi<0?99:bi)||new Date(a.fixture.date)-new Date(b.fixture.date)}).slice(0,6);
  document.querySelectorAll('.section').forEach(s=>{const title=s.querySelector('.section-title')?.textContent||'';if(title.startsWith('Prediksi')){const old=s.querySelector('.cards');if(old){old.className='home-prediction-grid';old.innerHTML=fixtures.map(homePredictionCard).join('')||'<div class="empty">Prediksi liga pilihan belum tersedia.</div>'}}if(title.startsWith('Klasemen')){const grid=s.querySelector('.league-cards');if(grid)grid.classList.add('home-standings-grid')}});
  const banner=document.querySelector('.hero .banner img');if(banner)banner.classList.add('fit-banner');
}
home=async function(){await baseHome();polishHome()};

function predictedScore(p,fixture){
  const gh=p?.predictions?.goals?.home,ga=p?.predictions?.goals?.away;
  const goalNumber=v=>{const m=String(v??'').match(/-?\d+(?:\.\d+)?/);return m?Math.max(0,Math.min(6,Math.abs(parseInt(m[0],10)))):null},hg=goalNumber(gh),ag=goalNumber(ga);
  if(hg!==null&&ag!==null&&(hg||ag))return `${hg} : ${ag}`;
  const raw=p?.predictions?.percent||{},h=Number(String(raw.home||0).replace('%','')),d=Number(String(raw.draw||0).replace('%','')),a=Number(String(raw.away||0).replace('%',''));
  if(!h&&!d&&!a)return '– : –';
  const seed=(Number(fixture?.fixture?.id)||Number(fixture?.teams?.home?.id)||1)%4;
  if(h>a&&h>=d)return h-a>25?(seed%2?'3 : 1':'2 : 0'):(seed%2?'2 : 1':'1 : 0');
  if(a>h&&a>=d)return a-h>25?(seed%2?'1 : 3':'0 : 2'):(seed%2?'1 : 2':'0 : 1');
  return seed%3===0?'2 : 2':seed%3===1?'1 : 1':(h>=a?'2 : 1':'1 : 2');
}
function predictionCover({x,p}){
  const h=x.teams?.home||{},a=x.teams?.away||{};
  return `<a class="sarang-cover" href="/detail/${x.fixture.id}"><div class="cover-brand">BOLA <b>UTAMA</b></div><div class="cover-teams"><img src="${esc(h.logo||'/favicon.svg')}"><span>${realOrPredictedScore(p,x)}</span><img src="${esc(a.logo||'/favicon.svg')}"></div><strong>${esc(h.name)} vs ${esc(a.name)}</strong><time>${fmtDate(x.fixture.date)} • ${fmtTime(x.fixture.date)} WIB</time></a>`;
}
function realOrPredictedScore(p,fixture){
  const status=String(fixture?.fixture?.status?.short||'').toUpperCase(),hg=fixture?.goals?.home,ag=fixture?.goals?.away;
  if(hg!==null&&hg!==undefined&&ag!==null&&ag!==undefined&&(['FT','AET','PEN','1H','2H','HT','ET','P','BT','INT'].includes(status)))return `${hg} : ${ag}`;
  return predictedScore(p,fixture);
}
function realMatchStatus(fixture){
  const s=String(fixture?.fixture?.status?.short||'NS').toUpperCase();
  return ['FT','AET','PEN'].includes(s)?s:(['1H','2H','HT','ET','P','BT','INT'].includes(s)?'LIVE':'');
}
function recentForm(p,teamId){
  const games=Array.isArray(p?.h2h)?p.h2h.slice(-5):[];
  const values=games.map(g=>{const home=Number(g.teams?.home?.id)===Number(teamId),gf=Number(home?g.goals?.home:g.goals?.away),ga=Number(home?g.goals?.away:g.goals?.home);return gf>ga?'W':gf<ga?'L':'D'});
  return formHTML(values.join(''));
}
function sarangPredictionRow({x,p}){
  const raw=p?.predictions?.percent||{},ph=Math.max(0,Number(String(raw.home||0).replace('%',''))),pd=Math.max(0,Number(String(raw.draw||0).replace('%',''))),pa=Math.max(0,Number(String(raw.away||0).replace('%',''))),sum=ph+pd+pa||100,hp=Math.round(ph/sum*100),dp=Math.round(pd/sum*100),ap=100-hp-dp,h=x.teams.home,a=x.teams.away;
  const predicted=realOrPredictedScore(p,x);
  return `<a class="sarang-pred-row" href="/detail/${x.fixture.id}"><div class="pred-form home-form">${recentForm(p,h.id)}</div><div class="pred-match"><div class="pred-side home-side"><b>${esc(h.name)}</b><img src="${esc(h.logo||'/favicon.svg')}"></div><div class="pred-kick"><time>${fmtTime(x.fixture.date)}${realMatchStatus(x)?` <em class="real-status">${realMatchStatus(x)}</em>`:''}</time><strong>${predicted}</strong></div><div class="pred-side away-side"><img src="${esc(a.logo||'/favicon.svg')}"><b>${esc(a.name)}</b></div><div class="prob"><span class="home" style="width:${hp}%">Home: ${hp}%</span><span class="draw" style="width:${dp}%">Draw: ${dp}%</span><span class="away" style="width:${ap}%">Away: ${ap}%</span></div></div><div class="pred-form away-form">${recentForm(p,a.id)}</div></a>`;
}

function predictionSummary(fixture,p){
  const raw=p?.predictions?.percent||{},pct=k=>Math.max(0,Number(String(raw[k]||0).replace('%',''))),total=pct('home')+pct('draw')+pct('away')||100,hp=Math.round(pct('home')/total*100),dp=Math.round(pct('draw')/total*100),ap=100-hp-dp,winner=p?.predictions?.winner;
  return `<div class="prediction-summary"><div><small>Prediksi skor</small><strong>${predictedScore(p,fixture)}</strong></div><div><small>Tim unggulan</small><strong>${esc(winner?.name||'Belum ditentukan')}</strong><span>${esc(winner?.comment||'')}</span></div><div><small>Analisis</small><strong>${esc(p?.predictions?.advice||'Analisis belum diterbitkan penyedia.')}</strong></div><div class="prob"><span class="home" style="width:${hp}%">Home ${hp}%</span><span class="draw" style="width:${dp}%">Draw ${dp}%</span><span class="away" style="width:${ap}%">Away ${ap}%</span></div></div>`;
}
async function predictionDetail(id){
  app.innerHTML='<div class="loading"><span></span> Memuat analisis prediksi...</div>';
  try{
    const [fd,pd]=await Promise.all([api('/api/football/fixtures?id='+encodeURIComponent(id)),api('/api/football/predictions?fixture='+encodeURIComponent(id)).catch(()=>({response:[]}))]),fixture=fd.response?.[0],p=pd.response?.[0]||null;
    if(!fixture?.fixture?.id)throw new Error('Pertandingan tidak ditemukan');
    const h=fixture.teams.home,a=fixture.teams.away,status=fixture.fixture.status?.long||'Scheduled';
    app.innerHTML=`<div class="container prediction-detail-page"><div class="prediction-detail-actions"><a class="btn" href="/prediksi">‹ Kembali</a><button class="btn secondary" type="button">▣ Widget</button></div><section class="prediction-detail-card panel"><div class="prediction-detail-league"><img src="${esc(fixture.league.logo||'/favicon.svg')}"><div><b>${esc(fixture.league.name)}</b><small>${esc(fixture.league.round||'')}</small></div></div><div class="prediction-detail-date">${fmtDate(fixture.fixture.date)} | ${fmtTime(fixture.fixture.date)} WIB</div><div class="prediction-detail-teams"><div><b>${esc(h.name)}</b><img src="${esc(h.logo||'/favicon.svg')}"></div><strong>${predictedScore(p,fixture)}</strong><div><img src="${esc(a.logo||'/favicon.svg')}"><b>${esc(a.name)}</b></div></div><p class="prediction-detail-status">${esc(status)}</p></section><div class="tabs prediction-tabs"><button class="btn active" data-pred-tab="summary">Ringkasan</button><button class="btn" data-pred-tab="statistics">Statistik</button><button class="btn" data-pred-tab="lineups">Susunan Pemain</button><button class="btn" data-pred-tab="history">Riwayat</button><button class="btn" data-pred-tab="standing">Klasemen</button></div><section id="matchDetail" class="panel match-detail"></section></div>`;
    const show=tab=>{document.querySelectorAll('[data-pred-tab]').forEach(x=>x.classList.toggle('active',x.dataset.predTab===tab));if(tab==='summary')document.querySelector('#matchDetail').innerHTML=predictionSummary(fixture,p);else detailTab(fixture,tab)};
    document.querySelectorAll('[data-pred-tab]').forEach(b=>b.onclick=()=>show(b.dataset.predTab));const finished=['FT','AET','PEN'].includes(String(fixture.fixture.status?.short||''));show(finished?'statistics':'summary');
  }catch(e){app.innerHTML=`<div class="container"><div class="detail-empty"><h2>Prediksi tidak ditemukan</h2><p>${esc(e.message)}</p><a class="btn" href="/prediksi">Kembali ke Prediksi</a></div></div>`}
}
predictions=async function(){
  app.innerHTML='<div class="loading"><span></span> Memuat prediksi...</div>';
  try{
    const today=wibDateValue(0),tomorrow=wibDateValue(1),allowedDates=new Set([today,tomorrow]),configured=new Set(String(state.boot.settings.featuredLeagues||'2,3,848,39,140,135,78,61,88,179').split(',').map(Number)),priority=[2,3,848,39,140,135,78,61,88,179],priorityOf=x=>{const i=priority.indexOf(Number(x.league?.id));return i<0?99:i},requests=await Promise.allSettled([loadFixtures('date='+today),loadFixtures('date='+tomorrow)]),all=[...new Map(requests.flatMap(r=>r.status==='fulfilled'?r.value:[]).filter(x=>x.fixture?.id&&allowedDates.has(wibFixtureDate(x.fixture.date))&&configured.has(Number(x.league?.id))).map(x=>[x.fixture.id,x])).values()].sort((a,b)=>priorityOf(a)-priorityOf(b)||new Date(a.fixture.date)-new Date(b.fixture.date)).slice(0,50),loaded=await Promise.all(all.map(async x=>{try{const d=await api('/api/football/predictions?fixture='+x.fixture.id);return{x,p:d.response?.[0]||null}}catch{return{x,p:null}}})),enriched=loaded.filter(z=>z.p&&z.x.teams?.home?.name&&z.x.teams?.away?.name).slice(0,30),fixtures=enriched.map(z=>z.x),dates=[today,tomorrow],first=today,last=tomorrow;
    const byDate=enriched.reduce((all,item)=>{const date=wibFixtureDate(item.x.fixture.date),league=item.x.league?.name||'Sepak Bola';if(!allowedDates.has(date))return all;all[date]??={};(all[date][league]??=[]).push(item);return all},{[today]:{},[tomorrow]:{}});
    app.innerHTML=`<div class="container sarang-predictions"><div class="sarang-page-title"><h1>Prediksi Bola</h1></div><div class="cover-slider"><button type="button" id="coverPrev">‹</button><div id="coverTrack">${enriched.slice(0,12).map(predictionCover).join('')}</div><button type="button" id="coverNext">›</button></div><div class="prediction-copy"><h2>Prediksi Bola | ${fmtDate(first+'T12:00:00Z')} – ${fmtDate(last+'T12:00:00Z')}</h2><p>Prediksi hanya untuk hari ini dan besok. Seluruh jam pertandingan menggunakan WIB.</p></div><div class="prediction-search"><input id="predSearch" placeholder="⌕  Pencarian tim atau liga..."></div><div id="predictionDates">${Object.entries(byDate).map(([date,leagues],di)=>`<details class="prediction-date" ${di===0?'open':''}><summary><b>${new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(date+'T12:00:00Z'))}</b><span>⌄</span></summary><div>${Object.keys(leagues).length?Object.entries(leagues).map(([name,items])=>`<section class="sarang-league"><div class="league-head"><img src="${esc(items[0].x.league?.logo||'/favicon.svg')}"><b>${esc(name)}</b></div>${items.map(sarangPredictionRow).join('')}</section>`).join(''):'<div class="day-empty">Belum ada prediksi untuk tanggal ini.</div>'}</div></details>`).join('')}</div></div>`;
    const track=document.querySelector('#coverTrack');document.querySelector('#coverPrev').onclick=()=>track.scrollBy({left:-480,behavior:'smooth'});document.querySelector('#coverNext').onclick=()=>track.scrollBy({left:480,behavior:'smooth'});document.querySelector('#predSearch').oninput=e=>{const q=e.target.value.toLowerCase();document.querySelectorAll('.sarang-pred-row').forEach(row=>row.hidden=!row.textContent.toLowerCase().includes(q));document.querySelectorAll('.sarang-league').forEach(g=>g.hidden=![...g.querySelectorAll('.sarang-pred-row')].some(r=>!r.hidden))};
  }catch(e){app.innerHTML=configError(e)}
};

function competitionMatch(x){
  const done=['FT','AET','PEN'].includes(x.fixture?.status?.short),score=done?`${x.goals?.home??0} : ${x.goals?.away??0}`:'VS';
  return `<a class="competition-match" href="/detail/${x.fixture.id}"><time><b>${fmtDate(x.fixture.date)}</b><span>${done?esc(x.fixture.status.short):fmtTime(x.fixture.date)+' WIB'}</span></time><div><span>${esc(x.teams.home.name)}</span><img src="${esc(x.teams.home.logo||'/favicon.svg')}"></div><strong>${score}</strong><div><img src="${esc(x.teams.away.logo||'/favicon.svg')}"><span>${esc(x.teams.away.name)}</span></div></a>`;
}
function knockoutBoard(fixtures){
  const groups=fixtures.reduce((a,x)=>{const key=x.league?.round||'Pertandingan';(a[key]??=[]).push(x);return a},{}),entries=Object.entries(groups).sort((a,b)=>new Date(a[1][0].fixture.date)-new Date(b[1][0].fixture.date));
  return entries.length?`<div class="knockout-board">${entries.map(([round,items])=>`<section><h3>${esc(round)}</h3><div>${items.slice(0,16).map(competitionMatch).join('')}</div></section>`).join('')}</div>`:'<div class="detail-empty"><h3>Jadwal belum tersedia</h3><p>Data babak kompetisi belum diterbitkan oleh penyedia.</p></div>';
}
leagueDetail=async function(id){
  app.innerHTML='<div class="loading"><span></span> Memuat kompetisi...</div>';
  try{
    const meta=await api(`/api/football/leagues?id=${encodeURIComponent(id)}`),info=meta.response?.[0]||{},seasons=info.seasons||[],current=seasons.find(s=>s.current)||seasons.sort((a,b)=>b.year-a.year)[0],season=current?.year||new Date().getFullYear(),today=ymd(new Date()),until=ymd(new Date(Date.now()+120*86400000));
    const [st,next,last]=await Promise.all([api(`/api/football/standings?league=${id}&season=${season}`).catch(()=>({response:[]})),api(`/api/football/fixtures?league=${id}&season=${season}&from=${today}&to=${until}`).catch(()=>({response:[]})),api(`/api/football/fixtures?league=${id}&season=${season}&last=30`).catch(()=>({response:[]}))]);
    const league=st.response?.[0]?.league||{...info.league,country:info.country?.name,flag:info.country?.flag,season},table=league?.standings?.[0]||[],seen=new Set(),fixtures=[...(next.response||[]),...(last.response||[])].filter(x=>x.fixture?.id&&!seen.has(x.fixture.id)&&seen.add(x.fixture.id)).sort((a,b)=>new Date(b.fixture.date)-new Date(a.fixture.date)),upcoming=fixtures.filter(x=>!['FT','AET','PEN'].includes(x.fixture.status.short)).sort((a,b)=>new Date(a.fixture.date)-new Date(b.fixture.date)),recent=fixtures.filter(x=>['FT','AET','PEN'].includes(x.fixture.status.short)).sort((a,b)=>new Date(b.fixture.date)-new Date(a.fixture.date)),matches=[...upcoming,...recent];
    app.innerHTML=`<div class="container competition-page"><a class="btn competition-back" href="/klasemen">‹ Kembali</a><header class="competition-title"><img src="${esc(league.logo||info.league?.logo||'/favicon.svg')}"><div><small>${esc(league.country||info.country?.name||'World')} • ${season}</small><h1>${esc(league.name||info.league?.name||'Kompetisi')}</h1><p>${table.length?'Klasemen, performa tim, dan jadwal pertandingan terbaru.':'Kompetisi sistem knockout — jadwal dan hasil ditampilkan per babak.'}</p></div></header><div class="competition-layout"><aside class="competition-fixtures panel"><div class="panel-head"><b>Pertandingan</b><span>${matches.length} laga</span></div>${matches.slice(0,24).map(competitionMatch).join('')||'<div class="detail-empty">Belum ada pertandingan.</div>'}</aside><main class="competition-data panel"><div class="panel-head"><b>${table.length?'Klasemen Liga':'Babak Knockout'}</b><span>${season}</span></div>${table.length?`<div class="standings-scroll">${standTable(table)}</div>`:knockoutBoard(fixtures)}</main></div></div>`;
  }catch(e){app.innerHTML=configError(e)}
};

/* Fully connected match, streaming, ads and history experience. */
scoreRow=function(x,streamPairs){
  const f=x.fixture||{},h=x.teams?.home||{},a=x.teams?.away||{},status=f.status?.short||'NS',isLive=['1H','2H','HT','ET','P','BT','INT','LIVE'].includes(status),hasStream=isLive&&streamPairs?.has(streamPairKey(h.name,a.name)),score=x.goals?.home==null?'VS':`${x.goals.home} : ${x.goals.away??0}`;
  const target=hasStream?`/match/${esc(f.id)}`:`/detail/${esc(f.id)}`;
  return `<a class="score-row" href="${target}"><div class="score-meta"><b>${esc(status)}</b><span>${fmtTime(f.date)}</span></div><div class="score-team home-team"><b>${esc(h.name)}</b><img src="${esc(h.logo||'/favicon.svg')}" alt="${esc(h.name)}"></div><strong class="score-pill">${score}</strong><div class="score-team away-team"><img src="${esc(a.logo||'/favicon.svg')}" alt="${esc(a.name)}"><b>${esc(a.name)}</b></div>${hasStream?'<span class="live-btn">▣ Live</span>':'<span></span>'}</a>`;
};

function adFor(placement,matchId){return (state.boot.ads||[]).find(a=>a.active&&a.placement===placement&&(!a.matchId||a.matchId==='all'||String(a.matchId)===String(matchId)))}
function adMarkup(ad,klass){if(!ad?.media)return '';return `<a class="${klass}" href="${esc(ad.clickUrl||'#')}" target="_blank" rel="noopener"><small>ADS</small>${ad.type==='video'?`<video src="${esc(ad.media)}" autoplay muted loop playsinline></video>`:`<img src="${esc(ad.media)}" alt="${esc(ad.title||'Iklan')}">`}</a>`}
function matchHighlight(home,away){const q=[home,away].map(x=>String(x||'').toLowerCase());return (state.boot.highlights||[]).find(x=>q.some(n=>n&&String(x.title||'').toLowerCase().includes(n)))||(state.boot.highlights||[])[0]}
function videoOverlayAd(matchId){
  const ad=adFor('overlay',matchId);if(!ad?.media)return;
  const delay=Math.max(0,Number(ad.delay||0))*1000;
  setTimeout(()=>{
    const box=document.querySelector('#ad');if(!box)return;
    box.className='ad-overlay sarang-video-ad';
    box.innerHTML=`<a class="sarang-ad-click" href="${esc(ad.clickUrl||'#')}" target="_blank" rel="noopener">${ad.type==='video'?`<video class="sarang-ad-media" src="${esc(ad.media)}" autoplay muted playsinline preload="auto"></video>`:`<img class="sarang-ad-media" src="${esc(ad.media)}">`}</a><button class="sarang-ad-mute" type="button">🔇</button><button class="sarang-ad-skip" type="button" disabled>Lewati dalam <b>5 detik</b></button>`;
    const video=box.querySelector('video'),mute=box.querySelector('.sarang-ad-mute'),skip=box.querySelector('.sarang-ad-skip');
    if(video&&mute)mute.onclick=()=>{video.muted=!video.muted;mute.textContent=video.muted?'🔇':'🔊'};
    let left=5;const timer=setInterval(()=>{left--;if(!skip||!box.isConnected)return clearInterval(timer);if(left<=0){clearInterval(timer);skip.disabled=false;skip.innerHTML='Lewati Iklan <span>›</span>';skip.onclick=()=>box.remove()}else skip.innerHTML=`Lewati dalam <b>${left} detik</b>`},1000);
    setTimeout(()=>box.isConnected&&box.remove(),Math.max(8,Number(ad.duration||20))*1000)
  },delay)
}

// Live match rendering is owned exclusively by app.js.
function historyResult(f,teamId){const home=String(f.teams?.home?.id)===String(teamId),gf=Number(home?f.goals?.home:f.goals?.away),ga=Number(home?f.goals?.away:f.goals?.home);return gf>ga?'W':gf<ga?'L':'D'}
function historyRows(items,teamId){return items.map(f=>`<a class="sarang-history-row" href="/detail/${esc(f.fixture?.id)}"><img src="${esc(f.league?.logo||'/favicon.svg')}"><div><b>${esc(f.teams?.home?.name)}</b><img src="${esc(f.teams?.home?.logo||'/favicon.svg')}"></div><time>${fmtDate(f.fixture?.date)}<strong>${f.goals?.home??0} : ${f.goals?.away??0}</strong></time><div><img src="${esc(f.teams?.away?.logo||'/favicon.svg')}"><b>${esc(f.teams?.away?.name)}</b></div><i class="${historyResult(f,teamId)}">${historyResult(f,teamId)}</i></a>`).join('')||'<div class="detail-empty">Riwayat belum tersedia.</div>'}
const originalDetailTab=detailTab;
detailTab=async function(fixture,tab){
  if(tab!=='history'||!fixture?.teams?.home?.id||String(fixture.fixture?.id||'').startsWith('lfa-'))return originalDetailTab(fixture,tab);
  const box=document.querySelector('#matchDetail');document.querySelectorAll('[data-tab],[data-pred-tab]').forEach(x=>x.classList.toggle('active',(x.dataset.tab||x.dataset.predTab)===tab));box.innerHTML='<div class="loading detail-loading"><span></span></div>';
  try{const [h,a]=await Promise.all([api(`/api/football/fixtures?team=${fixture.teams.home.id}&last=5`),api(`/api/football/fixtures?team=${fixture.teams.away.id}&last=5`)]);box.innerHTML=`<div class="sarang-history"><section><h3>LAGA TERAKHIR : ${esc(fixture.teams.home.name).toUpperCase()}</h3>${historyRows(h.response||[],fixture.teams.home.id)}</section><section><h3>LAGA TERAKHIR : ${esc(fixture.teams.away.name).toUpperCase()}</h3>${historyRows(a.response||[],fixture.teams.away.id)}</section></div>`}catch{box.innerHTML='<div class="detail-empty">Riwayat pertandingan belum tersedia.</div>'}
};


const _baseStandings=standings;
standings=async function(){
  if(new URLSearchParams(location.search).get('league'))return _baseStandings();
  app.innerHTML='<div class="loading"><span></span> Memuat klasemen...</div>';
  try{const d=await api('/api/football/leagues?current=true'),all=d.response||[],countries=Object.values(all.reduce((a,x)=>{const k=x.country?.name||'World';(a[k]??={name:k,flag:x.country?.flag,items:[]}).items.push(x);return a},{})).sort((a,b)=>a.name.localeCompare(b.name)),ad=adFor('standings','all');app.innerHTML=`<div class="container standings-sarang"><div class="sport-tabs"><b>Sepak Bola</b><span>Bola Basket</span><span>Bola Voli</span><span>Baseball</span><span>Tenis</span><span>Badminton</span><span>Hockey</span></div><h1>Klasemen Sepak Bola</h1><div class="standings-sarang-layout"><main><div class="cards league-cards sarang-league-grid">${leagueCards()}</div><div class="country-heading"><h2>Semua Liga</h2><input class="field" id="leagueSearch" placeholder="⌕ Cari liga atau negara..."></div><div id="countries" class="countries">${countries.map(c=>`<details class="panel country"><summary>${c.flag?`<img src="${c.flag}">`:''}<b>${esc(c.name)}</b><span>${c.items.length}</span><i>⌄</i></summary><div class="country-leagues">${c.items.map(x=>`<a href="/klasemen?league=${x.league.id}"><img src="${esc(x.league.logo||'/favicon.svg')}"><span>${esc(x.league.name)}</span><b>›</b></a>`).join('')}</div></details>`).join('')}</div></main><aside>${ad?.media?adMarkup(ad,'standings-side-ad'):''}</aside></div></div>`;document.querySelector('#leagueSearch').oninput=e=>{const q=e.target.value.toLowerCase();document.querySelectorAll('.country').forEach(x=>x.hidden=!x.textContent.toLowerCase().includes(q))}}catch(e){app.innerHTML=configError(e)}};
