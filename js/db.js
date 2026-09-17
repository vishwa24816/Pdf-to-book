/* db.js — tiny native IndexedDB wrapper. Store: books {id,title,blob,pageCount,uploadDate,thumb}. */
const DB_NAME = 'pdf-to-book', STORE = 'books', DB_VER = 1;
let dbPromise = null;

function openDB() {
  // ponytail: single object store, no indexes/upgrades beyond v1; add indexes if library grows large
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function tx(mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode), s = t.objectStore(STORE), out = fn(s);
    t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
    t.onerror = () => reject(t.error);
  });
}

const DB = {
  saveBook: (book) => tx('readwrite', (s) => s.put(book)),
  getBook: async (id) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const r = db.transaction(STORE).objectStore(STORE).get(id);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  },
  getAllBooks: async () => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const r = db.transaction(STORE).objectStore(STORE).getAll();
      r.onsuccess = () => resolve((r.result || []).sort((a, b) => b.uploadDate - a.uploadDate));
      r.onerror = () => reject(r.error);
    });
  },
  deleteBook: (id) => tx('readwrite', (s) => s.delete(id)),
  renameBook: async (id, title) => {
    const b = await DB.getBook(id);
    if (b) { b.title = title; await DB.saveBook(b); }
  },
};
