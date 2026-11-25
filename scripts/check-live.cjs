// Probe only public data. Never reads or accepts a credential.
(async () => {
  const response = await fetch('https://vessel-eta-live.vercel.app/api/live', {
    signal: AbortSignal.timeout(42000),
  });
  const data = await response.json();
  const messages = Array.isArray(data.messages) ? data.messages : [];
  const age = Date.now() - Date.parse(data.collectedAt);
  const ok = response.ok && messages.length > 0 && age >= 0 && age < 90000;
  console.log(JSON.stringify({ ok, status:response.status, messages:messages.length,
    uniqueVessels:new Set(messages.map(m=>m.MetaData.MMSI)).size,
    ageSeconds:Number.isFinite(age) ? Math.round(age/1000) : null,
    reason:ok ? 'Recent real AIS snapshot received' : data.reason || data.error || 'No recent data' }));
  process.exitCode = ok ? 0 : 1;
})().catch(() => { console.log(JSON.stringify({ok:false,reason:'Public snapshot request failed'})); process.exitCode=1; });
