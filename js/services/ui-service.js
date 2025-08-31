// خدمة واجهة المستخدم المحسنة
import { errorHandler } from '../utils/errors.js';

export class UIService {
  constructor() {
    this.loadingElements = new Set();
    this.modalStack = [];
    this.observers = new Map();
    this.debounceTimers = new Map();
  }

  // إدارة حالات التحميل
  showLoading(elementId, options = {}) {
    const {
      spinner = true,
      text = 'جاري التحميل...',
      overlay = false
    } = options;

    const element = document.getElementById(elementId);
    if (!element) return;

    this.loadingElements.add(elementId);
    
    const originalContent = element.innerHTML;
    element.dataset.originalContent = originalContent;
    
    let loadingHtml = '';
    if (spinner) {
      loadingHtml += '<div class="spinner-border spinner-border-sm me-2" role="status"></div>';
    }
    loadingHtml += text;
    
    if (overlay) {
      element.style.position = 'relative';
      loadingHtml = `
        <div class="loading-overlay" style="
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(255,255,255,0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        ">
          ${loadingHtml}
        </div>
      `;
      element.insertAdjacentHTML('beforeend', loadingHtml);
    } else {
      element.innerHTML = loadingHtml;
    }
  }

  hideLoading(elementId) {
    const element = document.getElementById(elementId);
    if (!element || !this.loadingElements.has(elementId)) return;

    this.loadingElements.delete(elementId);
    
    const overlay = element.querySelector('.loading-overlay');
    if (overlay) {
      overlay.remove();
    } else {
      const originalContent = element.dataset.originalContent;
      if (originalContent) {
        element.innerHTML = originalContent;
        delete element.dataset.originalContent;
      }
    }
  }

  // إدارة الإشعارات
  showNotification(message, type = 'info', duration = 5000) {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} notification-toast`;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      min-width: 300px;
      opacity: 0;
      transform: translateX(100%);
      transition: all 0.3s ease;
    `;
    
    notification.innerHTML = `
      <div class="d-flex align-items-center">
        <span class="flex-grow-1">${message}</span>
        <button type="button" class="btn-close" onclick="this.parentElement.parentElement.remove()"></button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // تحريك الإشعار
    requestAnimationFrame(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateX(0)';
    });
    
    // إزالة تلقائية
    if (duration > 0) {
      setTimeout(() => {
        this.hideNotification(notification);
      }, duration);
    }
    
    return notification;
  }

  hideNotification(notification) {
    if (!notification || !notification.parentElement) return;
    
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(100%)';
    
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 300);
  }

  // إدارة المودالات
  showModal(modalId, options = {}) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    const { backdrop = true, keyboard = true } = options;
    
    this.modalStack.push({
      id: modalId,
      element: modal,
      options
    });
    
    modal.style.display = 'flex';
    modal.classList.add('show');
    document.body.classList.add('modal-open');
    
    // إضافة backdrop
    if (backdrop) {
      modal.onclick = (e) => {
        if (e.target === modal) {
          this.hideModal(modalId);
        }
      };
    }
    
    // إضافة keyboard support
    if (keyboard) {
      const keyHandler = (e) => {
        if (e.key === 'Escape') {
          this.hideModal(modalId);
        }
      };
      document.addEventListener('keydown', keyHandler);
      modal.dataset.keyHandler = 'true';
    }
  }

  hideModal(modalId) {
    const modalIndex = this.modalStack.findIndex(m => m.id === modalId);
    if (modalIndex === -1) return;
    
    const { element } = this.modalStack[modalIndex];
    this.modalStack.splice(modalIndex, 1);
    
    element.style.display = 'none';
    element.classList.remove('show');
    
    if (this.modalStack.length === 0) {
      document.body.classList.remove('modal-open');
    }
    
    // إزالة keyboard handler
    if (element.dataset.keyHandler) {
      document.removeEventListener('keydown', this.keyHandler);
      delete element.dataset.keyHandler;
    }
  }

  // Lazy Loading للصور
  setupLazyLoading(container = document) {
    if (!('IntersectionObserver' in window)) {
      // Fallback للمتصفحات القديمة
      const images = container.querySelectorAll('img[data-src]');
      images.forEach(img => this.loadImage(img));
      return;
    }

    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          this.loadImage(img);
          observer.unobserve(img);
        }
      });
    }, {
      rootMargin: '50px'
    });

    const images = container.querySelectorAll('img[data-src]');
    images.forEach(img => imageObserver.observe(img));
    
    this.observers.set('images', imageObserver);
  }

  loadImage(img) {
    const src = img.dataset.src;
    if (!src) return;
    
    img.onload = () => {
      img.classList.add('loaded');
    };
    
    img.onerror = () => {
      img.src = 'https://via.placeholder.com/300x200?text=خطأ+في+التحميل';
    };
    
    img.src = src;
    img.removeAttribute('data-src');
  }

  // Virtual Scrolling للقوائم الطويلة
  setupVirtualScrolling(containerId, itemHeight, renderItem) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let items = [];
    let visibleStart = 0;
    let visibleEnd = 0;
    
    const updateVisibleItems = () => {
      const containerHeight = container.clientHeight;
      const scrollTop = container.scrollTop;
      
      visibleStart = Math.floor(scrollTop / itemHeight);
      visibleEnd = Math.min(
        visibleStart + Math.ceil(containerHeight / itemHeight) + 2,
        items.length
      );
      
      this.renderVisibleItems(container, items, visibleStart, visibleEnd, itemHeight, renderItem);
    };

    container.addEventListener('scroll', this.debounce('virtual-scroll', updateVisibleItems, 16));
    
    return {
      setItems: (newItems) => {
        items = newItems;
        container.style.height = `${items.length * itemHeight}px`;
        updateVisibleItems();
      },
      refresh: updateVisibleItems
    };
  }

  renderVisibleItems(container, items, start, end, itemHeight, renderItem) {
    const fragment = document.createDocumentFragment();
    
    for (let i = start; i < end; i++) {
      const item = items[i];
      const element = renderItem(item, i);
      element.style.position = 'absolute';
      element.style.top = `${i * itemHeight}px`;
      element.style.width = '100%';
      element.style.height = `${itemHeight}px`;
      fragment.appendChild(element);
    }
    
    container.innerHTML = '';
    container.appendChild(fragment);
  }

  // Debounce مع إدارة
  debounce(key, func, wait) {
    return (...args) => {
      const timer = this.debounceTimers.get(key);
      if (timer) {
        clearTimeout(timer);
      }
      
      this.debounceTimers.set(key, setTimeout(() => {
        func.apply(this, args);
        this.debounceTimers.delete(key);
      }, wait));
    };
  }

  // تحديث العناصر بكفاءة
  updateElement(elementId, updates) {
    const element = document.getElementById(elementId);
    if (!element) return;

    // تجميد التحديثات
    element.style.transition = 'none';
    
    Object.entries(updates).forEach(([property, value]) => {
      if (property === 'text') {
        element.textContent = value;
      } else if (property === 'html') {
        element.innerHTML = value;
      } else if (property === 'class') {
        element.className = value;
      } else if (property.startsWith('data-')) {
        element.setAttribute(property, value);
      } else {
        element.style[property] = value;
      }
    });
    
    // استعادة التحديثات
    requestAnimationFrame(() => {
      element.style.transition = '';
    });
  }

  // تنظيف الموارد
  cleanup() {
    // مسح جميع المؤقتات
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();
    
    // إيقاف جميع المراقبين
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
    
    // إزالة جميع الإشعارات
    document.querySelectorAll('.notification-toast').forEach(notification => {
      notification.remove();
    });
    
    // إغلاق جميع المودالات
    this.modalStack.forEach(modal => {
      this.hideModal(modal.id);
    });
    
    console.log('تم تنظيف موارد UI');
  }

  // معلومات الحالة
  getStatus() {
    return {
      loadingElements: this.loadingElements.size,
      activeModals: this.modalStack.length,
      activeObservers: this.observers.size,
      pendingDebounces: this.debounceTimers.size
    };
  }
}

export const uiService = new UIService();

// تنظيف عند إغلاق الصفحة
window.addEventListener('beforeunload', () => {
  uiService.cleanup();
});
