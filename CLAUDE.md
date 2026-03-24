# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Single-file HTML/JS/CSS tool that generates PNG label strips for circuit breakers on a Cessna aircraft panel. No build step, no dependencies — open `index.html` directly in a browser.

## Architecture

Everything lives in `index.html`:

- **Layout**: two-column flex — `#sidebar` (settings + breaker list) on the left, `#canvas-wrap` (live preview canvas) on the right.
- **State**: no global state object; all config is read directly from DOM inputs at render time via `getCfg()` and `getBreakers()`.
- **Coordinate system**: abstract "units" throughout. `totalSpan = margin + Σ(gap_i + brkW) + margin`. `scale = imgW / totalSpan` converts units → pixels.
- **Preview vs export**: preview canvas is drawn at display resolution (`imgW * s` where `s ≤ 1`). Export creates an offscreen canvas at full `imgW × imgH` resolution. Both call `drawLabels(ctx, W, H, cfg, breakers)`.
- **Font fitting**: `fitFont()` binary-searches for the largest integer font size where all lines fit in the available cell area. `bestLines()` tries every 1- and 2-word-group split, picks the split that yields the largest font. Explicit `\n` in a label bypasses auto-split.
- **Text rotation**: when `rotate=true`, the draw context is translated to the cell center, rotated −90°, and drawn as if `availW = cellHeight` and `availH = cellWidth`.

## Key functions

| Function | Purpose |
|---|---|
| `getCfg()` | Reads all sidebar inputs → config object |
| `getBreakers()` | Reads breaker list DOM → `[{label, gap}]` |
| `fitFont(ctx, lines, maxW, maxH, font)` | Binary search for max font size |
| `bestLines(ctx, text, maxW, maxH, font)` | Optimal 1 or 2-line split |
| `drawLabels(ctx, W, H, cfg, breakers)` | Core draw routine (preview + export) |
| `render()` | Scales preview, calls `drawLabels` |
| `exportPNG()` | Offscreen full-res canvas → PNG download |
| `addBreaker(label, gap)` | Appends row to breaker list |
