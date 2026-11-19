/* ابزارهای عمومی: عدد فارسی، شناسه، فایل و اشتراک‌گذاری */

export const FA = '۰۱۲۳۴۵۶۷۸۹';

export const toFa = s => String(s).replace(/[0-9]/g, d => FA[+d]);

export const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ورودی کاربر (ارقام فارسی/عربی، ممیز فارسی) را به عدد تبدیل می‌کند */
export function parseNum(raw){
  if (raw == null) return NaN;
  const s = String(raw).trim()
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[٫٬,]/g, '.')
    .replace(/[^0-9.]/g, '');
  const parts = s.split('.');
  const clean = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : s;
  return parseFloat(clean);
}

export function fmtNum(n, dec = 1){
  if (!isFinite(n)) return '—';
  const f = Math.pow(10, dec);
  const v = Math.round(n * f) / f;
  let s = v.toFixed(dec);
  if (dec > 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return toFa(s).replace('.', '٫');
}

export const fmtLen = cm => fmtNum(cm, 1);              /* سانتی‌متر */
export const fmtArea = cm2 => fmtNum(cm2 / 10000, 2);    /* متر مربع */
export const fmtM = cm => fmtNum(cm / 100, 2);           /* متر */

export function faDate(ts){
  if (!ts) return '';
  try {
    return toFa(new Date(ts).toLocaleDateString('fa-IR'));
  } catch (e) {
    return '';
  }
}

export function downloadBlob(blob, name){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 1500);
}

/* فایل را با اشتراک‌گذاری سیستم می‌فرستد و اگر نشد ذخیره می‌کند */
export async function shareFile(blob, name, text){
  const file = new File([blob], name, { type: blob.type || 'application/octet-stream' });
  if (navigator.canShare && navigator.canShare({ files: [file] })){
    try {
      await navigator.share({ files: [file], text: text || '' });
      return true;
    } catch (e) {
      if (e && e.name === 'AbortError') return true;
    }
  }
  downloadBlob(blob, name);
  return false;
}

export async function shareText(text){
  if (navigator.share){
    try {
      await navigator.share({ text });
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'abort';
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
    ta.remove();
    return ok ? 'copied' : 'failed';
  }
}
