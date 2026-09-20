const { parentPort } = require('node:worker_threads');
const { captureIcons, readWallpaper } = require('./desktop-capture.cjs');
let previous, wallpaperKey;
function capture() {
  try {
    const icons = captureIcons();
    const wallpaper = readWallpaper();
    const iconChanged = !previous || JSON.stringify(previous.rect) !== JSON.stringify(icons.rect) || !previous.pixels.equals(icons.pixels);
    const wallChanged = wallpaper.key !== wallpaperKey;
    if (iconChanged || wallChanged) {
      // The worker retains its own copy to avoid redundant GPU uploads.
      parentPort.postMessage({ icons: iconChanged ? icons : null, wallpaper: wallChanged ? wallpaper : null });
      previous = icons; wallpaperKey = wallpaper.key;
    }
  } catch (error) {
    parentPort.postMessage({ error: error.message });
  }
  setTimeout(capture, 2000);
}
capture();
