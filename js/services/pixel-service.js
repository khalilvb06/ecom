// خدمة إدارة البيكسل المحسنة
import { supabaseService } from './supabase-service.js';
import { errorHandler } from '../utils/errors.js';

export class PixelService {
  constructor() {
    this.activePixels = new Map();
    this.loadedScripts = new Set();
    this.eventQueue = [];
    this.retryAttempts = 3;
    this.pixelValidators = {
      facebook_pixel: this.validateFacebookPixel.bind(this),
      tiktok_pixel: this.validateTiktokPixel.bind(this),
      google_analytics: this.validateGoogleAnalytics.bind(this)
    };
  }

  // تحميل البيكسل الرئيسي للمتجر
  async loadMainPixel() {
    try {
      console.log("🚀 بدء تحميل البيكسل الرئيسي...");
      
      const { data: settings, error } = await supabaseService.getStoreSettings();
      
      if (error || !settings?.main_pixel) {
        console.warn("⚠️ لا يوجد بيكسل رئيسي محدد");
        return null;
      }

      const pixelId = settings.main_pixel;
      if (!this.isValidPixelId(pixelId)) {
        console.error("❌ معرف البيكسل غير صالح:", pixelId);
        return null;
      }

      const pixelResult = await supabaseService.getPixelData(pixelId);
      if (pixelResult.error || !pixelResult.data) {
        console.error("❌ فشل في جلب بيانات البيكسل");
        return null;
      }

      return await this.initializePixel(pixelResult.data, 'main');
    } catch (error) {
      errorHandler.handleError(error, 'pixel-main-load');
      return null;
    }
  }

  // تحميل بيكسل منتج محدد
  async loadProductPixel(productId) {
    try {
      console.log("🚀 بدء تحميل بيكسل المنتج:", productId);
      
      const { data: product, error } = await supabaseService.getProduct(productId);
      
      if (error || !product?.pixel) {
        console.warn("⚠️ لا يوجد بيكسل مرتبط بهذا المنتج");
        return null;
      }

      const pixelResult = await supabaseService.getPixelData(product.pixel);
      if (pixelResult.error || !pixelResult.data) {
        console.error("❌ فشل في جلب بيانات بيكسل المنتج");
        return null;
      }

      return await this.initializePixel(pixelResult.data, 'product', { productId });
    } catch (error) {
      errorHandler.handleError(error, 'pixel-product-load', { productId });
      return null;
    }
  }

  // تحميل بيكسل صفحة هبوط
  async loadLandingPagePixel(landingPageId) {
    try {
      console.log("🚀 بدء تحميل بيكسل صفحة الهبوط:", landingPageId);
      
      const { data: landingPage, error } = await supabaseService.getLandingPage(landingPageId);
      
      if (error || !landingPage?.pixel) {
        console.warn("⚠️ لا يوجد بيكسل مرتبط بصفحة الهبوط");
        return null;
      }

      const pixelResult = await supabaseService.getPixelData(landingPage.pixel);
      if (pixelResult.error || !pixelResult.data) {
        console.error("❌ فشل في جلب بيانات بيكسل صفحة الهبوط");
        return null;
      }

      return await this.initializePixel(pixelResult.data, 'landing', { landingPageId });
    } catch (error) {
      errorHandler.handleError(error, 'pixel-landing-load', { landingPageId });
      return null;
    }
  }

  // تهيئة البيكسل
  async initializePixel(pixelData, source, context = {}) {
    try {
      const { pixelType, pixelCode } = this.parsePixelData(pixelData);
      
      if (!pixelType || !pixelCode) {
        throw new Error("بيانات البيكسل غير صالحة");
      }

      const pixelKey = `${pixelType}_${pixelCode}`;
      
      // تجنب التحميل المكرر
      if (this.activePixels.has(pixelKey)) {
        console.log("✅ البيكسل محمل مسبقاً:", pixelKey);
        return this.activePixels.get(pixelKey);
      }

      console.log("🔧 تهيئة البيكسل:", pixelType, pixelCode);
      
      const pixelInstance = await this.loadPixelByType(pixelType, pixelCode, context);
      
      if (pixelInstance) {
        this.activePixels.set(pixelKey, {
          type: pixelType,
          code: pixelCode,
          source,
          context,
          instance: pixelInstance,
          loadedAt: Date.now()
        });
        
        // تتبع PageView
        await this.trackEvent('PageView', { source, ...context });
        
        console.log("✅ تم تحميل البيكسل بنجاح:", pixelKey);
        return pixelInstance;
      }
      
      return null;
    } catch (error) {
      errorHandler.handleError(error, 'pixel-initialize', { pixelData, source, context });
      return null;
    }
  }

  // تحليل بيانات البيكسل
  parsePixelData(pixelData) {
    try {
      let parsed;
      
      if (typeof pixelData.pixel_code === 'string') {
        parsed = JSON.parse(pixelData.pixel_code);
      } else if (typeof pixelData.pixel_code === 'object') {
        parsed = pixelData.pixel_code;
      } else {
        throw new Error("نوع بيانات غير مدعوم");
      }

      return {
        pixelType: parsed.type,
        pixelCode: parsed.code
      };
    } catch (error) {
      throw new Error("فشل في تحليل بيانات البيكسل: " + error.message);
    }
  }

  // تحميل البيكسل حسب النوع
  async loadPixelByType(type, code, context) {
    const validator = this.pixelValidators[type];
    if (!validator) {
      console.warn("نوع بيكسل غير مدعوم:", type);
      return null;
    }

    if (!validator(code)) {
      console.error("كود البيكسل غير صالح:", code);
      return null;
    }

    switch (type) {
      case 'facebook_pixel':
        return await this.loadFacebookPixel(code, context);
      case 'tiktok_pixel':
        return await this.loadTiktokPixel(code, context);
      case 'google_analytics':
        return await this.loadGoogleAnalytics(code, context);
      default:
        console.warn("نوع بيكسل غير مدعوم:", type);
        return null;
    }
  }

  // Facebook Pixel
  async loadFacebookPixel(pixelCode, context) {
    try {
      // تعريف fbq
      window.fbq = window.fbq || function() {
        (window.fbq.callMethod ? 
          window.fbq.callMethod.apply(window.fbq, arguments) : 
          window.fbq.queue.push(arguments));
      };
      window.fbq.push = window.fbq;
      window.fbq.loaded = true;
      window.fbq.version = '2.0';
      window.fbq.queue = [];

      // تهيئة البيكسل
      window.fbq('init', pixelCode);
      console.log('🔧 تم تهيئة Facebook Pixel:', pixelCode);

      // تحميل SDK
      if (!this.loadedScripts.has('facebook-pixel')) {
        await this.loadScript('https://connect.facebook.net/en_US/fbevents.js', 'facebook-pixel');
      }

      return {
        type: 'facebook_pixel',
        code: pixelCode,
        track: (eventName, eventData = {}) => {
          if (window.fbq) {
            window.fbq('track', eventName, eventData);
            console.log('📊 Facebook Pixel Event:', eventName, eventData);
          }
        }
      };
    } catch (error) {
      errorHandler.handleError(error, 'facebook-pixel-load', { pixelCode, context });
      return null;
    }
  }

  // TikTok Pixel
  async loadTiktokPixel(pixelCode, context) {
    try {
      window.ttq = window.ttq || [];
      
      if (!this.loadedScripts.has('tiktok-pixel')) {
        await this.loadScript(
          `https://analytics.tiktok.com/i18n/pixel/sdk.js?sdkid=${pixelCode}&lib=ttq`,
          'tiktok-pixel'
        );
      }

      window.ttq.push(['init', pixelCode]);
      console.log('🔧 تم تهيئة TikTok Pixel:', pixelCode);

      return {
        type: 'tiktok_pixel',
        code: pixelCode,
        track: (eventName, eventData = {}) => {
          if (window.ttq && Array.isArray(window.ttq)) {
            window.ttq.push(['track', eventName, eventData]);
            console.log('📊 TikTok Pixel Event:', eventName, eventData);
          }
        }
      };
    } catch (error) {
      errorHandler.handleError(error, 'tiktok-pixel-load', { pixelCode, context });
      return null;
    }
  }

  // Google Analytics
  async loadGoogleAnalytics(trackingId, context) {
    try {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function() { dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', trackingId);

      if (!this.loadedScripts.has('google-analytics')) {
        await this.loadScript(
          `https://www.googletagmanager.com/gtag/js?id=${trackingId}`,
          'google-analytics'
        );
      }

      console.log('🔧 تم تهيئة Google Analytics:', trackingId);

      return {
        type: 'google_analytics',
        code: trackingId,
        track: (eventName, eventData = {}) => {
          if (window.gtag) {
            window.gtag('event', eventName, eventData);
            console.log('📊 Google Analytics Event:', eventName, eventData);
          }
        }
      };
    } catch (error) {
      errorHandler.handleError(error, 'google-analytics-load', { trackingId, context });
      return null;
    }
  }

  // تحميل سكريپت
  loadScript(src, key) {
    return new Promise((resolve, reject) => {
      if (this.loadedScripts.has(key)) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      
      script.onload = () => {
        this.loadedScripts.add(key);
        resolve();
      };
      
      script.onerror = () => {
        reject(new Error(`فشل في تحميل السكريپت: ${src}`));
      };
      
      document.head.appendChild(script);
    });
  }

  // تتبع الأحداث
  async trackEvent(eventName, eventData = {}) {
    const promises = [];
    
    this.activePixels.forEach(pixel => {
      if (pixel.instance && pixel.instance.track) {
        promises.push(
          new Promise(resolve => {
            try {
              pixel.instance.track(eventName, eventData);
              resolve();
            } catch (error) {
              errorHandler.handleError(error, 'pixel-track-event', {
                pixelType: pixel.type,
                eventName,
                eventData
              });
              resolve();
            }
          })
        );
      }
    });

    await Promise.all(promises);
  }

  // أحداث محددة
  async trackPurchase(orderData) {
    const eventData = {
      value: orderData.total_price,
      currency: 'DZD',
      content_type: 'product',
      content_ids: [orderData.product_id],
      content_name: orderData.product_name
    };

    await this.trackEvent('Purchase', eventData);
  }

  async trackAddToCart(productData) {
    const eventData = {
      value: productData.price,
      currency: 'DZD',
      content_type: 'product',
      content_ids: [productData.id],
      content_name: productData.name
    };

    await this.trackEvent('AddToCart', eventData);
  }

  async trackViewContent(contentData) {
    const eventData = {
      content_type: contentData.type || 'product',
      content_ids: [contentData.id],
      content_name: contentData.name || '',
      value: contentData.price || 0,
      currency: 'DZD'
    };

    await this.trackEvent('ViewContent', eventData);
  }

  // التحقق من صحة البيكسل
  validateFacebookPixel(code) {
    return /^\d{15,20}$/.test(code);
  }

  validateTiktokPixel(code) {
    return /^[A-Z0-9]{20,}$/.test(code);
  }

  validateGoogleAnalytics(code) {
    return /^(G-|UA-|AW-)[A-Z0-9\-]+$/.test(code);
  }

  isValidPixelId(pixelId) {
    return pixelId && !isNaN(pixelId) && pixelId > 0 && Number.isInteger(Number(pixelId));
  }

  // إحصائيات
  getStats() {
    return {
      activePixels: this.activePixels.size,
      loadedScripts: this.loadedScripts.size,
      queuedEvents: this.eventQueue.length
    };
  }

  // تنظيف
  cleanup() {
    this.activePixels.clear();
    this.loadedScripts.clear();
    this.eventQueue = [];
    console.log('تم تنظيف خدمة البيكسل');
  }
}

export const pixelService = new PixelService();
