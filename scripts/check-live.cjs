// Probe the public endpoint only. No credential is read or accepted by this script.
const { WebSocket } = require('ws');
const socket = new WebSocket('wss://vessel-eta-live.vercel.app/api/live', {
  origin: 'https://phlppgdfry.github.io', handshakeTimeout: 15000,
});
let finished = false;
let count = 0; const vessels = new Set();
const timeout = setTimeout(() => finish(false, 'No real AIS received within 30 seconds'), 30000);
function finish(ok, message) {
  if (finished) return; finished = true;
  clearTimeout(timeout); socket.terminate();
  console.log(JSON.stringify({ ok, message, messages: count, uniqueVessels: vessels.size }));
  process.exitCode = ok ? 0 : 1;
}
socket.on('message', raw => {
  const msg = JSON.parse(String(raw));
  if (msg.relay === 'unavailable') return finish(false, 'Upstream unavailable');
  if (!msg.MessageType) return;
  count++; vessels.add(msg.MetaData.MMSI);
  if (count >= 3) finish(true, 'Received real AIS positions through the public relay');
});
socket.on('error', () => finish(false, 'Public WebSocket connection failed'));
