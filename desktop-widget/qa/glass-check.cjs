const { _electron: electron } = require('playwright-core');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: [path.resolve(__dirname, '..')] });
  try {
    const page = await app.firstWindow();
    await page.waitForURL('http://127.0.0.1:4444/**');
    await page.locator('#app main ol.grid > li').first().waitFor();
    await page.waitForTimeout(1000);
    const first = await page.locator('#app main ol.grid > li').first().innerText();
    assert(first.includes('arXiv'));
    const papers = page.locator('#app main ol.grid > li').nth(1);
    await papers.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    console.log('Second card:', (await papers.innerText()).slice(0, 180));
    assert.match(await papers.innerText(), /Hugging Face/i);
    const tldr = page.locator('#app main ol.grid > li').nth(2);
    await tldr.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    assert((await tldr.innerText()).includes('TLDR AI'));
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), false);
    await page.locator('#app main ol.grid > li').first().scrollIntoViewIfNeeded();
    const image = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'));
    fs.writeFileSync(path.join(__dirname, 'glass-internal.png'), Buffer.from(image, 'base64'));
    console.log('Verified: arXiv → Hugging Face → TLDR AI; light glass skin.');
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
