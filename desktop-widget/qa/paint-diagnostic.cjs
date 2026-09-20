const { _electron: electron } = require('playwright-core');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const application = await electron.launch({ executablePath: require('electron'), args: [path.resolve(__dirname, '..')] });
  try {
    const page = await application.firstWindow();
    await page.waitForURL('http://127.0.0.1:4444/**');
    await page.locator('#newsnow-desktop-bar').waitFor();
    const capture = async label => {
      console.log(label, await page.evaluate(() => ({ visibility: document.visibilityState, bar: !!document.querySelector('#newsnow-desktop-bar'), width: innerWidth, height: innerHeight })));
      const data = await application.evaluate(async ({ BrowserWindow, app, desktopCapturer, screen }) => {
        const win = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'NewsNow 桌面插件');
        const localRequire = process.getBuiltinModule('module').createRequire(app.getAppPath() + '/main.cjs');
        const info = localRequire('./desktop-host.cjs').describeWindow(Number(win.getNativeWindowHandle().readBigUInt64LE()));
        const display = screen.getPrimaryDisplay();
        const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: display.size.width * display.scaleFactor, height: display.size.height * display.scaleFactor } });
        const source = sources.find(s => s.display_id === String(display.id)) || (sources.length === 1 ? sources[0] : undefined);
        if (!source) throw new Error(`Desktop capture unavailable: ${JSON.stringify(sources.map(s => ({id:s.id,display:s.display_id})))}`);
        const image = source.thumbnail.crop({ x: info.rect.x, y: info.rect.y, width: info.rect.width, height: Math.min(68, info.rect.height) });
        const pixels = image.toBitmap();
        let lightPixels = 0, inkPixels = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i] + pixels[i + 1] + pixels[i + 2] > 450) lightPixels++;
          if (pixels[i] + pixels[i + 1] + pixels[i + 2] < 360) inkPixels++;
        }
        return { png: image.toPNG().toString('base64'), visible: win.isVisible(), native: info, lightPixels, inkPixels };
      });
      fs.writeFileSync(path.join(__dirname, label+'.png'), Buffer.from(data.png,'base64'));
      delete data.png;
      console.log(JSON.stringify(data));
      return data;
    };
    await page.waitForTimeout(1000);
    const initial = await capture('paint-native-only');
    const painted = data => data.lightPixels > 150 && data.inkPixels > 150;
    if (process.argv.includes('--assert-startup')) assert(painted(initial), 'Actual desktop pixels must contain both the glass surface and toolbar text');
    await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].showInactive());
    await page.waitForTimeout(1000);
    await capture('paint-show-inactive');
    await application.evaluate(async ({ BrowserWindow, screen }) => {
      const widget = BrowserWindow.getAllWindows()[0];
      const cover = new BrowserWindow({ ...widget.getBounds(), show: true, frame: false });
      await cover.loadURL('data:text/html,<body style="background:%23aaffaa">Paint cover check</body>');
      cover.show();
    });
    await page.waitForTimeout(500);
    await capture('paint-covered');
    await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().startsWith('data:')).destroy());
    await page.waitForTimeout(500);
    const uncovered = await capture('paint-uncovered');
    assert(painted(uncovered), 'Toolbar must repaint after another app uncovers it');
    await page.reload();
    await page.locator('#newsnow-desktop-bar').waitFor();
    await page.waitForTimeout(500);
    const reloaded = await capture('paint-after-reload');
    assert(painted(reloaded), 'Toolbar must remain painted after a page reload');
    await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].hide());
    await application.evaluate(({ app }) => app.emit('second-instance'));
    await page.waitForTimeout(500);
    const restored = await capture('paint-after-restore');
    assert(painted(restored), 'Restoring the widget must wake the Electron presentation path');
    assert.equal(restored.native.parent, initial.native.parent);
  } finally { await application.close(); }
})().catch(e => { console.error(e); process.exitCode=1; });
