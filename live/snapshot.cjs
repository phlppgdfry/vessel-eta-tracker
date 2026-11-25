const { WebSocket } = require('ws');
const { publicMessage, AIS_URL, BOUNDS, TYPES } = require('./public-server.cjs');

function collect({ key, url = AIS_URL, collectMs = 7000, handshakeMs = 25000 }) {
  return new Promise((resolve, reject) => {
    const messages = new Map();
    const socket = new WebSocket(url, { handshakeTimeout: handshakeMs, maxPayload: 65536, perMessageDeflate: true });
    let timer, done = false;
    function finish(reason) {
      if (done) return; done = true; clearTimeout(timer);
      // Destroy the upstream before resolving: no background sockets after HTTP completes.
      socket.terminate();
      if (reason || !messages.size) { reject(new Error(reason || 'no_data')); return; }
      resolve({ source: 'AISStream', mode: 'live', collectedAt: new Date().toISOString(),
        operationalSchedule: false, messages: [...messages.values()] });
    }
    socket.on('open', () => {
      socket.send(JSON.stringify({ APIKey: key, BoundingBoxes: [BOUNDS], FilterMessageTypes: TYPES }));
      timer = setTimeout(() => finish(), collectMs);
    });
    socket.on('message', raw => {
      try {
        const parsed = JSON.parse(String(raw));
        if (parsed.error || parsed.Error) { finish('provider_rejected'); return; }
        const msg = publicMessage(raw);
        if (!msg) return;
        msg.ReceivedAt = Date.now();
        const id = msg.MetaData.MMSI + ':' + msg.MessageType;
        messages.delete(id); messages.set(id, msg);
        if (messages.size > 240) messages.delete(messages.keys().next().value);
      } catch { /* Never forward raw provider content. */ }
    });
    socket.on('close', () => { if (!done) finish('provider_closed'); });
    socket.on('error', error => {
      const code = /opening handshake has timed out/i.test(error.message) ? 'handshake_timeout'
        : ['ENOTFOUND','ECONNRESET','ETIMEDOUT','EAI_AGAIN','ECONNREFUSED'].includes(error.code)
        ? error.code : 'network_error';
      finish(code);
    });
  });
}

function createSnapshotHandler({ key = process.env.AISSTREAM_API_KEY, url = AIS_URL,
  collectMs = 7000, handshakeMs = 25000, cacheMs = 30000 } = {}) {
  let cache = null, pending = null, lastFailure = 0, failureReason = null;
  return async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); // Intentionally public vessel data; no credentials.
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const reply = (status, data) => { res.statusCode = status; res.end(JSON.stringify(data)); };
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return reply(405, { error: 'method_not_allowed' }); }
    if (!key) return reply(503, { source: 'AISStream', error: 'not_configured' });
    try {
      if (!cache || Date.now() - Date.parse(cache.collectedAt) >= cacheMs) {
        if (Date.now() - lastFailure < 10000) throw new Error(failureReason);
        if (!pending) pending = collect({ key, url, collectMs, handshakeMs })
          .then(value => { cache = value; return value; })
          .catch(error => { lastFailure = Date.now(); failureReason = error.message; throw error; })
          .finally(() => { pending = null; });
        await pending;
      }
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30');
      reply(200, cache);
    } catch (error) {
      // Error messages come only from the fixed enums above, never provider strings.
      res.setHeader('Retry-After', '15');
      reply(503, { source: 'AISStream', error: 'temporarily_unavailable', reason: error.message });
    }
  };
}
module.exports = { createSnapshotHandler, collect };
