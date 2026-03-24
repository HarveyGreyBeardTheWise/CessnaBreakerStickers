// ================================================================
//  Cessna Breaker Label Generator — Application Logic
// ================================================================

// Shared line-height multiplier — must stay in sync between fitFont and drawLabels
const LH_MULT = 1.18;

// ── Default preset ───────────────────────────────────────────────
const PRESET = [
  { label: 'FUEL\nPUMP' },
  { label: 'FLAP' },
  { label: 'LAND LT' },
  { label: 'NAV LT' },
  { label: 'STROBE' },
  { label: 'BCN' },
  { label: 'PITOT HT' },
  { label: 'AVIONICS' },
  { label: 'COMM 1' },
  { label: 'NAV 1' },
];

// ── Config helpers ───────────────────────────────────────────────
function v(id) {
  return document.getElementById(id)?.value ?? '';
}

function getCfg() {
  const n = (id, fallback, min) => Math.max(min, +v(id) || fallback);
  return {
    imgW:           n('imgW',        8,    0.1),
    imgH:           n('imgH',        0.75, 0.1),
    dpi:            n('dpi',         300,  72),
    brkW:           n('brkW',        0.5,  0.01),
    margin:         n('margin',      0,    0),
    topMargin:      n('topMargin',   0,    0),
    bottomMargin:   n('bottomMargin',0,    0),
    bgTransparent:  document.getElementById('bgTransparent').checked,
    bgColor:        v('bgColor'),
    cellTransparent:document.getElementById('cellTransparent').checked,
    cellColor:      v('cellColor'),
    textColor:      v('textColor'),
    brdColor:       v('brdColor'),
    brdW:           n('brdW',        0,    0),
    font:           v('font') || 'Arial',
    pad:           (+v('pad') || 12) / 100,
    rotation:      +v('rotation') || 0,
  };
}

function getBreakers() {
  const defBrkW = +v('brkW') || 0.5;
  return Array.from(document.querySelectorAll('#breaker-list .b-row')).map(r => ({
    label:   r.querySelector('.b-label')?.value ?? '',
    gap:     Math.max(0,    +(r.querySelector('.b-gap')?.value)    || 0),
    brkW:    Math.max(0.01, +(r.querySelector('.b-brkw')?.value)   || defBrkW),
    sizeAdj: parseInt(r.querySelector('.b-size-adj')?.value)     || 0,
  }));
}

// ── Font fitting ─────────────────────────────────────────────────
// Binary-search for the largest integer font size where all lines fit in maxW×maxH.
function fitFont(ctx, lines, maxW, maxH, fontName) {
  if (maxW <= 0 || maxH <= 0 || !lines.length) return 4;
  let lo = 4, hi = Math.ceil(Math.max(maxW, maxH));

  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    ctx.font = `bold ${mid}px ${fontName}`;
    const totalH = lines.length * mid * LH_MULT;
    const wideW  = Math.max(...lines.map(l => ctx.measureText(l).width));
    (wideW <= maxW && totalH <= maxH) ? (lo = mid) : (hi = mid);
  }
  return lo;
}

// Return { lines, size } — the split that allows the largest font.
// Respects explicit \n; otherwise tries every 1- and 2-line word split.
function bestLines(ctx, text, maxW, maxH, fontName) {
  if (!text.trim()) return { lines: [], size: 0 };

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
  const ppi = W / cfg.imgW;
  const px  = inches => inches * ppi;

  if (!cfg.bgTransparent) {
    ctx.fillStyle = cfg.bgColor;
    ctx.fillRect(0, 0, W, H);
  }

  const cellY = px(cfg.topMargin);
  const cellH = H - px(cfg.topMargin) - px(cfg.bottomMargin);

  let x = px(cfg.margin);

  for (const b of breakers) {
    x += px(b.gap);
    const cw = px(b.brkW);

    if (!cfg.cellTransparent) {
      ctx.fillStyle = cfg.cellColor;
      ctx.fillRect(x, cellY, cw, cellH);
    }

    if (cfg.brdW > 0) {
      ctx.strokeStyle = cfg.brdColor;
      ctx.lineWidth   = cfg.brdW;
      const hw = cfg.brdW / 2;
      ctx.strokeRect(x + hw, cellY + hw, cw - cfg.brdW, cellH - cfg.brdW);
    }

    if (b.label.trim()) {
      ctx.fillStyle    = cfg.textColor;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';

      const rad = cfg.rotation * Math.PI / 180;
      const ac  = Math.abs(Math.cos(rad));
      const as  = Math.abs(Math.sin(rad));
      let availW, availH;
      if (as < 0.01) {
        availW = cw    * (1 - 2 * cfg.pad);
        availH = cellH * (1 - 2 * cfg.pad);
      } else if (ac < 0.01) {
        availW = cellH * (1 - 2 * cfg.pad);
        availH = cw    * (1 - 2 * cfg.pad);
      } else {
        const d = Math.min(cw, cellH) * (1 - 2 * cfg.pad);
        availW = d; availH = d;
      }

      const { lines, size: autoSize } = bestLines(ctx, b.label, availW, availH, cfg.font);
      if (!lines.length) { x += cw; continue; }

      const size   = Math.max(4, Math.round(autoSize * (1 + b.sizeAdj * 0.1)));
      ctx.font     = `bold ${size}px ${cfg.font}`;
      const lh     = size * LH_MULT;
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

// ── Measurement overlay ───────────────────────────────────────────
// Draws dimension annotations above the strip in display-pixel space.
// Never called during export — preview only.
function drawMeasurements(ctx, stripW, stripH, measH, cfg, breakers) {
  const dppi = stripW / cfg.imgW;

  // Y layout — total span / C-C row / segment rows
  const Y_TOTAL  = 16;   // total-span arrow line
  const Y_CC     = 38;   // center-to-center dimension line
  const TICK_TOP = 54;   // segment boundary ticks start
  const Y_LIFT2  = 70;   // lifted segment label row 2 (farthest)
  const Y_LIFT1  = 96;   // lifted segment label row 1
  const Y_SEG    = 122;  // segment baseline (inline labels)
  const TICK_BOT = measH - 4;
  const ARROW    = 8;
  const PILL_H   = 18;
  const PILL_PAD = 6;

  ctx.save();

  // ── background ───────────────────────────────────────────────
  ctx.fillStyle = '#e8edf5';
  ctx.fillRect(0, 0, stripW, measH);
  ctx.fillStyle = '#475569';
  ctx.fillRect(0, measH - 2, stripW, 2);

  // ── build segment list ───────────────────────────────────────
  const segs = [];
  let cx = cfg.margin * dppi;

  if (cfg.margin > 0) {
    segs.push({ x1: 0, x2: cx, label: `${cfg.margin.toFixed(3)}"`, type: 'margin' });
  }

  for (const b of breakers) {
    const gapPx = b.gap * dppi;
    const brkPx = b.brkW * dppi;
    if (gapPx > 0.5) {
      segs.push({ x1: cx, x2: cx + gapPx, label: `${b.gap.toFixed(3)}"`, type: 'gap' });
    }
    cx += gapPx;
    segs.push({ x1: cx, x2: cx + brkPx, label: `${b.brkW.toFixed(3)}"`, type: 'brk' });
    cx += brkPx;
  }

  if (cfg.margin > 0) {
    segs.push({ x1: cx, x2: stripW, label: `${cfg.margin.toFixed(3)}"`, type: 'margin' });
  }

  // ── helpers ──────────────────────────────────────────────────
  // dir: -1 = points left, +1 = points right
  function arrowHead(x, y, dir, size) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - dir * size, y - size * 0.45);
    ctx.lineTo(x - dir * size, y + size * 0.45);
    ctx.closePath();
    ctx.fill();
  }

  // Pill centered at (cx, cy) with given text width
  function pill(cx, cy, tw, h, r) {
    ctx.beginPath();
    ctx.roundRect(cx - tw / 2 - PILL_PAD, cy - h / 2, tw + PILL_PAD * 2, h, r);
    ctx.fill();
  }

  // ── total span arrow line ────────────────────────────────────
  const totalLabel = `${cfg.imgW.toFixed(3)}"`;
  ctx.font         = 'bold 13px system-ui, Arial, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign    = 'center';
  const tlw  = ctx.measureText(totalLabel).width;
  const tpad = 7;

  ctx.strokeStyle = '#1e40af';
  ctx.fillStyle   = '#1e40af';
  ctx.lineWidth   = 2;

  const lx = stripW / 2 - tlw / 2 - tpad;
  const rx = stripW / 2 + tlw / 2 + tpad;
  if (lx > ARROW) {
    ctx.beginPath(); ctx.moveTo(ARROW, Y_TOTAL); ctx.lineTo(lx, Y_TOTAL); ctx.stroke();
  }
  if (rx < stripW - ARROW) {
    ctx.beginPath(); ctx.moveTo(rx, Y_TOTAL); ctx.lineTo(stripW - ARROW, Y_TOTAL); ctx.stroke();
  }
  arrowHead(0, Y_TOTAL, -1, ARROW);
  arrowHead(stripW, Y_TOTAL, +1, ARROW);
  ctx.fillStyle = '#dbeafe';
  pill(stripW / 2, Y_TOTAL, tlw, 20, 4);
  ctx.fillStyle = '#1e3a8a';
  ctx.fillText(totalLabel, stripW / 2, Y_TOTAL);

  // ── assign each labeled segment to a row ─────────────────────
  // Inline row first; if label won't fit within its span, lift it
  // to the next free row (LIFT1 then LIFT2) using x-collision checks.
  ctx.font = 'bold 11px system-ui, Arial, sans-serif';

  const liftRows = [
    { y: Y_LIFT1, reserved: [] },
    { y: Y_LIFT2, reserved: [] },
  ];

  const placed = segs.map(seg => {
    if (!seg.label) return { ...seg, rowY: Y_SEG, lifted: false };

    const tw   = ctx.measureText(seg.label).width;
    const mid  = (seg.x1 + seg.x2) / 2;
    const half = tw / 2 + PILL_PAD + 2; // half-width of pill including padding
    const span = seg.x2 - seg.x1;

    // Fits inline?
    if (span >= tw + PILL_PAD * 2 + 4) {
      return { ...seg, rowY: Y_SEG, lifted: false, tw };
    }

    // Try lift rows in order (closest to strip first)
    for (const row of liftRows) {
      const clash = row.reserved.some(r => mid + half > r.lo && mid - half < r.hi);
      if (!clash) {
        row.reserved.push({ lo: mid - half, hi: mid + half });
        return { ...seg, rowY: row.y, lifted: true, tw };
      }
    }

    // Both rows full — append to the upper row regardless (rare edge case)
    return { ...seg, rowY: Y_LIFT2, lifted: true, tw };
  });

  // ── center-to-center row ─────────────────────────────────────
  // Compute each breaker's center x in display pixels
  const centers = [];
  let ccx = cfg.margin * dppi;
  for (const b of breakers) {
    ccx += b.gap * dppi;
    centers.push(ccx + b.brkW * dppi / 2);
    ccx += b.brkW * dppi;
  }

  if (centers.length >= 2) {
    // Continuous line from first to last center
    ctx.strokeStyle = '#0d9488';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(centers[0], Y_CC);
    ctx.lineTo(centers[centers.length - 1], Y_CC);
    ctx.stroke();

    // Arrowheads only at the two ends
    ctx.fillStyle = '#0d9488';
    arrowHead(centers[0],                   Y_CC, -1, 6);
    arrowHead(centers[centers.length - 1],  Y_CC, +1, 6);

    // Center tick marks at every breaker center
    ctx.strokeStyle = '#0d9488';
    ctx.lineWidth   = 1.5;
    centers.forEach(cx => {
      const px = Math.round(cx) + 0.5;
      ctx.beginPath(); ctx.moveTo(px, Y_CC - 7); ctx.lineTo(px, Y_CC + 7); ctx.stroke();
    });

    // Per-span C-C labels
    ctx.font         = 'bold 10px system-ui, Arial, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign    = 'center';
    for (let i = 0; i < centers.length - 1; i++) {
      const x1    = centers[i];
      const x2    = centers[i + 1];
      const span  = x2 - x1;
      const mid   = (x1 + x2) / 2;
      const label = `${(span / dppi).toFixed(3)}"`;
      const tw    = ctx.measureText(label).width;
      if (span >= tw + PILL_PAD * 2 + 4) {
        ctx.fillStyle = '#ccfbf1';
        pill(mid, Y_CC, tw, 17, 3);
        ctx.fillStyle = '#0f766e';
        ctx.fillText(label, mid, Y_CC);
      }
    }
  }

  // ── segment baseline ─────────────────────────────────────────
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth   = 1;
  ctx.beginPath(); ctx.moveTo(0, Y_SEG); ctx.lineTo(stripW, Y_SEG); ctx.stroke();

  // ── tick marks at every boundary ────────────────────────────
  const ticks = new Set([0, stripW]);
  placed.forEach(s => { ticks.add(s.x1); ticks.add(s.x2); });

  ticks.forEach(tx => {
    const isEdge = tx === 0 || tx === stripW;
    ctx.strokeStyle = isEdge ? '#334155' : '#475569';
    ctx.lineWidth   = isEdge ? 2 : 1.5;
    const px = Math.round(tx) + 0.5;
    ctx.beginPath();
    ctx.moveTo(px, TICK_TOP);
    ctx.lineTo(px, TICK_BOT);
    ctx.stroke();
  });

  // ── labels (leader lines first, then pills on top) ───────────
  ctx.font         = 'bold 11px system-ui, Arial, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign    = 'center';

  // Pass 1: dashed leader lines for lifted labels
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth   = 1;
  ctx.setLineDash([3, 3]);
  placed.forEach(seg => {
    if (!seg.label || !seg.lifted) return;
    const mid = (seg.x1 + seg.x2) / 2;
    ctx.beginPath();
    ctx.moveTo(mid, Y_SEG - 2);
    ctx.lineTo(mid, seg.rowY + PILL_H / 2 + 2);
    ctx.stroke();
  });
  ctx.setLineDash([]);

  // Pass 2: pills + text
  placed.forEach(seg => {
    if (!seg.label) return;
    const mid = (seg.x1 + seg.x2) / 2;
    const tw  = seg.tw ?? ctx.measureText(seg.label).width;

    const bgColor = seg.type === 'margin' ? '#e2e8f0'
                  : seg.type === 'gap'    ? '#fef3c7'
                  :                        '#dbeafe';
    const txColor = seg.type === 'margin' ? '#334155'
                  : seg.type === 'gap'    ? '#92400e'
                  :                        '#1e3a8a';

    ctx.fillStyle = bgColor;
    pill(mid, seg.rowY, tw, PILL_H, 4);
    ctx.fillStyle = txColor;
    ctx.fillText(seg.label, mid, seg.rowY);
  });

  // ── vertical measurements ──────────────────────────────────────
  const topM    = Math.max(0, cfg.topMargin);
  const botM    = Math.max(0, cfg.bottomMargin);
  const cellHin = Math.max(0, cfg.imgH - topM - botM);
  const yTop    = measH;           // strip top on canvas
  const yBot    = measH + stripH;  // strip bottom on canvas
  const hasVMar = topM > 0 || botM > 0;

  const V_PH  = 16; // pill height
  const V_PP  = 5;  // pill x-padding
  const V_ARR = 7;  // large arrowhead
  const V_SML = 5;  // small arrowhead

  // Band background
  ctx.fillStyle = '#e8edf5';
  ctx.fillRect(stripW, 0, MEAS_W, measH + stripH);
  // Vertical separator (left edge of band)
  ctx.fillStyle = '#475569';
  ctx.fillRect(stripW, 0, 2, measH + stripH);
  // Horizontal separator (continuation across the band)
  ctx.fillRect(stripW + 2, measH - 2, MEAS_W - 2, 2);

  const TOTAL_X = stripW + (hasVMar ? 14 : Math.round(MEAS_W / 2));
  const midY    = (yTop + yBot) / 2;

  // Measure total label before transforms
  const vFont = hasVMar ? 'bold 10px system-ui, Arial, sans-serif'
                        : 'bold 12px system-ui, Arial, sans-serif';
  ctx.font = vFont;
  ctx.textBaseline = 'middle';
  ctx.textAlign    = 'center';
  const totalVLabel = `${cfg.imgH.toFixed(3)}"`;
  const vtw         = ctx.measureText(totalVLabel).width;

  // Arrow line
  ctx.strokeStyle = '#1e40af';
  ctx.fillStyle   = '#1e40af';
  ctx.lineWidth   = 2;
  if (!hasVMar) {
    const halfGap = vtw / 2 + V_PP + 2;
    if (midY - halfGap > yTop + V_ARR) {
      ctx.beginPath(); ctx.moveTo(TOTAL_X, yTop + V_ARR); ctx.lineTo(TOTAL_X, midY - halfGap); ctx.stroke();
    }
    if (midY + halfGap < yBot - V_ARR) {
      ctx.beginPath(); ctx.moveTo(TOTAL_X, midY + halfGap); ctx.lineTo(TOTAL_X, yBot - V_ARR); ctx.stroke();
    }
  } else {
    ctx.beginPath(); ctx.moveTo(TOTAL_X, yTop); ctx.lineTo(TOTAL_X, yBot); ctx.stroke();
  }
  vArrowHead(ctx, TOTAL_X, yTop, 1, V_ARR);
  vArrowHead(ctx, TOTAL_X, yBot, -1, V_ARR);

  // Rotated total label pill
  ctx.save();
  ctx.translate(TOTAL_X, midY);
  ctx.rotate(-Math.PI / 2);
  ctx.font = vFont;
  ctx.fillStyle = '#dbeafe';
  ctx.beginPath();
  ctx.roundRect(-vtw / 2 - V_PP, -V_PH / 2, vtw + V_PP * 2, V_PH, 4);
  ctx.fill();
  ctx.fillStyle = '#1e3a8a';
  ctx.textBaseline = 'middle';
  ctx.textAlign    = 'center';
  ctx.fillText(totalVLabel, 0, 0);
  ctx.restore();

  // ── segment breakdown (only when margins exist) ────────────────
  if (hasVMar) {
    const SEG_X   = stripW + 36;
    const LABEL_X = stripW + 48;

    const vsegs = [];
    let vy = yTop;
    if (topM > 0) {
      vsegs.push({ y1: vy, y2: vy + topM * dppi, label: `${topM.toFixed(3)}"`, type: 'margin' });
      vy += topM * dppi;
    }
    vsegs.push({ y1: vy, y2: vy + cellHin * dppi, label: `${cellHin.toFixed(3)}"`, type: 'cell' });
    vy += cellHin * dppi;
    if (botM > 0) {
      vsegs.push({ y1: vy, y2: vy + botM * dppi, label: `${botM.toFixed(3)}"`, type: 'margin' });
    }

    ctx.font = 'bold 10px system-ui, Arial, sans-serif';
    ctx.textAlign = 'left';

    // Tick marks at each boundary
    const vBounds = new Set([yTop, yBot]);
    vsegs.forEach(s => { vBounds.add(s.y1); vBounds.add(s.y2); });
    ctx.strokeStyle = '#475569';
    ctx.lineWidth   = 1.5;
    vBounds.forEach(y => {
      const py = Math.round(y) + 0.5;
      ctx.beginPath(); ctx.moveTo(stripW + 4, py); ctx.lineTo(SEG_X - 2, py); ctx.stroke();
    });

    vsegs.forEach(seg => {
      const segMidY  = (seg.y1 + seg.y2) / 2;
      const tw       = ctx.measureText(seg.label).width;
      const bgColor  = seg.type === 'margin' ? '#e2e8f0' : '#dbeafe';
      const txColor  = seg.type === 'margin' ? '#334155' : '#1e3a8a';
      const lnColor  = seg.type === 'margin' ? '#64748b' : '#3b82f6';

      // Segment arrow
      ctx.strokeStyle = lnColor;
      ctx.fillStyle   = lnColor;
      ctx.lineWidth   = 1.5;
      const segPx = seg.y2 - seg.y1;
      if (segPx > V_SML * 2.5) {
        ctx.beginPath();
        ctx.moveTo(SEG_X, seg.y1 + V_SML);
        ctx.lineTo(SEG_X, seg.y2 - V_SML);
        ctx.stroke();
      }
      vArrowHead(ctx, SEG_X, seg.y1, 1, V_SML);
      vArrowHead(ctx, SEG_X, seg.y2, -1, V_SML);

      // Label pill
      ctx.fillStyle = bgColor;
      ctx.beginPath();
      ctx.roundRect(LABEL_X, segMidY - V_PH / 2, tw + V_PP * 2, V_PH, 3);
      ctx.fill();
      ctx.fillStyle    = txColor;
      ctx.textBaseline = 'middle';
      ctx.fillText(seg.label, LABEL_X + V_PP, segMidY);
    });
  }

  ctx.restore();
}

// Vertical arrowhead: dir=1 points up (tip at top), dir=-1 points down
function vArrowHead(ctx, x, y, dir, size) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - size * 0.45, y + dir * size);
  ctx.lineTo(x + size * 0.45, y + dir * size);
  ctx.closePath();
  ctx.fill();
}

// ── Render (preview) ─────────────────────────────────────────────
let suppressRender = false;
const MEAS_H = 152; // extra display pixels above strip for measurement overlay
const MEAS_W = 100; // extra display pixels to the right for vertical measurements

function render() {
  if (suppressRender) return;
  try {
    _render();
  } catch (err) {
    const infoEl = document.getElementById('info');
    if (infoEl) infoEl.textContent = '⚠ Render error: ' + err.message;
    console.error('render() error:', err);
  }
}

function _render() {
  const cfg      = getCfg();
  const breakers = getBreakers();
  const W_px     = Math.round(cfg.imgW * cfg.dpi);
  const H_px     = Math.round(cfg.imgH * cfg.dpi);
  const showMeas = document.getElementById('showMeasurements').checked;
  const measH    = showMeas ? MEAS_H : 0;

  const wrap   = document.getElementById('canvas-wrap');
  const canvas = document.getElementById('preview');
  const maxW   = Math.max(wrap.clientWidth  - 64 - (showMeas ? MEAS_W : 0), 200);
  const maxH   = Math.max(wrap.clientHeight - 64 - measH, 80);
  const s      = Math.min(maxW / W_px, maxH / H_px, 1);

  const stripW = Math.round(W_px * s);
  const stripH = Math.round(H_px * s);
  canvas.width  = stripW + (showMeas ? MEAS_W : 0);
  canvas.height = stripH + measH;

  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.translate(0, measH);
  ctx.scale(s, s);
  drawLabels(ctx, W_px, H_px, cfg, breakers);
  ctx.restore();

  if (showMeas) drawMeasurements(ctx, stripW, stripH, measH, cfg, breakers);

  // Info bar — warn when layout overflows strip width
  const totalSpan  = cfg.margin * 2 + breakers.reduce((a, b) => a + b.gap + b.brkW, 0);
  const overflowing = totalSpan > cfg.imgW + 0.001;
  const infoEl     = document.getElementById('info');
  infoEl.textContent =
    `${cfg.imgW}" × ${cfg.imgH}" @ ${cfg.dpi} DPI → ${W_px} × ${H_px} px` +
    `  ·  ${breakers.length} breaker${breakers.length !== 1 ? 's' : ''}` +
    `  ·  span ${totalSpan.toFixed(2)}"` +
    '';
  infoEl.classList.toggle('info-overflow', overflowing);
  document.getElementById('overflow-banner').hidden = !overflowing;
  document.getElementById('b-count').textContent = `(${breakers.length})`;
}

// ── Export ───────────────────────────────────────────────────────
function exportPNG() {
  const btn  = document.getElementById('exportBtn');
  const cfg  = getCfg();
  const W_px = Math.round(cfg.imgW * cfg.dpi);
  const H_px = Math.round(cfg.imgH * cfg.dpi);

  const off = document.createElement('canvas');
  off.width  = W_px;
  off.height = H_px;
  drawLabels(off.getContext('2d'), W_px, H_px, cfg, getBreakers());

  off.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = 'breaker-labels.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoke after the browser has had time to initiate the download
    setTimeout(() => URL.revokeObjectURL(url), 200);
  });

  // Brief visual confirmation on the button
  btn.textContent = '✓ Saved!';
  btn.disabled    = true;
  setTimeout(() => {
    btn.innerHTML = '&#11015; Export PNG';
    btn.disabled  = false;
  }, 1800);
}

// ── Export / Import settings (JSON) ─────────────────────────────
function exportSettings() {
  const data = {
    version: 1,
    image: {
      imgW:         +v('imgW'),
      imgH:         +v('imgH'),
      dpi:          +v('dpi'),
      brkW:         +v('brkW'),
      defGap:       +v('defGap'),
      defCC:        +v('defCC'),
      margin:       +v('margin'),
      topMargin:    +v('topMargin'),
      bottomMargin: +v('bottomMargin'),
    },
    appearance: {
      bgTransparent:   document.getElementById('bgTransparent').checked,
      bgColor:         v('bgColor'),
      cellTransparent: document.getElementById('cellTransparent').checked,
      cellColor:       v('cellColor'),
      textColor:       v('textColor'),
      brdColor:        v('brdColor'),
      brdW:            +v('brdW'),
      font:            v('font'),
      pad:             +v('pad'),
      rotation:        +v('rotation'),
    },
    breakers: getBreakers(),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'breaker-settings.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 200);

  const btn = document.getElementById('exportJsonBtn');
  btn.textContent = '✓ Saved!';
  btn.disabled    = true;
  setTimeout(() => { btn.innerHTML = '&#11015; Save Settings'; btn.disabled = false; }, 1800);
}

function importSettings(input) {
  const file = input.files[0];
  if (!file) return;
  // Reset so the same file can be re-loaded if needed
  input.value = '';

  const reader = new FileReader();
  reader.onload = e => {
    let data;
    try { data = JSON.parse(e.target.result); }
    catch { alert('Could not read the settings file — invalid JSON.'); return; }

    const img = data.image       || {};
    const app = data.appearance  || {};
    const brk = data.breakers    || [];

    // Image size
    const numFields = ['imgW','imgH','dpi','brkW','defGap','defCC','margin','topMargin','bottomMargin'];
    numFields.forEach(id => { if (img[id] != null) document.getElementById(id).value = img[id]; });

    // Appearance — checkboxes
    if (app.bgTransparent   != null) document.getElementById('bgTransparent').checked   = app.bgTransparent;
    if (app.cellTransparent != null) document.getElementById('cellTransparent').checked = app.cellTransparent;

    // Appearance — color pairs (picker + hex text)
    [['bgColor','bgHex'], ['cellColor','cellHex'], ['textColor','textHex'], ['brdColor','brdHex']]
      .forEach(([pickId, hexId]) => {
        const key = pickId; // same key name in JSON
        if (app[key]) {
          document.getElementById(pickId).value = app[key];
          document.getElementById(hexId).value  = app[key];
        }
      });

    // Appearance — simple numeric fields
    if (app.brdW != null) document.getElementById('brdW').value = app.brdW;
    if (app.pad  != null) document.getElementById('pad').value  = app.pad;

    // Font (use selectFont so the picker UI updates)
    if (app.font) selectFont(app.font);

    // Rotation (use setRotation so the tile UI updates)
    if (app.rotation != null) setRotation(app.rotation);

    // Breakers
    document.getElementById('breaker-list').innerHTML = '';
    suppressRender = true;
    brk.forEach(b => addBreaker(b.label ?? '', b.gap ?? null, b.brkW ?? null));
    // Restore per-card size adjustments (addBreaker initialises sizeAdj to 0)
    document.querySelectorAll('#breaker-list .b-row').forEach((row, i) => {
      const adj = brk[i]?.sizeAdj ?? 0;
      if (adj !== 0) {
        row.querySelector('.b-size-adj').value = adj;
        row.querySelector('.b-size-val').textContent = adj > 0 ? `+${adj}` : `${adj}`;
        updateCardState(row);
      }
    });
    suppressRender = false;
    render();
  };
  reader.readAsText(file);
}

// ── Breaker list UI ──────────────────────────────────────────────
function addBreaker(label = '', gap = null, brkW = null) {
  const list = document.getElementById('breaker-list');
  list.querySelector('.b-empty-state')?.remove();

  // Fall back to current global defaults when not explicitly provided
  const g = gap  ?? (+v('defGap') || 0.15);
  const w = brkW ?? (+v('brkW')   || 0.5);

  const row = document.createElement('div');
  row.className = 'b-row';
  row.setAttribute('draggable', 'true');
  row.dataset.defaultGap  = g;
  row.dataset.defaultBrkw = w;
  row.innerHTML =
    `<span class="b-handle" aria-hidden="true">` +
      `<span class="b-drag-icon">⠿</span>` +
      `<span class="b-num">?</span>` +
    `</span>` +
    `<div class="b-body">` +
    `<textarea class="b-label" rows="1" spellcheck="false"` +
      ` aria-label="Breaker label text"></textarea>` +
    `<div class="b-controls">` +
      `<span class="b-ctrl-lbl">Gap</span>` +
      `<span class="b-ctrl-lbl">Width</span>` +
      `<span class="b-ctrl-lbl">Size</span>` +
      `<button type="button" class="b-revert" tabindex="-1" aria-hidden="true"` +
        ` title="Revert to defaults" aria-label="Revert settings to defaults"` +
        ` onclick="revertCard(this)">↺</button>` +
      `<div class="b-size-wrap">` +
        `<button type="button" class="icon-btn" title="Decrease gap"` +
          ` aria-label="Decrease gap" onclick="adjGap(this,-1)">−</button>` +
        `<span class="b-gap-val">${g.toFixed(2)}</span>` +
        `<input type="hidden" class="b-gap" value="${g}">` +
        `<button type="button" class="icon-btn" title="Increase gap"` +
          ` aria-label="Increase gap" onclick="adjGap(this,+1)">+</button>` +
      `</div>` +
      `<div class="b-size-wrap">` +
        `<button type="button" class="icon-btn" title="Narrower"` +
          ` aria-label="Decrease breaker width" onclick="adjBrkW(this,-1)">−</button>` +
        `<span class="b-brkw-val">${w.toFixed(2)}</span>` +
        `<input type="hidden" class="b-brkw" value="${w}">` +
        `<button type="button" class="icon-btn" title="Wider"` +
          ` aria-label="Increase breaker width" onclick="adjBrkW(this,+1)">+</button>` +
      `</div>` +
      `<div class="b-size-wrap">` +
        `<button type="button" class="icon-btn" title="Smaller text"` +
          ` aria-label="Decrease text size" onclick="adjSize(this,-1)">−</button>` +
        `<span class="b-size-val">0</span>` +
        `<input type="hidden" class="b-size-adj" value="0">` +
        `<button type="button" class="icon-btn" title="Larger text"` +
          ` aria-label="Increase text size" onclick="adjSize(this,+1)">+</button>` +
      `</div>` +
      `<button type="button" class="icon-btn del" title="Delete breaker"` +
        ` aria-label="Delete this breaker" onclick="delRow(this)">×</button>` +
    `</div>` +
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
  const rows = document.querySelectorAll('#breaker-list .b-row');
  rows.forEach((r, i) => r.querySelector('.b-num').textContent = i + 1);
  // Show empty state when list is empty
  const list = document.getElementById('breaker-list');
  if (!rows.length && !list.querySelector('.b-empty-state')) {
    const empty = document.createElement('div');
    empty.className   = 'b-empty-state';
    empty.textContent = 'No breakers yet — click "+ Add Breaker" to get started';
    list.appendChild(empty);
  }
}

function clearBreakers() {
  const rows = document.querySelectorAll('#breaker-list .b-row');
  if (!rows.length) return;
  if (!confirm('Clear all breakers? This cannot be undone.')) return;
  document.getElementById('breaker-list').innerHTML = '';
  renumber();
  render();
}

function loadPreset() {
  document.getElementById('breaker-list').innerHTML = '';
  suppressRender = true;
  PRESET.forEach(b => addBreaker(b.label, b.gap));
  suppressRender = false;
  render();
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

// ── Font availability check ───────────────────────────────────────
// Compares rendering against the monospace fallback — more reliable than
// document.fonts.check() for system fonts that are loaded on demand.
function isFontAvailable(name) {
  const canvas = document.createElement('canvas');
  const ctx    = canvas.getContext('2d');
  const probe  = 'mmmmmmmmmmlli';
  ctx.font = `bold 20px monospace`;
  const fallback = ctx.measureText(probe).width;
  ctx.font = `bold 20px '${name}', monospace`;
  return ctx.measureText(probe).width !== fallback;
}

// ── Font picker ──────────────────────────────────────────────────
const FONTS = [
  // ── Heavy / display — best for labels ──────
  'Arial Black',
  'Impact',
  'Haettenschweiler',
  'Franklin Gothic Heavy',
  'Franklin Gothic Medium',
  'Gill Sans Ultra Bold',
  'Gill Sans MT Condensed',
  'Rockwell Extra Bold',
  'Wide Latin',
  'Segoe UI Black',
  'Bahnschrift',

  // ── Sans-serif ──────────────────────────────
  'Arial Narrow',
  'Arial',
  'Calibri',
  'Calibri Light',
  'Candara',
  'Century Gothic',
  'Corbel',
  'Microsoft Sans Serif',
  'Segoe UI',
  'Segoe UI Semibold',
  'Tahoma',
  'Trebuchet MS',
  'Verdana',
  'Lucida Sans Unicode',

  // ── Serif / slab ────────────────────────────
  'Rockwell',
  'Rockwell Condensed',
  'Gill Sans MT',
  'Cambria',
  'Constantia',
  'Georgia',
  'Garamond',
  'Book Antiqua',
  'Palatino Linotype',
  'Perpetua',
  'Century',
  'Times New Roman',

  // ── Monospace / technical ───────────────────
  'OCR A Extended',
  'Consolas',
  'Courier New',
  'Lucida Console',
];

function buildFontDropdown() {
  const dd = document.getElementById('fontDropdown');
  FONTS.forEach(name => {
    const available = isFontAvailable(name);

    const opt  = document.createElement('div');
    opt.className        = 'font-option' + (available ? '' : ' font-unavailable');
    opt.dataset.font     = name;
    opt.setAttribute('role',     'option');
    opt.setAttribute('tabindex', '0');
    opt.setAttribute('aria-selected', 'false');

    const span = document.createElement('span');
    span.className       = 'font-opt-name';
    span.style.fontFamily = `'${name}'`;
    span.textContent     = name;
    opt.appendChild(span);

    opt.addEventListener('click', () => selectFont(name));
    opt.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectFont(name);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        (opt.nextElementSibling ?? dd.firstElementChild)?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        (opt.previousElementSibling ?? dd.lastElementChild)?.focus();
      } else if (e.key === 'Escape' || e.key === 'Tab') {
        closeFontDropdown();
        document.getElementById('fontTrigger').focus();
      }
    });

    dd.appendChild(opt);
  });
}

function selectFont(name) {
  document.getElementById('font').value = name;
  const lbl = document.getElementById('fontTriggerLabel');
  lbl.textContent      = name;
  lbl.style.fontFamily = `'${name}'`;
  document.querySelectorAll('#fontDropdown .font-option').forEach(o => {
    const active = o.dataset.font === name;
    o.classList.toggle('active', active);
    o.setAttribute('aria-selected', active);
  });
  closeFontDropdown();
  render();
}

function toggleFontDropdown(e) {
  e.stopPropagation();
  const dd      = document.getElementById('fontDropdown');
  const trigger = document.getElementById('fontTrigger');
  const opening = !dd.classList.contains('open');
  dd.classList.toggle('open', opening);
  trigger.setAttribute('aria-expanded', opening);
  if (opening) {
    const active = dd.querySelector('.font-option.active') ?? dd.firstElementChild;
    active?.focus();
  }
}

function closeFontDropdown() {
  document.getElementById('fontDropdown').classList.remove('open');
  document.getElementById('fontTrigger').setAttribute('aria-expanded', 'false');
}

document.addEventListener('click', e => {
  if (!e.target.closest('.font-picker')) closeFontDropdown();
});

// ── Per-breaker gap adjustment ───────────────────────────────────
function adjGap(btn, dir) {
  const row = btn.closest('.b-row');
  const inp = row.querySelector('.b-gap');
  const val = Math.max(0, Math.round((parseFloat(inp.value) + dir * 0.05) * 100) / 100);
  inp.value = val;
  row.querySelector('.b-gap-val').textContent = val.toFixed(2);
  updateCardState(row);
  render();
}

// ── Per-breaker width adjustment ─────────────────────────────────
function adjBrkW(btn, dir) {
  const row = btn.closest('.b-row');
  const inp = row.querySelector('.b-brkw');
  const val = Math.max(0.05, Math.round((parseFloat(inp.value) + dir * 0.05) * 100) / 100);
  inp.value = val;
  row.querySelector('.b-brkw-val').textContent = val.toFixed(2);
  updateCardState(row);
  render();
}

// ── Per-breaker size adjustment ──────────────────────────────────
function adjSize(btn, dir) {
  const row = btn.closest('.b-row');
  const inp = row.querySelector('.b-size-adj');
  const val = Math.max(-9, Math.min(9, (parseInt(inp.value) || 0) + dir));
  inp.value = val;
  row.querySelector('.b-size-val').textContent = val > 0 ? `+${val}` : `${val}`;
  updateCardState(row);
  render();
}

// ── Card modified state ──────────────────────────────────────────
function updateCardState(row) {
  const gap      = parseFloat(row.querySelector('.b-gap').value);
  const brkW     = parseFloat(row.querySelector('.b-brkw').value);
  const adj      = parseInt(row.querySelector('.b-size-adj').value) || 0;
  const defGap   = parseFloat(row.dataset.defaultGap);
  const defBrkW  = parseFloat(row.dataset.defaultBrkw);
  const modified = gap !== defGap || brkW !== defBrkW || adj !== 0;
  row.classList.toggle('is-modified', modified);
  const revert = row.querySelector('.b-revert');
  revert.tabIndex = modified ? 0 : -1;
  revert.setAttribute('aria-hidden', String(!modified));
}

function revertCard(btn) {
  const row     = btn.closest('.b-row');
  const defGap  = parseFloat(row.dataset.defaultGap);
  const defBrkW = parseFloat(row.dataset.defaultBrkw);

  row.querySelector('.b-gap').value              = defGap;
  row.querySelector('.b-gap-val').textContent    = defGap.toFixed(2);

  row.querySelector('.b-brkw').value             = defBrkW;
  row.querySelector('.b-brkw-val').textContent   = defBrkW.toFixed(2);

  row.querySelector('.b-size-adj').value         = 0;
  row.querySelector('.b-size-val').textContent   = '0';

  updateCardState(row);
  render();
}

// ── Rotation selector ────────────────────────────────────────────
function setRotation(deg) {
  document.getElementById('rotation').value = deg;
  document.querySelectorAll('#rotGroup .rot-tile').forEach(btn => {
    const active = +btn.dataset.deg === deg;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
  render();
}

// ── Wire all config inputs ───────────────────────────────────────
['imgW','imgH','dpi','margin','topMargin','bottomMargin','brdW','pad']
  .forEach(id => document.getElementById(id).addEventListener('input', render));

// ── Three-way sync: brkW ↔ defGap ↔ defCC ───────────────────────
// Any one field updates the third to keep C-C = brkW + defGap.
let _syncingCC = false;
function syncCC(source) {
  if (_syncingCC) return;
  _syncingCC = true;

  const brkW   = Math.max(0.05, +v('brkW')  || 0.5);
  const defGap = Math.max(0,    +v('defGap') || 0.15);
  const defCC  = Math.max(0.05, +v('defCC')  || 0.65);
  const round3 = n => Math.round(n * 1000) / 1000;

  // Resolve the authoritative new gap and width
  let newGap  = defGap;
  let newBrkW = brkW;
  if (source === 'defCC') {
    newGap = round3(Math.max(0, defCC - brkW));
    document.getElementById('defGap').value = newGap;
  } else {
    document.getElementById('defCC').value = round3(brkW + defGap);
  }

  // Push new defaults into every unmodified card so the picture updates
  document.querySelectorAll('#breaker-list .b-row:not(.is-modified)').forEach(row => {
    row.dataset.defaultGap  = newGap;
    row.dataset.defaultBrkw = newBrkW;

    row.querySelector('.b-gap').value            = newGap;
    row.querySelector('.b-gap-val').textContent  = newGap.toFixed(2);

    row.querySelector('.b-brkw').value           = newBrkW;
    row.querySelector('.b-brkw-val').textContent = newBrkW.toFixed(2);
  });

  _syncingCC = false;
  render();
}
document.getElementById('brkW')?.addEventListener('input',   () => syncCC('brkW'));
document.getElementById('defGap')?.addEventListener('input', () => syncCC('defGap'));
document.getElementById('defCC')?.addEventListener('input',  () => syncCC('defCC'));

// Debounced resize — avoids expensive re-draws on every pixel of window drag
let _resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(render, 120);
});

// ── Drag-and-drop reordering ─────────────────────────────────────
let dragRow = null;

function onDragStart(e) {
  dragRow = e.currentTarget;
  e.dataTransfer.effectAllowed = 'move';
  setTimeout(() => dragRow?.classList.add('dragging'), 0);
}

function onDragEnd() {
  dragRow?.classList.remove('dragging');
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

// ── Help modal ───────────────────────────────────────────────────
function openHelp() {
  document.getElementById('help-backdrop').hidden = false;
  document.getElementById('help-modal').hidden    = false;
  document.getElementById('help-close')?.focus();
}

function closeHelp() {
  document.getElementById('help-backdrop').hidden = true;
  document.getElementById('help-modal').hidden    = true;
  document.getElementById('helpBtn').focus();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !document.getElementById('help-modal').hidden) closeHelp();
});

// ── Init ─────────────────────────────────────────────────────────
// Build the font dropdown without triggering a render.
buildFontDropdown();
document.getElementById('font').value = 'Arial Black';
const _initLabel = document.getElementById('fontTriggerLabel');
_initLabel.textContent      = 'Arial Black';
_initLabel.style.fontFamily = "'Arial Black'";
document.querySelectorAll('#fontDropdown .font-option').forEach(o => {
  const active = o.dataset.font === 'Arial Black';
  o.classList.toggle('active', active);
  o.setAttribute('aria-selected', String(active));
});

// Defer first render until after the browser has calculated layout,
// so wrap.clientWidth/Height return real values.
requestAnimationFrame(loadPreset);
