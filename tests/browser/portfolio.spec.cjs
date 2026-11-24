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
  await page.goto('/');
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
