const { app, desktopCapturer, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
app.whenReady().then(async () => {
  const { describeWindow } = require('../desktop-host.cjs');
  const log = fs.readFileSync(path.join(app.getPath('appData'), 'NewsNow Desktop Card/server.log'), 'utf8');
  const match = [...log.matchAll(/desktop attached: (\{[^\n]+?\});/g)].at(-1);
  const native = describeWindow(JSON.parse(match[1]).hwnd);
  const display = screen.getDisplayMatching(screen.screenToDipRect(null, native.rect));
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: display.size.width * display.scaleFactor, height: display.size.height * display.scaleFactor } });
  const source = sources.find(item => item.display_id === String(display.id)) || sources[0];
  const origin = screen.dipToScreenPoint({ x: display.bounds.x, y: display.bounds.y });
  const image = source.thumbnail.crop({ ...native.rect, x: native.rect.x - origin.x, y: native.rect.y - origin.y });
  const label = process.argv[2] || 'screen';
  fs.writeFileSync(path.join(__dirname, `${label}.png`), image.toPNG());
  console.log(JSON.stringify({ native, captureSize: image.getSize(), display: display.scaleFactor }));
  app.quit();
}).catch(error => { console.error(error); app.exit(1); });
