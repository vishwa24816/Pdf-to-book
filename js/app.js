/* app.js — dashboard (upload/grid/read/delete/rename) + view switching. */
(() => {
  const $ = (id) => document.getElementById(id);
  const dash = $('view-dashboard'), viewer = $('view-viewer');
  const grid = $('book-grid'), status = $('dash-status');
  const drop = $('dropzone'), fileInput = $('file-input');

  function note(msg, err) {
    status.hidden = !msg;
    status.textContent = msg || '';
    status.classList.toggle('error', !!err);
  }

  function showViewer(show) {
    dash.hidden = show;
    viewer.hidden = !show;
    if (!show) BookViewer.close();
  }

  async function refreshGrid() {
    let books = [];
    try {
      books = await DB.getAllBooks();
    } catch (e) {
      console.error(e);
      note('Storage unavailable (IndexedDB blocked?).', true);
      return;
    }
    grid.innerHTML = '';
    if (!books.length) {
      grid.innerHTML = '<p class="status">No books yet — upload a PDF above.</p>';
      return;
    }
    books.forEach((b) => {
      const card = document.createElement('div');
      card.className = 'book-card';
      const date = new Date(b.uploadDate).toLocaleDateString();
      card.innerHTML = `<img alt="cover"><div class="title"></div>
        <div class="meta">${b.pageCount} pages · ${date}</div>
        <div class="actions"><button class="btn read">Read</button>
        <button class="btn ghost ren">Rename</button>
        <button class="btn danger del">Delete</button></div>`;
      card.querySelector('img').src = b.thumb || '';
      card.querySelector('.title').textContent = b.title;
      card.querySelector('.read').onclick = async () => {
        const full = await DB.getBook(b.id);
        if (!full) { note('Book not found.', true); return; }
        showViewer(true);
        BookViewer.open(full);
      };
      card.querySelector('.del').onclick = async () => {
        if (!confirm(`Delete "${b.title}"?`)) return;
        await DB.deleteBook(b.id);
        refreshGrid();
      };
      card.querySelector('.ren').onclick = async () => {
        const t = prompt('New title:', b.title);
        if (t && t.trim()) { await DB.renameBook(b.id, t.trim()); refreshGrid(); }
      };
      grid.appendChild(card);
    });
  }

  async function addFiles(files) {
    for (const f of files) {
      if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') {
        note(`Skipped "${f.name}" — not a PDF.`, true);
        continue;
      }
      try {
        note(`Adding "${f.name}"…`);
        const buf = await f.arrayBuffer();
        const doc = await PdfEngine.load(buf.slice(0));
        const pageCount = doc.numPages;
        await doc.destroy();
        const thumb = await PdfEngine.thumbnail(buf.slice(0));
        await DB.saveBook({
          id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())),
          title: f.name.replace(/\.pdf$/i, ''),
          blob: new Blob([buf], { type: 'application/pdf' }),
          pageCount, uploadDate: Date.now(), thumb,
        });
      } catch (e) {
        console.error(e);
        note(`Failed to add "${f.name}": ${e.message}`, true);
        return;
      }
    }
    note('');
    refreshGrid();
  }

  fileInput.onchange = (e) => { addFiles([...e.target.files]); fileInput.value = ''; };
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => addFiles([...(e.dataTransfer.files || [])]));
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter') fileInput.click(); });
  $('btn-back').onclick = () => { showViewer(false); refreshGrid(); };

  BookViewer.bind();
  refreshGrid();
})();
