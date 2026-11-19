/* شروع برنامه: مسیریابی بین صفحه‌ها، تم و سرویس‌ورکر */

import { applyTheme } from './ui.js';
import { renderList } from './list.js';
import { renderSheet } from './sheet.js';

let current = null;

function route(){
  if (current && typeof current.destroy === 'function'){
    try { current.destroy(); } catch (e) { console.warn(e); }
  }
  current = null;

  const root = document.getElementById('root');
  if (!root) return;
  root.innerHTML = '';
  document.body.classList.remove('editing');
  window.scrollTo(0, 0);

  const parts = (location.hash || '').replace(/^#/, '').split('/').filter(Boolean);

  if (parts[0] === 's' && parts[1]) current = renderSheet(root, parts[1]);
  else current = renderList(root);
}

applyTheme();
route();

window.addEventListener('hashchange', route);

if (window.matchMedia){
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => {
    applyTheme();
    if ((location.hash || '').startsWith('#/s/')) route();
  };
  if (mq.addEventListener) mq.addEventListener('change', onChange);
  else if (mq.addListener) mq.addListener(onChange);
}

if ('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

if (navigator.storage && navigator.storage.persist){
  navigator.storage.persist().catch(() => {});
}
