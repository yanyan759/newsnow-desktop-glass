const { Worker } = require('node:worker_threads');
const path = require('node:path');
const { screen } = require('electron');

function createGlassFeed(win, getBounds, log) {
  const worker = new Worker(path.join(__dirname, 'desktop-capture-worker.cjs'));
  let latest = {}, ready = false, lastError = '';
  function send(frame) {
    if (ready && !win.isDestroyed()) win.webContents.send('widget:glass-frame', frame);
  }
  function geometry() {
    if (win.isDestroyed()) return;
    const rect = getBounds();
    const dip = screen.screenToDipRect(win, rect);
    const display = screen.getDisplayMatching(dip);
    send({ geometry: { rect, display: screen.dipToScreenRect(win, display.bounds), scale: display.scaleFactor } });
  }
  worker.on('message', frame => {
    if (frame.error) {
      if (frame.error !== lastError) log(`glass capture: ${frame.error}`);
      lastError = frame.error;
      return;
    }
    lastError = '';
    if (frame.icons) latest.icons = frame.icons;
    if (frame.wallpaper) latest.wallpaper = frame.wallpaper;
    send(frame);
  });
  worker.on('error', error => log(`glass worker: ${error.message}`));
  return {
    ready() { ready = true; send(latest); geometry(); },
    geometry,
    stop() { ready = false; return worker.terminate(); },
  };
}
module.exports = { createGlassFeed };
