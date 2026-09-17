/* bookViewer.js — spread renderer + flip animation + swipe/keyboard + pinch/wheel zoom + pan. */
const BookViewer = (() => {
  const $ = (id) => document.getElementById(id);
  const els = {};
  ['stage-wrap', 'stage', 'page-left', 'page-right', 'page-jump', 'page-total',
   'spread-label', 'viewer-status', 'prev-page', 'next-page'].forEach((id) => (els[id] = $(id)));

  const S = { doc: null, bookId: null, left: 1, total: 0, zoom: 1, panX: 0, panY: 0,
              turning: false, pointers: new Map(), pinchD0: 0, zoom0: 1, renderToken: 0 };

  const dual = () => window.matchMedia('(min-width: 641px)').matches;
  const zoomed = () => S.zoom > 1.01;
  const maxLeft = () => (dual() ? (S.total % 2 ? S.total : Math.max(1, S.total - 1)) : S.total);

  function status(msg, err) {
    els['viewer-status'].hidden = !msg;
    els['viewer-status'].textContent = msg || '';
    els['viewer-status'].classList.toggle('error', !!err);
  }

  function pageWidth() {
    const wrap = els['stage-wrap'].clientWidth;
    return Math.floor((dual() ? Math.min(wrap / 2 - 8, 520) : Math.min(wrap - 16, 620)));
  }

  async function open(book) {
    close();
    try {
      status('Loading PDF…');
      const buf = await book.blob.arrayBuffer();
      S.doc = await PdfEngine.load(buf);
      S.bookId = book.id; S.total = S.doc.numPages; S.left = 1;
      resetZoom();
      els['page-total'].textContent = S.total;
      await renderSpread();
      status('');
    } catch (e) {
      console.error(e);
      let m = 'Could not open this PDF.';
      if (e && e.name === 'PasswordException') m = 'Password-protected PDFs are not supported.';
      else if (e && e.name === 'InvalidPDFException') m = 'Invalid or corrupted PDF file.';
      status(m, true);
    }
  }

  function close() {
    S.renderToken++;
    if (S.doc) { S.doc.destroy().catch(() => {}); S.doc = null; } // free pdf.js memory
    els['page-left'].innerHTML = '';
    els['page-right'].innerHTML = '';
    S.bookId = null; S.left = 1; S.total = 0;
    resetZoom();
  }

  function resetZoom() {
    S.zoom = 1; S.panX = 0; S.panY = 0;
    applyTransform();
    $('zoom-reset').textContent = '100%';
  }

  function applyTransform() {
    els.stage.style.transform = `translate3d(${S.panX}px,${S.panY}px,0) scale(${S.zoom})`;
  }

  function clampPan() {
    // ponytail: pan clamped to a fixed radius instead of measuring overflow; exact bounds if ever needed
    const r = 600 * S.zoom;
    S.panX = Math.max(-r, Math.min(r, S.panX));
    S.panY = Math.max(-r, Math.min(r, S.panY));
  }

  function setZoom(z, cx, cy) {
    const before = S.zoom;
    S.zoom = Math.max(1, Math.min(4, z));
    if (cx !== undefined) { // zoom toward point: keep focal point stable
      S.panX = cx - ((cx - S.panX) * S.zoom) / before;
      S.panY = cy - ((cy - S.panY) * S.zoom) / before;
    }
    if (!zoomed()) { S.panX = 0; S.panY = 0; } // fully out → flip/swipe re-enabled
    clampPan(); applyTransform();
    $('zoom-reset').textContent = Math.round(S.zoom * 100) + '%';
  }

  function blank(el) {
    el.innerHTML = '';
    el.classList.add('blank');
  }

  async function renderSpread() {
    const token = ++S.renderToken;
    if (!S.doc) return;
    const w = pageWidth(), pages = dual() ? [S.left, S.left + 1] : [S.left];
    const slots = [els['page-left'], els['page-right']];
    slots.forEach((el) => { el.innerHTML = ''; el.classList.remove('blank'); });
    await Promise.all(pages.map(async (p, i) => {
      if (token !== S.renderToken) return; // superseded → drop stale render
      if (p > S.total) { if (i === 1) blank(slots[1]); return; }
      const c = document.createElement('canvas');
      slots[i].appendChild(c);
      try {
        await PdfEngine.renderToCanvas(S.doc, p, c, w);
      } catch (e) {
        console.error('render p' + p, e);
        slots[i].textContent = '⚠ page error';
      }
    }));
    if (token !== S.renderToken) return;
    els['page-jump'].value = S.left;
    els['page-jump'].max = S.total;
    els['spread-label'].textContent = dual()
      ? `Pages ${S.left}${S.left + 1 <= S.total ? '–' + (S.left + 1) : ''}`
      : `Page ${S.left}`;
    els['prev-page'].disabled = S.left <= 1;
    els['next-page'].disabled = S.left >= maxLeft();
  }

  // Flip animation: clone outgoing page into a rotating sheet, swap underneath mid-flight
  function flip(toNext, go) {
    if (S.turning || !S.doc) return;
    const fromEl = toNext ? els['page-right'] : els['page-left'];
    const src = fromEl.querySelector('canvas');
    S.turning = true;
    if (src) {
      const r = fromEl.getBoundingClientRect();
      const sheet = document.createElement('div');
      sheet.className = 'flip-sheet ' + (toNext ? 'next' : 'prev');
      sheet.style.width = r.width + 'px';
      sheet.style.height = r.height + 'px';
      const img = document.createElement('canvas');
      img.width = src.width; img.height = src.height;
      img.getContext('2d').drawImage(src, 0, 0);
      sheet.appendChild(img);
      els.stage.appendChild(sheet);
      setTimeout(() => { go(); sheet.addEventListener('animationend', () => sheet.remove(), { once: true }); }, 200);
      setTimeout(() => { S.turning = false; }, 480);
    } else { go(); S.turning = false; }
  }

  function next() {
    if (zoomed() || S.left >= maxLeft()) return; // no flip while zoomed
    flip(true, () => {
      S.left = Math.min(maxLeft(), S.left + (dual() ? 2 : 1));
      renderSpread();
    });
  }

  function prev() {
    if (zoomed() || S.left <= 1) return;
    flip(false, () => {
      S.left = Math.max(1, S.left - (dual() ? 2 : 1));
      renderSpread();
    });
  }

  function jump(n) {
    if (!S.doc) return;
    n = Math.max(1, Math.min(S.total, n | 0));
    S.left = dual() && n % 2 === 0 ? n - 1 : n; // spreads start on odd pages
    renderSpread();
  }

  function bind() {
    els['next-page'].onclick = next;
    els['prev-page'].onclick = prev;
    els['page-jump'].onchange = (e) => jump(+e.target.value);
    $('zoom-in').onclick = () => setZoom(S.zoom * 1.25);
    $('zoom-out').onclick = () => setZoom(S.zoom / 1.25);
    $('zoom-reset').onclick = resetZoom;
    $('btn-full').onclick = () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else document.documentElement.requestFullscreen().catch(() => {});
    };
    document.addEventListener('keydown', (e) => {
      if ($('view-viewer').hidden) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') next();
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') prev();
    });

    const wrap = els['stage-wrap'];
    let downX = 0, downY = 0, panX0 = 0, panY0 = 0, moved = false;

    wrap.addEventListener('pointerdown', (e) => {
      S.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (S.pointers.size === 2) {
        const [a, b] = [...S.pointers.values()];
        S.pinchD0 = Math.hypot(a.x - b.x, a.y - b.y);
        S.zoom0 = S.zoom;
      }
      downX = e.clientX; downY = e.clientY;
      panX0 = S.panX; panY0 = S.panY; moved = false;
      wrap.setPointerCapture(e.pointerId);
    });
    wrap.addEventListener('pointermove', (e) => {
      if (!S.pointers.has(e.pointerId)) return;
      S.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const dx = e.clientX - downX, dy = e.clientY - downY;
      if (Math.abs(dx) + Math.abs(dy) > 8) moved = true;
      if (S.pointers.size === 2) { // pinch zoom
        const [a, b] = [...S.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (S.pinchD0 > 0) {
          const r = wrap.getBoundingClientRect();
          setZoom(S.zoom0 * (d / S.pinchD0), (a.x + b.x) / 2 - r.left - r.width / 2, (a.y + b.y) / 2 - r.top - r.height / 2);
        }
      } else if (zoomed()) { // pan while zoomed
        S.panX = panX0 + dx; S.panY = panY0 + dy;
        clampPan(); applyTransform();
      }
    });
    const up = (e) => {
      const swipe = S.pointers.has(e.pointerId) && !moved === false;
      S.pointers.delete(e.pointerId);
      if (!S.pointers.size && !zoomed() && moved) {
        const dx = e.clientX - downX;
        if (dx < -50) next(); // swipe left → next (flip disabled while zoomed)
        else if (dx > 50) prev(); // swipe right → prev
      }
    };
    wrap.addEventListener('pointerup', up);
    wrap.addEventListener('pointercancel', (e) => S.pointers.delete(e.pointerId));
    wrap.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = wrap.getBoundingClientRect();
      setZoom(S.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12),
        e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2);
    }, { passive: false });
    wrap.addEventListener('dblclick', (e) => { // double-tap/click → 2x at point
      const r = wrap.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
      setZoom(zoomed() ? 1 : 2, x, y);
    });
    let rt;
    window.addEventListener('resize', () => { // recalc spread on viewport change
      clearTimeout(rt);
      rt = setTimeout(() => { if (S.doc) renderSpread(); }, 200);
    });
  }

  return { open, close, bind };
})();
