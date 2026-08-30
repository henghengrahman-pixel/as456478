import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('server, auth, admin, stream filtering, ads and public pages',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bola-utama-'));
  const port=19000+Math.floor(Math.random()*1000);
  const proc=spawn(process.execPath,['server.js'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),DATA_DIR:dir,JWT_SECRET:'test-secret-value-123456789',ADMIN_PASSWORD:'TestingPassword123',FOOTBALL_API_KEY:'',LIVE_FOOTBALL_API_KEY:''}});
  t.after(()=>proc.kill());
  await new Promise((resolve,reject)=>{const end=Date.now()+8000;(function ping(){fetch(`http://127.0.0.1:${port}/health`).then(r=>r.ok&&resolve()).catch(()=>{});if(Date.now()>end)return reject(Error('server timeout'));setTimeout(ping,100)})()});
  const base=`http://127.0.0.1:${port}`;
  const health=await fetch(base+'/health').then(r=>r.json());
  assert.equal(health.ok,true);
  assert.equal(health.streamProvider,'admin-fallback');
  assert.equal(health.liveFootballApiReady,false);
  for(const route of ['/','/livescore','/prediksi','/klasemen','/berita','/login','/register','/admin','/match/example']){
    const response=await fetch(base+route);
    assert.equal(response.status,200,route);
    assert.match(await response.text(),/BOLA UTAMA/);
  }
  const badFixture=await fetch(base+'/api/fixture/South-East-vs-Cairns/events');
  assert.equal(badFixture.status,400);
  assert.match((await badFixture.json()).error,/tidak valid/);
  const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'admin',password:'TestingPassword123'})});
  assert.equal(login.status,200);
  const cookie=login.headers.get('set-cookie').split(';')[0];
  const headers={cookie,'content-type':'application/json'};
  const create=body=>fetch(base+'/api/admin/streams',{method:'POST',headers,body:JSON.stringify(body)}).then(r=>r.json());
  await create({league:'Premier League',homeName:'Arsenal',awayName:'Chelsea',streamUrl:'https://example.com/live.m3u8',active:true,status:'live'});
  const rejected=await fetch(base+'/api/admin/streams',{method:'POST',headers,body:JSON.stringify({league:'ONE Friday Fights',homeName:'ONE Championship',awayName:'One Championships',streamUrl:'https://example.com/fight.m3u8',active:true,status:'live'})});
  assert.equal(rejected.status,400);
  const streams=await fetch(base+'/api/streams').then(r=>r.json());
  assert.equal(streams.provider,'admin-fallback');
  assert.equal(streams.matches.length,1);
  assert.equal(streams.matches[0].stream_provider,'admin');
  assert.equal(streams.matches[0].home_team_name,'Arsenal');
  const resolved=await fetch(base+`/api/stream/resolve/${streams.matches[0].id}`).then(r=>r.json());
  assert.equal(resolved.servers.length,1);
  assert.match(resolved.servers[0].playUrl,/^\/api\/stream\/proxy\?token=/);
  const ad=await fetch(base+'/api/admin/ads',{method:'POST',headers,body:JSON.stringify({title:'Banner Live',placement:'top',type:'image',media:'/uploads/ad.webp',active:true})}).then(r=>r.json());
  assert.equal(ad.ok,true);
  const adminState=await fetch(base+'/api/admin/state',{headers:{cookie}}).then(r=>r.json());
  assert.equal(adminState.streams.length,1);
  assert.equal(adminState.ads.length,1);
  const settings=await fetch(base+'/api/admin/settings',{method:'PUT',headers,body:JSON.stringify({siteName:'BOLA UTAMA'})}).then(r=>r.json());
  assert.equal(settings.ok,true);
  await new Promise(r=>setTimeout(r,180));
  assert.equal(fs.existsSync(path.join(dir,'bola-utama.json')),true);
});


test('1xAPI RapidAPI is live source, football-only, live + upcoming only',async t=>{
  const now=Math.floor(Date.now()/1000);
  let calls=0;
  const provider=http.createServer((req,res)=>{
    res.setHeader('content-type','application/json');
    calls++;
    res.end(JSON.stringify({data:{matches:[
      {match_id:'live-football',sport:'football',status:'live',league_name:'Premier League',home_team_name:'Arsenal',away_team_name:'Chelsea',timestamp:now-1800,score_home:2,score_away:1,elapsed:67,streams:[{name:'Main',url:'https://video.test/live.m3u8',type:'hls'}]},
      {match_id:'upcoming-football',sport:'soccer',status:'scheduled',league_name:'La Liga',home_team_name:'Barcelona',away_team_name:'Real Madrid',timestamp:now+3600,streams:[{name:'Server A',url:'https://video.test/upcoming.m3u8',type:'hls'}]},
      {match_id:'mma',sport:'mma',status:'live',league_name:'UFC',home_team_name:'Fighter A',away_team_name:'Fighter B',timestamp:now,streams:[{url:'https://video.test/mma.m3u8'}]},
      {match_id:'finished',sport:'football',status:'finished',league_name:'Serie A',home_team_name:'Milan',away_team_name:'Inter',timestamp:now-7200,streams:[{url:'https://video.test/ft.m3u8'}]},
      {match_id:'far',sport:'football',status:'scheduled',league_name:'Bundesliga',home_team_name:'Bayern',away_team_name:'Dortmund',timestamp:now+72*3600,streams:[{url:'https://video.test/far.m3u8'}]}
    ]}}));
  });
  await new Promise(resolve=>provider.listen(0,'127.0.0.1',resolve));
  t.after(()=>provider.close());
  const providerPort=provider.address().port;
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bola-rapidapi-'));
  const port=21000+Math.floor(Math.random()*1000);
  const proc=spawn(process.execPath,['server.js'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),DATA_DIR:dir,JWT_SECRET:'test-secret-value-123456789',ADMIN_PASSWORD:'TestingPassword123',FOOTBALL_API_KEY:'',LIVE_FOOTBALL_API_KEY:'',SCOREBAT_TOKEN:'',RAPIDAPI_KEY:'rapid-test',STREAM_API_HOST:'fake.rapidapi.test',STREAM_API_BASE:`http://127.0.0.1:${providerPort}`,STREAM_MATCHES_PATH:'/matches',STREAM_CACHE_SECONDS:'120',STREAM_UPCOMING_HOURS:'24'}});
  t.after(()=>proc.kill());
  await new Promise((resolve,reject)=>{const end=Date.now()+8000;(function ping(){fetch(`http://127.0.0.1:${port}/health`).then(r=>r.ok&&resolve()).catch(()=>{});if(Date.now()>end)return reject(Error('server timeout'));setTimeout(ping,100)})()});
  const base=`http://127.0.0.1:${port}`;
  const health=await fetch(base+'/health').then(r=>r.json());
  assert.equal(health.streamProvider,'rapidapi-1xapi');
  assert.equal(health.streamApiReady,true);
  const streams=await fetch(base+'/api/streams').then(r=>r.json());
  assert.equal(streams.ok,true);
  assert.equal(streams.provider,'rapidapi-1xapi+admin-fallback');
  assert.equal(streams.matches.length,2);
  assert.deepEqual(streams.matches.map(x=>x.match_id),['live-football','upcoming-football']);
  assert.equal(streams.matches[0].match_status,'live');
  assert.equal(streams.matches[1].match_status,'upcoming');
  assert.equal(streams.live,1);
  assert.equal(streams.upcoming,1);
  const resolved=await fetch(base+'/api/stream/resolve/live-football').then(r=>r.json());
  assert.equal(resolved.ok,true);
  assert.equal(resolved.provider,'rapidapi-1xapi');
  assert.equal(resolved.servers.length,1);
  assert.match(resolved.servers[0].playUrl,/^\/api\/stream\/proxy\?token=/);
  await Promise.all(Array.from({length:4},()=>fetch(base+'/api/streams').then(r=>r.json())));
  assert.equal(calls,1);
});
