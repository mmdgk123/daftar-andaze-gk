/* کشیدن برگه روی بوم: کاغذ، شبکه، خط‌های دستی و برچسب اندازه‌ها */

import { PAGE } from './geometry.js';
import { fmtLen } from './util.js';

const FONT = 'Vazirmatn, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
const GRID = 50;       /* هر خانه ۵۰ واحد صفحه */
const STRONG = 250;    /* خط پررنگ هر ۲۵۰ واحد */
export const PEN_W = 5; /* ضخامت قلم در واحد صفحه */

/* پالت روشن برای تصویر خروجی */
export const LIGHT_PALETTE = {
  bg: '#e9edeb',
  page: '#ffffff',
  grid: '#eef2f0',
  grid2: '#dde5e1',
  ink: '#12303a',
  pill: '#0f7c8a',
  pillText: '#ffffff',
  edge: '#d5ddd8'
};

export function collectPalette(el){
  const cs = getComputedStyle(el);
  const g = (name, fallback) => {
    const v = cs.getPropertyValue(name).trim();
    return v || fallback;
  };
  return {
    bg: g('--c-bg', '#e9edeb'),
    page: g('--c-page', '#ffffff'),
    grid: g('--c-grid', '#eef2f0'),
    grid2: g('--c-grid2', '#dde5e1'),
    ink: g('--c-ink', '#12303a'),
    pill: g('--c-pill', '#0f7c8a'),
    pillText: g('--c-pill-text', '#ffffff'),
    edge: g('--c-edge', '#d5ddd8')
  };
}

function pill(ctx, x, y, text, bg, fg, fs){
  const size = fs || 12;
  ctx.font = '700 ' + size + 'px ' + FONT;
  const w = ctx.measureText(String(text)).width + 14;
  const h = size + 11;
  const r = Math.min(h / 2, 9);
  const rx = x - w / 2, ry = y - h / 2;
  ctx.beginPath();
  ctx.moveTo(rx + r, ry);
  ctx.arcTo(rx + w, ry, rx + w, ry + h, r);
  ctx.arcTo(rx + w, ry + h, rx, ry + h, r);
  ctx.arcTo(rx, ry + h, rx, ry, r);
  ctx.arcTo(rx, ry, rx + w, ry, r);
  ctx.closePath();
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(text), x, y + 0.5);
}

/* عرض تقریبی برچسب برای تشخیص لمس */
export function labelWidthPx(text){
  return Math.max(46, String(text == null ? '' : text).length * 7 + 18);
}

/* نمای «کل برگه در صفحه» */
export function pageView(W, H){
  const pad = Math.max(6, Math.min(W, H) * 0.04);
  const s = Math.min((W - pad * 2) / PAGE.w, (H - pad * 2) / PAGE.h);
  return {
    scale: s,
    ox: (W - PAGE.w * s) / 2,
    oy: (H - PAGE.h * s) / 2
  };
}

export function drawSheet(ctx, W, H, pal, m){
  const view = m.view;
  const sheet = m.sheet || { strokes: [], labels: [] };
  const S = view.scale, ox = view.ox, oy = view.oy;
  const pw = PAGE.w * S, ph = PAGE.h * S;

  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, W, H);

  /* کاغذ */
  ctx.save();
  ctx.beginPath();
  ctx.rect(ox, oy, pw, ph);
  ctx.fillStyle = pal.page;
  ctx.fill();
  ctx.clip();

  /* شبکه */
  if (m.showGrid !== false){
    const step = GRID * S;
    if (step >= 5){
      ctx.beginPath();
      for (let x = GRID; x < PAGE.w; x += GRID){
        const X = ox + x * S;
        ctx.moveTo(X, oy);
        ctx.lineTo(X, oy + ph);
      }
      for (let y = GRID; y < PAGE.h; y += GRID){
        const Y = oy + y * S;
        ctx.moveTo(ox, Y);
        ctx.lineTo(ox + pw, Y);
      }
      ctx.strokeStyle = pal.grid;
      ctx.lineWidth = 1;
      ctx.stroke();

      const big = STRONG * S;
      if (big >= 12){
        ctx.beginPath();
        for (let x = STRONG; x < PAGE.w; x += STRONG){
          const X = ox + x * S;
          ctx.moveTo(X, oy);
          ctx.lineTo(X, oy + ph);
        }
        for (let y = STRONG; y < PAGE.h; y += STRONG){
          const Y = oy + y * S;
          ctx.moveTo(ox, Y);
          ctx.lineTo(ox + pw, Y);
        }
        ctx.strokeStyle = pal.grid2;
        ctx.stroke();
      }
    }
  }

  /* خط‌های دستی */
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = Math.max(1.2, PEN_W * S);

  (sheet.strokes || []).forEach(st => {
    const pts = st.pts || [];
    if (pts.length < 2) return;
    ctx.beginPath();
    pts.forEach((p, i) => {
      const X = ox + p[0] * S, Y = oy + p[1] * S;
      if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
    });
    ctx.stroke();
  });

  /* خطی که همین حالا در حال کشیدن است */
  const live = m.live || [];
  if (live.length > 1){
    ctx.beginPath();
    live.forEach((p, i) => {
      const X = ox + p[0] * S, Y = oy + p[1] * S;
      if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
    });
    ctx.stroke();
  }

  /* برچسب اندازه‌ها */
  const fs = m.labelFs || 12;
  (sheet.labels || []).forEach(l => {
    const X = ox + l.x * S, Y = oy + l.y * S;
    if (X < ox - 60 || X > ox + pw + 60 || Y < oy - 40 || Y > oy + ph + 40) return;
    pill(ctx, X, Y, fmtLen(l.value), pal.pill, pal.pillText, fs);
  });

  ctx.restore();

  /* حاشیه‌ی کاغذ */
  ctx.strokeStyle = pal.edge;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(ox, oy, pw, ph);

  ctx.restore();
}

/* بندانگشتی برگه در فهرست */
export function drawThumb(canvasEl, sheet){
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, canvasEl.clientWidth || 56);
  const h = Math.max(1, canvasEl.clientHeight || 78);
  canvasEl.width = Math.round(w * dpr);
  canvasEl.height = Math.round(h * dpr);
  const ctx = canvasEl.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const pal = collectPalette(canvasEl);
  drawSheet(ctx, w, h, pal, { sheet, view: pageView(w, h), showGrid: false });
}
