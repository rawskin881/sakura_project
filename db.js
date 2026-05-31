const DB_NAME = 'SakuraDB';
const DB_VERSION = 1;

class SakuraDB {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      
      req.onerror = () => reject(req.error);
      req.onsuccess = () => { this.db = req.result; resolve(this.db); };
      
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        
        // Store: User progress & stats
        if (!db.objectStoreNames.contains('user')) {
          db.createObjectStore('user', { keyPath: 'id' });
        }
        
        // Store: SRS cards
        if (!db.objectStoreNames.contains('srs')) {
          const srsStore = db.createObjectStore('srs', { keyPath: 'id' });
          srsStore.createIndex('nextReview', 'nextReview', { unique: false });
          srsStore.createIndex('bucket', 'bucket', { unique: false });
        }
        
        // Store: Custom user vocab
        if (!db.objectStoreNames.contains('customVocab')) {
          db.createObjectStore('customVocab', { keyPath: 'id', autoIncrement: true });
        }
        
        // Store: Session logs (untuk analytics)
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  }

  async get(store, id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async put(store, data) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).put(data);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async getAll(store) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async query(store, indexName, range) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(store, 'readonly');
      const index = tx.objectStore(store).index(indexName);
      const req = index.getAll(range);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
}

const db = new SakuraDB();
