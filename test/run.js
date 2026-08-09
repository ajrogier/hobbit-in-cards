const { chromium } = require('playwright');
const path = require('path');
const mock = require('./mock.js');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text()); });
  page.on('pageerror', e => console.log('PAGE ERROR:', e.message));

  await page.route('**/api.scryfall.com/**', route =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(mock) }));

  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForSelector('#view-tracker .card', { timeout: 10000 });

  // Stats
  console.log('total:', await page.textContent('#stat-total'));

  // Toggle two cards owned
  await page.click('.card[data-id="mock-8"]');   // Gollum
  await page.click('.card[data-id="mock-14"]');  // Smaug
  console.log('owned after toggles:', await page.textContent('#stat-owned'));

  // Filter: missing only should exclude owned
  await page.click('#chip-missing');
  const missingCount = await page.locator('#tracker-grid .card').count();
  console.log('missing-only count (expect 18):', missingCount);
  await page.click('#chip-missing');

  // Search
  await page.fill('#search', 'smaug');
  console.log('search "smaug" count:', await page.locator('#tracker-grid .card').count());
  await page.fill('#search', '');
  await page.screenshot({ path: 'test/tracker.png', fullPage: false });

  // Story view
  await page.click('#nav-story');
  await page.waitForSelector('.chapter');
  const chapters = await page.locator('.chapter').count();
  console.log('chapters rendered:', chapters);
  const gollumCh = await page.locator('.chapter', { hasText: 'Riddles in the Dark' }).locator('.card').count();
  console.log('cards in Riddles in the Dark:', gollumCh);
  await page.screenshot({ path: 'test/story.png', fullPage: true });

  // Story manager modal: move mock-20's appearance to A Warm Welcome, add a 2nd appearance
  const storyCard = page.locator('#view-story .card[data-id="mock-20"]');
  await storyCard.hover();
  await storyCard.locator('.assign-btn').click({ force: true });
  await page.selectOption('.appear-row >> nth=0 >> select >> nth=0', 'ch10');
  await page.waitForTimeout(200);
  await page.click('.add-appear');
  await page.selectOption('.appear-row >> nth=1 >> select >> nth=0', 'ch9');
  await page.selectOption('.appear-row >> nth=1 >> select >> nth=1', 'flavor');
  await page.fill('.appear-row >> nth=1 >> input', 'sings among the barrels');
  await page.locator('.appear-row >> nth=1 >> input').press('Tab');
  await page.waitForTimeout(200);
  console.log('modal summary:', (await page.textContent('.copy-summary')).trim());
  // Add one foil copy from modal (1 copy, 2 appearances -> one uncovered)
  await page.click('.copy-ctl:has-text("Foil") button:has-text("+")');
  await page.waitForTimeout(200);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const warmWelcome = await page.locator('.chapter', { hasText: 'A Warm Welcome' }).locator('.card').count();
  console.log('cards in A Warm Welcome after move (expect 1):', warmWelcome);
  const barrels = await page.locator('.chapter', { hasText: 'Barrels Out of Bond' }).locator('.card[data-id="mock-20"]').count();
  console.log('mock-20 also in Barrels chapter (expect 1):', barrels);
  const uncovered = await page.locator('#view-story .card.uncovered').count();
  console.log('uncovered appearances (expect 1):', uncovered);
  const quotePill = await page.locator('.tag-pill.flavor', { hasText: 'sings among the barrels' }).count();
  console.log('flavor-quote pill with note (expect 1):', quotePill);

  // Persistence: reload, check owned survived
  await page.reload();
  await page.waitForSelector('#view-tracker .card');
  console.log('owned after reload (expect 3):', await page.textContent('#stat-owned'));

  await browser.close();
  console.log('DONE');
})().catch(e => { console.error('TEST FAILED:', e); process.exit(1); });
