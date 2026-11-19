/* صفحه‌ی برگه‌ها: فهرست، جستجو، پشتیبان و تنظیمات */

import * as S from './store.js';
import { esc, toFa, faDate, shareFile } from './util.js';
import { drawThumb } from './render.js';
import {
  askConfirm, askChoice, openSheet, toast, setTheme, applyTheme
} from './ui.js';

export function renderList(root){
  let query = '';

  root.innerHTML = `
  <header class="bar">
    <div class="bar-mid">
      <div class="ttl static">دفتر اندازه کناف</div>
      <span class="sub">برگه‌های اندازه</span>
    </div>
    <button class="icon" data-act="menu" aria-label="بیشتر">⋯</button>
  </header>

  <main class="page">
    <div class="searchwrap">
      <input id="q" type="search" placeholder="جستجوی برگه یا مشتری…" autocomplete="off">
    </div>
    <div id="sheets"></div>
  </main>

  <button class="fab" data-act="new">+ برگه تازه</button>`;

  const qEl = root.querySelector('#q');
  const sheetsEl = root.querySelector('#sheets');

  function card(s){
    const n = (s.labels || []).length;
    return `
      <div class="sheetcard${s.done ? ' done' : ''}" data-sheet="${s.id}">
        <div class="sthum"><canvas data-thumb="${s.id}"></canvas></div>
        <div class="sbody">
          <div class="sttitle">${esc(s.title)}</div>
          <div class="stmeta">${esc(s.client || 'بدون مشتری')} · ${faDate(s.updatedAt)}</div>
          <div class="stfoot">
            <span class="stcnt">${n ? toFa(n) + ' اندازه' : 'بدون اندازه'}</span>
            ${s.done ? '<span class="stdone">✓ بریده شد</span>' : ''}
          </div>
        </div>
        <div class="sact">
          <button class="sdone${s.done ? ' on' : ''}" data-done="${s.id}" aria-label="بریده شد">✓</button>
          <button class="sdel" data-del="${s.id}" aria-label="حذف">✕</button>
        </div>
      </div>`;
  }

  function paint(){
    const all = S.listSheets();
    const needle = query.trim();
    const list = needle
      ? all.filter(s =>
        (s.title || '').includes(needle) ||
        (s.client || '').includes(needle) ||
        (s.note || '').includes(needle))
      : all;

    if (!all.length){
      sheetsEl.innerHTML = `
        <div class="empty">
          <span class="big">▤</span>
          هنوز برگه‌ای نداری.<br>
          با «برگه تازه» یکی باز کن، نقشه را با انگشت بکش<br>
          و اندازه‌ها را با ابزار «عدد» بنویس.
        </div>`;
      return;
    }
    if (!list.length){
      sheetsEl.innerHTML = '<div class="empty">چیزی با این نام پیدا نشد.</div>';
      return;
    }

    sheetsEl.innerHTML = list.map(card).join('');

    sheetsEl.querySelectorAll('canvas[data-thumb]').forEach(c => {
      const s = all.find(x => x.id === c.dataset.thumb);
      if (s) drawThumb(c, s);
    });

    sheetsEl.querySelectorAll('[data-sheet]').forEach(el => {
      el.addEventListener('click', e => {
        if (e.target.closest('[data-done]') || e.target.closest('[data-del]')) return;
        location.hash = '#/s/' + el.dataset.sheet;
      });
    });
    sheetsEl.querySelectorAll('[data-done]').forEach(b => {
      b.addEventListener('click', e => {
        e.stopPropagation();
        const s = S.getSheet(b.dataset.done);
        if (!s) return;
        s.done = !s.done;
        s.updatedAt = Date.now();
        S.save();
        paint();
      });
    });
    sheetsEl.querySelectorAll('[data-del]').forEach(b => {
      b.addEventListener('click', async e => {
        e.stopPropagation();
        const s = S.getSheet(b.dataset.del);
        if (!s) return;
        const ok = await askConfirm({
          title: 'حذف برگه',
          message: 'این برگه با همه‌ی خط‌ها و اندازه‌هایش پاک شود؟',
          confirmText: 'حذف',
          danger: true
        });
        if (!ok) return;
        S.deleteSheet(s.id);
        paint();
      });
    });
  }

  function newSheet(){
    const s = S.createSheet();
    location.hash = '#/s/' + s.id;
  }

  async function menu(){
    const id = await askChoice({
      title: 'دفتر',
      items: [
        { id: 'backup', label: 'پشتیبان‌گیری', hint: 'همه‌ی برگه‌ها در یک فایل', icon: '⤓' },
        { id: 'restore', label: 'بازیابی پشتیبان', hint: 'خواندن فایل پشتیبان', icon: '⤒' },
        { id: 'theme', label: 'حالت نمایش', hint: themeLabel(), icon: '◐' },
        { id: 'about', label: 'درباره', icon: 'ⓘ' }
      ]
    });
    if (id === 'backup') await backup();
    else if (id === 'restore') restore();
    else if (id === 'theme') await pickTheme();
    else if (id === 'about') about();
  }

  function themeLabel(){
    const t = S.getDB().settings.theme;
    return t === 'light' ? 'روشن' : t === 'dark' ? 'تیره' : 'خودکار';
  }

  async function pickTheme(){
    const id = await askChoice({
      title: 'حالت نمایش',
      items: [
        { id: 'auto', label: 'خودکار', hint: 'هماهنگ با گوشی' },
        { id: 'light', label: 'روشن' },
        { id: 'dark', label: 'تیره' }
      ]
    });
    if (!id) return;
    setTheme(id);
    applyTheme();
    paint();
  }

  async function backup(){
    const data = S.exportDB();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const name = 'daftar-andaze-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    const shared = await shareFile(blob, name);
    toast(shared ? 'پشتیبان آماده شد' : 'پشتیبان ذخیره شد');
  }

  function restore(){
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'application/json,.json';
    inp.addEventListener('change', async () => {
      const file = inp.files && inp.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const ok = await askConfirm({
          title: 'بازیابی پشتیبان',
          message: 'برگه‌های فعلی با فایل پشتیبان جایگزین شوند؟ این کار برگشت‌پذیر نیست.',
          confirmText: 'جایگزین کن',
          danger: true
        });
        if (!ok) return;
        const n = S.importDB(data);
        toast(toFa(n) + ' برگه بازیابی شد');
        paint();
      } catch (e) {
        toast('فایل پشتیبان معتبر نیست');
      }
    });
    inp.click();
  }

  function about(){
    const body = document.createElement('div');
    body.className = 'sheet-msg';
    body.innerHTML = `
      <b>دفتر اندازه کناف</b><br>
      نسخه ۳<br><br>
      نقشه را با انگشت بکش و با ابزار «عدد» اندازه‌ها را روی نقشه بنویس.
      هر برگه خودکار روی همین گوشی ذخیره می‌شود؛ برای اطمینان از «پشتیبان‌گیری» استفاده کن.`;
    openSheet({
      title: 'درباره',
      body,
      actions: [{ label: 'باشه', kind: 'pri' }]
    });
  }

  root.querySelector('[data-act="new"]').addEventListener('click', newSheet);
  root.querySelector('[data-act="menu"]').addEventListener('click', menu);
  qEl.addEventListener('input', () => {
    query = qEl.value;
    paint();
  });

  paint();

  return { destroy(){} };
}
