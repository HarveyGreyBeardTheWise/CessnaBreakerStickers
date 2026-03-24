// ================================================================
//  Cessna Breaker Label Generator — Application Logic
// ================================================================

// ── Default preset ───────────────────────────────────────────────
const PRESET = [
  { label: 'FUEL\nPUMP',  gap: 0.25 },
  { label: 'FLAP',        gap: 0.15 },
  { label: 'LAND LT',     gap: 0.25 },
  { label: 'NAV LT',      gap: 0.15 },
  { label: 'STROBE',      gap: 0.15 },
  { label: 'BCN',         gap: 0.15 },
  { label: 'PITOT HT',    gap: 0.25 },
  { label: 'AVIONICS',    gap: 0.25 },
  { label: 'COMM 1',      gap: 0.15 },
  { label: 'NAV 1',       gap: 0.15 },
  { label: 'XPDR',        gap: 0.15 },
  { label: 'ADF',         gap: 0.15 },
];

// ── Config helpers ───────────────────────────────────────────────
function v(id) {
  return document.getElementById(id).value;
}

function getCfg() {
  return {
    imgW:           Math.max(0.1,  +v('imgW')         || 8),
    imgH:           Math.max(0.1,  +v('imgH')         || 0.75),
    dpi:            Math.max(72,   +v('dpi')           || 300),
    brkW:           Math.max(0.01, +v('brkW')          || 0.5),
    margin:         Math.max(0,    +v('margin')        || 0),
    topMargin:      Math.max(0,    +v('topMargin')     || 0),
    bottomMargin:   Math.max(0,    +v('bottomMargin')  || 0),
    bgTransparent:  document.getElementById('bgTransparent').checked,
    bgColor:        v('bgColor'),
    cellTransparent:document.getElementById('cellTransparent').checked,
    cellColor:      v('cellColor'),
    textColor:      v('textColor'),
    brdColor:       v('brdColor'),
    brdW:           Math.max(0,    +v('brdW')          || 0),
    font:           v('font') || 'Arial',
    pad:           (+v('pad') || 12) / 100,
    rotation:      +v('rotation') || 0,
  };
}

function getBreakers() {
  return Array.from(document.querySelectorAll('#breaker-list .b-row')).map(r => ({
    label:   r.querySelector('.b-label').value,
    gap:     Math.max(0, +r.querySelector('.b-gap').value   || 0),
    sizeAdj: parseInt(r.querySelector('.b-size-adj').value) || 0,
  }));
}

// ── Font fitting ─────────────────────────────────────────────────
// Binary-search for the largest integer font size where all lines fit in maxW×maxH.
function fitFont(ctx, lines, maxW, maxH, fontName) {
  if (maxW <= 0 || maxH <= 0 || !lines.length) return 4;
  const lhMult = 1.18;
  let lo = 4, hi = Math.ceil(Math.max(maxW, maxH));

  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    ctx.font = `bold ${mid}px ${fontName}`;
    const totalH = lines.length * mid * lhMult;
    const wideW  = Math.max(...lines.map(l => ctx.measureText(l).width));
    (wideW <= maxW && totalH <= maxH) ? (lo = mid) : (hi = mid);
  }
  return lo;
}

// Return { lines, size } — the split that allows the largest font.
// Respects explicit \n; otherwise tries every 1- and 2-line word split.
function bestLines(ctx, text, maxW, maxH, fontName) {
  if (!text.trim()) return { lines: [], size: 0 };

  // Honour explicit newlines
  if (text.includes('\n')) {
    const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
    return { lines, size: fitFont(ctx, lines, maxW, maxH, fontName) };
  }

  const words = text.trim().split(/\s+/);
  let best = { lines: [text], size: fitFont(ctx, [text], maxW, maxH, fontName) };

  for (let i = 1; i < words.length; i++) {
    const lines = [words.slice(0, i).join(' '), words.slice(i).join(' ')];
    const size  = fitFont(ctx, lines, maxW, maxH, fontName);
    if (size > best.size) best = { lines, size };
  }
  return best;
}

// ── Core draw ────────────────────────────────────────────────────
// W and H are in pixels. cfg dimensions are in inches.
// ppi = W / cfg.imgW handles both preview scale and export DPI.
function drawLabels(ctx, W, H, cfg, breakers) {
  const ppi = W / cfg.imgW;           // pixels per inch for this render
  const px  = inches => inches * ppi; // inch → pixel helper

  // Background fill (skipped when transparent)
  if (!cfg.bgTransparent) {
    ctx.fillStyle = cfg.bgColor;
    ctx.fillRect(0, 0, W, H);
  }

  // Cell vertical bounds (respects top/bottom margins)
  const cellY = px(cfg.topMargin);
  const cellH = H - px(cfg.topMargin) - px(cfg.bottomMargin);

  let x = px(cfg.margin);

  for (const b of breakers) {
    x += px(b.gap);
    const cw = px(cfg.brkW);

    // Cell background (skipped when transparent)
    if (!cfg.cellTransparent) {
      ctx.fillStyle = cfg.cellColor;
      ctx.fillRect(x, cellY, cw, cellH);
    }

    // Cell border
    if (cfg.brdW > 0) {
      ctx.strokeStyle = cfg.brdColor;
      ctx.lineWidth   = cfg.brdW;
      const hw = cfg.brdW / 2;
      ctx.strokeRect(x + hw, cellY + hw, cw - cfg.brdW, cellH - cfg.brdW);
    }

    // Text
    if (b.label.trim()) {
      ctx.fillStyle    = cfg.textColor;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';

      // Available text area depends on rotation angle
      const rad = cfg.rotation * Math.PI / 180;
      const ac  = Math.abs(Math.cos(rad));
      const as  = Math.abs(Math.sin(rad));
      let availW, availH;
      if (as < 0.01) {                         // 0° / 180° — horizontal
        availW = cw    * (1 - 2 * cfg.pad);
        availH = cellH * (1 - 2 * cfg.pad);
      } else if (ac < 0.01) {                  // 90° / 270° — vertical
        availW = cellH * (1 - 2 * cfg.pad);
        availH = cw    * (1 - 2 * cfg.pad);
      } else {                                 // diagonal — inscribed square
        const d = Math.min(cw, cellH) * (1 - 2 * cfg.pad);
        availW = d;
        availH = d;
      }

      const { lines, size: autoSize } = bestLines(ctx, b.label, availW, availH, cfg.font);
      if (!lines.length) { x += cw; continue; }

      // Apply per-breaker size adjustment (each step = ±10%)
      const size = Math.max(4, Math.round(autoSize * (1 + b.sizeAdj * 0.1)));
      ctx.font = `bold ${size}px ${cfg.font}`;
      const lh     = size * 1.18;
      const totalH = lines.length * lh;
      const startY = -(totalH / 2) + lh / 2;

      ctx.save();
      ctx.translate(x + cw / 2, cellY + cellH / 2);
      ctx.rotate(rad);
      lines.forEach((l, i) => ctx.fillText(l, 0, startY + i * lh));
      ctx.restore();
    }

    x += cw;
  }
}

// ── Render (preview) ─────────────────────────────────────────────
function render() {
  const cfg      = getCfg();
  const breakers = getBreakers();

  const W_px = Math.round(cfg.imgW * cfg.dpi);
  const H_px = Math.round(cfg.imgH * cfg.dpi);

  const wrap   = document.getElementById('canvas-wrap');
  const canvas = document.getElementById('preview');

  // Scale preview to fit the available container space
  const maxW = Math.max(wrap.clientWidth  - 64, 200);
  const maxH = Math.max(wrap.clientHeight - 64, 80);
  const s    = Math.min(maxW / W_px, maxH / H_px, 1);

  canvas.width  = Math.round(W_px * s);
  canvas.height = Math.round(H_px * s);

  // Scale the context so drawLabels always works in full-res pixel space
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.scale(s, s);
  drawLabels(ctx, W_px, H_px, cfg, breakers);
  ctx.restore();

  // Info bar
  const totalSpan = cfg.margin * 2 + breakers.reduce((a, b) => a + b.gap + cfg.brkW, 0);
  document.getElementById('info').textContent =
    `${cfg.imgW}" × ${cfg.imgH}" @ ${cfg.dpi} DPI → ${W_px} × ${H_px} px  ·  ${breakers.length} breakers  ·  span ${totalSpan.toFixed(2)}"`;
  document.getElementById('b-count').textContent = `(${breakers.length})`;
}

// ── Export ───────────────────────────────────────────────────────
function exportPNG() {
  const cfg      = getCfg();
  const breakers = getBreakers();

  const W_px = Math.round(cfg.imgW * cfg.dpi);
  const H_px = Math.round(cfg.imgH * cfg.dpi);

  const off = document.createElement('canvas');
  off.width  = W_px;
  off.height = H_px;

  drawLabels(off.getContext('2d'), W_px, H_px, cfg, breakers);

  off.toBlob(blob => {
    const a  = document.createElement('a');
    a.href   = URL.createObjectURL(blob);
    a.download = 'breaker-labels.png';
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

// ── Breaker list UI ──────────────────────────────────────────────
function addBreaker(label = '', gap = 0.15) {
  const list = document.getElementById('breaker-list');
  const row  = document.createElement('div');
  row.className = 'b-row';
  row.setAttribute('draggable', 'true');
  row.innerHTML =
    `<span class="b-handle">` +
      `<span class="b-drag-icon">⠿</span>` +
      `<span class="b-num">?</span>` +
    `</span>` +
    `<textarea class="b-label" rows="1" spellcheck="false"></textarea>` +
    `<div class="b-controls">` +
      `<span class="b-ctrl-lbl">Gap (in)</span>` +
      `<span class="b-ctrl-lbl">Size</span>` +
      `<span></span>` +
      `<div class="b-size-wrap">` +
        `<button class="icon-btn" title="Gap smaller" onclick="adjGap(this,-1)">−</button>` +
        `<span class="b-gap-val">${gap.toFixed(2)}</span>` +
        `<input type="hidden" class="b-gap" value="${gap}">` +
        `<button class="icon-btn" title="Gap larger"  onclick="adjGap(this,+1)">+</button>` +
      `</div>` +
      `<div class="b-size-wrap">` +
        `<button class="icon-btn" title="Text smaller" onclick="adjSize(this,-1)">−</button>` +
        `<span class="b-size-val">0</span>` +
        `<input type="hidden" class="b-size-adj" value="0">` +
        `<button class="icon-btn" title="Text larger"  onclick="adjSize(this,+1)">+</button>` +
      `</div>` +
      `<button class="icon-btn del" title="Delete" onclick="delRow(this)">×</button>` +
    `</div>`;

  const ta = row.querySelector('.b-label');
  ta.value = label;
  ta.addEventListener('input', () => { autoResize(ta); render(); });
  row.addEventListener('dragstart', onDragStart);
  row.addEventListener('dragend',   onDragEnd);

  list.appendChild(row);
  autoResize(ta);
  renumber();
  render();
}

function autoResize(ta) {
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 'px';
}

function delRow(btn) {
  btn.closest('.b-row').remove();
  renumber();
  render();
}

function renumber() {
  document.querySelectorAll('#breaker-list .b-row').forEach((r, i) => {
    r.querySelector('.b-num').textContent = i + 1;
  });
}

function clearBreakers() {
  document.getElementById('breaker-list').innerHTML = '';
  render();
}

function loadPreset() {
  clearBreakers();
  PRESET.forEach(b => addBreaker(b.label, b.gap));
}

// ── Transparency checkbox toggles ────────────────────────────────
[['bgTransparent', 'bgRow'], ['cellTransparent', 'cellRow']].forEach(([cbId, rowId]) => {
  const el = document.getElementById(cbId);
  el.addEventListener('change', () => {
    document.getElementById(rowId).classList.toggle('is-transparent', el.checked);
    render();
  });
  document.getElementById(rowId).classList.toggle('is-transparent', el.checked);
});

// ── Color picker ↔ hex text sync ─────────────────────────────────
[['bgColor','bgHex'], ['cellColor','cellHex'], ['textColor','textHex'], ['brdColor','brdHex']]
  .forEach(([pickId, hexId]) => {
    const pick = document.getElementById(pickId);
    const hex  = document.getElementById(hexId);
    pick.addEventListener('input', () => { hex.value = pick.value; render(); });
    hex.addEventListener('input', () => {
      if (/^#[0-9a-fA-F]{6}$/.test(hex.value)) { pick.value = hex.value; render(); }
    });
  });

// ── Font picker ──────────────────────────────────────────────────
const FONTS = [
  'Arial Black',
  'Impact',
  'Franklin Gothic Medium',
  'Verdana',
  'Tahoma',
  'Arial',
  'Century Gothic',
  'Trebuchet MS',
  'Calibri',
  'Gill Sans MT',
  'Rockwell',
  'Cambria',
  'Georgia',
  'Courier New',
  'Times New Roman',
];

function buildFontDropdown() {
  const dd = document.getElementById('fontDropdown');
  FONTS.forEach(name => {
    const opt = document.createElement('div');
    opt.className   = 'font-option';
    opt.dataset.font = name;
    opt.innerHTML   = `<span class="font-opt-name" style="font-family:'${name}'">${name}</span>`;
    opt.addEventListener('click', () => selectFont(name));
    dd.appendChild(opt);
  });
}

function selectFont(name) {
  document.getElementById('font').value = name;
  const lbl = document.getElementById('fontTriggerLabel');
  lbl.textContent      = name;
  lbl.style.fontFamily = `'${name}'`;
  document.querySelectorAll('#fontDropdown .font-option').forEach(o => {
    o.classList.toggle('active', o.dataset.font === name);
  });
  closeFontDropdown();
  render();
}

function toggleFontDropdown(e) {
  e.stopPropagation();
  document.getElementById('fontDropdown').classList.toggle('open');
}

function closeFontDropdown() {
  document.getElementById('fontDropdown').classList.remove('open');
}

document.addEventListener('click', closeFontDropdown);

// ── Per-breaker gap adjustment ───────────────────────────────────
function adjGap(btn, dir) {
  const row = btn.closest('.b-row');
  const inp = row.querySelector('.b-gap');
  const val = Math.max(0, Math.round((parseFloat(inp.value) + dir * 0.05) * 100) / 100);
  inp.value = val;
  row.querySelector('.b-gap-val').textContent = val.toFixed(2);
  render();
}

// ── Per-breaker size adjustment ──────────────────────────────────
function adjSize(btn, dir) {
  const row = btn.closest('.b-row');
  const inp = row.querySelector('.b-size-adj');
  const val = (parseInt(inp.value) || 0) + dir;
  inp.value = val;
  row.querySelector('.b-size-val').textContent = val > 0 ? `+${val}` : `${val}`;
  render();
}

// ── Rotation selector ────────────────────────────────────────────
function setRotation(deg) {
  document.getElementById('rotation').value = deg;
  document.querySelectorAll('#rotGroup .rot-tile').forEach(btn => {
    btn.classList.toggle('active', +btn.dataset.deg === deg);
  });
  render();
}

// ── Wire all config inputs ───────────────────────────────────────
['imgW','imgH','dpi','brkW','margin','topMargin','bottomMargin','brdW','pad']
  .forEach(id => document.getElementById(id).addEventListener('input', render));

// Re-render on window resize (preview scale may change)
window.addEventListener('resize', render);

// ── Drag-and-drop reordering ─────────────────────────────────────
let dragRow = null;

function onDragStart(e) {
  dragRow = this;
  e.dataTransfer.effectAllowed = 'move';
  // Delay class add so drag ghost captures the un-dimmed look
  setTimeout(() => this.classList.add('dragging'), 0);
}

function onDragEnd() {
  if (dragRow) dragRow.classList.remove('dragging');
  document.querySelectorAll('#breaker-list .b-row')
    .forEach(r => r.classList.remove('drag-above', 'drag-below'));
  dragRow = null;
}

(function wireDragList() {
  const list = document.getElementById('breaker-list');

  list.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const target = e.target.closest('.b-row');
    if (!target || target === dragRow) return;
    document.querySelectorAll('#breaker-list .b-row')
      .forEach(r => r.classList.remove('drag-above', 'drag-below'));
    const { top, height } = target.getBoundingClientRect();
    target.classList.add(e.clientY < top + height / 2 ? 'drag-above' : 'drag-below');
  });

  list.addEventListener('dragleave', e => {
    if (!list.contains(e.relatedTarget)) {
      document.querySelectorAll('#breaker-list .b-row')
        .forEach(r => r.classList.remove('drag-above', 'drag-below'));
    }
  });

  list.addEventListener('drop', e => {
    e.preventDefault();
    const target = e.target.closest('.b-row');
    if (!target || target === dragRow) return;
    const { top, height } = target.getBoundingClientRect();
    list.insertBefore(dragRow, e.clientY < top + height / 2 ? target : target.nextSibling);
    document.querySelectorAll('#breaker-list .b-row')
      .forEach(r => r.classList.remove('drag-above', 'drag-below'));
    renumber();
    render();
  });
})();

// ── Init ─────────────────────────────────────────────────────────
buildFontDropdown();
selectFont('Arial Black');
loadPreset();
