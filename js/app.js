/* ═══════════════════════════════════════════════════════════════
   AudioScope — app.js
   Vanilla JS application for the hi-fi comparison tool.
   API calls are proxied through /.netlify/functions/compare
   to keep the Anthropic API key secure server-side.
═══════════════════════════════════════════════════════════════ */
'use strict';

/* ─── Category Definitions ──────────────────────────────────── */
const CATEGORIES = [
  { id: 'amplifier',    label: 'Integrated Amplifier', sub: 'Power amps & integrated' },
  { id: 'preamplifier', label: 'Preamplifier',          sub: 'Line stage & control' },
  { id: 'phono_preamp', label: 'Phono Preamplifier',    sub: 'MM/MC phono stages' },
  { id: 'turntable',    label: 'Turntable',             sub: 'Belt, direct & idler drive' },
  { id: 'tonearm',      label: 'Tonearm',               sub: 'Pivoted & tangential arms' },
  { id: 'cartridge',    label: 'Phono Cartridge',       sub: 'MM, MC & moving iron' },
  { id: 'dac',          label: 'DAC',                   sub: 'Digital-to-analog converters' },
  { id: 'streamer',     label: 'Streamer',              sub: 'Network audio players' },
  { id: 'speakers',     label: 'Loudspeakers',          sub: 'Floorstanders, monitors & more' },
  { id: 'headphones',   label: 'Headphones',            sub: 'Over-ear, IEM & planar magnetic' },
];

/* ─── App State ─────────────────────────────────────────────── */
const state = {
  category: null,   // selected category id
  catLabel: '',     // selected category label
  items: [],        // { id, name, status, data, err }
  running: false,
  uid: 1,
};

/* ─── Initialise ────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  buildCategoryGrid();
  bindInput();
  showSection('sec-home');
});

/* ─── Build Category Grid ───────────────────────────────────── */
function buildCategoryGrid() {
  const grid = document.getElementById('cat-grid');
  if (!grid) return;
  grid.innerHTML = CATEGORIES.map((cat, idx) => `
    <button
      class="cat-card"
      role="listitem"
      data-cat="${cat.id}"
      aria-label="Compare ${cat.label}"
    >
      <div class="cat-num">${String(idx + 1).padStart(2, '0')}</div>
      <div class="cat-label">${esc(cat.label)}</div>
      <div class="cat-sub">${esc(cat.sub)}</div>
      <div class="cat-arrow">Compare → </div>
    </button>
  `).join('');

  grid.addEventListener('click', e => {
    const btn = e.target.closest('.cat-card');
    if (btn) selectCategory(btn.dataset.cat);
  });
}

/* ─── Bind Input Events ─────────────────────────────────────── */
function bindInput() {
  const input   = document.getElementById('comp-input');
  const addBtn  = document.getElementById('btn-add');
  const cmpBtn  = document.getElementById('btn-compare');

  if (input)  input.addEventListener('keydown', e => { if (e.key === 'Enter') addComponent(); });
  if (addBtn) addBtn.addEventListener('click', addComponent);
  if (cmpBtn) cmpBtn.addEventListener('click', () => { if (!cmpBtn.disabled) runComparison(); });
}

/* ─── Section Navigation ────────────────────────────────────── */
function showSection(id) {
  ['sec-home', 'sec-add', 'sec-results'].forEach(s => {
    const el = document.getElementById(s);
    if (el) el.classList.toggle('hidden', s !== id);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ─── Select Category ───────────────────────────────────────── */
function selectCategory(catId) {
  const cat = CATEGORIES.find(c => c.id === catId);
  if (!cat) return;
  state.category = catId;
  state.catLabel = cat.label;
  const lbl = document.getElementById('lbl-cat');
  if (lbl) lbl.textContent = cat.label;
  showSection('sec-add');
  // Small delay so section is visible before focus
  setTimeout(() => {
    const inp = document.getElementById('comp-input');
    if (inp) inp.focus();
  }, 150);
}

/* ─── Add Component ─────────────────────────────────────────── */
function addComponent() {
  if (state.running) return;
  const inp = document.getElementById('comp-input');
  if (!inp) return;
  const val = inp.value.trim();
  if (!val || state.items.length >= 6) return;
  state.items.push({ id: state.uid++, name: val, status: 'idle', data: null, err: null });
  inp.value = '';
  inp.focus();
  refreshAddUI();
}

/* ─── Remove Component ──────────────────────────────────────── */
function removeComponent(uid) {
  state.items = state.items.filter(i => i.id !== uid);
  refreshAddUI();
}

/* ─── Refresh Add Section UI ────────────────────────────────── */
function refreshAddUI() {
  const n = state.items.length;

  // Chips
  const wrap = document.getElementById('chips-wrap');
  if (wrap) {
    wrap.innerHTML = state.items.map((item, idx) => `
      <div class="chip" role="listitem">
        <span class="chip-num">${idx + 1}</span>
        <span class="chip-nm">${esc(item.name)}</span>
        <button
          class="chip-rm"
          type="button"
          onclick="removeComponent(${item.id})"
          aria-label="Remove ${esc(item.name)}"
        >×</button>
      </div>
    `).join('');
  }

  // Count label
  const cntLbl = document.getElementById('cnt-lbl');
  if (cntLbl) cntLbl.textContent = `${n}/6 · minimum 2 required`;

  // Compare button
  const cmpBtn = document.getElementById('btn-compare');
  if (cmpBtn) {
    if (n >= 2) {
      cmpBtn.textContent = `Compare ${n} Component${n > 1 ? 's' : ''} →`;
      cmpBtn.disabled = false;
      cmpBtn.classList.remove('disabled');
    } else {
      cmpBtn.textContent = 'Add at least 2 components';
      cmpBtn.disabled = true;
      cmpBtn.classList.add('disabled');
    }
  }

  // Input/add-button disable at 6
  const inp    = document.getElementById('comp-input');
  const addBtn = document.getElementById('btn-add');
  if (inp)    inp.disabled    = n >= 6;
  if (addBtn) addBtn.disabled = n >= 6;
}

/* ─── Run Comparison ────────────────────────────────────────── */
async function runComparison() {
  if (state.items.length < 2 || state.running) return;
  state.running = true;

  // Switch to results view
  showSection('sec-results');
  document.getElementById('btn-new-cmp').classList.remove('hidden');
  document.getElementById('ad-top').classList.remove('hidden');
  document.getElementById('lbl-res-cat').textContent = `${state.catLabel} · Comparison`;
  document.getElementById('lbl-loading-names').textContent = state.items.map(i => i.name).join(' · ');

  // Reset results area
  document.getElementById('loading-block').style.display = 'block';
  document.getElementById('table-zone').innerHTML = '';
  document.getElementById('err-zone').innerHTML = '';
  document.getElementById('cards-grid').innerHTML = '';
  document.getElementById('cards-zone').classList.add('hidden');
  document.getElementById('ad-mid').classList.add('hidden');
  document.getElementById('ad-bot').classList.add('hidden');
  document.getElementById('results-cta').classList.add('hidden');

  // Mark all as loading
  state.items = state.items.map(i => ({ ...i, status: 'loading' }));

  // Fetch each component sequentially (progressive rendering)
  for (let i = 0; i < state.items.length; i++) {
    try {
      const data = await fetchComponent(state.items[i].name, state.catLabel);
      state.items[i] = { ...state.items[i], status: 'done', data };
    } catch (e) {
      state.items[i] = {
        ...state.items[i],
        status: 'error',
        err: e.message || 'Could not retrieve data. Please check the component name.',
      };
      appendError(state.items[i]);
    }
    renderProgress();
  }

  // All done
  state.running = false;
  document.getElementById('loading-block').style.display = 'none';

  const doneCount = state.items.filter(i => i.status === 'done').length;
  if (doneCount > 0) {
    document.getElementById('ad-mid').classList.remove('hidden');
    document.getElementById('ad-bot').classList.remove('hidden');
  }
  document.getElementById('results-cta').classList.remove('hidden');
}

/* ─── Fetch One Component ───────────────────────────────────── */
async function fetchComponent(name, category) {
  const res = await fetch('/.netlify/functions/compare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, category }),
  });
  if (!res.ok) {
    let msg = `Server error ${res.status}`;
    try { const j = await res.json(); msg = j.error || msg; } catch (_) {}
    throw new Error(msg);
  }
  return res.json();
}

/* ─── Progressive Render After Each Fetch ──────────────────────*/
function renderProgress() {
  const done = state.items.filter(i => i.data);
  if (done.length === 0) return;

  // Hide the main spinner once first result arrives
  document.getElementById('loading-block').style.display = 'none';

  renderTable();
  renderCards();
}

/* ─── Render Spec Table ─────────────────────────────────────── */
function renderTable() {
  const zone = document.getElementById('table-zone');
  const done = state.items.filter(i => i.data);
  if (done.length === 0 || !zone) return;

  // Collect all unique spec keys across loaded items
  const allKeys = [...new Set(done.flatMap(i => Object.keys(i.data.specs || {})))];
  const minW    = Math.max(560, 175 + state.items.length * 195);

  // Build thead columns
  const cols = state.items.map(item => {
    if (item.status === 'loading') {
      return `<th class="th-comp"><div class="loading-v">Loading ${esc(item.name)}…</div></th>`;
    }
    if (item.data) {
      return `<th class="th-comp">
        <div class="th-brand">${esc(item.data.brand)}</div>
        <div class="th-model">${esc(item.data.model)}</div>
        <div class="th-price">${esc(item.data.msrpUSD)}</div>
        <div class="th-year">${esc(item.data.yearIntroduced)}</div>
      </th>`;
    }
    return `<th class="th-comp"><div style="color:var(--muted)">${esc(item.name)}</div></th>`;
  }).join('');

  // Dimensions row
  const dimRow = state.items.map(item => {
    if (item.status === 'loading') return `<td><span class="loading-v">·  ·  ·</span></td>`;
    if (!item.data?.dimensions)    return `<td><span class="empty-v">—</span></td>`;
    const d = item.data.dimensions;
    return `<td>
      <div class="dim-grid">
        <span class="dk">W</span><span>${esc(d.width  || '—')}</span>
        <span class="dk">H</span><span>${esc(d.height || '—')}</span>
        <span class="dk">D</span><span>${esc(d.depth  || '—')}</span>
        <span class="dk">Wt</span><span>${esc(d.weight || '—')}</span>
      </div>
    </td>`;
  }).join('');

  // Spec rows
  const specRows = allKeys.map(key => {
    const cells = state.items.map(item => {
      if (item.status === 'loading') return `<td><span class="loading-v">·  ·  ·</span></td>`;
      const val = item.data?.specs?.[key];
      return val ? `<td>${esc(val)}</td>` : `<td><span class="empty-v">—</span></td>`;
    }).join('');
    return `<tr><td class="td-label">${esc(key)}</td>${cells}</tr>`;
  }).join('');

  // Features row
  const featRow = state.items.map(item => {
    if (item.status === 'loading') return `<td><span class="loading-v">·  ·  ·</span></td>`;
    if (!item.data?.notableFeatures?.length) return `<td><span class="empty-v">—</span></td>`;
    const lis = item.data.notableFeatures.map(f => `<li>${esc(f)}</li>`).join('');
    return `<td><ul class="feat-ul">${lis}</ul></td>`;
  }).join('');

  zone.innerHTML = `
    <div class="table-scroll">
      <table class="spec-table" style="min-width:${minW}px;" aria-label="Component specification comparison">
        <thead>
          <tr>
            <th class="th-spec" scope="col">Specification</th>
            ${cols}
          </tr>
        </thead>
        <tbody>
          <tr class="row-dim">
            <td class="td-label">Dimensions</td>
            ${dimRow}
          </tr>
          ${specRows}
          <tr class="row-feat">
            <td class="td-label">Notable Features</td>
            ${featRow}
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

/* ─── Render Component Profile Cards ────────────────────────── */
function renderCards() {
  const done = state.items.filter(i => i.data);
  if (!done.length) return;

  const grid = document.getElementById('cards-grid');
  const zone = document.getElementById('cards-zone');
  if (!grid || !zone) return;

  zone.classList.remove('hidden');

  grid.innerHTML = done.map(item => {
    const d = item.data;

    const strengths = (d.strengths || [])
      .map(s => `<li>${esc(s)}</li>`).join('');

    const considerations = (d.considerations || []).length
      ? `<div>
          <p class="list-lbl">Considerations</p>
          <ul class="con-ul">${(d.considerations).map(c => `<li>${esc(c)}</li>`).join('')}</ul>
         </div>`
      : '';

    const mfgLink = d.manufacturerUrl
      ? `<a href="${safeUrl(d.manufacturerUrl)}" target="_blank" rel="noopener noreferrer" class="link-row">
           <span class="link-ic ic-m">M</span>Manufacturer Website ↗
         </a>`
      : '';

    const revLinks = (d.reviewLinks || []).map(r =>
      `<a href="${safeUrl(r.url)}" target="_blank" rel="noopener noreferrer" class="link-row">
         <span class="link-ic ic-r">R</span>${esc(r.outlet)} Review ↗
       </a>`
    ).join('');

    const ytLinks = (d.youtubeSearches || []).slice(0, 2).map(q =>
      `<a href="https://www.youtube.com/results?search_query=${encodeURIComponent(q)}"
          target="_blank" rel="noopener noreferrer" class="link-row">
         <span class="link-ic ic-yt">▶</span>YouTube: ${esc(q)} ↗
       </a>`
    ).join('');

    return `
      <article class="comp-card" aria-label="${esc(d.fullName || d.model)} profile">
        <header class="card-hd">
          <div class="card-brand">${esc(d.brand)}</div>
          <div class="card-model">${esc(d.model)}</div>
          <div class="card-price">${esc(d.msrpUSD)}</div>
        </header>

        <p class="card-summary">${esc(d.summary)}</p>

        <div>
          <p class="list-lbl">Strengths</p>
          <ul class="pro-ul">${strengths}</ul>
        </div>

        ${considerations}

        <div class="card-links" aria-label="Links and resources for ${esc(d.model)}">
          <p class="list-lbl">Links &amp; Resources</p>
          ${mfgLink}
          ${revLinks}
          ${ytLinks}
        </div>
      </article>
    `;
  }).join('');
}

/* ─── Append Error Notice ───────────────────────────────────── */
function appendError(item) {
  const zone = document.getElementById('err-zone');
  if (!zone) return;
  const div = document.createElement('div');
  div.className = 'err-notice';
  div.innerHTML = `<strong>${esc(item.name)}</strong> — ${esc(item.err)}`;
  zone.appendChild(div);
}

/* ─── Reset App ─────────────────────────────────────────────── */
function resetApp() {
  state.category = null;
  state.catLabel = '';
  state.items    = [];
  state.running  = false;
  state.uid      = 1;

  document.getElementById('btn-new-cmp').classList.add('hidden');
  document.getElementById('ad-top').classList.add('hidden');
  document.getElementById('table-zone').innerHTML  = '';
  document.getElementById('cards-grid').innerHTML  = '';
  document.getElementById('err-zone').innerHTML    = '';
  document.getElementById('chips-wrap').innerHTML  = '';
  document.getElementById('cards-zone').classList.add('hidden');

  const inp = document.getElementById('comp-input');
  if (inp) { inp.value = ''; inp.disabled = false; }

  const addBtn = document.getElementById('btn-add');
  if (addBtn) addBtn.disabled = false;

  const cmpBtn = document.getElementById('btn-compare');
  if (cmpBtn) {
    cmpBtn.textContent = 'Add at least 2 components';
    cmpBtn.disabled = true;
    cmpBtn.classList.add('disabled');
  }

  showSection('sec-home');
}

/* ─── Utility: HTML escape ──────────────────────────────────── */
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

/* ─── Utility: safe URL (http/https only) ───────────────────── */
function safeUrl(str) {
  if (!str) return '#';
  const s = String(str).trim();
  return (s.startsWith('http://') || s.startsWith('https://')) ? s : '#';
}
