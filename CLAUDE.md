# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Browser-based tool that generates printable PNG label strips for circuit breakers on a Cessna aircraft panel. No build step, no dependencies — open `index.html` directly in a browser.

## File Structure

| File | Role |
|---|---|
| `index.html` | Markup only — sidebar panels, toolbar buttons, canvas wrapper, help modal |
| `style.css` | All styles — design tokens, layout, breaker cards, measurement overlay, help modal |
| `app.js` | All application logic — config reading, drawing, UI interactions, import/export |

## Architecture

- **Layout**: two-column flex — `#sidebar` (settings + breaker list) on the left, `#main` (toolbar + overflow banner + canvas) on the right.
- **State**: no global state object; all config is read directly from DOM inputs at render time via `getCfg()` and `getBreakers()`.
- **Coordinate system**: `totalSpan = margin + Σ(gap_i + brkW_i) + margin`. In `drawLabels`, `ppi = W_px / cfg.imgW` converts inches → pixels. `s = min(maxW/W_px, maxH/H_px, 1)` scales the preview down to fit the canvas-wrap area.
- **Preview vs export**: preview canvas is `stripW × (stripH + measH)` (plus `MEAS_W` on the right when measurements are on). Export creates an offscreen canvas at full `W_px × H_px` with no measurement overlay.
- **Per-breaker values**: each breaker card stores its own gap and width in hidden inputs (`.b-gap`, `.b-brkw`). Cards track whether they've been modified from the global defaults via `dataset.defaultGap` / `dataset.defaultBrkw` and the `is-modified` CSS class.
- **Three-way sync**: `defCC = brkW + defGap`. `syncCC(source)` resolves which field changed and pushes updated values to all unmodified cards. A `_syncingCC` boolean prevents re-entrant calls.
- **Font fitting**: `fitFont()` binary-searches for the largest integer font size where all lines fit in the available cell area. `bestLines()` tries every 1- and 2-word-group split, picks the split that yields the largest font. Explicit `\n` in a label bypasses auto-split.
- **Text rotation**: context is translated to the cell center, rotated by `cfg.rotation` degrees, then drawn. `availW`/`availH` are swapped for 90°/270°.
- **Measurement overlay**: `MEAS_H = 152` px band above the strip (horizontal) and `MEAS_W = 100` px band to the right (vertical). `render()` expands the canvas by these amounts and translates the strip draw down/left. Measurements are drawn in display-pixel space after `ctx.restore()`. The export canvas omits the overlay entirely.
- **Render error handling**: `render()` wraps `_render()` in a try/catch that surfaces errors in the `#info` bar.

## Key functions

| Function | Purpose |
|---|---|
| `getCfg()` | Reads all sidebar inputs → config object |
| `getBreakers()` | Reads breaker list DOM → `[{label, gap, brkW, sizeAdj}]` |
| `fitFont(ctx, lines, maxW, maxH, font)` | Binary search for max font size |
| `bestLines(ctx, text, maxW, maxH, font)` | Optimal 1 or 2-line split |
| `drawLabels(ctx, W, H, cfg, breakers)` | Core draw routine — used for both preview and export |
| `drawMeasurements(ctx, stripW, stripH, measH, cfg, breakers)` | Horizontal + vertical dimension overlay (preview only) |
| `vArrowHead(ctx, x, y, dir, size)` | Vertical arrowhead helper for measurement overlay |
| `render()` | try/catch wrapper around `_render()` |
| `_render()` | Sizes canvas, scales preview, calls `drawLabels` + `drawMeasurements` |
| `exportPNG()` | Offscreen full-res canvas → PNG download |
| `exportSettings()` | Serializes all inputs + breaker list → JSON download |
| `importSettings(input)` | Reads JSON file, restores all inputs and breaker list |
| `addBreaker(label, gap, brkW)` | Appends a card to the breaker list |
| `syncCC(source)` | Three-way sync between `brkW`, `defGap`, `defCC`; pushes to unmodified cards |
| `updateCardState(row)` | Checks if card differs from defaults; toggles `is-modified` + revert button |
| `loadPreset()` | Replaces list with the built-in Cessna 172 preset |

## Measurement overlay layout

**Horizontal band** (`MEAS_H = 152 px`, above the strip):
- `Y_TOTAL = 16` — total span double-arrow with pill label
- `Y_CC = 38` — center-to-center teal row (ticks + per-span labels)
- `TICK_TOP = 54` — top of segment boundary tick marks
- `Y_LIFT2 = 70`, `Y_LIFT1 = 96` — lift rows for narrow-segment labels
- `Y_SEG = 122` — segment baseline; inline labels sit here
- `TICK_BOT = measH - 4` — bottom of tick marks

**Vertical band** (`MEAS_W = 100 px`, right of the strip):
- Total height double-arrow with rotated label (centered when no margins, left column when margins exist)
- When `topMargin > 0` or `bottomMargin > 0`: tick marks at each boundary + color-coded segment arrows and pill labels for top margin, cell area, and bottom margin

## Notable gotchas

- `brkW` and `defGap` inputs are NOT in the general `render` event-listener array — they're handled exclusively by `syncCC`. Adding them back to the wire array would cause double renders and sync loops.
- Setting `canvas.width` or `canvas.height` resets the entire canvas state. The context is always retrieved **after** sizing.
- `getBreakers()` uses optional chaining (`?.`) on all querySelector calls so a stale DOM card without `.b-brkw` doesn't throw and silently blank the canvas.
- The measurement overlay uses `ctx.roundRect` (Chrome 99+, Firefox 112+). No fallback — minimum browser requirement.
- Export calls `drawLabels` directly on an offscreen canvas; it never calls `drawMeasurements`.
