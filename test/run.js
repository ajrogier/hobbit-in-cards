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

  // Mock GitHub: collection.json contents API (404 until first PUT, then serves the stored doc)
  const gh = { doc: null, n: 0, puts: 0 };
  const ghRoute = route => {
    const req = route.request();
    if (req.url().includes('/contents/collection.json')) {
      if (req.method() === 'PUT') {
        gh.puts++; gh.n++;
        gh.doc = { sha: 's' + gh.n, content: JSON.parse(req.postData()).content };
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ content: { sha: 's' + gh.n } }) });
      }
      if (!gh.doc) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"message":"Not Found"}' });
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(gh.doc) });
    }
    // repo lookup (token validation)
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ permissions: { push: true } }) });
  };
  await page.route('**/api.github.com/**', ghRoute);

  // Owner mode: token present -> editing enabled, edits committed to the mock repo
  await page.addInitScript(() => localStorage.setItem('hob_token_v1', 'test-token'));

  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForSelector('#view-tracker .card', { timeout: 10000 });

  // Stats (mock set: 20 main cards + 1 special art #300)
  console.log('total (expect 21):', await page.textContent('#stat-total'));

  // Toggle two cards owned
  await page.click('.card[data-id="mock-8"]');   // Gollum
  await page.click('.card[data-id="mock-14"]');  // Smaug
  console.log('owned after toggles:', await page.textContent('#stat-owned'));

  // Settings menu: theme + sheen prefs apply and survive reload (device preferences)
  await page.click('#btn-settings');
  await page.waitForSelector('#settings-modal.show');
  await page.click('#theme-light');
  await page.click('#sheen-animated');
  console.log('light + animated applied (expect true / true):',
    await page.evaluate(() => document.body.classList.contains('light')), '/',
    await page.evaluate(() => document.body.classList.contains('sheen-anim')));
  await page.keyboard.press('Escape');
  await page.reload();
  await page.waitForSelector('#view-tracker .card');
  console.log('prefs after reload (expect true / true):',
    await page.evaluate(() => document.body.classList.contains('light')), '/',
    await page.evaluate(() => document.body.classList.contains('sheen-anim')));
  await page.click('#btn-settings');            // back to night + subtle for the rest
  await page.click('#theme-dark');
  await page.click('#sheen-subtle');
  console.log('back to subtle (expect false):', await page.evaluate(() => document.body.classList.contains('sheen-anim')));
  await page.keyboard.press('Escape');

  // Quick foil from the card pill; sheen + badge should appear
  await page.locator('.card[data-id="mock-14"] .qty-pill .foil').click();
  console.log('foil sheen shown (expect 1):', await page.locator('.card[data-id="mock-14"] .foil-sheen').count());
  console.log('foil badge (expect ✦1):', (await page.textContent('.card[data-id="mock-14"] .owned-badge')).trim());

  // Main-set-only goal: hides #300 and shrinks the quest total
  await page.click('#chip-main');
  console.log('main-set total (expect 20):', await page.textContent('#stat-total'));
  console.log('special hidden (expect 0):', await page.locator('.card[data-id="mock-300"]').count());
  await page.click('#chip-main');
  console.log('full total again (expect 21):', await page.textContent('#stat-total'));

  // Filter: missing only should exclude owned
  await page.click('#chip-missing');
  const missingCount = await page.locator('#tracker-grid .card').count();
  console.log('missing-only count (expect 19):', missingCount);
  await page.click('#chip-missing');

  // Search
  await page.fill('#search', 'smaug');
  console.log('search "smaug" count:', await page.locator('#tracker-grid .card').count());
  await page.fill('#search', '');
  await page.screenshot({ path: 'test/tracker.png', fullPage: false });

  // Story view: clean slate, then author an outline
  const answers = [];
  page.on('dialog', d => d.type() === 'prompt' ? d.accept(answers.shift() || '') : d.accept());
  await page.click('#nav-story');
  await page.waitForSelector('.story-empty');
  console.log('clean slate (expect 1):', await page.locator('.story-empty').count());

  answers.push('An Unexpected Party');
  await page.click('.story-empty .tool-btn');
  await page.waitForSelector('.chapter');
  console.log('section title:', (await page.textContent('.ch-title')).trim());
  console.log('section numeral (expect I):', (await page.textContent('.ch-num')).trim());

  answers.push('Bag End');
  await page.locator('.sec-add').first().click();   // "+ Add subsection" on section I
  await page.waitForSelector('.subsection');
  console.log('subsection title:', (await page.textContent('.sub-title')).trim());

  // Picker on the section: search by name, then by flavor text
  await page.locator('.chapter .grid').first().locator('.add-card').click();
  await page.waitForSelector('#picker-modal.show');
  await page.fill('#picker-search', 'smaug');
  console.log('picker name search (expect 1):', await page.locator('#picker-results .pick').count());
  await page.click('#picker-results .pick');
  await page.fill('#picker-search', 'pocketses');
  const flavorHit = page.locator('#picker-results .pick', { hasText: 'Gollum' });
  console.log('picker flavor search finds Gollum (expect 1):', await flavorHit.count());
  await flavorHit.click();
  console.log('picked badge shows ✓ (expect 1):', await page.locator('#picker-results .pick.in').count());
  await page.click('#picker-modal .auth-actions .tool-btn');   // Done
  console.log('cards in section (expect 2):',
    await page.locator('.chapter .grid').first().locator('.card:not(.add-card)').count());

  // Second placement of Gollum in the subsection -> 1 copy, 2 placements -> amber
  await page.locator('.subsection .add-card').click();
  await page.fill('#picker-search', 'gollum');
  await page.click('#picker-results .pick');
  await page.click('#picker-modal .auth-actions .tool-btn');
  console.log('uncovered placements (expect 1):', await page.locator('#view-story .card.uncovered').count());
  await page.screenshot({ path: 'test/story.png', fullPage: true });

  // Card modal: placements listed, note editing, removal
  // In the tale, tapping a card opens its dialog (no separate story button)
  await page.locator('#view-story .card[data-id="mock-8"]').first().click();
  console.log('modal placements (expect 2):', await page.locator('#modal .place-label').count());
  await page.fill('#modal .appear-row >> nth=0 >> input', 'what has it got in its pocketses?');
  await page.locator('#modal .appear-row >> nth=0 >> input').press('Tab');
  await page.waitForTimeout(200);
  await page.locator('#modal .appear-row .del').last().click();   // drop the subsection placement
  console.log('placements after remove (expect 1):', await page.locator('#modal .place-label').count());
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  console.log('note pill rendered (expect 1):',
    await page.locator('#view-story .tag-pill.note', { hasText: 'pocketses' }).count());

  // Sync: wait for the debounced commit of the edits above, then verify payload
  await page.waitForFunction(() =>
    document.getElementById('sync-chip').textContent.includes('synced'), { timeout: 5000 });
  const pushed = JSON.parse(Buffer.from(gh.doc.content, 'base64').toString('utf8'));
  console.log('synced doc owned count (expect 2):', Object.values(pushed.owned).filter(o => o.q + o.f + o.s > 0).length);
  console.log('synced doc has story (expect An Unexpected Party / 2 cards):',
    pushed.story.sections[0].title, '/', pushed.story.sections[0].cards.length);
  console.log('PUT commits made:', gh.puts > 0);

  // Persistence: reload, check owned + story survived (now served from the mock repo)
  await page.reload();
  await page.waitForSelector('#view-tracker .card');
  console.log('owned after reload (expect 2):', await page.textContent('#stat-owned'));
  await page.click('#nav-story');
  await page.waitForSelector('.chapter');
  console.log('story after reload:', (await page.textContent('.ch-title')).trim(), '/',
    await page.locator('.chapter .grid').first().locator('.card:not(.add-card)').count(), 'cards');

  // Multi-copy protection: with >1 copies, a card tap opens the dialog instead of wiping counts
  await page.click('#nav-tracker');
  await page.locator('.card[data-id="mock-8"] .qty-pill button').first().click();  // + -> 2 copies
  await page.click('.card[data-id="mock-8"]');
  console.log('multi-copy tap opens dialog, owned intact (expect true / 2):',
    await page.locator('#modal.show').isVisible(), '/', await page.textContent('#stat-owned'));
  await page.locator('#modal .copy-ctl button').first().click();                   // − back to 1
  await page.keyboard.press('Escape');
  await page.waitForFunction(() =>
    document.getElementById('sync-chip').textContent.includes('synced'), { timeout: 5000 });

  // Viewer mode: fresh context without a token -> read-only, but sees the collection
  const viewerCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const viewer = await viewerCtx.newPage();
  await viewer.route('**/api.scryfall.com/**', route =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(mock) }));
  await viewer.route('**/api.github.com/**', ghRoute);
  await viewer.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await viewer.waitForSelector('#view-tracker .card');
  await viewer.waitForFunction(() => document.getElementById('stat-owned').textContent !== '0');
  console.log('viewer sees owned (expect 2):', await viewer.textContent('#stat-owned'));
  console.log('viewer is readonly (expect true):', await viewer.evaluate(() => document.body.classList.contains('readonly')));
  console.log('viewer qty-pill hidden (expect true):', await viewer.locator('.card[data-id="mock-8"] .qty-pill').isHidden());
  const putsBefore = gh.puts;
  await viewer.click('.card[data-id="mock-1"]');   // opens read-only details, changes nothing
  await viewer.waitForTimeout(300);
  console.log('viewer tap opens read-only dialog (expect true / 0 counter buttons):',
    await viewer.locator('#modal.show').isVisible(), '/', await viewer.locator('#modal .copy-ctl button').count());
  console.log('viewer click changed nothing (expect 2 / true):',
    await viewer.textContent('#stat-owned'), '/', gh.puts === putsBefore);
  await viewer.keyboard.press('Escape');
  await viewer.click('#nav-story');
  await viewer.waitForSelector('.chapter');
  console.log('viewer sees the tale (expect An Unexpected Party):', (await viewer.textContent('.ch-title')).trim());
  console.log('viewer has no edit controls (expect 0 / 0):',
    await viewer.locator('.sec-controls').count(), '/', await viewer.locator('.add-card').count());
  await viewerCtx.close();

  await browser.close();
  console.log('DONE');
})().catch(e => { console.error('TEST FAILED:', e); process.exit(1); });
