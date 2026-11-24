const { test, expect } = require('@playwright/test');
async function downloaded(page, action) {
  const pending = page.waitForEvent('download'); await action(); const download = await pending;
  const stream = await download.createReadStream(); const chunks=[];
  for await (const chunk of stream) chunks.push(chunk);
  return {name:download.suggestedFilename(), data:Buffer.concat(chunks)};
}
test.beforeEach(async ({page}) => {
  page._errors=[]; page.on('pageerror',error=>page._errors.push(error.message));
});
test.afterEach(async ({page}) => { expect(page._errors).toEqual([]); });

test('simulation is readable, prioritised, searchable and exportable without a key', async ({page}) => {
  // Keep third-party weather and tile availability outside deterministic functional CI.
  await page.route('**/api.open-meteo.com/**',route=>route.abort());
  await page.route('**/tile.openstreetmap.org/**',route=>route.abort());
  await page.goto('/?mode=demo');
  const rows=page.locator('#vessel-list .vrow'); await expect(rows).toHaveCount(8);
  await expect(page.getByLabel('Sort vessels')).toHaveValue('attention');
  await expect(rows.first()).toContainText('Late');
  await page.locator('#ft-cargo').click(); await expect(rows).toHaveCount(8);
  await page.locator('#ft-tank').click(); await expect(rows).toHaveCount(0);
  await expect(page.getByText('No matches',{exact:true})).toBeVisible();
  await page.locator('#ft-all').click(); await expect(rows).toHaveCount(8);
  const name=await rows.first().locator('.vname').innerText();
  expect(await rows.first().locator('.vname').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(14);
  const search=page.getByLabel('Search vessels'); await search.fill(name); await expect(rows).toHaveCount(1);
  await rows.first().click();
  await search.fill('no-such-vessel'); await expect(page.getByText('No matches',{exact:true})).toBeVisible();
  await search.fill(''); await page.getByLabel('Sort vessels').selectOption('arrival'); await expect(rows).toHaveCount(8);
  const file=await downloaded(page,()=>page.getByTitle('Export CSV',{exact:true}).click());
  expect(file.name).toMatch(/\.csv$/); expect(file.data.toString()).toContain(name);
  expect(file.data.toString().trim().split(/\r?\n/)).toHaveLength(9);
});

test('settings control real map layers, validate thresholds and escape printable terminal text', async ({page}) => {
  await page.route('**/api.open-meteo.com/**',route=>route.abort());
  await page.route('**/tile.openstreetmap.org/**',route=>route.abort());
  await page.goto('/?mode=demo'); await expect(page.locator('#vessel-list .vrow')).toHaveCount(8);
  const settings=page.getByRole('button',{name:'Settings',exact:true}); await settings.click();
  const dialog=page.getByRole('dialog',{name:'Settings',exact:true});await expect(dialog).toBeVisible();
  for (const [name,key] of [['Approach lane','approach'],['Pilot station marker','pilot'],['Anchorage zone','anchorage']]) {
    const toggle=dialog.getByRole('switch',{name,exact:true});
    await toggle.click();await expect(toggle).not.toBeChecked();
    expect(await page.evaluate(key=>map.hasLayer(mapOverlays[key]),key)).toBe(false);
    await toggle.click();await expect(toggle).toBeChecked();
    expect(await page.evaluate(key=>map.hasLayer(mapOverlays[key]),key)).toBe(true);
  }
  await dialog.getByLabel('Warning threshold (min)',{exact:true}).fill('220');
  await dialog.getByRole('button',{name:'Apply Settings',exact:true}).click();
  await expect(dialog).toBeVisible();await expect(page.locator('#settings-error')).toContainText('greater than');
  await dialog.getByRole('switch',{name:'Berth conflict alerts',exact:true}).click();
  await dialog.getByRole('switch',{name:'Early arrival warnings',exact:true}).click();
  const alerts=await page.locator('#alerts-list .alert-row').count();
  await dialog.getByLabel('Warning threshold (min)',{exact:true}).fill('100');
  await dialog.getByLabel('Critical threshold (min)',{exact:true}).fill('200');
  const terminal='<img src=x onerror="window.injected=true">';
  await dialog.getByLabel('Terminal name',{exact:true}).fill(terminal);
  await dialog.getByRole('button',{name:'Apply Settings',exact:true}).click();
  await expect(dialog).not.toBeVisible();await expect(settings).toBeFocused();
  await expect(page.locator('#critical-threshold-label')).toContainText('200');await expect(page.locator('#k-crits')).toHaveText('0');
  await expect(page.locator('#vessel-list .vrow').filter({hasText:'CSCL GLOBE'}).locator('.etab')).toHaveClass(/e-ok/);
  await expect(page.locator('#alerts-list .alert-row')).toHaveCount(alerts);
  await page.evaluate(()=>{window.print=()=>{};});
  await page.getByRole('button',{name:'Shift handover report',exact:true}).click();
  await expect(page.locator('#pr-meta')).toContainText(terminal);await expect(page.locator('#pr-meta img')).toHaveCount(0);
  await settings.click();await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(settings).toBeFocused();
  await page.route('http://portfolio.test:4174/**',async route=>{
    const url=new URL(route.request().url());
    const response=await page.request.get('http://127.0.0.1:4174'+url.pathname+url.search);
    await route.fulfill({response});
  });
  await page.goto('http://portfolio.test:4174/?mode=demo');await page.getByRole('button',{name:'Settings',exact:true}).click();
  await expect(page.getByLabel('API Key (aisstream.io)',{exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Connect with this key',exact:false})).toBeDisabled();
  await expect(page.locator('#ais-connection-help')).toContainText('does not need a key');
  await page.evaluate(()=>applyApiKey());
  expect(await page.evaluate(()=>sessionStorage.getItem(LS_KEY))).toBeNull();
  expect(await page.evaluate(()=>demoMode)).toBe(true);
});


test('public live data stays separate from simulated planning and resets on mode switches', async ({page}) => {
  await page.route('**/api.open-meteo.com/**', route => route.abort());
  await page.route('**/tile.openstreetmap.org/**', route => route.abort());
  await page.addInitScript(() => {
    class Feed {
      static OPEN = 1;
      readyState = 0;
      constructor(url) {
        window.feedURLs = [...(window.feedURLs || []), url];
        setTimeout(() => {
          this.readyState = 1; this.onopen?.();
          this.onmessage?.({data: JSON.stringify({MessageType:'PositionReport',
            MetaData:{MMSI:477307900,ShipName:'REAL TEST VESSEL',latitude:51.5,longitude:2.9},
            Message:{PositionReport:{Sog:12,Cog:125}}})});
        }, 20);
      }
      send(value) { window.clientWrites = [...(window.clientWrites || []), value]; }
      close() { this.readyState = 3; this.onclose?.(); }
    }
    window.WebSocket = Feed;
  });
  await page.goto('/');
  const rows = page.locator('#vessel-list .vrow');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('REAL TEST VESSEL');
  await expect(page.locator('#stext')).toHaveText('Live AIS · aisstream.io');
  await expect(page.locator('#live-ct')).toHaveText('1 live');
  await expect(page.locator('#k-ontime')).toHaveText('—');
  await expect(page.locator('#k-crits')).toHaveText('—');
  expect(await page.evaluate(()=>window.clientWrites || [])).toEqual([]);
  expect(await page.evaluate(()=>Object.values(vessels).map(v=>({berth:v.berth,dev:v.dev,eta:v.schedEta}))))
    .toEqual([{berth:undefined,dev:undefined,eta:undefined}]);
  await rows.first().click();
  await expect(page.locator('#dinn')).toContainText('straight-line speed estimate');
  await expect(page.locator('#dinn')).not.toContainText('Shipping Agent');
  await page.evaluate(()=>vessels['477307900'].name='=1+1');
  const liveExport = await downloaded(page,()=>page.getByTitle('Export CSV',{exact:true}).click());
  expect(liveExport.data.toString()).toContain('AISStream live');
  expect(liveExport.data.toString()).toContain("'=1+1");
  expect(liveExport.data.toString()).not.toContain('AEX-041W');
  await page.locator('#demo-btn').click();
  await expect(rows).toHaveCount(8);
  await expect(page.locator('#live-ct')).toHaveText('8 simulated');
  await page.locator('#live-btn').click();
  await expect(rows).toHaveCount(1);
  await page.waitForTimeout(3200);
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('REAL TEST VESSEL');
});

test('a failed live feed remains explicit and never inserts simulated vessels', async ({page}) => {
  await page.route('**/api.open-meteo.com/**', route => route.abort());
  await page.route('**/tile.openstreetmap.org/**', route => route.abort());
  await page.addInitScript(() => {
    window.WebSocket = class {
      static OPEN = 1;
      constructor() { setTimeout(()=>this.onerror?.(),20); }
      close() {}
    };
  });
  await page.goto('/?mode=live');
  await expect(page.locator('#stext')).toHaveText('Connection error');
  await expect(page.locator('#vessel-list .vrow')).toHaveCount(0);
  expect(await page.evaluate(()=>demoMode)).toBe(false);
  await page.locator('#demo-btn').click();
  await expect(page.locator('#vessel-list .vrow')).toHaveCount(8);
  await expect(page.locator('#stext')).toContainText('Simulated AIS');
});
