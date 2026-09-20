const koffi = require('koffi');
const u32 = koffi.load('user32.dll');
const k32 = koffi.load('kernel32.dll');
const RECT = koffi.struct('DesktopRect', { left: 'long', top: 'long', right: 'long', bottom: 'long' });
const POINT = koffi.struct('DesktopPoint', { x: 'long', y: 'long' });
const FindWindowEx = u32.func('uintptr_t __stdcall FindWindowExW(uintptr_t parent, uintptr_t after, str16 className, str16 title)');
const GetClassName = u32.func('int __stdcall GetClassNameW(uintptr_t hwnd, _Out_ uint16_t *text, int maxCount)');
const GetParent = u32.func('uintptr_t __stdcall GetParent(uintptr_t hwnd)');
const SetParent = u32.func('uintptr_t __stdcall SetParent(uintptr_t hwnd, uintptr_t parent)');
const GetStyle = u32.func('intptr_t __stdcall GetWindowLongPtrW(uintptr_t hwnd, int index)');
const SetStyle = u32.func('intptr_t __stdcall SetWindowLongPtrW(uintptr_t hwnd, int index, intptr_t value)');
const SetWindowPos = u32.func('bool __stdcall SetWindowPos(uintptr_t hwnd, uintptr_t after, int x, int y, int width, int height, uint32_t flags)');
const GetWindowRect = u32.func('bool __stdcall GetWindowRect(uintptr_t hwnd, _Out_ DesktopRect *rect)');
const ScreenToClient = u32.func('bool __stdcall ScreenToClient(uintptr_t hwnd, _Inout_ DesktopPoint *point)');
const IsWindow = u32.func('bool __stdcall IsWindow(uintptr_t hwnd)');
const IsWindowVisible = u32.func('bool __stdcall IsWindowVisible(uintptr_t hwnd)');
const GetLastError = k32.func('uint32_t __stdcall GetLastError()');
const SetLastError = k32.func('void __stdcall SetLastError(uint32_t error)');

function className(hwnd) {
  const data = Buffer.alloc(512);
  const length = GetClassName(hwnd, data, 256);
  return data.toString('utf16le', 0, length * 2);
}
function listDesktopHosts() {
  const hosts = [];
  let hwnd = 0;
  while ((hwnd = FindWindowEx(0, hwnd, null, null))) {
    const defView = FindWindowEx(hwnd, 0, 'SHELLDLL_DefView', null);
    if (defView) hosts.push({ hwnd, className: className(hwnd), defView, icons: FindWindowEx(defView, 0, 'SysListView32', null), visible: IsWindowVisible(hwnd) });
  }
  return hosts;
}
function getRect(hwnd) {
  const rect = {};
  if (!GetWindowRect(hwnd, rect)) throw new Error(`GetWindowRect: ${GetLastError()}`);
  return { x: rect.left, y: rect.top, width: rect.right - rect.left, height: rect.bottom - rect.top };
}
function attachDesktop(win) {
  const hwnd = Number(win.getNativeWindowHandle().readBigUInt64LE());
  let host;
  function attach() {
    const candidate = listDesktopHosts().find(item => item.visible);
    if (!candidate) throw new Error('没有找到 Windows 桌面图标容器，请在资源管理器恢复后重试。');
    host = candidate.hwnd;
    // A real WS_CHILD, not a top-level window that is periodically pushed behind apps.
    const style = ((Number(GetStyle(hwnd, -16)) | 0x40000000) & ~0x80000000 & ~0x00c00000 & ~0x00040000) >>> 0;
    SetStyle(hwnd, -16, style);
    const exStyle = ((Number(GetStyle(hwnd, -20)) | 0x00000080) & ~0x00040000 & ~0x00000008) >>> 0;
    SetStyle(hwnd, -20, exStyle);
    SetLastError(0);
    SetParent(hwnd, host);
    const code = GetLastError();
    if (GetParent(hwnd) !== host) throw new Error(`无法嵌入桌面 (SetParent ${code})。`);
    return { hwnd, host, hostClass: candidate.className };
  }
  function setBounds(bounds) {
    const point = { x: bounds.x, y: bounds.y };
    ScreenToClient(host, point);
    // HWND_TOP applies only amongst the desktop's children, never above other apps.
    if (!SetWindowPos(hwnd, 0, point.x, point.y, bounds.width, bounds.height, 0x0010 | 0x0020 | 0x0040)) {
      throw new Error(`无法调整桌面卡片尺寸 (${GetLastError()})。`);
    }
  }
  const info = attach();
  return {
    info, attach, setBounds,
    getBounds: () => getRect(hwnd),
    isAttached: () => IsWindow(host) && GetParent(hwnd) === host,
  };
}
function describeWindow(hwnd) {
  return { hwnd, parent: GetParent(hwnd), style: Number(GetStyle(hwnd, -16)) >>> 0, exStyle: Number(GetStyle(hwnd, -20)) >>> 0, visible: IsWindowVisible(hwnd), rect: getRect(hwnd) };
}
module.exports = { attachDesktop, listDesktopHosts, getRect, describeWindow };
if (require.main === module) console.log(JSON.stringify(listDesktopHosts(), null, 2));
