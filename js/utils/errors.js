// نظام معالجة الأخطاء المحسن
export class ErrorHandler {
  constructor() {
    this.listeners = [];
    this.setupGlobalErrorHandling();
  }

  setupGlobalErrorHandling() {
    window.addEventListener('error', (event) => {
      console.error('خطأ عام:', event.error);
      this.handleError(event.error, 'global');
    });

    window.addEventListener('unhandledrejection', (event) => {
      console.error('Promise مرفوض:', event.reason);
      this.handleError(event.reason, 'promise');
    });
  }

  handleError(error, type = 'general', context = {}) {
    const errorInfo = {
      message: error?.message || error,
      type,
      context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    // إشعار المستمعين
    this.listeners.forEach(listener => {
      try {
        listener(errorInfo);
      } catch (e) {
        console.error('خطأ في معالج الأخطاء:', e);
      }
    });

    // إرسال الخطأ للسيرفر إذا كان حرجاً
    if (this.isCriticalError(error)) {
      this.reportToCrashlytics(errorInfo);
    }

    return errorInfo;
  }

  isCriticalError(error) {
    const criticalKeywords = ['network', 'database', 'auth', 'payment'];
    const errorMessage = (error?.message || error || '').toLowerCase();
    return criticalKeywords.some(keyword => errorMessage.includes(keyword));
  }

  async reportToCrashlytics(errorInfo) {
    try {
      // يمكن إضافة خدمة تقارير الأخطاء هنا
      console.warn('تقرير خطأ حرج:', errorInfo);
    } catch (e) {
      console.error('فشل في إرسال تقرير الخطأ:', e);
    }
  }

  onError(listener) {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }
}

export const errorHandler = new ErrorHandler();
