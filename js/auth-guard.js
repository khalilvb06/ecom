import { supabase } from './server-superbase.js';

// قائمة الصفحات الإدارية التي تحتاج مصادقة
const ADMIN_PAGES = [
  'dashboard.html',
  'products.html', 
  'addLandingPage.html',
  'orders.html',
  'ads.html',
  'categories.html',
  'shipping.html',
  'sitting.html'
];

// دالة للتحقق من أن الصفحة الحالية هي صفحة إدارية
function isAdminPage() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  console.log('الصفحة الحالية:', currentPage);
  const isAdmin = ADMIN_PAGES.includes(currentPage);
  console.log('هل هي صفحة إدارية؟', isAdmin);
  return isAdmin;
}

// دالة للتوجيه إلى صفحة تسجيل الدخول
function redirectToLogin() {
  console.log('بدء إعادة التوجيه إلى صفحة تسجيل الدخول...');
  // حفظ الصفحة الحالية للعودة إليها بعد تسجيل الدخول
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  sessionStorage.setItem('redirectAfterLogin', currentPage);
  console.log('تم حفظ الصفحة الحالية:', currentPage);
  
  // التوجيه إلى صفحة تسجيل الدخول فوراً
  window.location.href = 'login.html';
}

// دالة للتحقق من المصادقة مع timeout
async function checkAuthWithTimeout() {
  try {
    // إضافة timeout للاتصال بـ Supabase (2 ثانية فقط)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), 5000);
    });
    
    const authPromise = supabase.auth.getUser();
    
    const { data: { user }, error } = await Promise.race([authPromise, timeoutPromise]);
    
    if (error) {
      console.error('خطأ في التحقق من المصادقة:', error);
      return { user: null, error };
    }
    
    return { user, error: null };
  } catch (error) {
    console.error('خطأ في الاتصال أو timeout:', error);
    return { user: null, error };
  }
}

// دالة لحماية الصفحات الإدارية
async function protectAdminPages() {
  console.log('=== بدء حماية الصفحات الإدارية ===');
  
  if (isAdminPage()) {
    console.log('صفحة إدارية مكتشفة، التحقق من المصادقة...');
    
    const { user, error } = await checkAuthWithTimeout();
    
    if (error || !user) {
      console.log('المصادقة فشلت، إعادة التوجيه فوراً...');
      redirectToLogin();
      return false;
    }
    
    console.log('المصادقة ناجحة، يمكن الوصول للصفحة');
    console.log('معلومات المستخدم:', user.email);
    return true;
  } else {
    console.log('هذه ليست صفحة إدارية، لا حاجة للمصادقة');
    return true;
  }
}

// بدء الحماية مرة واحدة فقط عند تحميل السكريبت
console.log('بدء حماية الصفحات (استدعاء واحد)...');
protectAdminPages();

// تصدير الدوال للاستخدام في ملفات أخرى
export { protectAdminPages, isAdminPage }; 
