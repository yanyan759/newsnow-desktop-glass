const { app, BrowserWindow, Menu, Tray, nativeImage, screen, shell, dialog, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { startServer } = require('./server.cjs');
const { attachDesktop } = require('./desktop-host.cjs');
const { resizeBounds, fitBounds } = require('./desktop-geometry.cjs');
const { createGlassFeed } = require('./glass-feed.cjs');
const { nodePath } = require('./config.json');
const root = path.resolve(__dirname, '..');
const version = require('../package.json').version;
const baseURL = 'http://127.0.0.1:4444';
const widgetCSS = fs.readFileSync(path.join(__dirname, 'widget.css'), 'utf8');
const glassRenderer = fs.readFileSync(path.join(__dirname, 'glass-renderer.js'), 'utf8');

app.setName('NewsNow Desktop Card');
app.setAppUserModelId('local.newsnow.desktop-card');
let win, tray, desktop, service, startup, statePath, logPath, hostTimer, gesture, glass;
let quitting = false;
let state = {};
let lastHostError = '';

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => show());
  app.on('window-all-closed', () => {});
  app.on('before-quit', event => {
    if (quitting) return;
    event.preventDefault();
    quitting = true;
    clearInterval(hostTimer);
    glass?.stop();
    saveState();
    Promise.resolve(startup).catch(() => {}).then(() => service?.stop()).finally(() => app.quit());
  });
  app.whenReady().then(createWindow).catch(error => {
    dialog.showErrorBox('NewsNow 桌面插件', error.message);
    app.quit();
  });
}

function log(message) {
  if (logPath) fs.appendFileSync(logPath, `${new Date().toISOString()} ${message}\n`);
}
function bounds() {
  return desktop?.isAttached() ? screen.screenToDipRect(win, desktop.getBounds()) : win.getBounds();
}
function saveState() {
  if (!win || win.isDestroyed()) return;
  try {
    state = { ...bounds(), mode: 'desktop' };
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  } catch (error) { log(error.message); }
}
function applyBounds(next) {
  desktop.setBounds(screen.dipToScreenRect(win, next));
  glass?.geometry();
}
function mount() {
  if (!win || win.isDestroyed()) return false;
  try {
    const next = fitBounds(state, screen.getDisplayMatching({ x: state.x || 0, y: state.y || 0, width: state.width || 420, height: state.height || 560 }).workArea);
    if (!desktop) desktop = attachDesktop(win);
    else desktop.attach();
    applyBounds(next);
    // SetWindowPos(SWP_SHOWWINDOW) maps the HWND but does not initialize
    // Electron's presentation path. Explicitly show it without taking focus.
    win.showInactive();
    lastHostError = '';
    tray.setToolTip('NewsNow 桌面插件 · 右键设置');
    log(`desktop attached: ${JSON.stringify(desktop.info)}; bounds=${JSON.stringify(bounds())}`);
    saveState();
    return true;
  } catch (error) {
    win.hide();
    tray.setToolTip('NewsNow · 正在等待 Windows 桌面');
    if (lastHostError !== error.message) { lastHostError = error.message; log(error.stack || error.message); }
    return false;
  }
}
function show() {
  if (!win || win.isDestroyed()) return;
  if (!desktop?.isAttached()) mount();
  if (desktop?.isAttached()) {
    applyBounds(fitBounds(state, screen.getDisplayMatching(state).workArea));
    win.showInactive();
  }
}
function openExternal(url) {
  try {
    if (['http:', 'https:'].includes(new URL(url).protocol)) shell.openExternal(url).catch(error => log(error.message));
  } catch { /* Ignore non-web URLs. */ }
}
function menu() {
  return Menu.buildFromTemplate([
    { label: '显示桌面卡片', click: show },
    { label: '刷新新闻', click: () => win.webContents.reload() },
    { label: '恢复默认大小和位置', click: () => {
      state = { ...fitBounds({}, screen.getPrimaryDisplay().workArea), mode: 'desktop' };
      if (!desktop?.isAttached()) mount();
      else { applyBounds(state); saveState(); }
    } },
    { label: '重新贴到桌面', click: mount },
    { type: 'separator' },
    { label: '在浏览器打开', click: () => openExternal(baseURL) },
    { label: '使用说明', click: () => shell.openPath(path.join(__dirname, '使用说明.md')) },
    { label: '查看运行日志', click: () => shell.openPath(logPath) },
    { type: 'separator' },
    { label: '暂时隐藏', click: () => { saveState(); win.hide(); } },
    { label: '完全退出', click: () => app.quit() },
  ]);
}
function trusted(event) {
  return win && !win.isDestroyed() && event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame;
}
function installIPC() {
  ipcMain.on('widget:glass-ready', event => { if (trusted(event)) glass?.ready(); });
  ipcMain.on('widget:glass-error', (event, message) => { if (trusted(event)) log(`glass renderer: ${String(message).slice(0, 500)}`); });
  ipcMain.on('widget:command', (event, command) => {
    if (!trusted(event)) return;
    if (command === 'refresh') win.webContents.reload();
    if (command === 'menu') menu().popup({ window: win });
  });
  ipcMain.on('widget:gesture', (event, input) => {
    if (!trusted(event) || !desktop?.isAttached() || !input) return;
    if (input.phase === 'end' && gesture) {
      gesture = null;
      const current = bounds();
      applyBounds(fitBounds(current, screen.getDisplayMatching(current).workArea));
      saveState();
      return;
    }
    if (![input.x, input.y].every(value => Number.isFinite(value) && Math.abs(value) < 100000)) return;
    if (input.phase === 'begin' && ['move', 'n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'].includes(input.edge)) {
      gesture = { origin: input, initial: bounds(), edge: input.edge };
    } else if (input.phase === 'move' && gesture) {
      applyBounds(resizeBounds(gesture.initial, gesture.edge, input.x - gesture.origin.x, input.y - gesture.origin.y));
    }
  });
}
async function createWindow() {
  statePath = path.join(app.getPath('userData'), 'window-state.json');
  logPath = path.join(app.getPath('userData'), 'server.log');
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  if (fs.existsSync(logPath) && fs.statSync(logPath).size > 2 * 1024 * 1024) fs.renameSync(logPath, `${logPath}.previous`);
  try { state = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch { /* First launch. */ }
  if (state.mode !== 'desktop') state = fitBounds({}, screen.getPrimaryDisplay().workArea);
  else state = fitBounds(state, screen.getDisplayMatching(state).workArea);
  const iconPath = path.join(root, 'public/pwa-192x192.png');
  win = new BrowserWindow({
    ...state, minWidth: 280, minHeight: 240, frame: false, thickFrame: false, resizable: false,
    show: false, skipTaskbar: true, minimizable: false, maximizable: false,
    title: 'NewsNow 桌面插件', icon: iconPath, transparent: true, backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false },
  });
  Menu.setApplicationMenu(null);
  // The desktop service always serves the installed build. Discard only its
  // offline app shell so an old PWA cache cannot override a rebuilt source order.
  await win.webContents.session.clearStorageData({
    origin: baseURL, storages: ['serviceworkers', 'cachestorage'],
  });
  // Chromium also caches index.html outside CacheStorage, including its old
  // hashed bundle URLs. Keep localStorage settings while refreshing that shell.
  await win.webContents.session.clearCache();
  win.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  win.webContents.session.setPermissionCheckHandler(() => false);
  win.on('page-title-updated', event => event.preventDefault());
  win.on('close', event => { if (!quitting) { event.preventDefault(); saveState(); win.hide(); } });
  win.on('closed', () => {
    if (!quitting) { log('Desktop host destroyed the window; relaunching.'); app.relaunch(); app.quit(); }
  });
  win.webContents.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: 'deny' }; });
  const guard = (event, url) => { if (new URL(url).origin !== baseURL) { event.preventDefault(); openExternal(url); } };
  win.webContents.on('will-navigate', guard);
  win.webContents.on('will-redirect', guard);
  win.webContents.on('dom-ready', async () => {
    try {
      await win.webContents.insertCSS(widgetCSS);
      if (win.webContents.getURL().startsWith(baseURL)) {
        await win.webContents.executeJavaScriptInIsolatedWorld(1001, [{ code: glassRenderer }]);
      }
    } catch (error) { log(error.message); }
  });
  tray = new Tray(nativeImage.createFromPath(iconPath).resize({ width: 20, height: 20 }));
  tray.setToolTip('NewsNow 桌面插件 · 右键设置');
  tray.on('click', show);
  tray.setContextMenu(menu());
  installIPC();
  await win.loadFile(path.join(__dirname, 'loading.html'));
  mount();
  glass = createGlassFeed(win, () => desktop?.getBounds() || screen.dipToScreenRect(win, win.getBounds()), log);
  // SetWindowPos can synchronously deliver these events inside the FFI call.
  // Querying Win32 again in that nested callback can crash Electron/Koffi.
  win.on('resize', () => setImmediate(() => glass?.geometry()));
  win.on('move', () => setImmediate(() => glass?.geometry()));
  hostTimer = setInterval(() => { if (!quitting && !desktop?.isAttached()) mount(); }, 2500);
  screen.on('display-metrics-changed', () => { if (desktop?.isAttached()) show(); });
  startup = startServer({ root, nodePath, url: baseURL, version, log });
  try {
    service = await startup;
    log(`service ready; owned=${service.owned}`);
    if (!quitting) await win.loadURL(baseURL);
  } catch (error) {
    log(error.stack || error.message);
    if (!quitting) { dialog.showErrorBox('NewsNow 未能启动', `${error.message}\n\n日志：${logPath}`); app.quit(); }
  }
}
