import { analyze, analyzeAll, CIN_SEGMENTS, MAX_ITEMS } from './cin.js';

const $ = (sel) => document.querySelector(sel);
const input = $('#input');
const gutter = $('#gutter');
const editor = $('#editor');
const results = $('#results');
const count = $('#count');
const clearBtn = $('#clear');
const toastEl = $('#toast');

const PAGE = 500;
const STATUS_LABEL = { valid: 'Valid', warning: 'Needs a look', invalid: 'Invalid' };

const SAMPLE = [
  'L17110MH1973PLC019786',
  'L85110KA1981PLC013115',
  'U72900KA2019OPC123456',
  'L74899DL1993GOI054155',
  'AAA-1234',
  'aab5678',
  'L65993PN2007PLC130076',
  'L29120TZ1960PLC000351',
  'L17110MH1973PLCO19786',
  'U72200DL2015PTC12345',
  'U72200UK2015PTC123456',
  'L72900KA2016PTC123456',
  'U12345MH2031PTC123456',
  '27AAACR5055K1Z7',
  'AB-12345',
  'L17110MH1973PLC019786',
].join('\n');

const state = {
  data: null,
  filter: 'all',
  shown: PAGE,
  open: new Set(), // keys of expanded rows
  dist: [0, 0, 0],  // last valid / warning / invalid shares, for the bar to animate from
  arrive: false,    // play the arrival animation on the next render
};

// ---------------------------------------------------------------- helpers

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => n.toLocaleString('en-IN');
const rowKey = (r) => `${r.line}:${r.index}:${r.id}`;

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms()); };
}

// The number as typed, split into its parts, with problem characters marked.
function idMarkup(r) {
  const text = r.id || r.input.trim();
  const bad = new Set(r.errors.flatMap((e) => e.at || []));
  if (r.kind === 'cin' && text.length === 21) {
    return CIN_SEGMENTS.map((seg) => {
      const chars = [...text.slice(seg.start, seg.start + seg.len)]
        .map((c, k) => (bad.has(seg.start + k) ? `<mark>${esc(c)}</mark>` : esc(c))).join('');
      return `<span class="g">${chars}</span>`;
    }).join('');
  }
  return [...text].map((c, i) => (bad.has(i) ? `<mark>${esc(c)}</mark>` : esc(c))).join('');
}

function kindText(f) {
  if (!f) return '';
  if (f.entity === 'LLP') return 'LLP';
  return `${f.listed} company`;
}

function rowMessage(r) {
  if (r.status === 'invalid') return r.errors.find((e) => e.at?.length)?.msg || r.errors[0]?.msg || '';
  if (r.status === 'warning') return r.warnings[0];
  return '';
}

// ---------------------------------------------------------------- anatomy

const LLP_NOTE = 'An LLPIN is a serial number. It doesn’t record the state, year or type, so those come from the LLP’s filings.';

function anatomy(r, { large = false, animate = false, labels = null } = {}) {
  if (!r.segments) return '';
  let i = 0;
  const segs = r.segments.map((s) => {
    if (s.key === 'dash') return `<div class="seg seg-dash" style="--i:${i++}"><span class="seg-chars">-</span></div>`;
    const cls = s.bad === true ? ' is-bad' : s.bad === 'warn' ? ' is-warn' : '';
    const chars = [...(s.text || '')].map((c) => `<span class="ch">${esc(c)}</span>`).join('') || '&nbsp;';
    return `<div class="seg seg-${s.key}${cls}" style="--i:${i++}">
      <span class="seg-chars">${chars}</span>
      <span class="seg-meaning">${esc(s.meaning)}</span>
      <span class="seg-label">${esc(labels?.[s.key] ?? s.label)}</span>
    </div>`;
  }).join('');
  const cls = ['anatomy', large && 'anatomy-lg', r.kind === 'llpin' && 'anatomy-llp', animate && !reduceMotion() && 'animate'].filter(Boolean).join(' ');
  return `<div class="${cls}">${segs}</div>`;
}

// ---------------------------------------------------------------- empty state
// The hero decodes a few real-shaped CINs in turn, once, then stops.

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const HERO = [
  { id: 'L17110MH1973PLC019786', caption: 'A listed public company registered in Maharashtra in 1973.' },
  { id: 'U72900KA2019OPC123456', caption: 'An unlisted one person company registered in Karnataka in 2019.' },
  { id: 'L29120TZ1960PLC000351', caption: 'TZ is the Coimbatore registrar’s code. Older Tamil Nadu CINs use it instead of TN.' },
  { id: 'L65993PN2007PLC130076', caption: 'PN is the Pune registrar’s code. Older Maharashtra CINs use it instead of MH.' },
];
const HERO_LABELS = { listing: 'Listing', industry: 'Industry code', state: 'State', year: 'Incorporated', type: 'Company type', reg: 'Registration no.' };
const hero = { i: 0, timer: 0, raf: 0, seen: 0, hold: false, stopped: false };

function renderEmpty() {
  if (results.querySelector('#hero')) return; // already showing
  stopHero();
  hero.seen = 0;
  hero.stopped = reduceMotion();
  results.innerHTML = `
    <div class="panel empty">
      <h2>What a CIN tells you</h2>
      <p class="lede">Every Indian company has a 21-character Corporate Identity Number. Read left to right, it says:</p>
      <div class="hero" id="hero">
        <div id="hero-anatomy" aria-live="off"></div>
        <div class="hero-foot">
          <p class="hero-caption" id="hero-caption"></p>
          <div class="hero-pager" role="group" aria-label="Examples">
            ${HERO.map((h, k) => `<button type="button" class="dot" data-hero="${k}" aria-label="Example ${k + 1}: ${esc(h.id)}" aria-pressed="false"></button>`).join('')}
          </div>
        </div>
      </div>
      <div class="empty-llp">
        <span class="llp-sample">AAA-1234</span>
        <p>An LLP has an LLPIN instead: three letters, a hyphen and four digits. ${LLP_NOTE.replace('An LLPIN is', 'It’s')}</p>
      </div>
      <div class="empty-cta">
        <button type="button" class="btn btn-primary" data-act="sample">Try a sample list</button>
        <span class="empty-or">or paste your own list <span class="where"></span></span>
      </div>
    </div>`;
  const box = results.querySelector('#hero');
  box.addEventListener('pointerenter', () => { hero.hold = true; });
  box.addEventListener('pointerleave', () => { hero.hold = false; });
  box.addEventListener('focusin', () => { hero.hold = true; });
  box.addEventListener('focusout', () => { hero.hold = false; });
  showHero(0);
}

function showHero(i, { user = false } = {}) {
  const box = results.querySelector('#hero-anatomy');
  if (!box) return;
  hero.i = i;
  const r = analyze(HERO[i].id);
  box.innerHTML = anatomy(r, { large: true, animate: true, labels: HERO_LABELS });
  results.querySelector('#hero-caption').textContent = HERO[i].caption;
  results.querySelectorAll('[data-hero]').forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
  if (!reduceMotion()) scramble(box);
  if (user) hero.stopped = true;
  clearTimeout(hero.timer);
  hero.seen++;
  if (!hero.stopped && hero.seen < HERO.length + 1) hero.timer = setTimeout(nextHero, 4600);
}

function nextHero() {
  if (!results.querySelector('#hero')) return;
  if (hero.hold || document.hidden) { hero.timer = setTimeout(nextHero, 800); return; }
  showHero((hero.i + 1) % HERO.length);
}

function stopHero() {
  clearTimeout(hero.timer);
  cancelAnimationFrame(hero.raf);
}

// Each character flickers through look-alikes of its own kind, then settles, left to right.
function scramble(box) {
  const chars = [...box.querySelectorAll('.ch')];
  const LET = 'ABCDEFGHJKLMNPRSTUVWXYZ';
  const DIG = '0123456789';
  chars.forEach((el, k) => {
    el.dataset.final = el.textContent;
    el.dataset.at = String(160 + k * 34);
    el.classList.add('is-scr');
  });
  cancelAnimationFrame(hero.raf);
  const start = performance.now();
  let last = 0;
  const tick = (now) => {
    const t = now - start;
    const swap = now - last > 55;
    if (swap) last = now;
    let pending = false;
    for (const el of chars) {
      if (!el.classList.contains('is-scr')) continue;
      if (t >= Number(el.dataset.at)) {
        el.textContent = el.dataset.final;
        el.classList.remove('is-scr');
      } else {
        pending = true;
        if (swap) {
          const pool = /\d/.test(el.dataset.final) ? DIG : LET;
          el.textContent = pool[(Math.random() * pool.length) | 0];
        }
      }
    }
    if (pending) hero.raf = requestAnimationFrame(tick);
  };
  hero.raf = requestAnimationFrame(tick);
}

// ---------------------------------------------------------------- results

function filtered() {
  const { results: list } = state.data;
  switch (state.filter) {
    case 'valid': return list.filter((r) => r.status === 'valid');
    case 'warning': return list.filter((r) => r.status === 'warning');
    case 'invalid': return list.filter((r) => r.status === 'invalid');
    case 'duplicates': return list.filter((r) => r.duplicateOf);
    default: return list;
  }
}

function summaryText(s) {
  const parts = [`${fmt(s.valid)} valid`];
  if (s.warning) parts.push(`${fmt(s.warning)} ${s.warning === 1 ? 'needs' : 'need'} a look`);
  parts.push(`${fmt(s.invalid)} invalid`);
  let t = `${fmt(s.total)} checked: ${parts.join(', ')}.`;
  if (s.duplicates) t += ` ${fmt(s.duplicates)} ${s.duplicates === 1 ? 'is a duplicate' : 'are duplicates'}.`;
  return t;
}

function headline(s) {
  if (s.total === 1) {
    return { valid: 'This number is valid.', warning: 'Valid format, but something looks off.', invalid: 'This number isn’t valid.' }[
      s.valid ? 'valid' : s.warning ? 'warning' : 'invalid'];
  }
  if (s.invalid === 0 && s.warning === 0) return s.total === 2 ? 'Both are valid.' : `All ${fmt(s.total)} are valid.`;
  if (s.valid === 0 && s.warning === 0) return s.total === 2 ? 'Neither is valid.' : `None of the ${fmt(s.total)} are valid.`;
  const bad = s.invalid + s.warning;
  return `${fmt(bad)} of ${fmt(s.total)} ${bad === 1 ? 'needs' : 'need'} attention.`;
}

function filterButton(key, label, n, tone = '') {
  if (key !== 'all' && n === 0) return '';
  const on = state.filter === key;
  return `<button type="button" class="chip ${tone}" data-filter="${key}" aria-pressed="${on}">
    <span>${label}</span><span class="chip-n">${fmt(n)}</span></button>`;
}

function renderResults() {
  stopHero();
  const { stats } = state.data;
  const pct = (n) => (stats.total ? (n / stats.total) * 100 : 0);
  const dist = [pct(stats.valid), pct(stats.warning), pct(stats.invalid)];
  const from = state.dist;
  const arrive = state.arrive && !reduceMotion();
  state.arrive = false;
  const list = filtered();
  const visible = list.slice(0, state.shown);
  const more = list.length - visible.length;

  const extra = [];
  if (stats.truncated) extra.push(`<p class="banner">Only the first ${fmt(MAX_ITEMS)} of ${fmt(stats.truncated)} numbers are checked. Split the list to check the rest.</p>`);

  results.innerHTML = `
    <div class="panel results">
      <div class="summary">
        <div class="summary-text">
          <h2>${esc(headline(stats))}</h2>
          <p class="summary-line">${esc(summaryText(stats))}${stats.llps && stats.companies ? ` ${fmt(stats.companies)} ${stats.companies === 1 ? 'company' : 'companies'}, ${fmt(stats.llps)} ${stats.llps === 1 ? 'LLP' : 'LLPs'}.` : ''}</p>
        </div>
        <div class="summary-actions">
          <button type="button" class="btn btn-quiet" data-act="copy">Copy table</button>
          <button type="button" class="btn" data-act="csv">Download CSV</button>
        </div>
      </div>
      <div class="dist" role="img" aria-label="${esc(summaryText(stats))}">
        <span class="d d-valid" style="width:${from[0]}%"></span><span class="d d-warning" style="width:${from[1]}%"></span><span class="d d-invalid" style="width:${from[2]}%"></span>
      </div>
      ${extra.join('')}
      ${stats.total > 1 ? `<div class="filters" role="group" aria-label="Show only">
        ${filterButton('all', 'All', stats.total)}
        ${filterButton('valid', 'Valid', stats.valid, 'tone-valid')}
        ${filterButton('warning', 'Needs a look', stats.warning, 'tone-warning')}
        ${filterButton('invalid', 'Invalid', stats.invalid, 'tone-invalid')}
        ${filterButton('duplicates', 'Duplicates', stats.duplicates)}
      </div>` : ''}
      <div class="table" role="table" aria-label="Checked numbers">
        <div class="thead" role="row">
          <span role="columnheader">Line</span>
          <span role="columnheader">Number</span>
          <span role="columnheader">Result</span>
          <span role="columnheader">Kind</span>
          <span role="columnheader">State</span>
          <span role="columnheader">Year</span>
          <span role="columnheader">Company type</span>
          <span></span>
        </div>
        <ol class="rows${arrive ? ' arrive' : ''}" role="rowgroup">
          ${visible.map((r, k) => rowHTML(r, k)).join('')}
        </ol>
        ${list.length === 0 ? `<p class="none">Nothing in this group.</p>` : ''}
      </div>
      ${more > 0 ? `<button type="button" class="btn more" data-act="more">Show ${fmt(Math.min(PAGE, more))} more <span class="muted">(${fmt(more)} left)</span></button>` : ''}
    </div>`;

  // Grow the bar from its last state to the new one.
  const bars = results.querySelectorAll('.dist .d');
  requestAnimationFrame(() => requestAnimationFrame(() => bars.forEach((b, k) => { b.style.width = `${dist[k]}%`; })));
  state.dist = dist;
}

function rowHTML(r, k = 0) {
  const key = rowKey(r);
  const open = state.open.has(key);
  const f = r.fields;
  const msg = rowMessage(r);
  const dup = r.duplicateOf ? `<span class="dup">Duplicate of line ${r.duplicateOf}</span>` : '';
  const na = (v, why) => (v == null ? `<span class="na" title="${esc(why)}">Not in LLPIN</span>` : esc(v));
  const fields = f
    ? `<span class="c c-kind" role="cell">${esc(kindText(f))}</span>
       <span class="c c-state" role="cell">${f.entity === 'LLP' ? na(null, LLP_NOTE) : esc(f.state)}</span>
       <span class="c c-year" role="cell">${f.entity === 'LLP' ? '<span class="na">—</span>' : esc(f.year)}</span>
       <span class="c c-type" role="cell">${esc(f.type)}</span>
       <span class="c-sum">${f.entity === 'LLP'
         ? `Limited liability partnership<span class="muted">State and year aren’t part of an LLPIN</span>`
         : `${esc(kindText(f))} in ${esc(f.state)}, ${esc(f.year)}<span class="muted">${esc(f.type)}</span>`}</span>`
    : '';
  return `<li class="row s-${r.status}${open ? ' is-open' : ''}" role="row" data-key="${esc(key)}"${k < 16 ? ` style="--k:${k}"` : ''}>
    <button type="button" class="row-btn" aria-expanded="${open}" data-act="toggle">
      <span class="c c-line" role="cell"><span class="sr">Line </span>${r.line}</span>
      <span class="c c-id" role="cell"><span class="id">${idMarkup(r)}</span></span>
      <span class="c c-res" role="cell"><span class="badge">${STATUS_LABEL[r.status]}</span></span>
      ${fields}
      ${msg || dup ? `<span class="c c-msg">${esc(msg)}${dup}</span>` : ''}
      <span class="chev" aria-hidden="true"></span>
    </button>
    ${open ? detailHTML(r) : ''}
  </li>`;
}

function detailHTML(r, { animate = false } = {}) {
  // The row already shows its main message, so the detail lists everything else.
  const shown = rowMessage(r);
  const items = [
    ...r.errors.filter((e) => e.msg !== shown).map((e) => `<li class="m m-error">${esc(e.msg)}</li>`),
    ...r.warnings.filter((w) => w !== shown).map((w) => `<li class="m m-warning">${esc(w)}</li>`),
    ...(r.duplicateOf ? [`<li class="m m-note">Same number as line ${r.duplicateOf}.</li>`] : []),
    ...r.notes.map((n) => `<li class="m m-note">${esc(n)}</li>`),
  ];
  const f = r.fields;
  const facts = f && f.entity === 'LLP' ? `<p class="llp-note">${esc(LLP_NOTE)}</p>` : '';
  const sugg = r.suggestion
    ? `<div class="suggest">
        <p>Did you mean <span class="id">${esc(r.suggestion.id)}</span>? <span class="muted">${esc(r.suggestion.why)}</span></p>
        <button type="button" class="btn btn-primary btn-sm" data-act="apply">Use this in my list</button>
      </div>`
    : '';
  const raw = r.input.trim() !== r.id ? `<p class="raw">You entered <span class="id">${esc(r.input.trim())}</span></p>` : '';
  return `<div class="detail${animate && !reduceMotion() ? ' animate' : ''}">
    ${anatomy(r, { animate })}
    ${sugg}
    ${items.length ? `<ul class="msgs">${items.join('')}</ul>` : ''}
    ${facts}
    ${raw}
    <div class="detail-actions">
      <button type="button" class="btn btn-quiet btn-sm" data-act="locate">Show line ${r.line} in my list</button>
      ${r.status !== 'invalid' ? `<button type="button" class="btn btn-quiet btn-sm" data-act="copy-one">Copy number</button>` : ''}
    </div>
  </div>`;
}

// ---------------------------------------------------------------- gutter

function renderGutter() {
  const n = input.value.split(/\r\n|\r|\n/).length;
  const worst = new Map();
  const rank = { valid: 0, warning: 1, invalid: 2 };
  if (state.data) {
    for (const r of state.data.results) {
      const cur = worst.get(r.line);
      if (cur == null || rank[r.status] > rank[cur]) worst.set(r.line, r.status);
    }
  }
  let html = '';
  for (let i = 1; i <= n; i++) {
    const s = worst.get(i);
    html += s ? `<div class="g-${s}">${i}</div>` : `<div>${i}</div>`;
  }
  gutter.innerHTML = html;
  syncGutter();
}

function syncGutter() {
  gutter.style.transform = `translateY(${-input.scrollTop}px)`;
}

// ---------------------------------------------------------------- main loop

function run() {
  const text = input.value;
  clearBtn.disabled = text.length === 0;
  const data = analyzeAll(text);
  const prevTotal = state.data?.stats.total ?? 0;
  state.data = data.stats.total ? data : null;
  if (!state.data) {
    count.textContent = 'One number per line';
    state.dist = [0, 0, 0];
    renderGutter();
    renderEmpty();
    return;
  }
  // Keep the filter only while it still has something in it.
  if (state.filter !== 'all' && filtered().length === 0) state.filter = 'all';
  if (Math.abs(data.stats.total - prevTotal) > 1) state.shown = PAGE;
  const s = data.stats;
  count.textContent = `${fmt(s.total)} ${s.total === 1 ? 'number' : 'numbers'}${s.blank ? `, ${fmt(s.blank)} blank ${s.blank === 1 ? 'line' : 'lines'} skipped` : ''}`;
  renderGutter();
  renderResults();
}

const schedule = debounce(run, () => (input.value.length > 50000 ? 350 : 120));

input.addEventListener('input', schedule);
input.addEventListener('scroll', syncGutter, { passive: true });
input.addEventListener('paste', () => { state.arrive = true; scan(); setTimeout(run, 0); });

// A light band sweeps down the editor when a list arrives, as if it were being read.
function scan() {
  if (reduceMotion()) return;
  editor.classList.remove('is-scan');
  void editor.offsetWidth; // restart the animation
  editor.classList.add('is-scan');
}
editor.addEventListener('animationend', () => editor.classList.remove('is-scan'));

function setInput(text, { focus = false } = {}) {
  input.value = text;
  state.open.clear();
  state.filter = 'all';
  state.shown = PAGE;
  state.arrive = Boolean(text);
  if (text) scan();
  run();
  if (focus) input.focus();
}

$('#sample').addEventListener('click', () => setInput(SAMPLE));
clearBtn.addEventListener('click', () => { setInput('', { focus: true }); toast('List cleared'); });
$('#open').addEventListener('click', () => $('#file').click());
$('#file').addEventListener('change', (e) => { loadFile(e.target.files[0]); e.target.value = ''; });

async function loadFile(file) {
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { toast('That file is over 5 MB. Try a smaller list.'); return; }
  const text = await file.text();
  setInput(text);
  toast(`Loaded ${file.name}`);
}

// Drag a .txt or .csv onto the editor.
['dragenter', 'dragover'].forEach((ev) => editor.addEventListener(ev, (e) => {
  if (![...(e.dataTransfer?.types || [])].includes('Files')) return;
  e.preventDefault();
  editor.classList.add('is-drop');
}));
['dragleave', 'drop'].forEach((ev) => editor.addEventListener(ev, () => editor.classList.remove('is-drop')));
editor.addEventListener('drop', (e) => {
  const file = e.dataTransfer?.files?.[0];
  if (file) { e.preventDefault(); loadFile(file); }
});

// ---------------------------------------------------------------- result actions

results.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act], [data-filter], [data-hero]');
  if (!btn) return;
  if (btn.dataset.hero) { showHero(Number(btn.dataset.hero), { user: true }); return; }
  if (btn.dataset.filter) {
    state.filter = btn.dataset.filter;
    state.shown = PAGE;
    renderResults();
    results.querySelector(`[data-filter="${state.filter}"]`)?.focus();
    return;
  }
  const li = btn.closest('.row');
  const r = li && state.data.results.find((x) => rowKey(x) === li.dataset.key);
  switch (btn.dataset.act) {
    case 'sample': setInput(SAMPLE); break;
    case 'more': state.shown += PAGE; renderResults(); break;
    case 'copy': copyTable(); break;
    case 'csv': downloadCSV(); break;
    case 'toggle': toggle(li, r); break;
    case 'apply': applySuggestion(r); break;
    case 'locate': locate(r.line); break;
    case 'copy-one': copyText(r.id).then(() => toast(`Copied ${r.id}`)); break;
  }
});

function toggle(li, r) {
  const key = rowKey(r);
  const open = !state.open.has(key);
  if (open) state.open.add(key); else state.open.delete(key);
  li.classList.toggle('is-open', open);
  li.querySelector('.row-btn').setAttribute('aria-expanded', String(open));
  li.querySelector('.detail')?.remove();
  if (open) li.insertAdjacentHTML('beforeend', detailHTML(r, { animate: true }));
}

function lineBounds(text, line) {
  let start = 0;
  for (let i = 1; i < line; i++) {
    const nl = text.indexOf('\n', start);
    if (nl === -1) return [text.length, text.length];
    start = nl + 1;
  }
  let end = text.indexOf('\n', start);
  if (end === -1) end = text.length;
  if (text[end - 1] === '\r') end--;
  return [start, end];
}

function locate(line) {
  const [start, end] = lineBounds(input.value, line);
  input.focus({ preventScroll: true });
  input.setSelectionRange(start, end);
  const lh = parseFloat(getComputedStyle(input).lineHeight) || 24;
  input.scrollTop = Math.max(0, (line - 3) * lh);
  editor.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

function applySuggestion(r) {
  const text = input.value;
  const [start, end] = lineBounds(text, r.line);
  const line = text.slice(start, end);
  const raw = r.input.trim();
  const idx = line.indexOf(raw);
  const next = idx >= 0 ? line.slice(0, idx) + r.suggestion.id + line.slice(idx + raw.length) : r.suggestion.id;
  input.value = text.slice(0, start) + next + text.slice(end);
  const newKey = `${r.line}:${r.index}:${r.suggestion.id}`;
  state.open.delete(rowKey(r));
  state.open.add(newKey);
  run();
  toast(`Line ${r.line} updated`);
  const row = results.querySelector(`.row[data-key="${CSS.escape(newKey)}"]`);
  row?.classList.add('just-fixed');
  row?.querySelector('.row-btn')?.focus();
}

// ---------------------------------------------------------------- export

const COLS = ['Line', 'Input', 'Number', 'Result', 'Entity', 'Listing', 'State', 'State code', 'Year', 'Company type', 'Type code', 'Industry code', 'Registration no.', 'Problem', 'Duplicate of line'];

function exportRows(list) {
  return list.map((r) => {
    const f = r.fields || {};
    return [
      r.line, r.input.trim(), r.id, STATUS_LABEL[r.status], f.entity ?? '', f.listed ?? (f.entity === 'LLP' ? 'Not applicable' : ''),
      f.state ?? '', f.stateCode ?? '', f.year ?? '', f.type ?? '', f.typeCode ?? '', f.industry ?? '', f.reg ?? '',
      [...r.errors.map((e) => e.msg), ...r.warnings].join(' '), r.duplicateOf ?? '',
    ];
  });
}

// Spreadsheet apps run cells that start with these characters as formulas.
const safeCell = (v) => { const s = String(v); return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; };

function downloadCSV() {
  const rows = [COLS, ...exportRows(state.data.results)];
  const csv = rows.map((row) => row.map((v) => `"${safeCell(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `cin-check-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(`Downloaded ${fmt(state.data.results.length)} rows`);
}

function copyTable() {
  const list = filtered();
  const rows = [COLS, ...exportRows(list)];
  const tsv = rows.map((row) => row.map((v) => safeCell(v).replace(/[\t\n]/g, ' ')).join('\t')).join('\n');
  copyText(tsv).then(() => toast(`Copied ${fmt(list.length)} ${list.length === 1 ? 'row' : 'rows'}. Paste into Excel or Sheets.`));
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const t = document.createElement('textarea');
    t.value = text;
    t.style.position = 'fixed';
    t.style.opacity = '0';
    document.body.append(t);
    t.select();
    document.execCommand('copy');
    t.remove();
  }
}

// ---------------------------------------------------------------- start

run();
