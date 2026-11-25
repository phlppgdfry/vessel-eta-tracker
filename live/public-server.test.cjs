const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { WebSocketServer } = require('ws');
const { createSnapshotHandler } = require('./snapshot.cjs');
const { publicMessage } = require('./public-server.cjs');
const FIXTURE = { MessageType:'PositionReport', MetaData:{MMSI:477307900,
  ShipName:'<img> LIVE VESSEL',latitude:51.5,longitude:2.9,secret:'private'},
  Message:{PositionReport:{Sog:12,Cog:120,private:'private'}},APIKey:'private' };
async function fixture(t, options={}) {
  const provider = new WebSocketServer({port:0,host:'127.0.0.1'});
  await once(provider,'listening');
  const handler = createSnapshotHandler({key:'test-server-secret',
    url:`ws://127.0.0.1:${provider.address().port}`,collectMs:40,handshakeMs:1000,...options});
  const server = http.createServer(handler);
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  t.after(()=>{server.closeAllConnections();server.close();provider.clients.forEach(c=>c.terminate());provider.close();});
  return {provider,url:`http://127.0.0.1:${server.address().port}/api/live`};
}
test('missing credentials fail explicitly and are never requested from visitors', async t=>{
  const {url}=await fixture(t,{key:''});
  const r=await fetch(url);assert.equal(r.status,503);
  assert.deepEqual(await r.json(),{source:'AISStream',error:'not_configured'});
  assert.equal(r.headers.get('cache-control'),'no-store');
});
test('shares collection across concurrent requests and caches only validated public data',async t=>{
  const {url,provider}=await fixture(t);let connections=0;
  provider.on('connection',socket=>{connections++;socket.on('message',raw=>{
    const sub=JSON.parse(String(raw));assert.equal(sub.APIKey,'test-server-secret');
    assert.deepEqual(sub.BoundingBoxes,[[[50.8,1.5],[52.2,4.8]]]);
    socket.send(JSON.stringify(FIXTURE));
  });});
  const results=await Promise.all([fetch(url),fetch(url)]);
  for(const r of results){assert.equal(r.status,200);assert.equal(r.headers.get('access-control-allow-origin'),'*');
    const body=await r.json();assert.equal(body.mode,'live');assert.equal(body.operationalSchedule,false);
    assert.equal(body.messages.length,1);assert.equal(body.messages[0].MetaData.MMSI,477307900);
    assert.ok(!JSON.stringify(body).includes('private'));assert.ok(!JSON.stringify(body).includes('test-server-secret'));
    assert.ok(!body.messages[0].MetaData.ShipName.includes('<'));
  }
  await fetch(url);assert.equal(connections,1);
  await new Promise(resolve=>setTimeout(resolve,30));assert.equal(provider.clients.size,0,'upstream must be closed before the response completes');
});
test('client submissions never create or alter a provider subscription',async t=>{
  const {url,provider}=await fixture(t);let connections=0;provider.on('connection',()=>connections++);
  const r=await fetch(url,{method:'POST',body:'{"APIKey":"attacker"}'});
  assert.equal(r.status,405);assert.equal(connections,0);
});
test('provider errors return a fixed reason, never the raw error or secret',async t=>{
  const {url,provider}=await fixture(t);
  provider.on('connection',socket=>socket.on('message',()=>socket.send('{"error":"invalid test-server-secret"}')));
  const r=await fetch(url);assert.equal(r.status,503);const data=await r.json();
  assert.equal(data.reason,'provider_rejected');assert.ok(!JSON.stringify(data).includes('test-server-secret'));
});
test('an empty feed times out, closes upstream and never substitutes demo ships',async t=>{
  const {url,provider}=await fixture(t,{collectMs:20});
  const r=await fetch(url);assert.equal(r.status,503);
  assert.equal((await r.json()).reason,'no_data');
  await new Promise(resolve=>setTimeout(resolve,30));assert.equal(provider.clients.size,0);
});
test('cached snapshots expire and require a new real collection',async t=>{
  const {url,provider}=await fixture(t,{cacheMs:1,collectMs:10});let connections=0;
  provider.on('connection',socket=>{connections++;socket.on('message',()=>socket.send(JSON.stringify(FIXTURE)));});
  assert.equal((await fetch(url)).status,200);
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal((await fetch(url)).status,200);assert.equal(connections,2);
});
test('invalid MMSI, out-of-area positions and AIS unavailable values are filtered',()=>{
  assert.equal(publicMessage(JSON.stringify({error:'private'})),null);
  assert.equal(publicMessage(JSON.stringify({...FIXTURE,MetaData:{...FIXTURE.MetaData,latitude:91}})),null);
  assert.equal(publicMessage(JSON.stringify({...FIXTURE,MetaData:{...FIXTURE.MetaData,MMSI:'x'}})),null);
  const current = publicMessage(JSON.stringify({...FIXTURE,MetaData:{MMSI:477307900,ShipName:'CURRENT',Latitude:51.5,Longitude:2.9}}));
  assert.equal(current.MetaData.latitude,51.5);assert.equal(current.MetaData.longitude,2.9);
  const msg=publicMessage(JSON.stringify({...FIXTURE,Message:{PositionReport:{Sog:102.3,Cog:360}}}));
  assert.equal(msg.Message.PositionReport.Sog,0);assert.equal(msg.Message.PositionReport.Cog,null);
});
