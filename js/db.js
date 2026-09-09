const DB_NAME = 'FinanzaPersonalDB';
const DB_VERSION = 1;
const SQLITE_NAME = 'finanzas';

const StoreNames = {
  INCOMES: 'incomes',
  EXPENSES: 'expenses',
  INVESTMENTS: 'investments',
  LOANS: 'loans',
  SETTINGS: 'settings'
};

const DATA_STORES = [
  StoreNames.INCOMES,
  StoreNames.EXPENSES,
  StoreNames.INVESTMENTS,
  StoreNames.LOANS
];

const DB = {
  db: null,
  sqlite: null,
  _engine: null,

  _isNative() {
    const w = typeof window !== 'undefined' ? window : null;
    return !!(w && w.Capacitor && typeof w.Capacitor.isNativePlatform === 'function' && w.Capacitor.isNativePlatform());
  },

  _getSQLitePlugin() {
    const w = typeof window !== 'undefined' ? window : null;
    if (!w || !w.Capacitor) return null;
    if (w.Capacitor.Plugins && w.Capacitor.Plugins.CapacitorSQLite) {
      return w.Capacitor.Plugins.CapacitorSQLite;
    }
    if (typeof w.Capacitor.nativePromise === 'function') {
      const methods = ['createConnection', 'closeConnection', 'open', 'close', 'execute', 'executeSet', 'run', 'query'];
      const proxy = {};
      methods.forEach(m => {
        proxy[m] = options => w.Capacitor.nativePromise('CapacitorSQLite', m, options || {});
      });
      return proxy;
    }
    return null;
  },

  async _sqliteInit() {
    const sqlite = DB._getSQLitePlugin();
    if (!sqlite) throw new Error('SQLite plugin not available');

    await sqlite.createConnection({ database: SQLITE_NAME, version: DB_VERSION, encrypted: false });
    await sqlite.open({ database: SQLITE_NAME });

    const ddl = DATA_STORES
      .map(n => `CREATE TABLE IF NOT EXISTS "${n}" (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, json TEXT);`)
      .concat(`CREATE TABLE IF NOT EXISTS "${StoreNames.SETTINGS}" (key TEXT PRIMARY KEY, value TEXT);`)
      .join('\n');
    await sqlite.execute({ database: SQLITE_NAME, statements: ddl });

    const isEmpty = (await DB._sqliteCount(sqlite)) === 0;
    if (isEmpty && (await DB._idbHasData())) {
      await DB._migrateIdbToSqlite(sqlite);
    }
    return sqlite;
  },

  async _sqliteCount(sqlite) {
    let total = 0;
    for (const n of Object.values(StoreNames)) {
      const res = await sqlite.query({
        database: SQLITE_NAME,
        statement: `SELECT COUNT(*) AS n FROM "${n}"`
      });
      const row = res.values && res.values[0];
      total += row ? Number(row.n || 0) : 0;
    }
    return total;
  },

  async _sqliteParseRows(res) {
    const out = [];
    for (const row of (res.values || [])) {
      if (row.json == null) continue;
      const obj = JSON.parse(row.json);
      obj.id = row.id;
      out.push(obj);
    }
    return out;
  },

  async _sqlitePut(sqlite, store, data) {
    if (store === StoreNames.SETTINGS) {
      await sqlite.run({
        database: SQLITE_NAME,
        statement: `INSERT OR REPLACE INTO "${StoreNames.SETTINGS}" (key, value) VALUES (?, ?)`,
        values: [data.key, data.value]
      });
      return undefined;
    }
    const date = data.date || '';
    const json = JSON.stringify(data);
    if (data.id != null) {
      await sqlite.run({
        database: SQLITE_NAME,
        statement: `INSERT OR REPLACE INTO "${store}" (id, date, json) VALUES (?, ?, ?)`,
        values: [data.id, date, json]
      });
      return data.id;
    }
    const res = await sqlite.run({
      database: SQLITE_NAME,
      statement: `INSERT INTO "${store}" (date, json) VALUES (?, ?)`,
      values: [date, json]
    });
    return res.changes ? res.changes.lastId : undefined;
  },

  async _migrateIdbToSqlite(sqlite) {
    for (const n of Object.values(StoreNames)) {
      const items = n === StoreNames.SETTINGS ? await DB._idbGetAllSettings() : await DB._idbGetAll(n);
      for (const item of items) {
        await DB._sqlitePut(sqlite, n, item);
      }
    }
  },

  _idbOpen() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onsuccess = e => resolve(e.target.result);
      req.onerror = e => reject(e.target.error);
    });
  },

  async _idbHasData() {
    try {
      const db = await DB._idbOpen();
      let has = false;
      for (const n of DATA_STORES) {
        if (db.objectStoreNames.contains(n)) {
          const count = await new Promise((resolve, reject) => {
            const req = db.transaction(n, 'readonly').objectStore(n).count();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });
          if (count > 0) { has = true; break; }
        }
      }
      db.close();
      return has;
    } catch (err) {
      return false;
    }
  },

  async _idbGetAll(store) {
    const db = await DB._idbOpen();
    try {
      return await new Promise((resolve, reject) => {
        const req = db.transaction(store, 'readonly').objectStore(store).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  },

  async _idbGetAllSettings() {
    const items = await DB._idbGetAll(StoreNames.SETTINGS);
    return items.map(s => ({ key: s.key, value: s.value }));
  },

  async init() {
    if (DB._isNative()) {
      try {
        const sqlite = await DB._sqliteInit();
        DB._engine = 'sqlite';
        DB.sqlite = sqlite;
        return;
      } catch (err) {
        console.error('SQLite init failed, using IndexedDB:', err);
      }
    }
    await DB._idbInit();
  },

  async _idbInit() {
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
        DB._engine = 'idb';
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
    if (DB._engine === 'sqlite') {
      return DB._sqlitePut(DB.sqlite, storeName, { ...data, createdAt: Date.now() });
    }
    return new Promise((resolve, reject) => {
      const store = DB._tx(storeName, 'readwrite');
      const req = store.add({ ...data, createdAt: Date.now() });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async put(storeName, data) {
    if (DB._engine === 'sqlite') {
      return DB._sqlitePut(DB.sqlite, storeName, data);
    }
    return new Promise((resolve, reject) => {
      const store = DB._tx(storeName, 'readwrite');
      const req = store.put(data);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async get(storeName, id) {
    if (DB._engine === 'sqlite') {
      const res = await DB.sqlite.query({
        database: SQLITE_NAME,
        statement: `SELECT id, json FROM "${storeName}" WHERE id = ?`,
        values: [id]
      });
      const rows = await DB._sqliteParseRows(res);
      return rows[0];
    }
    return new Promise((resolve, reject) => {
      const store = DB._tx(storeName);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async getAll(storeName) {
    if (DB._engine === 'sqlite') {
      const res = await DB.sqlite.query({
        database: SQLITE_NAME,
        statement: `SELECT id, json FROM "${storeName}"`
      });
      return DB._sqliteParseRows(res);
    }
    return new Promise((resolve, reject) => {
      const store = DB._tx(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  async delete(storeName, id) {
    if (DB._engine === 'sqlite') {
      await DB.sqlite.run({
        database: SQLITE_NAME,
        statement: `DELETE FROM "${storeName}" WHERE id = ?`,
        values: [id]
      });
      return;
    }
    return new Promise((resolve, reject) => {
      const store = DB._tx(storeName, 'readwrite');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async clear(storeName) {
    if (DB._engine === 'sqlite') {
      await DB.sqlite.run({
        database: SQLITE_NAME,
        statement: `DELETE FROM "${storeName}"`
      });
      return;
    }
    return new Promise((resolve, reject) => {
      const store = DB._tx(storeName, 'readwrite');
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async getSetting(key, defaultVal = null) {
    if (DB._engine === 'sqlite') {
      const res = await DB.sqlite.query({
        database: SQLITE_NAME,
        statement: `SELECT value FROM "${StoreNames.SETTINGS}" WHERE key = ?`,
        values: [key]
      });
      const row = res.values && res.values[0];
      return row && row.value != null ? row.value : defaultVal;
    }
    return new Promise((resolve) => {
      const store = DB._tx(StoreNames.SETTINGS);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : defaultVal);
      req.onerror = () => resolve(defaultVal);
    });
  },

  async setSetting(key, value) {
    if (DB._engine === 'sqlite') {
      await DB._sqlitePut(DB.sqlite, StoreNames.SETTINGS, { key, value });
      return;
    }
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
    const stores = Object.values(StoreNames);
    for (const [storeName, items] of Object.entries(data)) {
      if (stores.includes(storeName)) {
        for (const item of items) {
          await DB.put(storeName, item);
        }
      }
    }
  }
};