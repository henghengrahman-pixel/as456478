const clean=(v,n=1000)=>String(v??'').trim().slice(0,n);
const lowerKey=k=>String(k||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const normName=s=>clean(s,220).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();

export function createOddsProvider(env=process.env, fetchImpl=fetch){
  const cache={list:null,listAt:0,detail:new Map(),discovery:null,lastError:'',lastHttp:null};
  const cacheSeconds=()=>Math.max(3,Math.min(300,Number(env.ODDS_CACHE_SECONDS||10)||10));
  const bearer=()=>String(env.ODDS_BEARER_TOKEN||'').trim();
  const cookie=()=>String(env.ODDS_COOKIE||'').trim();
  const xReal=()=>String(env.ODDS_X_REAL_LD||'').trim();
  const referer=()=>clean(env.ODDS_REFERER||'https://u4l3ia.lczdldhn.com/',1000);
  const configured=()=>Boolean(bearer()||cookie());
  function origin(){
    for(const v of [env.ODDS_BASE_URL,env.ODDS_MARKETS_URL,env.ODDS_API_URL]){try{if(v)return new URL(v).origin}catch{}}
    return 'https://u4l3br.lczdldhn.com';
  }
  function extraHeaders(){try{const x=JSON.parse(String(env.ODDS_EXTRA_HEADERS||'{}'));return x&&typeof x==='object'&&!Array.isArray(x)?x:{}}catch{return {}}}
  function headers(contentType='application/x-www-form-urlencoded'){
    const h={accept:'application/json, text/plain, */*'};
    if(contentType)h['content-type']=contentType;
    if(bearer())h.authorization=/^bearer\s/i.test(bearer())?bearer():`Bearer ${bearer()}`;
    if(cookie())h.cookie=cookie();
    if(xReal())h['x-real-ld']=xReal();
    if(env.ODDS_CUSTID)h.custid=clean(env.ODDS_CUSTID,200);
    if(env.ODDS_USERNAME)h.username=clean(env.ODDS_USERNAME,200);
    if(env.ODDS_DEVICE_TYPE)h.devicetype=clean(env.ODDS_DEVICE_TYPE,80);
    if(referer()){h.referer=referer();try{h.origin=new URL(referer()).origin}catch{}}
    Object.assign(h,extraHeaders());
    return h;
  }
  async function request(url,{method='POST',bodyMode='empty',body=null,timeout=9000}={}){
    const opt={method,headers:headers(bodyMode==='json'?'application/json':'application/x-www-form-urlencoded'),signal:AbortSignal.timeout(timeout)};
    if(!['GET','HEAD'].includes(method)&&bodyMode!=='empty')opt.body=bodyMode==='json'?JSON.stringify(body??{}):String(body??'');
    const r=await fetchImpl(url,opt); const text=await r.text(); let data;
    try{data=JSON.parse(text)}catch{data={raw:text}}
    cache.lastHttp={url,status:r.status,ok:r.ok,at:new Date().toISOString()};
    if(!r.ok)throw Error(`HTTP ${r.status}${data?.message?`: ${data.message}`:''}`);
    if(data&&typeof data==='object'&&Number(data.errorCode||0)!==0)throw Error(data.errorMsg||`Provider error ${data.errorCode}`);
    return data;
  }
  const primitive=v=>['string','number'].includes(typeof v)?v:null;
  function deepObjects(root,max=25000){const out=[],stack=[root],seen=new Set();while(stack.length&&out.length<max){const x=stack.pop();if(!x||typeof x!=='object'||seen.has(x))continue;seen.add(x);if(Array.isArray(x)){for(const v of x)stack.push(v);continue}out.push(x);for(const v of Object.values(x))if(v&&typeof v==='object')stack.push(v)}return out}
  function getAny(o,names){if(!o||typeof o!=='object')return null;const map=new Map(Object.entries(o).map(([k,v])=>[lowerKey(k),v]));for(const n of names){const v=map.get(lowerKey(n));if(v!==undefined&&v!==null&&v!=='')return v}return null}
  function textAny(o,names){const v=getAny(o,names);if(typeof v==='object'&&v){return clean(v.name||v.title||v.displayName||v.teamName||'',220)}return clean(primitive(v),220)}
  function numberAny(o,names){const v=getAny(o,names);if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:clean(v,80)}
  function scoreObject(o){const keys=Object.keys(o||{}).map(lowerKey);let s=0;for(const k of keys){if(/matchid|eventid|fixtureid/.test(k))s+=3;if(/home(team|name)?|team1|hometeam/.test(k))s+=3;if(/away(team|name)?|team2|awayteam/.test(k))s+=3;if(/league|competition|tournament/.test(k))s+=2;if(/market|odds|price|handicap|spread|over|under/.test(k))s+=1}return s}
  function responseScore(data){let best=0,good=0;for(const o of deepObjects(data,5000)){const s=scoreObject(o);best=Math.max(best,s);if(s>=6)good++}return best+Math.min(20,good)}
  function candidateUrls(){
    const O=origin().replace(/\/$/,'');const explicit=[env.ODDS_MARKETS_URL,env.ODDS_SHOW_ALL_URL].filter(Boolean);
    const controllers=['Odds','Market','Markets','Sports','Betting','Event','Events','Bet','OddsLibrary','OddsService','MarketService'];
    const paths=['/api/GetMarkets','/api/GetMarket','/api/ShowAllOdds'];
    for(const c of controllers){paths.push(`/api/${c}/GetMarkets`,`/api/${c}/GetMarket`,`/api/${c}/ShowAllOdds`)}
    return [...new Set([...explicit,...paths.map(p=>O+p)])];
  }
  async function discover(){
    if(env.ODDS_MARKETS_URL)return {url:env.ODDS_MARKETS_URL,method:clean(env.ODDS_MARKETS_METHOD||'POST',10).toUpperCase(),source:'env'};
    if(cache.discovery)return cache.discovery;
    const failures=[];
    for(const url of candidateUrls()){
      for(const method of ['POST','GET']){
        try{const data=await request(url,{method,bodyMode:'empty',timeout:4500});const score=responseScore(data);if(score>=6){cache.discovery={url,method,source:'auto',score};return cache.discovery}failures.push(`${method} ${new URL(url).pathname}:score=${score}`)}catch(e){failures.push(`${method} ${new URL(url).pathname}:${e.message}`)}
      }
    }
    throw Error('Endpoint daftar pertandingan belum ditemukan otomatis. Isi ODDS_MARKETS_URL dari Network → GetMarkets/ShowAllOdds.');
  }
  function idOf(o){return clean(getAny(o,['matchId','match_id','MatchId','eventId','event_id','EventId','fixtureId','fixture_id','id','Id']),120)}
  function homeOf(o){return textAny(o,['homeName','home_name','homeTeamName','HomeTeamName','homeTeam','HomeTeam','home','Home','team1','Team1','hostName','host'])}
  function awayOf(o){return textAny(o,['awayName','away_name','awayTeamName','AwayTeamName','awayTeam','AwayTeam','away','Away','team2','Team2','guestName','guest'])}
  function leagueOf(o){return textAny(o,['leagueName','league_name','LeagueName','league','League','competitionName','competition','tournamentName','tournament'])}
  function kickoffOf(o){const v=getAny(o,['kickoff','kickOff','startTime','start_time','matchTime','match_time','eventTime','event_time','date','datetime','beginTime','begin_time']);return primitive(v)==null?'':clean(v,100)}
  function normalizeMarketObject(o){
    const name=textAny(o,['marketName','market_name','name','betTypeName','bet_type_name','typeName','type','marketType','market_type','title'])||'Market';
    const line=getAny(o,['line','handicap','hdp','spread','point','total','goalLine','goal_line']);
    const selections=[];
    const direct=[['Home',['homeOdds','home_odds','homePrice','home_price','price1','odd1']],['Draw',['drawOdds','draw_odds','drawPrice','draw_price','priceX','oddX']],['Away',['awayOdds','away_odds','awayPrice','away_price','price2','odd2']],['Over',['overOdds','over_odds','overPrice','over_price']],['Under',['underOdds','under_odds','underPrice','under_price']]];
    for(const [label,keys] of direct){const v=numberAny(o,keys);if(v!==null)selections.push({label,odds:v})}
    const arr=getAny(o,['selections','selection','outcomes','outcome','options','option','odds','prices','priceList','betOptions']);
    if(Array.isArray(arr))for(const x of arr){if(x&&typeof x==='object'){const label=textAny(x,['name','label','selectionName','selection_name','outcomeName','outcome_name','runnerName','runner_name','key','side']);const odds=numberAny(x,['odds','odd','price','value','decimalOdds','decimal_odds','rate']);if(label||odds!==null)selections.push({label:label||'Pilihan',odds,line:getAny(x,['line','handicap','hdp','point'])??null})}}
    return {name,line:line??null,selections};
  }
  function collectMarkets(o){const markets=[];const candidates=[getAny(o,['markets','marketList','market_list','betTypes','bet_types','oddsList','odds_list']),o];for(const c of candidates){if(Array.isArray(c)){for(const m of c)if(m&&typeof m==='object')markets.push(normalizeMarketObject(m))}else if(c&&typeof c==='object'&&scoreObject(c)>0){const m=normalizeMarketObject(c);if(m.selections.length||m.line!=null)markets.push(m)}}const seen=new Set();return markets.filter(m=>{const k=JSON.stringify(m);if(seen.has(k))return false;seen.add(k);return m.selections.length||m.line!=null}).slice(0,200)}
  function normalizeMatch(o){const id=idOf(o),home=homeOf(o),away=awayOf(o),league=leagueOf(o),kickoff=kickoffOf(o),markets=collectMarkets(o);if(!id&&!home&&!away)return null;return {matchId:id,eventId:id,league:league||'Sepak Bola',home,away,kickoff,markets,raw:o}}
  function normalizeList(data){
    const rows=[];for(const o of deepObjects(data)){const m=normalizeMatch(o);if(!m)continue;if((m.home&&m.away)||(m.matchId&&scoreObject(o)>=4))rows.push(m)}
    const uniq=new Map();for(const m of rows){const k=m.matchId||`${normName(m.home)}|${normName(m.away)}|${m.kickoff}`;const old=uniq.get(k);if(!old||m.markets.length>old.markets.length)uniq.set(k,m)}
    return [...uniq.values()].slice(0,3000);
  }
  function publicMatch(m){if(!m)return null;const {raw,...x}=m;return x}
  async function list(force=false){
    if(!configured())return {configured:false,ready:false,matches:[],count:0,message:'ODDS_BEARER_TOKEN atau ODDS_COOKIE belum diatur'};
    if(!force&&cache.list&&Date.now()-cache.listAt<cacheSeconds()*1000)return cache.list;
    try{const d=await discover(),raw=await request(d.url,{method:d.method,bodyMode:'empty'}),matches=normalizeList(raw).map(publicMatch);const result={configured:true,ready:matches.length>0,upstreamOk:true,endpoint:d.url,method:d.method,discovery:d.source,count:matches.length,matches,message:matches.length?'':'Provider merespons tetapi daftar pertandingan belum terbaca.'};cache.list=result;cache.listAt=Date.now();cache.lastError='';return result}catch(e){cache.lastError=e.message;if(cache.list)return {...cache.list,stale:true,warning:e.message};throw e}
  }
  function detailUrl(matchId,listEndpoint){
    if(env.ODDS_MARKET_BY_MATCH_URL)return String(env.ODDS_MARKET_BY_MATCH_URL).replace('{matchId}',encodeURIComponent(matchId));
    try{const u=new URL(listEndpoint||origin());const p=u.pathname;const idx=p.lastIndexOf('/');u.pathname=p.slice(0,idx+1)+'GetMarketByMatchId';u.search='';u.searchParams.set('matchId',matchId);return u.href}catch{return `${origin()}/api/Market/GetMarketByMatchId?matchId=${encodeURIComponent(matchId)}`}
  }
  async function detail(matchId,{force=false}={}){
    matchId=clean(matchId,120);if(!matchId)throw Error('matchId diperlukan');const cached=cache.detail.get(matchId);if(!force&&cached&&Date.now()-cached.at<cacheSeconds()*1000)return cached.data;
    const l=await list(false);let base=l.endpoint;const candidates=[detailUrl(matchId,base)];
    if(!env.ODDS_MARKET_BY_MATCH_URL){const O=origin();for(const c of ['Market','Markets','Odds','Sports','Betting','Event','Events','Bet'])candidates.push(`${O}/api/${c}/GetMarketByMatchId?matchId=${encodeURIComponent(matchId)}`);candidates.push(`${O}/api/GetMarketByMatchId?matchId=${encodeURIComponent(matchId)}`)}
    let last='';for(const url of [...new Set(candidates)])for(const method of ['GET','POST']){try{const raw=await request(url,{method,bodyMode:'empty',timeout:5000});const matches=normalizeList(raw);let m=matches.find(x=>x.matchId===matchId)||matches[0];if(!m){const markets=deepObjects(raw).map(normalizeMarketObject).filter(x=>x.selections.length||x.line!=null);const fromList=l.matches.find(x=>x.matchId===matchId);if(markets.length)m={...(fromList||{matchId,eventId:matchId,league:'Sepak Bola',home:'',away:'',kickoff:''}),markets}}if(m){const data={ok:true,ready:true,match:publicMatch(m),endpoint:url,method};cache.detail.set(matchId,{at:Date.now(),data});return data}}catch(e){last=e.message}}
    const fromList=l.matches.find(x=>x.matchId===matchId);if(fromList)return {ok:true,ready:true,match:fromList,endpoint:l.endpoint,method:l.method,fallback:true};throw Error(last||'Detail odds pertandingan belum ditemukan');
  }
  function status(){return {configured:configured(),cacheSeconds:cacheSeconds(),origin:origin(),discovery:cache.discovery,lastError:cache.lastError,lastHttp:cache.lastHttp}}
  return {configured,list,detail,status,normalizeList,responseScore};
}
