const { chromium } = require('playwright');
const path = require('path');
const mock = require('./mock.js');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 2000 } });  // tall: the whole tale stays in view, drags never fight scroll
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text()); });
  page.on('pageerror', e => console.log('PAGE ERROR:', e.message));

  const scryfallRoute = route =>
    route.fulfill({ contentType: 'application/json',
      body: JSON.stringify(route.request().url().includes('thob') ? mock.tokenResponse : mock) });
  await page.route('**/api.scryfall.com/**', scryfallRoute);

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
  await page.waitForSelector('#view-story .story-empty', { timeout: 10000 });
  console.log('lands on the tale (expect true):', await page.locator('#nav-story.active').count() === 1);
  await page.click('#nav-tracker');
  await page.waitForSelector('#view-tracker .card');

  // Stats (mock set: 20 main cards + 1 special art #300)
  console.log('total (expect 24 incl. 2 tokens):', await page.textContent('#stat-total'));

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
  await page.waitForSelector('#view-story .story-empty');
  console.log('prefs after reload (expect true / true):',
    await page.evaluate(() => document.body.classList.contains('light')), '/',
    await page.evaluate(() => document.body.classList.contains('sheen-anim')));
  await page.click('#btn-settings');            // back to night + subtle for the rest
  await page.click('#theme-dark');
  await page.click('#sheen-subtle');
  console.log('back to subtle (expect false):', await page.evaluate(() => document.body.classList.contains('sheen-anim')));
  // Device mode follows prefers-color-scheme live
  await page.click('#theme-auto');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForTimeout(120);
  console.log('device mode follows light (expect true):', await page.evaluate(() => document.body.classList.contains('light')));
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForTimeout(120);
  console.log('device mode follows dark (expect false):', await page.evaluate(() => document.body.classList.contains('light')));
  await page.click('#theme-dark');   // pin night for the rest of the run
  await page.keyboard.press('Escape');
  await page.click('#nav-tracker');
  await page.waitForSelector('#view-tracker .card');

  // Quick foil from the card pill; sheen + badge should appear
  await page.locator('.card[data-id="mock-14"] .qty-pill .foil').click();
  console.log('foil sheen shown (expect 1):', await page.locator('.card[data-id="mock-14"] .foil-sheen').count());
  console.log('foil badge (expect ✦1):', (await page.textContent('.card[data-id="mock-14"] .owned-badge')).trim());

  // Main-set-only goal: hides #300 and shrinks the quest total
  await page.click('#chip-main');
  console.log('main-set total (expect 20):', await page.textContent('#stat-total'));
  console.log('special hidden (expect 0):', await page.locator('.card[data-id="mock-300"]').count());
  await page.click('#chip-main');
  console.log('full total again (expect 24):', await page.textContent('#stat-total'));
  console.log('token shown with T# (expect T#1):', (await page.textContent('.card[data-id="tok-1"] .cn')).trim());

  // Filter: missing only should exclude owned
  await page.click('#chip-missing');
  const missingCount = await page.locator('#tracker-grid .card').count();
  console.log('missing-only count (expect 22):', missingCount);
  await page.click('#chip-missing');

  // Search
  await page.fill('#search', 'smaug');
  console.log('search "smaug" count:', await page.locator('#tracker-grid .card').count());
  await page.fill('#search', 'bolg');   // plain letters must find Bólg
  console.log('diacritic-folded search finds Bólg (expect 1):', await page.locator('#tracker-grid .card').count());
  await page.fill('#search', '');
  await page.screenshot({ path: 'test/tracker.png', fullPage: false });

  // Story view: clean slate, then author an outline
  const answers = [];
  page.on('dialog', d => d.type() === 'prompt' ? d.accept(answers.shift() || '') : d.accept());
  await page.click('#nav-story');
  await page.waitForSelector('.story-empty');
  console.log('clean slate (expect 1):', await page.locator('#view-story .story-empty').count());

  answers.push('An Unexpected Party');
  await page.click('#view-story .story-empty .tool-btn');
  await page.waitForSelector('.chapter');
  console.log('section title:', (await page.textContent('.ch-title')).trim());
  console.log('section numeral (expect I):', (await page.textContent('.ch-num')).trim());

  answers.push('Bag End');
  await page.locator('.sec-add', { hasText: 'Add subsection' }).first().click();
  await page.waitForSelector('.subsection');
  console.log('subsection title:', (await page.textContent('.sub-title')).trim());

  // Picker on the section: search by name, then by flavor text
  await page.locator('.sec-add', { hasText: 'Add cards' }).first().click();
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

  // Reorder within the section: move Gollum (2nd) before Smaug
  await page.locator('.chapter .grid').first().locator('.card[data-id="mock-8"] .entry-move', { hasText: '‹' }).click();
  console.log('first card after reorder (expect mock-8):',
    await page.locator('.chapter .grid').first().locator('.card:not(.add-card)').first().getAttribute('data-id'));
  console.log('start-of-list ‹ disabled (expect true):',
    await page.locator('.chapter .grid').first().locator('.card[data-id="mock-8"] .entry-move', { hasText: '‹' }).isDisabled());

  // Second placement of Gollum in the subsection -> 1 copy, 2 placements -> amber
  await page.locator('#view-story .card[data-id="mock-8"]').first().click();
  await page.selectOption('#modal-add-target', { index: 1 });   // Bag End
  await page.locator('#modal button', { hasText: 'Place here' }).click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
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

  // Passages: quote a card's flavor into the tale as story text (no placement cost)
  await page.locator('#view-story .card[data-id="mock-8"]').first().click();   // Gollum dialog
  const placementsBefore = await page.locator('#modal .place-label').count();
  await page.selectOption('#modal-quote-target', { index: 0 });                // section I
  await page.locator('#modal button', { hasText: 'Quote here' }).click();
  console.log('quote adds no placement (expect ' + placementsBefore + '):',
    await page.locator('#modal .place-label').count());
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  console.log('quoted passage rendered (expect 1):',
    await page.locator('#view-story .passage', { hasText: 'pocketses' }).count());
  console.log('passage attributed to Gollum (expect 1):',
    await page.locator('#view-story .passage .p-attr', { hasText: 'Gollum' }).count());
  console.log('quote consumes no copies — uncovered stays 0 (expect 0):',
    await page.locator('#view-story .card.uncovered').count());

  // Quote Smaug as well: his mock has art, so this passage shows a mini card
  await page.locator('#view-story .card[data-id="mock-14"]').first().click();
  await page.locator('#modal button', { hasText: 'Quote here' }).click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  console.log('passage mini card present (expect 1):', await page.locator('.passage .p-card').count());

  // Free-text passage via the ❝ tile, then edit-mode removal
  answers.push('And so the company gathered, thirteen dwarves and a burglar.');
  await page.locator('.sec-add', { hasText: 'Add text' }).first().click();
  await page.waitForTimeout(200);
  console.log('free passage added (expect 1):',
    await page.locator('#view-story .passage', { hasText: 'company gathered' }).count());
  await page.locator('#view-story .passage', { hasText: 'company gathered' }).locator('.entry-del').click();
  await page.waitForTimeout(200);
  console.log('passage removed (expect 0):',
    await page.locator('#view-story .passage', { hasText: 'company gathered' }).count());

  // Mark flavor as relevant at Gollum's placement (the ❝ toggle), then go read
  await page.locator('.chapter .grid').first().locator('.card[data-id="mock-8"] .entry-move.fl').click();
  console.log('flavor toggle lit (expect true):',
    await page.locator('.chapter .grid').first().locator('.card[data-id="mock-8"] .entry-move.fl.on').count() === 1);
  console.log('flavor line appears under the card at once (expect 1):',
    await page.locator('.chapter .grid').first().locator('.card[data-id="mock-8"] .card-flavor', { hasText: 'pocketses' }).count());

  // Read/edit toggle: read mode hides all authoring chrome, edit brings it back
  await page.click('.story-edit-toggle');
  console.log('read mode hides controls (expect 0 / 0 / 0):',
    await page.locator('.sec-controls').count(), '/',
    await page.locator('.add-card').count(), '/',
    await page.locator('.entry-del').count());
  console.log('read mode hides count badges (expect 0 visible):',
    await page.locator('#view-story .owned-badge:visible').count());
  console.log('marked flavor stays visible in read mode (expect 1):',
    await page.locator('#view-story .card-flavor', { hasText: 'pocketses' }).count());

  // Read-mode tap = lightbox; flavor shows only where it was marked with ❝
  await page.locator('#view-story .card[data-id="mock-8"]').first().click();
  console.log('marked card zooms with flavor (expect true / 1):',
    await page.locator('#zoom-modal.show').isVisible(), '/',
    await page.locator('.zoom-flavor', { hasText: 'pocketses' }).count());
  await page.keyboard.press('Escape');
  await page.locator('#view-story .card[data-id="mock-14"]').first().click();
  console.log('unmarked card zooms without flavor (expect true / 0):',
    await page.locator('#zoom-modal.show').isVisible(), '/', await page.locator('.zoom-flavor').count());
  console.log('art crop shown first (expect 1):', await page.locator('.zoom-art').count());
  await page.locator('.zoom-art').click();
  console.log('tap flips to full card (expect 0 / 1):',
    await page.locator('.zoom-art').count(), '/', await page.locator('#zoom-body img').count());
  await page.locator('#zoom-body img').click();
  console.log('tap flips back to art (expect 1):', await page.locator('.zoom-art').count());
  await page.keyboard.press('Escape');
  await page.locator('.passage .p-card').click();
  console.log('passage mini card zooms, no edit dialog (expect true / false / 1):',
    await page.locator('#zoom-modal.show').isVisible(), '/',
    await page.locator('#modal.show').isVisible(), '/',
    await page.locator('.zoom-flavor').count());
  await page.keyboard.press('Escape');
  await page.locator('.passage blockquote').first().click();   // the quote text is a target too
  console.log('tapping the quote itself zooms its card (expect true / Gollum):',
    await page.locator('#zoom-modal.show').isVisible(), '/',
    (await page.textContent('.zoom-name')).trim().split(',')[0]);
  await page.keyboard.press('Escape');
  await page.click('.story-edit-toggle');
  console.log('edit mode restores controls (expect >0):', await page.locator('.sec-controls').count() > 0);

  // Subsections travel between sections: ↓ past the end lands in the next section
  answers.push('Roast Mutton');
  await page.locator('.sec-add').last().click();               // global "+ Add section"
  await page.waitForTimeout(150);
  await page.locator('.subsection .sec-controls button', { hasText: '↓' }).click();
  console.log('subsection travelled to section II (expect 1):',
    await page.locator('.chapter').nth(1).locator('.sub-title', { hasText: 'Bag End' }).count());
  await page.locator('.subsection .sec-controls button', { hasText: '↑' }).click();
  console.log('subsection travelled back (expect 1):',
    await page.locator('.chapter').first().locator('.sub-title', { hasText: 'Bag End' }).count());
  await page.locator('.chapter').nth(1).locator('.sec-controls button', { hasText: '✕' }).click();
  await page.waitForTimeout(150);
  console.log('scratch section removed (expect 1):', await page.locator('.chapter').count());

  // Drag & drop: pull Smaug out of the section into the Bag End subsection
  await page.waitForTimeout(150);   // let the re-render settle before grabbing coordinates
  const src = await page.locator('.chapter .grid').first().locator('.card[data-id="mock-14"]').boundingBox();
  await page.mouse.move(src.x + src.width / 2, src.y + 40);
  await page.mouse.down();
  await page.mouse.move(src.x + src.width / 2 + 30, src.y + 48, { steps: 4 });   // passes the drag threshold
  await page.locator('.subsection').scrollIntoViewIfNeeded();
  const tgt = await page.locator('.subsection').boundingBox();
  await page.mouse.move(tgt.x + tgt.width / 2, tgt.y + 20, { steps: 12 });
  // mid-drag re-slotting reflows the page: re-acquire the live position for the final approach
  const tgt2 = await page.locator('.subsection .sub-head').boundingBox();
  await page.mouse.move(tgt2.x + tgt2.width / 2, tgt2.y + tgt2.height / 2, { steps: 3 });
  await page.mouse.move(tgt2.x + tgt2.width / 2 + 3, tgt2.y + tgt2.height / 2, { steps: 1 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  console.log('drag moved Smaug to subsection (expect 1 / 1):',
    await page.locator('.subsection .grid .card[data-id="mock-14"]').count(), '/',
    await page.locator('.chapter .grid').first().locator('.card:not(.add-card)').count());

  // Sync: wait for the debounced commit of the edits above, then verify payload
  await page.waitForFunction(() =>
    document.getElementById('sync-chip').textContent.includes('synced'), { timeout: 5000 });
  const pushed = JSON.parse(Buffer.from(gh.doc.content, 'base64').toString('utf8'));
  console.log('synced doc owned count (expect 2):', Object.values(pushed.owned).filter(o => o.q + o.f + o.s > 0).length);
  const secList = pushed.story.sections[0].cards;
  console.log('synced doc story (expect 1 placement + 2 passages / 1 sub card):',
    secList.filter(e => e.text === undefined).length, '+',
    secList.filter(e => e.text !== undefined).length, '/',
    pushed.story.sections[0].subs[0].cards.length);
  console.log('PUT commits made:', gh.puts > 0);

  // Persistence: reload, check owned + story survived (now served from the mock repo)
  await page.reload();
  await page.waitForSelector('.chapter');   // lands straight on the written tale
  console.log('story after reload (expect 1 card):', (await page.textContent('.ch-title')).trim(), '/',
    await page.locator('.chapter .grid').first().locator('.card:not(.add-card)').count(), 'cards');
  await page.click('#nav-tracker');
  await page.waitForSelector('#view-tracker .card');
  console.log('owned after reload (expect 2):', await page.textContent('#stat-owned'));

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

  // Unused-in-tale filter and the buy list: place unowned Bólg to create a shortfall
  await page.click('#nav-story');
  await page.click('.story-edit-toggle');
  await page.locator('.sec-add', { hasText: 'Add cards' }).first().click();
  await page.fill('#picker-search', 'bolg');
  await page.click('#picker-results .pick');
  await page.fill('#picker-search', 'burglar');     // flavor hit: all three Bilbos
  await page.locator('#picker-results .pick').nth(1).click();   // extras #300
  await page.locator('#picker-results .pick').nth(2).click();   // extras #301
  await page.click('#picker-modal .auth-actions .tool-btn');
  await page.click('#nav-tracker');
  await page.click('#chip-unused');
  console.log('unused-in-tale count (expect 19 of 24):', await page.locator('#tracker-grid .card').count());
  console.log('used card hidden from unused view (expect 0):',
    await page.locator('#tracker-grid .card[data-id="mock-8"]').count());
  await page.click('#chip-unused');
  console.log('buy list chip counts wanted copies (expect 3):',
    (await page.textContent('#btn-buylist .cnt')).trim());
  await page.click('#btn-buylist');
  console.log('buy list rows (expect 3 / starts 1× Bólg):',
    await page.locator('.buy-row').count(), '/',
    (await page.textContent('.buy-row')).trim().replace(/\s+/g, ' ').slice(0, 30));
  const cmLines = await page.evaluate(() => cardmarketText(buyList()).split('\n'));
  console.log('cardmarket lines: name only, twins merged (expect true / true / 2 lines):',
    cmLines[0] === '1x Bólg of the North', '/',
    cmLines[1] === '2x Bilbo, Fellow Conspirator', '/', cmLines.length);
  const faceLine = await page.evaluate(() =>
    cardmarketText([{ c: { name: "Bilbo, Luckwearer // Burglar's Plot", set: 'hob', cn: '32' }, need: 1 }]));
  console.log('double-faced names use the front face (expect true):', faceLine === '1x Bilbo, Luckwearer');
  // Exact-printing links: each art keeps its own row with its own Cardmarket idProduct link
  const cmHrefs = await page.locator('#buylist-rows .cm-link').evaluateAll(as => as.map(a => a.href));
  console.log('per-printing Cardmarket links (expect 700016 / 700300 / 700301):',
    cmHrefs.map(h => (h.match(/idProduct=(\d+)/) || [])[1]).join(' / '));
  console.log('twin arts told apart by artist (expect true / true):',
    (await page.textContent('#buylist-rows')).includes('art by Alan Lee'), '/',
    (await page.textContent('#buylist-rows')).includes('art by John Howe'));
  const cmFallbacks = await page.evaluate(() => [
    cmLink(cards.find(c => c.id === 'tok-1')),
    cmLink(cards.find(c => c.id === 'tok-2')),
  ]);
  console.log('link fallbacks: scryfall purchase uri, then name search (expect true / true):',
    cmFallbacks[0].includes('searchString=Dragon+Token'), '/',
    cmFallbacks[1].includes('Search?searchString=Spider'));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() =>
    document.getElementById('sync-chip').textContent.includes('synced'), { timeout: 5000 });

  // Viewer mode: fresh context without a token -> read-only, but sees the collection
  const viewerCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const viewer = await viewerCtx.newPage();
  await viewer.route('**/api.scryfall.com/**', scryfallRoute);
  await viewer.route('**/api.github.com/**', ghRoute);
  await viewer.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await viewer.waitForSelector('.chapter');   // viewers land on the tale
  console.log('viewer lands on the tale (expect true):', await viewer.locator('#nav-story.active').count() === 1);
  await viewer.click('#nav-tracker');
  await viewer.waitForSelector('#view-tracker .card');
  await viewer.waitForFunction(() => document.getElementById('stat-owned').textContent !== '0');
  console.log('viewer sees owned (expect 2):', await viewer.textContent('#stat-owned'));
  console.log('viewer is readonly (expect true):', await viewer.evaluate(() => document.body.classList.contains('readonly')));
  console.log('viewer qty-pill hidden (expect true):', await viewer.locator('#tracker-grid .card[data-id="mock-8"] .qty-pill').isHidden());
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
  await viewer.locator('#view-story .card[data-id="mock-8"]').first().click();
  console.log('viewer tale tap opens lightbox with flavor (expect true / 1):',
    await viewer.locator('#zoom-modal.show').isVisible(), '/',
    await viewer.locator('.zoom-flavor', { hasText: 'pocketses' }).count());
  await viewer.keyboard.press('Escape');
  console.log('viewer has no edit controls (expect 0 / 0):',
    await viewer.locator('.sec-controls').count(), '/', await viewer.locator('.add-card').count());
  await viewerCtx.close();

  await browser.close();
  console.log('DONE');
})().catch(e => { console.error('TEST FAILED:', e); process.exit(1); });
