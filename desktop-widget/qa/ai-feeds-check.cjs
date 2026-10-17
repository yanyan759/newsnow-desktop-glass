const { _electron: electron } = require('playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'newsnow-ai-qa-'));
  const app = await electron.launch({ executablePath: require('electron'), args: [path.resolve(__dirname, '..'), `--user-data-dir=${profile}`], timeout: 30000 });
  try {
    const page = await app.firstWindow();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.waitForURL('http://127.0.0.1:4444/**');
    // Install before React creates its polling timers; existing native timers
    // cannot be advanced by a clock installed later in the test.
    await page.clock.install();
    await page.evaluate(() => localStorage.setItem('metadata', JSON.stringify({ updatedTime: Date.now(), action: 'manual', data: { focus: ['github-trending-today'], hottest: ['baidu'], realtime: [], updated: [] } })));
    await page.reload();
    const cards = page.locator('#app main ol.grid > li');
    await cards.first().waitFor();
    assert.equal(await cards.count(), 8);
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('metadata')).data.focus), ['github-trending-today']);
    assert.match(await cards.nth(0).innerText(), /arXiv/);
    await cards.nth(0).locator('.ai-news-details').first().waitFor();
    assert.match(await cards.nth(0).innerText(), /来源日期/);
    assert.match(await cards.nth(0).innerText(), /中文概括：/);
    assert.match(await cards.nth(0).locator('a').filter({ hasText: 'PDF' }).first().getAttribute('href'), /^https:\/\/arxiv.org\/pdf\//);
    const details = cards.nth(0).locator('details').first();
    await details.locator('summary').click();
    assert.equal(await details.getAttribute('open'), '');
    await details.locator('summary').click();
    await cards.nth(1).scrollIntoViewIfNeeded();
    await cards.nth(1).locator('.ai-news-details').first().waitFor();
    assert.match(await cards.nth(1).innerText(), /Hugging Face/);
    assert.match(await cards.nth(1).innerText(), /中文概括：/);
    assert.match(await cards.nth(1).innerText(), /票/);
    assert.match(await cards.nth(1).innerText(), /社区/);

    const layouts = [];
    for (const size of [{ width: 280, height: 360 }, { width: 840, height: 600 }, { width: 420, height: 640 }]) {
      await app.evaluate(({ BrowserWindow, screen, app }, size) => {
        const win = BrowserWindow.getAllWindows()[0];
        const localRequire = process.getBuiltinModule('module').createRequire(app.getAppPath() + '/main.cjs');
        const desktop = localRequire('./desktop-host.cjs').attachDesktop(win);
        const area = screen.getPrimaryDisplay().workArea;
        desktop.setBounds(screen.dipToScreenRect(win, { ...size, x: area.x + area.width - size.width - 20, y: area.y + 24 }));
      }, size);
      await page.waitForFunction(size => innerWidth === size.width && innerHeight === size.height, size);
      await cards.first().scrollIntoViewIfNeeded();
      await page.evaluate(() => document.querySelectorAll('[data-overlayscrollbars-viewport]').forEach(el => { el.scrollTop = 0; }));
      const layout = await page.evaluate(() => {
        const grid = document.querySelector('#app main ol.grid');
        return { width: innerWidth, columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length, scrollWidth: document.documentElement.scrollWidth, handles: document.querySelectorAll('.newsnow-resize').length };
      });
      assert.equal(layout.columns, size.width >= 800 ? 2 : 1);
      assert(layout.scrollWidth <= size.width, 'No horizontal page overflow');
      assert.equal(layout.handles, 8);
      const png = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'));
      fs.writeFileSync(path.join(__dirname, `ai-${size.width}.png`), Buffer.from(png, 'base64'));
      layouts.push(layout);
    }

    // An open desktop must query again after its source cache expires.
    await cards.first().scrollIntoViewIfNeeded();
    const refreshed = page.waitForResponse(response => response.url().includes('/api/s?id=arxiv'), { timeout: 15000 });
    await page.clock.fastForward(31 * 60 * 1000);
    assert.equal((await refreshed).status(), 200);

    // Network errors keep readable papers and explicitly report the failure.
    const previousTitle = await cards.first().locator('ol > li > a').first().innerText();
    await page.route('**/api/s?id=arxiv*', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"offline"}' }));
    await cards.first().getByRole('button', { name: '刷新 arXiv', exact: true }).click();
    await cards.first().getByText('更新失败 · 保留上次内容').waitFor();
    assert.equal(await cards.first().locator('ol > li > a').first().innerText(), previousTitle);
    await page.unroute('**/api/s?id=arxiv*');

    await cards.nth(7).scrollIntoViewIfNeeded();
    await cards.nth(7).locator('.ai-news-details').first().waitFor();
    assert.match(await cards.nth(7).innerText(), /渠道入口/);
    assert.match(await cards.nth(7).innerText(), /中文概括：/);
    assert.match(await cards.nth(7).innerText(), /Karpathy/);
    assert.equal(await cards.nth(7).locator('time').count(), 0, 'Static channel links must not pretend to have publication dates');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ status: 'passed', sources: await cards.count(), layouts, autoRefresh: true, offlineRetention: true, existingFavoritesPreserved: true, errors }, null, 2));
  } finally {
    await app.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
