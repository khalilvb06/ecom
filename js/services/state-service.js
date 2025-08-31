// خدمة إدارة الحالة المشتركة
import { errorHandler } from '../utils/errors.js';

export class StateService {
  constructor() {
    this.state = {
      products: [],
      categories: [],
      storeSettings: null,
      shippingStates: [],
      currentUser: null,
      cart: [],
      filters: {
        category: '',
        price: '',
        search: '',
        sort: 'newest'
      },
      ui: {
        loading: false,
        modals: {},
        notifications: []
      }
    };
    
    this.subscribers = {};
    this.middleware = [];
    this.history = [];
    this.maxHistorySize = 50;
  }

  // اشتراك في تغييرات الحالة
  subscribe(key, callback) {
    if (!this.subscribers[key]) {
      this.subscribers[key] = [];
    }
    
    this.subscribers[key].push(callback);
    
    // إرجاع دالة إلغاء الاشتراك
    return () => {
      const index = this.subscribers[key].indexOf(callback);
      if (index > -1) {
        this.subscribers[key].splice(index, 1);
      }
    };
  }

  // إشعار المشتركين
  notify(key, newValue, oldValue) {
    if (this.subscribers[key]) {
      this.subscribers[key].forEach(callback => {
        try {
          callback(newValue, oldValue);
        } catch (error) {
          errorHandler.handleError(error, 'state-notification', { key });
        }
      });
    }
  }

  // تحديث الحالة
  setState(updates, source = 'unknown') {
    const oldState = this.deepClone(this.state);
    const changes = {};
    
    // تطبيق التحديثات
    Object.entries(updates).forEach(([key, value]) => {
      if (this.state[key] !== value) {
        changes[key] = {
          old: this.state[key],
          new: value
        };
        this.state[key] = value;
      }
    });
    
    // تشغيل middleware
    this.middleware.forEach(middleware => {
      try {
        middleware(changes, this.state, oldState, source);
      } catch (error) {
        errorHandler.handleError(error, 'state-middleware', { source });
      }
    });
    
    // إشعار المشتركين
    Object.entries(changes).forEach(([key, change]) => {
      this.notify(key, change.new, change.old);
    });
    
    // حفظ في التاريخ
    this.saveToHistory(oldState, this.state, source);
    
    return this.state;
  }

  // الحصول على الحالة
  getState(key = null) {
    if (key) {
      return this.state[key];
    }
    return this.deepClone(this.state);
  }

  // تحديث جزئي للحالة المتداخلة
  updateNestedState(path, value, source = 'unknown') {
    const keys = path.split('.');
    const oldValue = this.getNestedValue(this.state, keys);
    
    if (oldValue === value) return this.state;
    
    const newState = this.deepClone(this.state);
    this.setNestedValue(newState, keys, value);
    
    return this.setState(newState, source);
  }

  getNestedValue(obj, keys) {
    return keys.reduce((current, key) => current?.[key], obj);
  }

  setNestedValue(obj, keys, value) {
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  // إضافة middleware
  addMiddleware(middleware) {
    this.middleware.push(middleware);
    
    return () => {
      const index = this.middleware.indexOf(middleware);
      if (index > -1) {
        this.middleware.splice(index, 1);
      }
    };
  }

  // حفظ في التاريخ
  saveToHistory(oldState, newState, source) {
    this.history.push({
      timestamp: Date.now(),
      oldState: this.deepClone(oldState),
      newState: this.deepClone(newState),
      source
    });
    
    // حد أقصى للتاريخ
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  // استرجاع من التاريخ
  undo() {
    if (this.history.length < 2) return false;
    
    const previous = this.history[this.history.length - 2];
    this.state = this.deepClone(previous.newState);
    this.history.pop();
    
    // إشعار المشتركين بجميع التغييرات
    Object.keys(this.state).forEach(key => {
      this.notify(key, this.state[key], previous.oldState[key]);
    });
    
    return true;
  }

  // نسخ عميق
  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj);
    if (obj instanceof Array) return obj.map(item => this.deepClone(item));
    if (typeof obj === 'object') {
      const copy = {};
      Object.keys(obj).forEach(key => {
        copy[key] = this.deepClone(obj[key]);
      });
      return copy;
    }
  }

  // مساعدات للمنتجات
  addProduct(product) {
    const products = [...this.state.products, product];
    this.setState({ products }, 'add-product');
  }

  updateProduct(id, updates) {
    const products = this.state.products.map(p => 
      p.id === id ? { ...p, ...updates } : p
    );
    this.setState({ products }, 'update-product');
  }

  removeProduct(id) {
    const products = this.state.products.filter(p => p.id !== id);
    this.setState({ products }, 'remove-product');
  }

  // مساعدات للفلاتر
  setFilter(key, value) {
    const filters = { ...this.state.filters, [key]: value };
    this.setState({ filters }, 'set-filter');
  }

  clearFilters() {
    const filters = {
      category: '',
      price: '',
      search: '',
      sort: 'newest'
    };
    this.setState({ filters }, 'clear-filters');
  }

  // مساعدات للسلة
  addToCart(item) {
    const cart = [...this.state.cart, { ...item, id: Date.now() }];
    this.setState({ cart }, 'add-to-cart');
  }

  removeFromCart(id) {
    const cart = this.state.cart.filter(item => item.id !== id);
    this.setState({ cart }, 'remove-from-cart');
  }

  clearCart() {
    this.setState({ cart: [] }, 'clear-cart');
  }

  // مساعدات للواجهة
  setLoading(loading) {
    this.updateNestedState('ui.loading', loading, 'set-loading');
  }

  showModal(modalId, data = {}) {
    const modals = { ...this.state.ui.modals, [modalId]: data };
    this.updateNestedState('ui.modals', modals, 'show-modal');
  }

  hideModal(modalId) {
    const modals = { ...this.state.ui.modals };
    delete modals[modalId];
    this.updateNestedState('ui.modals', modals, 'hide-modal');
  }

  // حفظ واسترجاع من localStorage
  saveToStorage(key = 'app-state') {
    try {
      localStorage.setItem(key, JSON.stringify({
        filters: this.state.filters,
        cart: this.state.cart,
        timestamp: Date.now()
      }));
    } catch (error) {
      errorHandler.handleError(error, 'state-save', { key });
    }
  }

  loadFromStorage(key = 'app-state') {
    try {
      const saved = localStorage.getItem(key);
      if (!saved) return false;
      
      const data = JSON.parse(saved);
      const age = Date.now() - data.timestamp;
      
      // تجاهل البيانات القديمة (أكثر من يوم)
      if (age > 86400000) {
        localStorage.removeItem(key);
        return false;
      }
      
      this.setState({
        filters: data.filters || this.state.filters,
        cart: data.cart || this.state.cart
      }, 'load-from-storage');
      
      return true;
    } catch (error) {
      errorHandler.handleError(error, 'state-load', { key });
      return false;
    }
  }

  // إحصائيات
  getStats() {
    return {
      stateSize: JSON.stringify(this.state).length,
      subscribersCount: Object.values(this.subscribers).reduce((sum, arr) => sum + arr.length, 0),
      middlewareCount: this.middleware.length,
      historySize: this.history.length
    };
  }

  // تنظيف
  cleanup() {
    this.subscribers = {};
    this.middleware = [];
    this.history = [];
    console.log('تم تنظيف حالة التطبيق');
  }
}

export const stateService = new StateService();

// حفظ تلقائي للحالة
setInterval(() => {
  stateService.saveToStorage();
}, 30000); // كل 30 ثانية

// تحميل الحالة عند البداية
document.addEventListener('DOMContentLoaded', () => {
  stateService.loadFromStorage();
});

// تنظيف عند إغلاق الصفحة
window.addEventListener('beforeunload', () => {
  stateService.saveToStorage();
  stateService.cleanup();
});
