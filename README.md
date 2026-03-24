# Cessna Breaker Label Generator

A browser-based tool for designing and exporting printable circuit breaker label strips for Cessna aircraft panels. No installation, no server — open `index.html` directly in any modern browser.

## Features

- **Live preview** — changes reflect instantly in the canvas
- **Full-resolution PNG export** — configurable DPI (default 300) for print-ready output
- **Per-breaker customization** — individual gap, width, and font size overrides per breaker cell
- **Three-way center-to-center sync** — breaker width + gap = C-C; change any one field and the others update automatically
- **Auto font fitting** — binary search finds the largest font that fits each cell; auto-splits multi-word labels onto two lines
- **Measurement overlay** — toggleable horizontal and vertical dimension annotations with center-to-center spacing, segment widths, and margin breakdowns
- **Save / Load settings** — full configuration (all inputs + breaker list) serialized to JSON
- **Overflow warning** — red banner when breakers exceed the configured strip width
- **Drag-to-reorder** — reorder breakers by dragging the handle on each card

## Usage

1. Open `index.html` in Chrome, Edge, or Firefox
2. Adjust **Image Size** settings to match your panel dimensions
3. Set **Appearance** (colors, font, rotation)
4. Add breakers to the list — click **+ Add Breaker** or **Load Preset** for a Cessna 172 starting point
5. Click **📏 Measurements** to verify spacing against your physical panel
6. Click **Export PNG** to download the strip at full resolution
7. Click **Save Settings** to save your work; **Load Settings** to restore it later

### Printing

Print the exported PNG at **100% scale** (disable "fit to page") to preserve physical dimensions. The exported file never includes the measurement overlay — only the clean label strip.

## Settings Reference

### Image Size

| Setting | Description |
|---|---|
| Width (in) | Physical strip width in inches |
| Height (in) | Physical strip height in inches |
| DPI | Export resolution (300 = standard print quality) |
| Breaker width (in) | Default cell width; individual cells can override |
| Default gap (in) | Default space between cells |
| Default center to center (in) | Equals breaker width + gap; changing it recalculates the gap |
| End margins (in) | Empty space before the first and after the last breaker |
| Top / Bottom margin (in) | Vertical padding inside the strip |

### Appearance

| Setting | Description |
|---|---|
| Background | Strip fill color; check **Transparent** for no background |
| Cell fill | Individual cell fill color; check **Transparent** for no fill |
| Text color | Label text color |
| Border color / width | Cell outline; set width to 0 to remove |
| Font | Typeface for all labels; unavailable system fonts are dimmed |
| Text padding (%) | Space between text and cell edge |
| Text rotation | Label angle (90° is typical for narrow strips) |

### Breaker Cards

Each card has:
- **Label** — text to print; press Enter or type `\n` for a manual line break
- **Gap** (− / +) — pre-cell spacing in 0.05" steps; bold outline when overriding default
- **Width** (− / +) — cell width in 0.05" steps; bold outline when overriding default
- **Size** (− / +) — font size nudge (±9 steps) on top of auto-fit
- **↺** — revert that cell's gap and width back to global defaults
- **⠿ handle** — drag to reorder
- **×** — delete

## File Structure

```
index.html   — markup (sidebar, toolbar, canvas, help modal)
style.css    — all styles
app.js       — all application logic
```

No build step. No dependencies. No frameworks.
