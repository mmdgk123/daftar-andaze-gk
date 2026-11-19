/* مدل داده و ذخیره‌سازی: برگه‌ها (خط‌های دستی + برچسب اندازه) */

import { uid, toFa, faDate } from './util.js';
import { bbox, PAGE } from './geometry.js';

const KEY = 'kanaf.v3';
const KEY2 = 'kanaf.v2';
const KEY1 = 'kanaf-notebook-v1';

/* در نسخه‌ی ۲ مختصات سانتی‌متر بود؛ اینجا صفحه‌ای ۴۰۰ سانت عرض دارد */
const CM2PAGE = PAGE.w / 400;

let db = null;

function fresh(){
  return { v: 3, sheets: [], settings: { theme: 'auto', showGrid: true } };
}

export function getDB(){
  if (!db) hydrate();
  return db;
}

function hydrate(){
  let parsed = null;
  try { parsed = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { parsed = null; }

  if (parsed && typeof parsed === 'object' && Array.isArray(parsed.sheets)){
    db = parsed;
    normalize();
  } else {
    db = fresh();
    migrate();
  }
}

function normalize(){
  if (!db.settings || typeof db.settings !== 'object') db.settings = fresh().settings;
  if (typeof db.settings.showGrid !== 'boolean') db.settings.showGrid = true;
  if (!db.settings.theme) db.settings.theme = 'auto';

  db.sheets.forEach(s => {
    if (!s.id) s.id = uid();
    if (!Array.isArray(s.strokes)) s.strokes = [];
    if (!Array.isArray(s.labels)) s.labels = [];
    if (!s.createdAt) s.createdAt = Date.now();
    if (!s.updatedAt) s.updatedAt = s.createdAt;
  });
}

export function save(){
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { console.warn('ذخیره نشد', e); }
}

export function setSetting(key, value){
  getDB().settings[key] = value;
  save();
}

/* ---------- انتقال داده‌ی نسخه‌های قبلی ---------- */
function centerSheet(sheet){
  const all = [];
  (sheet.strokes || []).forEach(st => (st.pts || []).forEach(p => all.push({ x: p[0], y: p[1] })));
  (sheet.labels || []).forEach(l => all.push({ x: l.x, y: l.y }));
  if (!all.length) return;
  const bb = bbox(all);
  if (!bb) return;
  const dx = PAGE.w / 2 - (bb.minX + bb.w / 2);
  const dy = PAGE.h / 2 - (bb.minY + bb.h / 2);
  if (!isFinite(dx) || !isFinite(dy)) return;
  (sheet.strokes || []).forEach(st => (st.pts || []).forEach(p => { p[0] += dx; p[1] += dy; }));
  (sheet.labels || []).forEach(l => { l.x += dx; l.y += dy; });
}

function migrate(){
  /* نسخه ۲: کارها و قطعه‌های چندضلعی */
  let v2 = null;
  try { v2 = JSON.parse(localStorage.getItem(KEY2) || 'null'); } catch (e) { v2 = null; }

  if (v2 && Array.isArray(v2.jobs) && v2.jobs.length){
    const out = [];
    v2.jobs.forEach(job => {
      (job.pieces || []).forEach(piece => {
        const strokes = [];
        (piece.shapes || []).forEach(sh => {
          const pts = (sh.pts || []).map(p => [p.x * CM2PAGE, p.y * CM2PAGE]);
          if (sh.kind === 'poly' && sh.closed && pts.length >= 3) pts.push(pts[0].slice());
          if (pts.length >= 2) strokes.push({ id: uid(), pts });
        });
        let note = piece.note || job.note || '';
        if (piece.notes && piece.notes.length){
          const extra = piece.notes.map(n => n.text).filter(Boolean).join('، ');
          if (extra) note = note ? note + ' — ' + extra : extra;
        }
        const sheetTitle = (piece.title && piece.title !== 'شکل')
          ? piece.title
          : (job.title || 'برگه');
        const sheet = {
          id: uid(),
          title: sheetTitle,
          client: job.client || '',
          note,
          done: !!piece.done,
          createdAt: piece.createdAt || job.createdAt || Date.now(),
          updatedAt: piece.updatedAt || job.updatedAt || Date.now(),
          strokes,
          labels: []
        };
        centerSheet(sheet);
        out.push(sheet);
      });
    });
    if (out.length){
      db.sheets = out;
      save();
      return;
    }
  }

  /* نسخه ۱: برگه‌های طراحی آزاد */
  let v1 = null;
  try { v1 = JSON.parse(localStorage.getItem(KEY1) || 'null'); } catch (e) { v1 = null; }
  if (!Array.isArray(v1) || !v1.length) return;

  db.sheets = v1.map(sh => {
    const strokes = [];
    (sh.strokes || []).forEach(st => {
      const pts = (st.points || []).map(p => [(p[0] || 0) * PAGE.w, (p[1] || 0) * PAGE.h]);
      if (pts.length >= 2) strokes.push({ id: uid(), pts });
    });
    const labels = (sh.labels || [])
      .filter(l => l && isFinite(l.value))
      .map(l => ({
        id: uid(),
        x: (typeof l.x === 'number' ? l.x : 0.5) * PAGE.w,
        y: (typeof l.y === 'number' ? l.y : 0.5) * PAGE.h,
        value: Number(l.value)
      }));
    const created = Number(sh.createdAt) || Date.now();
    return {
      id: uid(),
      title: 'برگه‌ی قبلی — ' + faDate(created),
      client: '',
      note: 'از نسخه‌ی قدیمی منتقل شد',
      done: !!sh.done,
      createdAt: created,
      updatedAt: Number(sh.updatedAt) || created,
      strokes,
      labels
    };
  });
  save();
}

/* ---------- برگه‌ها ---------- */
export function listSheets(){
  return getDB().sheets.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function getSheet(id){
  return getDB().sheets.find(s => s.id === id) || null;
}

function autoTitle(ts){
  try {
    const d = new Date(ts);
    const date = toFa(d.toLocaleDateString('fa-IR'));
    const time = toFa(d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }));
    return 'برگه ' + date + ' · ' + time;
  } catch (e) {
    return 'برگه تازه';
  }
}

export function createSheet(){
  const now = Date.now();
  const sheet = {
    id: uid(),
    title: autoTitle(now),
    client: '',
    note: '',
    done: false,
    createdAt: now,
    updatedAt: now,
    strokes: [],
    labels: []
  };
  getDB().sheets.unshift(sheet);
  save();
  return sheet;
}

export function updateSheet(id, patch){
  const sheet = getSheet(id);
  if (!sheet) return null;
  Object.keys(patch || {}).forEach(k => { sheet[k] = patch[k]; });
  sheet.updatedAt = Date.now();
  save();
  return sheet;
}

export function deleteSheet(id){
  const d = getDB();
  d.sheets = d.sheets.filter(s => s.id !== id);
  save();
}

/* ---------- پشتیبان ---------- */
export function exportDB(){
  const d = getDB();
  return { app: 'daftar-andaze', v: 3, exportedAt: Date.now(), settings: d.settings, sheets: d.sheets };
}

export function importDB(data){
  if (!data || typeof data !== 'object' || !Array.isArray(data.sheets)){
    throw new Error('فایل پشتیبان معتبر نیست');
  }
  const next = fresh();
  if (data.settings && typeof data.settings === 'object'){
    next.settings = Object.assign(next.settings, data.settings);
  }
  next.sheets = JSON.parse(JSON.stringify(data.sheets));
  db = next;
  normalize();
  save();
  return db.sheets.length;
}
