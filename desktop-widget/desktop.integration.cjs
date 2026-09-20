const { _electron: electron } = require('playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const output = path.join(__dirname, 'qa');
fs.mkdirSync(output, { recursive: true });

(async () => {
  let movedBounds;
  const application = await electron.launch({ executablePath: require('electron'), args: [__dirname], timeout: 30000 });
  try {
    const page = await application.firstWindow();
    await page.waitForURL('http://127.0.0.1:4444/**');
    await page.locator('#newsnow-desktop-bar').waitFor();
    await page.locator('#app main ol.grid > li').first().waitFor();
    const native = await application.evaluate(({ BrowserWindow, app }) => {
      const win = BrowserWindow.getAllWindows()[0];
      const localRequire = process.getBuiltinModule('module').createRequire(app.getAppPath() + '/main.cjs');
      const { describeWindow, listDesktopHosts } = localRequire('./desktop-host.cjs');
      const hwnd = Number(win.getNativeWindowHandle().readBigUInt64LE());
      return { ...describeWindow(hwnd), hosts: listDesktopHosts(), top: win.isAlwaysOnTop() };
    });
    assert(native.hosts.some(item => item.hwnd === native.parent), 'Widget must be a native child of the real desktop host');
    assert(native.style & 0x40000000, 'WS_CHILD must be set');
    assert(!(native.style & 0x80000000), 'WS_POPUP must be removed');
    assert(!(native.exStyle & 0x40000), 'WS_EX_APPWINDOW must be removed');
    assert.equal(native.top, false);
    const layouts = [];
    for (const size of [{ width: 280, height: 240 }, { width: 840, height: 480 }, { width: 420, height: 560 }]) {
      const geometry = await application.evaluate(({ BrowserWindow, screen, app }, size) => {
        const win = BrowserWindow.getAllWindows()[0];
        const localRequire = process.getBuiltinModule('module').createRequire(app.getAppPath() + '/main.cjs');
        const host = localRequire('./desktop-host.cjs').attachDesktop(win);
        const area = screen.getPrimaryDisplay().workArea;
        const physical = screen.dipToScreenRect(win, { ...size, x: area.x + area.width - size.width - 20, y: area.y + 24 });
        host.setBounds(physical);
        return { physical, native: host.getBounds(), electron: win.getBounds(), content: win.getContentBounds(), scale: screen.getPrimaryDisplay().scaleFactor };
      }, size);
      console.log('resize', JSON.stringify({ size, geometry, viewport: await page.evaluate(() => ({ width: innerWidth, height: innerHeight, ratio: devicePixelRatio })) }));
      await page.waitForFunction(size => innerWidth === size.width && innerHeight === size.height, size);
      const layout = await page.evaluate(() => {
        const grid = document.querySelector('#app main ol.grid');
        return { width: innerWidth, height: innerHeight, columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
          scrollWidth: document.documentElement.scrollWidth, gridWidth: grid.getBoundingClientRect().width,
          bar: !!document.querySelector('#newsnow-desktop-bar'), handles: document.querySelectorAll('.newsnow-resize').length };
      });
      assert.equal(layout.columns, size.width >= 800 ? 2 : 1);
      assert.equal(layout.handles, 8);
      assert(layout.scrollWidth <= size.width, 'No horizontal page overflow');
      const screenshot = await application.evaluate(async ({ BrowserWindow }) => {
        const image = await BrowserWindow.getAllWindows()[0].webContents.capturePage();
        return image.toPNG().toString('base64');
      });
      fs.writeFileSync(path.join(output, `widget-${size.width}x${size.height}.png`), Buffer.from(screenshot, 'base64'));
      layouts.push(layout);
    }
    // Exercise the actual preload -> IPC -> native window resize path.
    await page.mouse.move(417, 557);
    await page.mouse.down();
    await page.mouse.move(497, 597);
    await page.mouse.up();
    await page.waitForFunction(() => innerWidth === 500 && innerHeight === 600, undefined, { timeout: 5000 });
    const resizeResult = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    const position = await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds());
    await page.mouse.move(100, 17);
    await page.mouse.down();
    await page.mouse.move(40, 60);
    await page.mouse.up();
    const moved = await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds());
    assert.equal(moved.x, position.x - 60);
    assert.equal(moved.y, position.y + 43);
    movedBounds = moved;
    // An ordinary application window must cover the desktop child.
    const covering = await application.evaluate(async ({ BrowserWindow, screen, app }) => {
      const localRequire = process.getBuiltinModule('module').createRequire(app.getAppPath() + '/main.cjs');
      const ffi = localRequire('koffi');
      const user32 = ffi.load('user32.dll');
      const pointType = ffi.struct('HitTestPoint', { x: 'long', y: 'long' });
      const windowAt = user32.func('uintptr_t __stdcall WindowFromPoint(HitTestPoint point)');
      const ancestor = user32.func('uintptr_t __stdcall GetAncestor(uintptr_t hwnd, uint32_t flags)');
      const getTop = user32.func('uintptr_t __stdcall GetTopWindow(uintptr_t hwnd)');
      const getNext = user32.func('uintptr_t __stdcall GetWindow(uintptr_t hwnd, uint32_t command)');
      const widget = BrowserWindow.getAllWindows()[0];
      const area = widget.getBounds();
      const cover = new BrowserWindow({ ...area, show: true, frame: false });
      await cover.loadURL('data:text/html,<body style="background:%23eeeeee">NewsNow desktop layer test</body>');
      cover.show();
      await new Promise(resolve => setTimeout(resolve, 200));
      const point = screen.dipToScreenPoint({ x: area.x + 50, y: area.y + 70 });
      const root = ancestor(windowAt(point), 2);
      const expected = Number(cover.getNativeWindowHandle().readBigUInt64LE());
      const desktopRoot = ancestor(Number(widget.getNativeWindowHandle().readBigUInt64LE()), 2);
      const order = [];
      for (let hwnd = getTop(0); hwnd && order.length < 1000; hwnd = getNext(hwnd, 2)) order.push(hwnd);
      const coverIndex = order.indexOf(expected), desktopIndex = order.indexOf(desktopRoot);
      cover.destroy();
      return { root, expected, desktopRoot, coverIndex, desktopIndex, desktopStillVisible: localRequire('./desktop-host.cjs').describeWindow(Number(widget.getNativeWindowHandle().readBigUInt64LE())).visible };
    });
    // Another user application may be above the temporary cover. Check actual
    // Z order without requiring the test window to steal foreground focus.
    assert(covering.coverIndex >= 0 && covering.coverIndex < covering.desktopIndex, 'Regular application should be above the desktop widget');
    assert.notEqual(covering.root, covering.desktopRoot, 'The desktop must not cover an application at the test point');
    assert.equal(covering.desktopStillVisible, true);
    const report = { native, layouts, resizeResult, moved, covering };
    fs.writeFileSync(path.join(output, 'integration.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await application.close();
  }
  const reopened = await electron.launch({ executablePath: require('electron'), args: [__dirname], timeout: 30000 });
  try {
    const page = await reopened.firstWindow();
    await page.waitForURL('http://127.0.0.1:4444/**');
    const restored = await reopened.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds());
    assert.deepEqual(restored, movedBounds);
    console.log('Restored after complete exit:', JSON.stringify(restored));
  } finally { await reopened.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
