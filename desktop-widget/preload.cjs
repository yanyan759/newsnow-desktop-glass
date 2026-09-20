const { ipcRenderer, contextBridge } = require('electron');

// Texture access is confined to a separate isolated world, not the news page.
contextBridge.exposeInIsolatedWorld(1001, 'desktopGlass', {
  subscribe(callback) {
    const listener = (_event, frame) => callback(frame);
    ipcRenderer.on('widget:glass-frame', listener);
    return () => ipcRenderer.removeListener('widget:glass-frame', listener);
  },
  ready: () => ipcRenderer.send('widget:glass-ready'),
  error: message => ipcRenderer.send('widget:glass-error', String(message).slice(0, 500)),
});

window.addEventListener('DOMContentLoaded', () => {
  // The desktop glass surface uses dark ink regardless of the website's default theme.
  document.documentElement.classList.remove('dark');
  document.documentElement.classList.add('desktop-glass');
  const bar = document.createElement('div');
  bar.id = 'newsnow-desktop-bar';
  bar.innerHTML = '<span class="widget-grip" title="拖动此处移动桌面卡片">⠿ <b>NewsNow</b><small>桌面新闻</small></span><button type="button" title="刷新新闻页面" aria-label="刷新新闻页面">↻</button><button type="button" title="卡片设置" aria-label="卡片设置">⋯</button>';
  document.body.append(bar);
  bar.querySelectorAll('button')[0].addEventListener('click', () => ipcRenderer.send('widget:command', 'refresh'));
  bar.querySelectorAll('button')[1].addEventListener('click', () => ipcRenderer.send('widget:command', 'menu'));
  const begin = (element, edge) => {
    let active = false;
    element.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      event.preventDefault();
      active = true;
      element.setPointerCapture(event.pointerId);
      ipcRenderer.send('widget:gesture', { phase: 'begin', edge, x: event.screenX, y: event.screenY });
    });
    element.addEventListener('pointermove', event => {
      if (active) ipcRenderer.send('widget:gesture', { phase: 'move', x: event.screenX, y: event.screenY });
    });
    const end = () => {
      if (!active) return;
      active = false;
      ipcRenderer.send('widget:gesture', { phase: 'end' });
    };
    element.addEventListener('pointerup', end);
    element.addEventListener('pointercancel', end);
    element.addEventListener('lostpointercapture', end);
    window.addEventListener('blur', end);
  };
  begin(bar.querySelector('.widget-grip'), 'move');
  for (const edge of ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se']) {
    const handle = document.createElement('div');
    handle.className = `newsnow-resize newsnow-resize-${edge}`;
    handle.setAttribute('aria-hidden', 'true');
    begin(handle, edge);
    document.body.append(handle);
  }
});
