/* pdfEngine.js — pdf.js init, page-to-canvas renderer (DPR-scaled), cover thumbnail. */
const PdfEngine = (() => {
  const URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  if (window.pdfjsLib) window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL;

  async function load(buffer) {
    if (!window.pdfjsLib) throw new Error('PDF.js failed to load (CDN unreachable?).');
    const doc = await window.pdfjsLib.getDocument({ data: buffer }).promise;
    if (!doc.numPages) throw new Error('PDF has no pages.');
    return doc;
  }

  async function renderToCanvas(doc, pageNum, canvas, cssWidth) {
    const page = await doc.getPage(pageNum);
    const dpr = window.devicePixelRatio || 1;
    const base = page.getViewport({ scale: 1 });
    const scale = (cssWidth / base.width) * dpr; // DPR scaling: sharp on hidpi
    const vp = page.getViewport({ scale });
    canvas.width = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    canvas.style.width = Math.floor(vp.width / dpr) + 'px';
    canvas.style.height = Math.floor(vp.height / dpr) + 'px';
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    page.cleanup();
  }

  async function thumbnail(buffer) {
    const doc = await load(buffer.slice(0));
    const page = await doc.getPage(1);
    const vp = page.getViewport({ scale: 0.4 });
    const c = document.createElement('canvas');
    c.width = vp.width; c.height = vp.height;
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    const url = c.toDataURL('image/jpeg', 0.7);
    await doc.destroy();
    return url;
  }

  return { load, renderToCanvas, thumbnail };
})();
