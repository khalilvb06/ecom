// نظام Cache محسن مع IndexedDB للبيانات الكبيرة
export class CacheManager {
  constructor() {
    this.memoryCache = new Map();
    this.maxMemorySize = 50; // 50 عنصر في الذاكرة
    this.dbName = 'StoreCache';
    this.dbVersion = 1;
    this.db = null;
    this.initDB();
  }

  async initDB() {
    if (!window.indexedDB) {
      console.warn('IndexedDB غير مدعوم، سيتم استخدام الذاكرة فقط');
      return;
    }

    try {
      this.db = await this.openDB();
    } catch (error) {
      console.error('فشل في تهيئة IndexedDB:', error);
    }
  }

  openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // إنشاء store للبيانات العامة
        if (!db.objectStoreNames.contains('cache')) {
          const store = db.createObjectStore('cache', { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  // تخزين في الذاكرة للبيانات الصغيرة
  setMemory(key, value, ttl = 300000) { // 5 دقائق افتراضياً
    if (this.memoryCache.size >= this.maxMemorySize) {
      // إزالة أقدم عنصر
      const firstKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(firstKey);
    }

    this.memoryCache.set(key, {
      value,
      timestamp: Date.now(),
      ttl
    });
  }

  getMemory(key) {
    const item = this.memoryCache.get(key);
    if (!item) return null;

    if (Date.now() - item.timestamp > item.ttl) {
      this.memoryCache.delete(key);
      return null;
    }

    return item.value;
  }

  // تخزين في IndexedDB للبيانات الكبيرة
  async setDB(key, value, ttl = 3600000) { // ساعة واحدة افتراضياً
    if (!this.db) return false;

    try {
      const transaction = this.db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      
      await new Promise((resolve, reject) => {
        const request = store.put({
          key,
          value,
          timestamp: Date.now(),
          ttl
        });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      return true;
    } catch (error) {
      console.error('فشل في التخزين في IndexedDB:', error);
      return false;
    }
  }

  async getDB(key) {
    if (!this.db) return null;

    try {
      const transaction = this.db.transaction(['cache'], 'readonly');
      const store = transaction.objectStore('cache');
      
      const item = await new Promise((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (!item) return null;

      if (Date.now() - item.timestamp > item.ttl) {
        await this.deleteDB(key);
        return null;
      }

      return item.value;
    } catch (error) {
      console.error('فشل في القراءة من IndexedDB:', error);
      return null;
    }
  }

  async deleteDB(key) {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      
      await new Promise((resolve, reject) => {
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('فشل في الحذف من IndexedDB:', error);
    }
  }

  // واجهة موحدة للتخزين
  async set(key, value, options = {}) {
    const { useDB = false, ttl } = options;
    
    if (useDB) {
      return await this.setDB(key, value, ttl);
    } else {
      this.setMemory(key, value, ttl);
      return true;
    }
  }

  async get(key, options = {}) {
    const { useDB = false } = options;
    
    if (useDB) {
      return await this.getDB(key);
    } else {
      return this.getMemory(key);
    }
  }

  async clear() {
    this.memoryCache.clear();
    
    if (this.db) {
      try {
        const transaction = this.db.transaction(['cache'], 'readwrite');
        const store = transaction.objectStore('cache');
        await new Promise((resolve, reject) => {
          const request = store.clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      } catch (error) {
        console.error('فشل في مسح IndexedDB:', error);
      }
    }
  }

  // تنظيف البيانات المنتهية الصلاحية
  async cleanup() {
    // تنظيف الذاكرة
    for (const [key, item] of this.memoryCache.entries()) {
      if (Date.now() - item.timestamp > item.ttl) {
        this.memoryCache.delete(key);
      }
    }

    // تنظيف IndexedDB
    if (this.db) {
      try {
        const transaction = this.db.transaction(['cache'], 'readwrite');
        const store = transaction.objectStore('cache');
        const index = store.index('timestamp');
        const cutoff = Date.now() - 86400000; // 24 ساعة
        
        const request = index.openCursor(IDBKeyRange.upperBound(cutoff));
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          }
        };
      } catch (error) {
        console.error('فشل في تنظيف IndexedDB:', error);
      }
    }
  }
}

export const cacheManager = new CacheManager();

// تنظيف دوري كل ساعة
setInterval(() => {
  cacheManager.cleanup();
}, 3600000);
