import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

test('server, auth, admin, stream filtering, ads and public pages',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bola-utama-'));
  const port=19000+Math.floor(Math.random()*1000);
  const proc=spawn(process.execPath,['server.js'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),DATA_DIR:dir,JWT_SECRET:'test-secret-value-123456789',ADMIN_PASSWORD:'TestingPassword123',FOOTBALL_API_KEY:'',LIVE_FOOTBALL_API_KEY:''}});
  t.after(()=>proc.kill());
  await new Promise((resolve,reject)=>{const end=Date.now()+8000;(function ping(){fetch(`http://127.0.0.1:${port}/health`).then(r=>r.ok&&resolve()).catch(()=>{});if(Date.now()>end)return reject(Error('server timeout'));setTimeout(ping,100)})()});
  const base=`http://127.0.0.1:${port}`;
  const health=await fetch(base+'/health').then(r=>r.json());
  assert.equal(health.ok,true);
  assert.equal(health.streamProvider,'admin-managed');
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
  assert.equal(streams.provider,'admin-managed');
  assert.equal(streams.matches.length,1);
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

test('RapidAPI streams are football-only and automatically linked to fixture details',async t=>{
  const fixture={fixture:{id:9001,date:'2026-08-28T13:00:00.000Z',status:{short:'2H',elapsed:67}},league:{id:39,name:'Premier League',season:2026},teams:{home:{id:42,name:'Arsenal',logo:'https://img.test/a.png'},away:{id:49,name:'Chelsea',logo:'https://img.test/c.png'}},goals:{home:2,away:1}};
  let rapidCalls=0;
  const fake=http.createServer((req,res)=>{res.setHeader('content-type','application/json');if(req.url.startsWith('/fixtures'))return res.end(JSON.stringify({response:[fixture]}));rapidCalls++;res.end(JSON.stringify({data:{matches:[
    {match_id:'football-1',sport:'football',match_status:'live',league:{name:'Premier League'},home:{name:'Arsenal',logo:'https://img.test/a.png'},away:{name:'Chelsea',logo:'https://img.test/c.png'},timestamp:1787922000,streams:[{name:'Utama',url:'https://video.test/live.m3u8',type:'hls'}]},
    {match_id:'fight-1',sport:'mma',match_status:'live',league_name:'ONE Championship',home_team_name:'Fighter A',away_team_name:'Fighter B',servers:[{url:'https://video.test/fight.m3u8'}]},
    {match_id:'rugby-1',sport:'rugby league',match_status:'live',league_name:'NRL Women',home_team_name:'Gold Coast Titans W',away_team_name:'Canberra Raiders W',servers:[{url:'https://video.test/rugby.m3u8'}]},
    {match_id:'basket-1',sport:{name:'Basketball'},match_status:'live',league_name:'NBA',home_team_name:'Lakers',away_team_name:'Celtics',servers:[{url:'https://video.test/basket.m3u8'}]}
  ]}}))});
  await new Promise(resolve=>fake.listen(0,'127.0.0.1',resolve));t.after(()=>fake.close());
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bola-rapid-')),port=20000+Math.floor(Math.random()*1000),fakePort=fake.address().port;
  const proc=spawn(process.execPath,['server.js'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),DATA_DIR:dir,JWT_SECRET:'test-secret-value-123456789',ADMIN_PASSWORD:'TestingPassword123',FOOTBALL_API_KEY:'football-key',FOOTBALL_API_BASE:`http://127.0.0.1:${fakePort}`,LIVE_FOOTBALL_API_KEY:'',RAPIDAPI_KEY:'test-key',STREAM_API_HOST:'fake.test',STREAM_API_BASE:`http://127.0.0.1:${fakePort}`,STREAM_MATCHES_PATH:'/matches'}});t.after(()=>proc.kill());
  await new Promise((resolve,reject)=>{const end=Date.now()+8000;(function ping(){fetch(`http://127.0.0.1:${port}/health`).then(r=>r.ok&&resolve()).catch(()=>{});if(Date.now()>end)return reject(Error('server timeout'));setTimeout(ping,100)})()});
  const base=`http://127.0.0.1:${port}`,health=await fetch(base+'/health').then(r=>r.json());assert.equal(health.streamProvider,'rapidapi');
  const responses=await Promise.all(Array.from({length:8},()=>fetch(base+'/api/streams').then(r=>r.json()))),streams=responses[0];assert.equal(rapidCalls,1);assert.equal(streams.ok,true);assert.equal(streams.matches.length,1);assert.equal(streams.matches[0].home_team_name,'Arsenal');assert.equal(streams.matches[0].league_name,'Premier League');assert.equal(streams.matches[0].fixtureId,'9001');assert.equal(streams.matches[0].score_home,2);assert.equal(streams.matches[0].score_away,1);assert.equal(streams.matches[0].elapsed,67);
  const resolved=await fetch(base+'/api/stream/resolve/football-1').then(r=>r.json());assert.equal(resolved.ok,true);assert.equal(resolved.servers.length,1);assert.match(resolved.servers[0].playUrl,/stream\/proxy/);
});
