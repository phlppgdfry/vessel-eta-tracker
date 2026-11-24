// Public, read-only AIS relay. Credentials and subscriptions never come from clients.
const http = require('node:http');
const { WebSocket, WebSocketServer } = require('ws');
const AIS_URL = 'wss://stream.aisstream.io/v0/stream';
const BOUNDS = [[50.8, 1.5], [52.2, 4.8]];
const TYPES = ['PositionReport', 'StandardClassBPositionReport', 'ShipStaticData'];
const text = value => String(value ?? '').replace(/[<>&"'`]/g, ' ').trim().slice(0, 100);

function publicMessage(raw) {
  const msg = JSON.parse(String(raw));
  const meta = msg.MetaData;
  const type = msg.MessageType;
  const body = msg.Message?.[type];
  if (!meta || !body || !TYPES.includes(type)) return null;
  const mmsi = String(meta.MMSI);
  const lat = meta.latitude, lon = meta.longitude;
  if (!/^\d{9}$/.test(mmsi) || !Number.isFinite(lat) || !Number.isFinite(lon) ||
      lat < BOUNDS[0][0] || lat > BOUNDS[1][0] || lon < BOUNDS[0][1] || lon > BOUNDS[1][1]) return null;
  const position = type !== 'ShipStaticData';
  const fields = position
    ? { Sog: Number.isFinite(body.Sog) && body.Sog >= 0 && body.Sog < 102.3 ? body.Sog : 0,
        Cog: Number.isFinite(body.Cog) && body.Cog >= 0 && body.Cog < 360 ? body.Cog : null }
    : { Name: text(body.Name), Destination: text(body.Destination),
        Type: Number.isInteger(body.Type) && body.Type >= 0 && body.Type <= 99 ? body.Type : 0 };
  return { MessageType: type, MetaData: { MMSI: Number(mmsi), ShipName: text(meta.ShipName),
    latitude: lat, longitude: lon, time_utc: text(meta.time_utc) }, Message: { [type]: fields } };
}

function createPublicServer({ key = process.env.AISSTREAM_API_KEY, upstreamUrl = AIS_URL,
  origins = ['https://phlppgdfry.github.io', 'https://vessel-eta-live.vercel.app'],
  maxClients = 40, sessionMs = 240000, idleMs = 45000 } = {}) {
  const clients = new Set();
  const latest = new Map();
  let upstream = null, idleTimer = null, shuttingDown = false;
  const server = http.createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(req.method === 'GET' ? (key ? 200 : 503) : 405);
    res.end(JSON.stringify({ source: 'AISStream', configured: Boolean(key),
      mode: 'live', operationalSchedule: false }));
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024, perMessageDeflate: false });
  const send = (client, msg) => {
    if (client.readyState !== WebSocket.OPEN) return;
    if (client.bufferedAmount > 256000) { client.close(1013, 'Slow consumer'); return; }
    client.send(JSON.stringify(msg));
  };
  const broadcast = msg => clients.forEach(client => send(client, msg));
  function closeUpstream() {
    clearTimeout(idleTimer);
    if (upstream) { const old = upstream; upstream = null; old.terminate(); }
  }
  function unavailable() {
    closeUpstream();
    broadcast({ relay: 'unavailable' });
    clients.forEach(client => client.close(1013, 'AIS feed unavailable; retry later'));
  }
  function watch() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(unavailable, idleMs);
    idleTimer.unref?.();
  }
  function connect() {
    if (upstream || !clients.size || shuttingDown) return;
    const feed = new WebSocket(upstreamUrl, { handshakeTimeout: 10000, maxPayload: 65536 });
    upstream = feed;
    watch();
    feed.on('open', () => {
      if (upstream !== feed) return;
      feed.send(JSON.stringify({ APIKey: key, BoundingBoxes: [BOUNDS], FilterMessageTypes: TYPES }));
    });
    feed.on('message', raw => {
      if (upstream !== feed) return;
      try {
        const parsed = JSON.parse(String(raw));
        if (parsed.error || parsed.Error) { unavailable(); return; }
        const msg = publicMessage(raw);
        if (!msg) return;
        watch();
        const id = msg.MetaData.MMSI + ':' + msg.MessageType;
        latest.delete(id); latest.set(id, { msg, received: Date.now() });
        while (latest.size > 240) latest.delete(latest.keys().next().value);
        broadcast(msg);
      } catch { /* Malformed provider messages never reach visitors or logs. */ }
    });
    feed.on('error', () => { if (upstream === feed) unavailable(); });
    feed.on('close', () => { if (upstream === feed) unavailable(); });
  }
  server.on('upgrade', (req, socket, head) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    const allowed = origins.includes(req.headers.origin);
    const status = !allowed || path !== '/api/live' ? 403 : !key ? 503 : clients.size >= maxClients ? 429 : 0;
    if (status) { socket.end(`HTTP/1.1 ${status} Rejected\r\nConnection: close\r\n\r\n`); return; }
    wss.handleUpgrade(req, socket, head, client => wss.emit('connection', client));
  });
  wss.on('connection', client => {
    clients.add(client);
    send(client, { relay: 'waiting', source: 'AISStream', operationalSchedule: false });
    for (const entry of latest.values()) if (Date.now() - entry.received < 60000) send(client, entry.msg);
    const expiry = setTimeout(() => client.close(1001, 'Refresh session'), sessionMs);
    expiry.unref?.();
    // Read-only. Reject client subscriptions rather than forwarding arbitrary data.
    client.on('message', () => client.close(1008, 'Read-only feed'));
    client.on('error', () => client.terminate());
    client.on('close', () => {
      clearTimeout(expiry); clients.delete(client);
      if (!clients.size) { closeUpstream(); latest.clear(); }
    });
    connect();
  });
  server.shutdown = () => {
    shuttingDown = true; closeUpstream();
    clients.forEach(client => client.terminate());
    wss.close(); server.close();
  };
  return server;
}
module.exports = { createPublicServer, publicMessage };
