# 📚 Pdf-to-book

Vanilla JS web app that turns PDF files into an interactive flip-book reading experience.
Upload and manage PDFs on the **Dashboard**, then read them in the **Book Viewer** with
realistic page flips, pinch/scroll zoom, and touch swipe. No frameworks, no build step,
no server — everything runs in the browser and persists in IndexedDB.

## ✨ Features

### Dashboard (View A)
- **Upload PDFs** via drag-and-drop zone or file picker (multiple files at once)
- **Persistence** — PDFs stored as blobs in IndexedDB with metadata
  (`id`, `title`, `pageCount`, `uploadDate`, cover `thumb`); library survives reloads
- **Grid view** with canvas-rendered cover thumbnails, page counts, upload dates
- Per-book **Read**, **Rename**, and **Delete** actions

### Book Viewer (View B)
- **PDF engine (pdf.js)** — pages rendered async to HTML5 Canvas with
  Device-Pixel-Ratio scaling (sharp text on high-DPI screens)
- **Page flip** — 3D CSS page-turn animation on every turn
- **Spreads** — two-page side-by-side on desktop, single page on mobile (≤640px)
- **Touch swipe** — swipe left = next, swipe right = previous (full touch support)
- **Keyboard** — `←` / `→` arrows, `PageUp` / `PageDown`
- **Zoom system** — `+` / `−` buttons, mouse-wheel zoom at cursor, pinch-to-zoom,
  double-tap / double-click for 2× at point, reset button with live % label
- **Pan** — drag to pan with hardware-accelerated `translate3d + scale` when zoomed in
- **Conflict-free gestures** — flip/swipe auto-disabled while zoomed in, re-enabled at 100%
- **Reading controls** — `Page X of Y` jump input, spread label, Library (back) button,
  fullscreen toggle (`requestFullscreen`)
- **Edge cases** — corrupt/invalid PDFs, password-protected PDFs, empty PDFs,
  per-page render errors, window-resize spread recalculation, stale-render cancellation,
  memory cleanup (`doc.destroy()`, canvases cleared) when swapping/closing books

## 🗂️ File structure

```
index.html        Unified app shell / dashboard ↔ viewer switcher
styles.css        Theme (CSS variables), Flexbox/Grid, flip keyframes, responsive rules
js/db.js          Native IndexedDB wrapper (save/get/getAll/delete/rename)
js/pdfEngine.js   pdf.js worker init, DPR-aware page renderer, thumbnail generator
js/bookViewer.js  Spread state, flip animation, swipe/keyboard, zoom+pan controller
js/app.js         Main controller wiring dashboard UI to DB and Viewer
```

> `script.js` / `style.css` are the legacy pre-rebuild files, superseded by the
> structure above.

## 🚀 Run

Any static server works (required so pdf.js and ES modules load correctly):

```
python -m http.server 8000
# open http://localhost:8000/index.html
```

Then drag a PDF onto the dropzone → **Read** → flip through with buttons,
swipe, arrow keys, or pinch/scroll zoom.

## 🔧 Technical notes

- **Stack**: pure HTML5 + CSS3 + ES6+, `pdf.js` 3.11.174 via CDN (the only dependency).
  No PageFlip/panzoom libraries — custom ~40-line pointer controller covers
  pinch, pan, swipe, and double-tap without conflicts.
- **Storage**: single IndexedDB object store (`books`, keyPath `id`); no indexes —
  add them if the library grows large.
- **Zoom range**: 1×–4×; pan clamped to a zoom-scaled radius.
- **Limits (demo-grade)**: browser-local storage only, no multi-user sync, no server-side
  auth. Add a backend + real user accounts before treating this as production.
