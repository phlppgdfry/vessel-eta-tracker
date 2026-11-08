const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');

const port = 30000 + Math.floor(Math.random() * 10000);
const server = spawn(process.execPath, ['server.js'], {
  cwd: __dirname, env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
after(() => server.kill());
const ready = new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Server did not start')), 10000);
  server.stdout.on('data', () => { clearTimeout(timeout); resolve(); });
  server.on('error', reject);
  server.on('exit', code => { if (code) { clearTimeout(timeout); reject(new Error(`Server exited ${code}`)); } });
});

test('serves the public dashboard and manifest, including root query strings', async () => {
  await ready;
  for (const route of ['/', '/?demo=1', '/index.html']) {
    const response = await fetch(`http://127.0.0.1:${port}${route}`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /VesselETA/);
  }
  const response = await fetch(`http://127.0.0.1:${port}/manifest.json`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).short_name, 'VesselETA');
});

test('does not expose source, git metadata, environment files or local drafts', async () => {
  await ready;
  for (const route of ['/server.js', '/package.json', '/.env', '/.git/config', '/index-v2.html', '/%2e%2e/.env']) {
    const response = await fetch(`http://127.0.0.1:${port}${route}`);
    assert.equal(response.status, 404, route);
  }
});
