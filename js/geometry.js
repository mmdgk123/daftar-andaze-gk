/* هندسه و ثابت‌های مشترک — مختصات «واحد صفحه» است، نه سانتی‌متر */

/* اندازه‌ی برگه: مثل یک کاغذ عمودی (نسبت ۱ به ۱٫۴) */
export const PAGE = { w: 1000, h: 1400 };

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function bbox(list){
  if (!list || !list.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of list){
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}
