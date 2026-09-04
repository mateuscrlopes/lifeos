const REGION_ID = 'lifeosToastRegion';

function region() {
  let node = document.getElementById(REGION_ID);
  if (node) return node;
  node = document.createElement('div');
  node.id = REGION_ID;
  node.className = 'lifeos-toast-region';
  node.setAttribute('aria-live', 'polite');
  node.setAttribute('aria-atomic', 'false');
  document.body.appendChild(node);
  return node;
}

export function toast(message, type = 'ok', duration = 2800) {
  const text = String(message || '').trim();
  if (!text) return null;
  const item = document.createElement('div');
  item.className = `lifeos-toast lifeos-toast--${type === 'erro' || type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'ok'}`;
  item.setAttribute('role', type === 'erro' || type === 'error' ? 'alert' : 'status');
  item.textContent = text;
  region().appendChild(item);
  const timer = window.setTimeout(() => item.remove(), Math.max(800, Number(duration) || 2800));
  item.addEventListener('click', () => {
    window.clearTimeout(timer);
    item.remove();
  }, { once: true });
  return item;
}

window.lifeosToast = toast;
