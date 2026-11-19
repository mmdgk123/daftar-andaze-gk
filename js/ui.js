/* اجزای رابط: شیت پایین، پرسش متن/عدد/فرم، اعلان و تم */

import { getDB, setSetting } from './store.js';
import { parseNum, fmtLen } from './util.js';

export function toast(msg, kind){
  const box = document.getElementById('toasts');
  if (!box) return;
  const t = document.createElement('div');
  t.className = 'toast' + (kind ? ' ' + kind : '');
  t.textContent = msg;
  box.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 260);
  }, 2100);
}

export function applyTheme(){
  let theme = 'auto';
  try { theme = getDB().settings.theme || 'auto'; } catch (e) { theme = 'auto'; }
  const dark = theme === 'dark' ||
    (theme === 'auto' && !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches));
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0a100e' : '#0f7c8a');
  return dark;
}

export function setTheme(theme){
  setSetting('theme', theme);
  applyTheme();
}

function kbFit(scrim){
  if (!window.visualViewport) return;
  const vv = window.visualViewport;
  const off = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
  scrim.style.setProperty('--kb', Math.min(off, window.innerHeight * 0.55) + 'px');
}

export function openSheet(opts){
  const o = opts || {};
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  if (o.title){
    const h = document.createElement('div');
    h.className = 'sheet-title';
    h.textContent = o.title;
    sheet.appendChild(h);
  }
  if (o.body) sheet.appendChild(o.body);

  let closed = false;

  function onKey(e){
    if (e.key === 'Escape' && o.dismissible !== false) close(true);
  }
  function onVV(){ kbFit(scrim); }

  function close(viaDismiss){
    if (closed) return;
    closed = true;
    scrim.classList.remove('open');
    document.removeEventListener('keydown', onKey);
    if (window.visualViewport){
      visualViewport.removeEventListener('resize', onVV);
      visualViewport.removeEventListener('scroll', onVV);
    }
    setTimeout(() => scrim.remove(), 240);
    if (viaDismiss && o.onDismiss) o.onDismiss();
  }

  const actions = o.actions || [];
  if (actions.length){
    const row = document.createElement('div');
    row.className = 'sheet-actions';
    actions.forEach(a => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn ' + (a.kind || '');
      b.textContent = a.label;
      b.addEventListener('click', () => {
        if (a.close !== false) close(false);
        if (a.onClick) a.onClick();
      });
      row.appendChild(b);
    });
    sheet.appendChild(row);
  }

  scrim.appendChild(sheet);
  document.body.appendChild(scrim);
  scrim.addEventListener('click', e => {
    if (e.target === scrim && o.dismissible !== false) close(true);
  });
  document.addEventListener('keydown', onKey);
  if (window.visualViewport){
    visualViewport.addEventListener('resize', onVV);
    visualViewport.addEventListener('scroll', onVV);
  }
  requestAnimationFrame(() => {
    scrim.classList.add('open');
    kbFit(scrim);
  });

  return { close, sheet, body: o.body || null };
}

function focusInput(inp){
  /* فوکوس هم‌گام با لمس کاربر تا کیبورد آیفون مطمئن بالا بیاید */
  try { inp.focus({ preventScroll: true }); } catch (e) { try { inp.focus(); } catch (e2) {} }
  requestAnimationFrame(() => {
    try { inp.focus({ preventScroll: true }); } catch (e) {}
    const scrim = document.querySelector('.scrim.open');
    if (scrim) kbFit(scrim);
  });
  setTimeout(() => {
    if (document.activeElement !== inp){
      try { inp.focus({ preventScroll: true }); } catch (e) {}
    }
    const scrim = document.querySelector('.scrim.open');
    if (scrim) kbFit(scrim);
  }, 220);
}

/* ورود اندازه: تایپ عدد و ثبت — با دکمه‌ی «همان عدد قبلی» برای سرعت */
export function askDimension(opts){
  const o = opts || {};
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if (done) return; done = true; resolve(v); };

    const body = document.createElement('div');
    body.className = 'sheet-body';

    const editing = o.value != null;

    if (!editing && o.lastValue != null && isFinite(o.lastValue)){
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chipbtn';
      chip.textContent = 'همان عدد قبلی: ' + fmtLen(o.lastValue);
      body.appendChild(chip);
      chip.addEventListener('click', () => {
        const v = o.lastValue;
        sheet.close();
        finish({ action: 'set', value: v });
      });
    }

    const inp = document.createElement('input');
    inp.className = 'inp num';
    inp.type = 'text';
    inp.inputMode = 'decimal';
    inp.enterKeyHint = 'done';
    inp.autocomplete = 'off';
    inp.spellcheck = false;
    inp.placeholder = 'مثلاً ۱۱۵';
    inp.value = editing ? fmtLen(o.value) : '';
    body.appendChild(inp);

    const submit = () => {
      const n = parseNum(inp.value);
      sheet.close();
      if (!isFinite(n) || n <= 0){
        toast('عدد معتبر بنویس');
        finish(null);
        return;
      }
      finish({ action: 'set', value: n });
    };

    const actions = [
      { label: 'ثبت', kind: 'pri', close: false, onClick: submit }
    ];
    if (editing){
      actions.push({
        label: 'حذف', kind: 'del', close: false,
        onClick: () => { sheet.close(); finish({ action: 'delete' }); }
      });
    }
    actions.push({ label: 'لغو', onClick: () => finish(null) });

    const sheet = openSheet({
      title: o.title || 'اندازه (سانتی‌متر)',
      body,
      onDismiss: () => finish(null),
      actions
    });

    focusInput(inp);
  });
}

export function askText(opts){
  const o = opts || {};
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if (done) return; done = true; resolve(v); };

    const body = document.createElement('div');
    body.className = 'sheet-body';
    const inp = document.createElement(o.multiline ? 'textarea' : 'input');
    inp.className = 'inp';
    if (o.multiline){
      inp.rows = 3;
    } else {
      inp.type = 'text';
      inp.inputMode = o.inputMode || 'text';
      inp.autocomplete = 'off';
    }
    inp.value = o.value == null ? '' : String(o.value);
    inp.placeholder = o.placeholder || '';
    body.appendChild(inp);

    const sheet = openSheet({
      title: o.title || '',
      body,
      onDismiss: () => finish(null),
      actions: [
        {
          label: o.confirmText || 'ثبت',
          kind: 'pri',
          close: false,
          onClick: () => {
            const v = inp.value.trim();
            sheet.close();
            finish(v);
          }
        },
        { label: 'لغو', onClick: () => finish(null) }
      ]
    });

    if (!o.multiline){
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter'){
          e.preventDefault();
          const v = inp.value.trim();
          sheet.close();
          finish(v);
        }
      });
    }
    focusInput(inp);
  });
}

export function askConfirm(opts){
  const o = opts || {};
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if (done) return; done = true; resolve(v); };

    const body = document.createElement('p');
    body.className = 'sheet-msg';
    body.textContent = o.message || '';

    openSheet({
      title: o.title || '',
      body,
      onDismiss: () => finish(false),
      actions: [
        { label: o.confirmText || 'تأیید', kind: o.danger ? 'del' : 'pri', onClick: () => finish(true) },
        { label: o.cancelText || 'لغو', onClick: () => finish(false) }
      ]
    });
  });
}

export function askChoice(opts){
  const o = opts || {};
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if (done) return; done = true; resolve(v); };

    const body = document.createElement('div');
    body.className = 'sheet-list';
    let sheet = null;

    (o.items || []).forEach(it => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'choice' + (it.danger ? ' danger' : '');
      const icon = document.createElement('span');
      icon.className = 'ci';
      icon.textContent = it.icon || '';
      const ct = document.createElement('span');
      ct.className = 'ct';
      ct.textContent = it.label || '';
      if (it.hint){
        const small = document.createElement('small');
        small.textContent = it.hint;
        ct.appendChild(small);
      }
      b.appendChild(icon);
      b.appendChild(ct);
      b.addEventListener('click', () => {
        if (sheet) sheet.close();
        finish(it.id);
      });
      body.appendChild(b);
    });

    sheet = openSheet({
      title: o.title || '',
      body,
      onDismiss: () => finish(null),
      actions: [{ label: o.cancelText || 'بستن', onClick: () => finish(null) }]
    });
  });
}

export function askForm(opts){
  const o = opts || {};
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if (done) return; done = true; resolve(v); };

    const body = document.createElement('div');
    body.className = 'sheet-body';
    const inputs = {};

    (o.fields || []).forEach(f => {
      const label = document.createElement('label');
      label.className = 'fld';
      const cap = document.createElement('span');
      cap.textContent = f.label || '';
      label.appendChild(cap);
      const inp = document.createElement(f.type === 'textarea' ? 'textarea' : 'input');
      inp.className = 'inp';
      if (f.type === 'textarea'){
        inp.rows = 3;
      } else {
        inp.type = f.type || 'text';
        if (f.inputMode) inp.inputMode = f.inputMode;
        inp.autocomplete = 'off';
      }
      inp.value = f.value == null ? '' : String(f.value);
      inp.placeholder = f.placeholder || '';
      label.appendChild(inp);
      body.appendChild(label);
      inputs[f.key] = inp;
    });

    const collect = () => {
      const out = {};
      Object.keys(inputs).forEach(k => { out[k] = inputs[k].value.trim(); });
      return out;
    };

    const sheet = openSheet({
      title: o.title || '',
      body,
      onDismiss: () => finish(null),
      actions: [
        {
          label: o.confirmText || 'ثبت',
          kind: 'pri',
          close: false,
          onClick: () => {
            const v = collect();
            sheet.close();
            finish(v);
          }
        },
        { label: 'لغو', onClick: () => finish(null) }
      ]
    });

    const first = Object.values(inputs)[0];
    if (first) focusInput(first);
  });
}
