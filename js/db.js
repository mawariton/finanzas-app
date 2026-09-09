const DB_NAME = 'FinanzaPersonalDB';
const DB_VERSION = 1;

const StoreNames = {
  INCOMES: 'incomes',
  EXPENSES: 'expenses',
  INVESTMENTS: 'investments',
  LOANS: 'loans',
  SETTINGS: 'settings'
};

const DB = {
  db: null,

  async init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = e => {
        const db = e.target.result;

        if (!db.objectStoreNames.contains(StoreNames.INCOMES)) {
          const store = db.createObjectStore(StoreNames.INCOMES, { keyPath: 'id', autoIncrement: true });
          store.createIndex('date', 'date');
          store.createIndex('type', 'type');
        }
        if (!db.objectStoreNames.contains(StoreNames.EXPENSES)) {
          const store = db.createObjectStore(StoreNames.EXPENSES, { keyPath: 'id', autoIncrement: true });
          store.createIndex('date', 'date');
          store.createIndex('category', 'category');
        }
        if (!db.objectStoreNames.contains(StoreNames.INVESTMENTS)) {
          const store = db.createObjectStore(StoreNames.INVESTMENTS, { keyPath: 'id', autoIncrement: true });
          store.createIndex('date', 'date');
        }
        if (!db.objectStoreNames.contains(StoreNames.LOANS)) {
          const store = db.createObjectStore(StoreNames.LOANS, { keyPath: 'id', autoIncrement: true });
          store.createIndex('dueDate', 'dueDate');
          store.createIndex('status', 'status');
        }
        if (!db.objectStoreNames.contains(StoreNames.SETTINGS)) {
          db.createObjectStore(StoreNames.SETTINGS, { keyPath: 'key' });
        }
      };

      req.onsuccess = e => {
        DB.db = e.target.result;
        resolve(DB.db);
      };

      req.onerror = e => reject(e.target.error);
    });
  },

  _tx(storeName, mode = 'readonly') {
    const tx = DB.db.transaction(storeName, mode);
    return tx.objectStore(storeName);
  },

  async add(storeName, data) {
    return new Promise((resolve, reject) => {
      const store = DB._tx(storeName, 'readwrite');
      const req = store.add({ ...data, createdAt: Date.now() });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async put(storeName, data) {
    return new Promise((resolve, reject) => {
      const store = DB._tx(storeName, 'readwrite');
      const req = store.put(data);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async get(storeName, id) {
    return new Promise((resolve, reject) => {
      const store = DB._tx(storeName);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async getAll(storeName) {
    return new Promise((resolve, reject) => {
      const store = DB._tx(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  async delete(storeName, id) {
    return new Promise((resolve, reject) => {
      const store = DB._tx(storeName, 'readwrite');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async clear(storeName) {
    return new Promise((resolve, reject) => {
      const store = DB._tx(storeName, 'readwrite');
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async getSetting(key, defaultVal = null) {
    return new Promise((resolve) => {
      const store = DB._tx(StoreNames.SETTINGS);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : defaultVal);
      req.onerror = () => resolve(defaultVal);
    });
  },

  async setSetting(key, value) {
    return new Promise((resolve, reject) => {
      const store = DB._tx(StoreNames.SETTINGS, 'readwrite');
      const req = store.put({ key, value });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async exportAll() {
    const data = {};
    for (const name of Object.values(StoreNames)) {
      data[name] = await DB.getAll(name);
    }
    return data;
  },

  async importAll(data) {
    for (const [storeName, items] of Object.entries(data)) {
      if (DB.db.objectStoreNames.contains(storeName)) {
        for (const item of items) {
          await DB.put(storeName, item);
        }
      }
    }
  }
};
