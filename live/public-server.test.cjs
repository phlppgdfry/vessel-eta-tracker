const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { WebSocket, WebSocketServer } = require('ws');
const { createPublicServer, publicMessage } = require('./public-server.cjs');
const ORIGIN = 'https://phlppgdfry.github.io';
const FIXTURE = { MessageType: 'PositionReport', MetaData: { MMSI: 477307900,
  ShipName: '<img> LIVE VESSEL', latitude: 51.5, longitude: 2.9, secret: 'private' },
  Message: { PositionReport: { Sog: 12, Cog: 120, private: 'private' } }, APIKey: 'private' };
async function fixture(t, options = {}) {
  const provider = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  await once(provider, 'listening');
  const server = createPublicServer({ key: 'test-server-secret',
    upstreamUrl: `ws://127.0.0.1:${provider.address().port}`, ...options });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.shutdown(); provider.clients.forEach(c => c.terminate()); provider.close(); });
  const url = `ws://127.0.0.1:${server.address().port}/api/live`;
  return { provider, server, url, connect: () => new WebSocket(url, { origin: ORIGIN }) };
}
const nextAIS = socket => new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('No AIS')), 2000);
  socket.on('message', raw => { const msg = JSON.parse(String(raw)); if (msg.MessageType) { clearTimeout(timeout); resolve(msg); } });
});
test('public health reports a missing credential without exposing configuration', async t => {
  const { url } = await fixture(t, { key: '' });
  const response = await fetch(url.replace('ws:', 'http:'));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { source: 'AISStream', configured: false, mode: 'live', operationalSchedule: false });
});
test('rejects unrelated origins before creating an upstream connection', async t => {
  const { url, provider } = await fixture(t);
  let connections = 0; provider.on('connection', () => connections++);
  const socket = new WebSocket(url, { origin: 'https://other.test' });
  const [error] = await once(socket, 'error');
  assert.match(error.message, /403/); assert.equal(connections, 0);
});
test('shares a server-owned subscription and sends only validated public fields', async t => {
  const { connect, provider } = await fixture(t);
  const upstreamPromise = once(provider, 'connection');
  const first = connect(); const data1 = nextAIS(first);
  const [upstream] = await upstreamPromise;
  const [rawSubscription] = await once(upstream, 'message');
  const subscription = JSON.parse(String(rawSubscription));
  assert.equal(subscription.APIKey, 'test-server-secret');
  assert.deepEqual(subscription.BoundingBoxes, [[[50.8, 1.5], [52.2, 4.8]]]);
  const second = connect(); const data2 = nextAIS(second); await once(second, 'open');
  assert.equal(provider.clients.size, 1);
  upstream.send(JSON.stringify(FIXTURE));
  const messages = await Promise.all([data1, data2]);
  for (const msg of messages) {
    assert.equal(msg.MetaData.MMSI, 477307900);
    assert.ok(!JSON.stringify(msg).includes('private'));
    assert.ok(!JSON.stringify(msg).includes('test-server-secret'));
    assert.ok(!msg.MetaData.ShipName.includes('<'));
  }
});
test('client writes cannot change the provider subscription', async t => {
  const { connect, provider } = await fixture(t);
  const feedPromise = once(provider, 'connection');
  const socket = connect(); await once(socket, 'open');
  const [upstream] = await feedPromise;
  const closed = once(socket, 'close'); socket.send('{"APIKey":"attacker"}');
  const [code] = await closed; assert.equal(code, 1008);
  assert.ok(upstream.readyState !== WebSocket.OPEN || provider.clients.size <= 1);
});
test('provider errors close visitors without echoing secrets', async t => {
  const { connect, provider } = await fixture(t);
  const feedPromise = once(provider, 'connection');
  const socket = connect(); const messages = [];
  socket.on('message', raw => messages.push(String(raw)));
  const [upstream] = await feedPromise; await once(upstream, 'message');
  const closed = once(socket, 'close');
  upstream.send(JSON.stringify({ error: 'invalid test-server-secret' }));
  const [code] = await closed; assert.equal(code, 1013);
  assert.ok(messages.some(msg => msg.includes('unavailable')));
  assert.ok(!messages.join('').includes('test-server-secret'));
});
test('sessions expire within the function lifetime', async t => {
  const { connect } = await fixture(t, { sessionMs: 50 });
  const socket = connect(); const [code] = await once(socket, 'close'); assert.equal(code, 1001);
});
test('invalid positions, provider payloads and AIS unavailable values are filtered', () => {
  assert.equal(publicMessage(JSON.stringify({ error: 'private' })), null);
  assert.equal(publicMessage(JSON.stringify({ ...FIXTURE, MetaData: { ...FIXTURE.MetaData, latitude: 91 } })), null);
  assert.equal(publicMessage(JSON.stringify({ ...FIXTURE, MetaData: { ...FIXTURE.MetaData, MMSI: 'x' } })), null);
  const result = publicMessage(JSON.stringify({ ...FIXTURE, Message: { PositionReport: { Sog: 102.3, Cog: 360 } } }));
  assert.equal(result.Message.PositionReport.Sog, 0);
  assert.equal(result.Message.PositionReport.Cog, null);
});
