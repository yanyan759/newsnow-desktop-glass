const koffi = require('koffi');
const fs = require('node:fs');
const { listDesktopHosts, getRect } = require('./desktop-host.cjs');
const u = koffi.load('user32.dll'), g = koffi.load('gdi32.dll');
const setDpi = u.func('intptr_t __stdcall SetThreadDpiAwarenessContext(intptr_t context)');
const getDC = u.func('uintptr_t __stdcall GetDC(uintptr_t hwnd)');
const releaseDC = u.func('int __stdcall ReleaseDC(uintptr_t hwnd, uintptr_t dc)');
const createDC = g.func('uintptr_t __stdcall CreateCompatibleDC(uintptr_t dc)');
const createBitmap = g.func('uintptr_t __stdcall CreateCompatibleBitmap(uintptr_t dc, int width, int height)');
const select = g.func('uintptr_t __stdcall SelectObject(uintptr_t dc, uintptr_t object)');
const print = u.func('bool __stdcall PrintWindow(uintptr_t hwnd, uintptr_t dc, uint32_t flags)');
const visible = u.func('bool __stdcall IsWindowVisible(uintptr_t hwnd)');
const dib = g.func('int __stdcall GetDIBits(uintptr_t dc, uintptr_t bmp, uint32_t start, uint32_t lines, _Out_ void *bits, void *info, uint32_t usage)');
const deleteObject = g.func('bool __stdcall DeleteObject(uintptr_t object)');
const deleteDC = g.func('bool __stdcall DeleteDC(uintptr_t dc)');
const spi = u.func('bool __stdcall SystemParametersInfoW(uint32_t action, uint32_t size, _Out_ void *value, uint32_t flags)');
const getColor = u.func('uint32_t __stdcall GetSysColor(int index)');
const reg = koffi.load('advapi32.dll').func('int32_t __stdcall RegGetValueW(uintptr_t key, str16 subkey, str16 value, uint32_t flags, void *type, _Out_ void *data, _Inout_ uint32_t *size)');
let wallpaperCache;

function captureIcons() {
  const previousDpi = setDpi(-4);
  let hwnd, dc, mem, bmp, old;
  const started = performance.now();
  try {
    hwnd = listDesktopHosts().find(h => h.visible)?.icons;
    if (!hwnd) throw new Error('Desktop icon host unavailable');
    const rect = getRect(hwnd), { width, height } = rect;
    if (width <= 0 || height <= 0 || width * height > 40000000) throw new Error('Desktop texture dimensions unsupported');
    const pixels = Buffer.alloc(width * height * 4);
    if (visible(hwnd)) {
      dc = getDC(hwnd); mem = createDC(dc); bmp = createBitmap(dc, width, height);
      if (!dc || !mem || !bmp) throw new Error('Cannot allocate desktop capture surface');
      old = select(mem, bmp);
      // Flags 0 retains Explorer's premultiplied alpha; PW_RENDERFULLCONTENT
      // would flatten the background to black. This captures only the sibling
      // icon surface, so neither our widget nor foreground apps feed back.
      if (!print(hwnd, mem, 0)) throw new Error('Explorer could not paint desktop icons');
      select(mem, old); old = null;
      const info = Buffer.alloc(40);
      info.writeUInt32LE(40); info.writeInt32LE(width, 4); info.writeInt32LE(-height, 8);
      info.writeUInt16LE(1, 12); info.writeUInt16LE(32, 14);
      if (dib(dc, bmp, 0, height, pixels, info, 0) !== height) throw new Error('Incomplete desktop icon capture');
      // WebGL accepts RGBA. Keep premultiplication for source-over composition.
      for (let i = 0; i < pixels.length; i += 4) {
        const blue = pixels[i]; pixels[i] = pixels[i + 2]; pixels[i + 2] = blue;
      }
    }
    return { rect, pixels, ms: performance.now() - started };
  } finally {
    if (old) select(mem, old);
    if (bmp) deleteObject(bmp);
    if (mem) deleteDC(mem);
    if (dc) releaseDC(hwnd, dc);
    if (previousDpi) setDpi(previousDpi);
  }
}
function desktopSetting(name, fallback) {
  const buffer = Buffer.alloc(128), size = [buffer.length];
  const status = reg(0xffffffff80000001n, 'Control Panel\\Desktop', name, 2, null, buffer, size);
  return status === 0 ? buffer.toString('utf16le').replace(/\0.*$/s, '') : fallback;
}
function readWallpaper() {
  const buffer = Buffer.alloc(65536);
  if (!spi(0x73, 32768, buffer, 0)) throw new Error('Cannot read Windows wallpaper');
  const file = buffer.toString('utf16le').replace(/\0.*$/s, '');
  const style = desktopSetting('WallpaperStyle', '10');
  const tile = desktopSetting('TileWallpaper', '0') === '1';
  const color = getColor(1);
  const key = `${file}:${file ? fs.statSync(file).mtimeMs : 0}:${style}:${tile}:${color}`;
  if (wallpaperCache?.key === key) return wallpaperCache;
  let dataURL = null;
  if (file) {
    const bytes = fs.readFileSync(file);
    const mime = bytes[0] === 0xff ? 'image/jpeg' : bytes[0] === 0x89 ? 'image/png' : 'image/bmp';
    dataURL = `data:${mime};base64,${bytes.toString('base64')}`;
  }
  wallpaperCache = { key, dataURL, style, tile, color: [color & 255, (color >> 8) & 255, (color >> 16) & 255] };
  return wallpaperCache;
}
module.exports = { captureIcons, readWallpaper };
