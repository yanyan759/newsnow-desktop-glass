function resizeBounds(start, edge, dx, dy) {
  if (edge === 'move') return { ...start, x: start.x + dx, y: start.y + dy };
  const next = { ...start };
  if (edge.includes('e')) next.width = Math.max(280, start.width + dx);
  if (edge.includes('s')) next.height = Math.max(240, start.height + dy);
  if (edge.includes('w')) {
    next.width = Math.max(280, start.width - dx);
    next.x = start.x + start.width - next.width;
  }
  if (edge.includes('n')) {
    next.height = Math.max(240, start.height - dy);
    next.y = start.y + start.height - next.height;
  }
  return next;
}
function fitBounds(bounds, area) {
  const width = Math.min(Math.max(bounds.width || 420, 280), area.width);
  const height = Math.min(Math.max(bounds.height || 560, 240), area.height);
  return {
    x: Math.round(Math.min(Math.max(bounds.x ?? area.x + area.width - width - 20, area.x), area.x + area.width - width)),
    y: Math.round(Math.min(Math.max(bounds.y ?? area.y + 24, area.y), area.y + area.height - height)),
    width: Math.round(width), height: Math.round(height),
  };
}
module.exports = { resizeBounds, fitBounds };
