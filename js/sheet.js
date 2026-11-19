/* برگه: کشیدن نقشه با قلم و نوشتن اندازه‌ها با ابزار عدد */

import * as S from './store.js';
import { drawSheet, collectPalette, pageView, labelWidthPx, LIGHT_PALETTE } from './render.js';
import { PAGE, clamp } from './geometry.js';
import { uid, toFa, esc, fmtLen, shareFile } from './util.js';
import { askText, askForm, askDimension, askChoice, askConfirm, toast } from './ui.js';

export function renderSheet(root, sheetId){
  const sheet = S.getSheet(sheetId);
  if (!sheet){
    toast('برگه پیدا نشد');
    location.hash = '#/';
    return { destroy(){} };
  }

  document.body.classList.add('editing');

  root.innerHTML = `
  <div class="ed">
    <header class="bar">
      <button class="icon" data-act="back" aria-label="برگشت">›</button>
      <button class="ttl" data-act="rename">${esc(sheet.title)}</button>
      <button class="icon" data-act="done" aria-label="بریده شد">✓</button>
      <button class="icon" data-act="more" aria-label="بیشتر">⋯</button>
    </header>

    <div class="cvwrap">
      <canvas id="cv"></canvas>
      <div class="zoomers">
        <button data-act="zin" aria-label="بزرگ‌تر">+</button>
        <button data-act="zout" aria-label="کوچک‌تر">−</button>
        <button data-act="fit" aria-label="نمایش کامل">⤢</button>
      </div>
      <div class="cvhint" id="cvhint"></div>
    </div>

    <div class="tools">
      <div class="toolrow">
        <div class="seg" id="seg">
          <button data-tool="pen">✎ قلم</button>
          <button data-tool="num"># عدد</button>
        </div>
        <button class="iconbtn wide" data-act="mirror" aria-label="برگردان نقشه">⇋ برگردان</button>
        <button class="iconbtn" data-act="undo" aria-label="واگرد">↩</button>
        <button class="iconbtn" data-act="redo" aria-label="از نو">↪</button>
      </div>
    </div>
  </div>`;

  const cv = root.querySelector('#cv');
  const wrapEl = root.querySelector('.cvwrap');
  const ctx = cv.getContext('2d');
  const seg = root.querySelector('#seg');
  const hintEl = root.querySelector('#cvhint');
  const doneBtn = root.querySelector('[data-act="done"]');

  const cfg = () => S.getDB().settings;

  const state = {
    W: 1,
    H: 1,
    view: { scale: 0.3, ox: 0, oy: 0 },
    tool: 'pen',
    stroke: null,
    strokePrev: null,
    tap: null,
    dragLabel: null,
    pointers: new Map(),
    pinch: null,
    lastValue: null,
    history: [],
    future: [],
    fitted: false
  };

  let palCache = null;
  const pal = () => (palCache || (palCache = collectPalette(cv)));

  doneBtn.classList.toggle('on', !!sheet.done);

  /* ---------- مختصات ---------- */
  const clampScale = s => Math.min(6, Math.max(0.05, s));

  function evPos(e){
    const r = cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function toPage(px, py){
    return { x: (px - state.view.ox) / state.view.scale, y: (py - state.view.oy) / state.view.scale };
  }
  function toPx(p){
    return { x: p.x * state.view.scale + state.view.ox, y: p.y * state.view.scale + state.view.oy };
  }
  function pageClamp(p){
    return { x: clamp(p.x, 0, PAGE.w), y: clamp(p.y, 0, PAGE.h) };
  }

  /* ---------- بوم ---------- */
  function sizeCanvas(){
    const r = wrapEl.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    state.W = Math.max(1, Math.round(r.width));
    state.H = Math.max(1, Math.round(r.height));
    cv.width = Math.round(state.W * dpr);
    cv.height = Math.round(state.H * dpr);
    cv.style.width = state.W + 'px';
    cv.style.height = state.H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!state.fitted){
      state.fitted = true;
      fit();
    } else {
      render();
    }
  }

  function render(){
    drawSheet(ctx, state.W, state.H, pal(), {
      sheet,
      view: state.view,
      showGrid: cfg().showGrid,
      live: state.stroke ? state.stroke.pts : null
    });
  }

  function fit(){
    state.view = pageView(state.W, state.H);
    render();
  }

  function zoom(f){
    const cx = state.W / 2, cy = state.H / 2;
    const w = toPage(cx, cy);
    const s = clampScale(state.view.scale * f);
    state.view = { scale: s, ox: cx - w.x * s, oy: cy - w.y * s };
    render();
  }

  /* ---------- تاریخچه ---------- */
  const snap = () => JSON.stringify({ strokes: sheet.strokes || [], labels: sheet.labels || [] });

  function pushHistory(){
    state.history.push(snap());
    if (state.history.length > 50) state.history.shift();
    state.future = [];
  }

  function restore(str){
    const o = JSON.parse(str);
    sheet.strokes = o.strokes || [];
    sheet.labels = o.labels || [];
    state.dragLabel = null;
  }

  function undo(){
    if (!state.history.length){ toast('چیزی برای واگرد نیست'); return; }
    state.future.push(snap());
    restore(state.history.pop());
    saveSheet();
    render();
  }

  function redo(){
    if (!state.future.length){ toast('چیزی برای از نو نیست'); return; }
    state.history.push(snap());
    restore(state.future.pop());
    saveSheet();
    render();
  }

  function saveSheet(){
    sheet.updatedAt = Date.now();
    S.save();
  }

  /* ---------- قلم ---------- */
  function startStroke(p){
    state.strokePrev = snap();
    state.stroke = { id: uid(), pts: [[p.x, p.y]] };
    render();
  }

  function extendStroke(p){
    if (!state.stroke) return;
    const pts = state.stroke.pts;
    const last = pts[pts.length - 1];
    const min = Math.max(0.7, 1.5 / state.view.scale);
    if (Math.hypot(p.x - last[0], p.y - last[1]) < min) return;
    pts.push([p.x, p.y]);
    render();
  }

  function endStroke(){
    const st = state.stroke;
    state.stroke = null;
    if (!st) return;
    if (st.pts.length >= 2){
      if (state.strokePrev){
        state.history.push(state.strokePrev);
        if (state.history.length > 50) state.history.shift();
        state.future = [];
      }
      sheet.strokes.push(st);
      saveSheet();
    }
    state.strokePrev = null;
    render();
  }

  /* ---------- برچسب عدد ---------- */
  function hitLabel(p){
    const labels = sheet.labels || [];
    for (let i = labels.length - 1; i >= 0; i--){
      const l = labels[i];
      const q = toPx(l);
      const w = labelWidthPx(fmtLen(l.value));
      if (Math.abs(q.x - p.x) <= w / 2 && Math.abs(q.y - p.y) <= 15) return l;
    }
    return null;
  }

  async function addLabelAt(pagePt){
    const res = await askDimension({
      title: 'اندازه (سانتی‌متر)',
      lastValue: state.lastValue
    });
    if (!res || res.action !== 'set') return;
    pushHistory();
    const l = {
      id: uid(),
      x: clamp(pagePt.x, 0, PAGE.w),
      y: clamp(pagePt.y, 0, PAGE.h),
      value: res.value
    };
    sheet.labels.push(l);
    state.lastValue = res.value;
    saveSheet();
    render();
    hint();
  }

  async function editLabel(l){
    const res = await askDimension({ title: 'ویرایش اندازه', value: l.value });
    if (!res) return;
    pushHistory();
    if (res.action === 'delete'){
      sheet.labels = sheet.labels.filter(x => x.id !== l.id);
    } else {
      l.value = res.value;
      state.lastValue = res.value;
    }
    saveSheet();
    render();
    hint();
  }

  /* ---------- اشاره‌گر ---------- */
  function onDown(e){
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    const p = evPos(e);
    state.pointers.set(e.pointerId, p);

    if (state.pointers.size === 2){
      beginPinch();
      return;
    }
    if (state.pointers.size > 2) return;

    if (state.tool === 'num'){
      const l = hitLabel(p);
      if (l){
        state.dragLabel = { id: l.id, moved: false };
      } else {
        state.tap = { x: p.x, y: p.y, page: pageClamp(toPage(p.x, p.y)), moved: false };
      }
      return;
    }

    startStroke(pageClamp(toPage(p.x, p.y)));
  }

  function onMove(e){
    const p = evPos(e);
    if (state.pointers.has(e.pointerId)) state.pointers.set(e.pointerId, p);

    if (state.pointers.size >= 2 && state.pinch){
      updatePinch();
      return;
    }

    if (state.tap){
      if (Math.hypot(p.x - state.tap.x, p.y - state.tap.y) > 12) state.tap.moved = true;
      return;
    }

    if (state.dragLabel){
      const l = (sheet.labels || []).find(x => x.id === state.dragLabel.id);
      if (!l) return;
      if (!state.dragLabel.moved){
        pushHistory();
        state.dragLabel.moved = true;
      }
      const pg = toPage(p.x, p.y);
      l.x = clamp(pg.x, 0, PAGE.w);
      l.y = clamp(pg.y, 0, PAGE.h);
      render();
      return;
    }

    if (state.stroke){
      extendStroke(pageClamp(toPage(p.x, p.y)));
    }
  }

  function onUp(e){
    state.pointers.delete(e.pointerId);
    if (state.pointers.size < 2) state.pinch = null;

    if (state.stroke){
      endStroke();
      return;
    }

    if (state.dragLabel){
      const d = state.dragLabel;
      state.dragLabel = null;
      if (d.moved){
        saveSheet();
      } else {
        const l = (sheet.labels || []).find(x => x.id === d.id);
        if (l) editLabel(l);
      }
      return;
    }

    if (state.tap){
      const t = state.tap;
      state.tap = null;
      if (!t.moved && state.pointers.size === 0) addLabelAt(t.page);
    }
  }

  /* ---------- دو انگشت ---------- */
  function beginPinch(){
    if (state.stroke) endStroke();
    state.tap = null;
    if (state.dragLabel && state.dragLabel.moved) saveSheet();
    state.dragLabel = null;

    const pts = Array.from(state.pointers.values());
    if (pts.length < 2) return;
    const a = pts[0], b = pts[1];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    state.pinch = {
      d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      s0: state.view.scale,
      world: {
        x: (mid.x - state.view.ox) / state.view.scale,
        y: (mid.y - state.view.oy) / state.view.scale
      }
    };
  }

  function updatePinch(){
    const pts = Array.from(state.pointers.values());
    if (pts.length < 2 || !state.pinch) return;
    const a = pts[0], b = pts[1];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const d = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
    const s = clampScale(state.pinch.s0 * (d / state.pinch.d0));
    state.view = { scale: s, ox: mid.x - state.pinch.world.x * s, oy: mid.y - state.pinch.world.y * s };
    render();
  }

  /* ---------- نوار ابزار ---------- */
  function setTool(t){
    state.tool = t;
    state.tap = null;
    updateChrome();
  }

  function hint(){
    const n = (sheet.labels || []).length;
    const count = n ? toFa(n) + ' اندازه · ' : '';
    hintEl.textContent = count + (state.tool === 'pen' ? 'با انگشت بکش' : 'روی صفحه بزن و اندازه را بنویس');
  }

  function updateChrome(){
    seg.querySelectorAll('button').forEach(b => {
      b.classList.toggle('on', b.dataset.tool === state.tool);
    });
    hint();
  }

  /* ---------- منوی برگه ---------- */
  /* وقتی نقشه را از پشت صفحه (روی زمینه) کشیده‌ای، یک ضربه نقشه را چپ‌وراست
     می‌کند تا با روی صفحه‌ای که برش می‌خورد بخواند؛ لازم نیست ورق را بگردانی. */
  function mirror(){
    if (!(sheet.strokes || []).length && !(sheet.labels || []).length){
      toast('چیزی برای برگرداندن نیست');
      return;
    }
    pushHistory();
    (sheet.strokes || []).forEach(st => (st.pts || []).forEach(p => { p[0] = PAGE.w - p[0]; }));
    (sheet.labels || []).forEach(l => { l.x = PAGE.w - l.x; });
    saveSheet();
    render();
    toast('نقشه برگردانده شد ⇋');
  }

  function exportPng(){
    const W = 1400, H = 1960;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const octx = c.getContext('2d');
    if (!octx) return;
    drawSheet(octx, W, H, LIGHT_PALETTE, {
      sheet,
      view: { scale: W / PAGE.w, ox: 0, oy: 0 },
      showGrid: true,
      labelFs: 20
    });
    c.toBlob(async blob => {
      if (!blob){ toast('ساخت تصویر ناموفق بود'); return; }
      const shared = await shareFile(blob, 'kanaf-sheet.png', sheet.title || '');
      toast(shared ? 'تصویر آماده شد' : 'تصویر ذخیره شد');
    }, 'image/png');
  }

  async function clearAll(){
    if (!(sheet.strokes || []).length && !(sheet.labels || []).length){
      toast('این برگه خالی است');
      return;
    }
    const ok = await askConfirm({
      title: 'پاک کردن همه',
      message: 'همه‌ی خط‌ها و اندازه‌های این برگه پاک شوند؟',
      confirmText: 'پاک کن',
      danger: true
    });
    if (!ok) return;
    pushHistory();
    sheet.strokes = [];
    sheet.labels = [];
    saveSheet();
    render();
    hint();
  }

  async function removeSheet(){
    const ok = await askConfirm({
      title: 'حذف برگه',
      message: 'این برگه با همه‌ی خط‌ها و اندازه‌هایش پاک شود؟',
      confirmText: 'حذف',
      danger: true
    });
    if (!ok) return;
    S.deleteSheet(sheet.id);
    location.hash = '#/';
  }

  async function editNote(){
    const v = await askText({
      title: 'یادداشت برگه',
      value: sheet.note || '',
      placeholder: 'توضیح کوتاه',
      multiline: true,
      confirmText: 'ذخیره'
    });
    if (v === null) return;
    sheet.note = v;
    saveSheet();
    toast('ذخیره شد');
  }

  async function info(){
    const v = await askForm({
      title: 'اطلاعات برگه',
      confirmText: 'ذخیره',
      fields: [
        { key: 'title', label: 'نام برگه', value: sheet.title },
        { key: 'client', label: 'مشتری', value: sheet.client || '', placeholder: 'اختیاری' }
      ]
    });
    if (!v) return;
    sheet.title = v.title || 'برگه';
    sheet.client = v.client;
    root.querySelector('[data-act="rename"]').textContent = sheet.title;
    saveSheet();
  }

  async function more(){
    const id = await askChoice({
      title: sheet.title,
      items: [
        { id: 'info', label: 'نام و مشتری', icon: '✎' },
        { id: 'grid', label: 'شبکه', hint: cfg().showGrid ? 'روشن' : 'خاموش', icon: '⌗' },
        { id: 'note', label: 'یادداشت برگه', hint: sheet.note || 'خالی', icon: '☰' },
        { id: 'share', label: 'ارسال تصویر برگه', icon: '↗' },
        { id: 'new', label: 'برگه تازه', icon: '＋' },
        { id: 'clear', label: 'پاک کردن همه', icon: '✕', danger: true },
        { id: 'del', label: 'حذف برگه', icon: '⌫', danger: true }
      ]
    });
    if (!id) return;
    if (id === 'info') await info();
    else if (id === 'grid'){ S.setSetting('showGrid', !cfg().showGrid); render(); }
    else if (id === 'note') await editNote();
    else if (id === 'share') exportPng();
    else if (id === 'new'){
      const s = S.createSheet();
      location.hash = '#/s/' + s.id;
    } else if (id === 'clear') await clearAll();
    else if (id === 'del') await removeSheet();
  }

  /* ---------- اتصال‌ها ---------- */
  root.querySelector('[data-act="back"]').addEventListener('click', () => {
    location.hash = '#/';
  });
  root.querySelector('[data-act="rename"]').addEventListener('click', info);
  root.querySelector('[data-act="more"]').addEventListener('click', more);
  doneBtn.addEventListener('click', () => {
    sheet.done = !sheet.done;
    doneBtn.classList.toggle('on', sheet.done);
    saveSheet();
    toast(sheet.done ? 'علامت بریده‌شد خورد' : 'علامت برداشته شد');
  });
  root.querySelector('[data-act="zin"]').addEventListener('click', () => zoom(1.3));
  root.querySelector('[data-act="zout"]').addEventListener('click', () => zoom(1 / 1.3));
  root.querySelector('[data-act="fit"]').addEventListener('click', () => fit());
  root.querySelector('[data-act="undo"]').addEventListener('click', undo);
  root.querySelector('[data-act="redo"]').addEventListener('click', redo);
  root.querySelector('[data-act="mirror"]').addEventListener('click', mirror);

  seg.addEventListener('click', e => {
    const b = e.target.closest('button[data-tool]');
    if (!b) return;
    setTool(b.dataset.tool);
  });

  cv.addEventListener('pointerdown', onDown);
  cv.addEventListener('pointermove', onMove);
  cv.addEventListener('pointerup', onUp);
  cv.addEventListener('pointercancel', onUp);

  window.addEventListener('resize', sizeCanvas);
  const ro = new ResizeObserver(() => sizeCanvas());
  ro.observe(wrapEl);

  requestAnimationFrame(() => {
    sizeCanvas();
    updateChrome();
  });

  return {
    destroy(){
      ro.disconnect();
      window.removeEventListener('resize', sizeCanvas);
      document.body.classList.remove('editing');
    }
  };
}
