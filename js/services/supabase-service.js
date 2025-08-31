// خدمة Supabase محسنة مع Cache وإدارة أفضل للأخطاء
import { supabase } from '../server-superbase.js';
import { cacheManager } from '../utils/cache.js';
import { errorHandler } from '../utils/errors.js';

export class SupabaseService {
  constructor() {
    this.retryAttempts = 3;
    this.retryDelay = 1000;
    this.requestQueue = [];
    this.processing = false;
  }

  // معالج عام للاستعلامات مع Cache وإعادة المحاولة
  async execute(queryFn, cacheKey = null, options = {}) {
    const {
      useCache = true,
      cacheTTL = 300000, // 5 دقائق
      useDB = false,
      retries = this.retryAttempts
    } = options;

    // البحث في Cache أولاً
    if (useCache && cacheKey) {
      const cached = await cacheManager.get(cacheKey, { useDB });
      if (cached) {
        console.log(`تم استرجاع البيانات من Cache: ${cacheKey}`);
        return { data: cached, error: null, fromCache: true };
      }
    }

    // تنفيذ الاستعلام مع إعادة المحاولة
    let lastError = null;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await queryFn();
        
        if (result.error) {
          throw new Error(result.error.message);
        }

        // تخزين في Cache
        if (useCache && cacheKey && result.data) {
          await cacheManager.set(cacheKey, result.data, {
            useDB,
            ttl: cacheTTL
          });
        }

        return result;
      } catch (error) {
        lastError = error;
        console.warn(`المحاولة ${attempt} فشلت:`, error.message);
        
        if (attempt < retries) {
          await this.delay(this.retryDelay * attempt);
        }
      }
    }

    // تسجيل الخطأ
    const errorInfo = errorHandler.handleError(lastError, 'supabase', {
      cacheKey,
      retries,
      options
    });

    return { data: null, error: lastError, errorInfo };
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // استعلامات محسنة
  async getProducts(options = {}) {
    return this.execute(
      () => supabase.from('products').select('*').order('id', { ascending: false }),
      'products_all',
      { useCache: true, cacheTTL: 600000, ...options } // 10 دقائق
    );
  }

  async getProduct(id, options = {}) {
    return this.execute(
      () => supabase.from('products').select('*').eq('id', id).single(),
      `product_${id}`,
      { useCache: true, cacheTTL: 300000, ...options } // 5 دقائق
    );
  }

  async getCategories(options = {}) {
    return this.execute(
      () => supabase.from('categories').select('*').order('id', { ascending: false }),
      'categories_all',
      { useCache: true, cacheTTL: 1800000, ...options } // 30 دقيقة
    );
  }

  async getStoreSettings(options = {}) {
    return this.execute(
      () => supabase.from('store_settings').select('*').eq('id', 1).single(),
      'store_settings',
      { useCache: true, cacheTTL: 900000, ...options } // 15 دقيقة
    );
  }

  async getShippingStates(options = {}) {
    return this.execute(
      () => supabase.from('shipping_states').select('*').eq('is_available', true),
      'shipping_states',
      { useCache: true, cacheTTL: 1800000, ...options } // 30 دقيقة
    );
  }

  async getLandingPage(id, options = {}) {
    return this.execute(
      () => supabase.from('landing_pages').select('*').eq('id', id).single(),
      `landing_page_${id}`,
      { useCache: true, cacheTTL: 300000, ...options } // 5 دقائق
    );
  }

  async getLandingPages(options = {}) {
    return this.execute(
      () => supabase.from('landing_pages').select('*').order('id', { ascending: false }),
      'landing_pages_all',
      { useCache: true, cacheTTL: 600000, ...options } // 10 دقائق
    );
  }

  async getPixelData(pixelId, options = {}) {
    return this.execute(
      () => supabase.from('ad_pixels').select('id, pixel_name, pixel_code').eq('id', pixelId).single(),
      `pixel_${pixelId}`,
      { useCache: true, cacheTTL: 1800000, ...options } // 30 دقيقة
    );
  }

  // عمليات الكتابة (لا تستخدم Cache)
  async createOrder(orderData) {
    return this.execute(
      () => supabase.from('orders').insert([orderData]),
      null,
      { useCache: false, retries: 5 }
    );
  }

  async updateProduct(id, updates) {
    const result = await this.execute(
      () => supabase.from('products').update(updates).eq('id', id),
      null,
      { useCache: false }
    );

    // مسح Cache للمنتج المحدث
    if (result.data) {
      await cacheManager.get(`product_${id}`, { useDB: false });
      await cacheManager.get('products_all', { useDB: false });
    }

    return result;
  }

  // إدارة الطوابير للطلبات المتزامنة
  async queueRequest(requestFn) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ requestFn, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.processing || this.requestQueue.length === 0) return;
    
    this.processing = true;
    
    while (this.requestQueue.length > 0) {
      const { requestFn, resolve, reject } = this.requestQueue.shift();
      
      try {
        const result = await requestFn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
      
      // تأخير بسيط بين الطلبات
      await this.delay(100);
    }
    
    this.processing = false;
  }

  // مسح Cache محدد
  async invalidateCache(pattern) {
    if (pattern === 'products') {
      await cacheManager.get('products_all', { useDB: false });
      // مسح جميع منتجات محددة
      const keys = Array.from(cacheManager.memoryCache.keys())
        .filter(key => key.startsWith('product_'));
      
      for (const key of keys) {
        cacheManager.memoryCache.delete(key);
      }
    } else if (pattern === 'categories') {
      await cacheManager.get('categories_all', { useDB: false });
    } else if (pattern === 'settings') {
      await cacheManager.get('store_settings', { useDB: false });
    }
  }

  // إحصائيات الأداء
  getStats() {
    return {
      memoryCache: cacheManager.memoryCache.size,
      queueLength: this.requestQueue.length,
      processing: this.processing
    };
  }
}

export const supabaseService = new SupabaseService();
