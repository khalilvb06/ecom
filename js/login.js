import { supabase } from './server-superbase.js';

// عناصر DOM
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const rememberMeCheckbox = document.getElementById('remember-me');
const passwordToggle = document.getElementById('password-toggle');
const passwordIcon = document.getElementById('password-icon');
const errorMessage = document.getElementById('error-message');
const successMessage = document.getElementById('success-message');
const errorText = document.getElementById('error-text');
const successText = document.getElementById('success-text');

// دالة لإظهار رسائل الخطأ
function showError(message) {
  errorText.textContent = message;
  errorMessage.style.display = 'block';
  successMessage.style.display = 'none';
  
  // إخفاء رسالة الخطأ بعد 5 ثواني
  setTimeout(() => {
    errorMessage.style.display = 'none';
  }, 5000);
}

// دالة لإظهار رسائل النجاح
function showSuccess(message) {
  successText.textContent = message;
  successMessage.style.display = 'block';
  errorMessage.style.display = 'none';
  
  // إخفاء رسالة النجاح بعد 3 ثواني
  setTimeout(() => {
    successMessage.style.display = 'none';
  }, 3000);
}

// دالة لتبديل عرض كلمة المرور
function togglePasswordVisibility() {
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    passwordIcon.className = 'fas fa-eye-slash';
  } else {
    passwordInput.type = 'password';
    passwordIcon.className = 'fas fa-eye';
  }
}

// دالة للتحقق من صحة البريد الإلكتروني
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// دالة للتحقق من صحة كلمة المرور
function validatePassword(password) {
  return password.length >= 6;
}

// دالة لحفظ بيانات تسجيل الدخول في localStorage
function saveLoginData(email, rememberMe) {
  if (rememberMe) {
    localStorage.setItem('rememberedEmail', email);
    localStorage.setItem('rememberMe', 'true');
  } else {
    localStorage.removeItem('rememberedEmail');
    localStorage.removeItem('rememberMe');
  }
}

// دالة لتحميل بيانات تسجيل الدخول المحفوظة
function loadSavedLoginData() {
  const rememberedEmail = localStorage.getItem('rememberedEmail');
  const rememberMe = localStorage.getItem('rememberMe');
  
  if (rememberedEmail && rememberMe === 'true') {
    emailInput.value = rememberedEmail;
    rememberMeCheckbox.checked = true;
  }
}

// دالة لتسجيل الدخول
async function handleLogin(email, password, rememberMe) {
  try {
    // التحقق من صحة البيانات
    if (!validateEmail(email)) {
      showError('يرجى إدخال بريد إلكتروني صحيح');
      return false;
    }
    
    if (!validatePassword(password)) {
      showError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return false;
    }
    
    // محاولة تسجيل الدخول مع Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });
    
    if (error) {
      showError('خطأ في تسجيل الدخول: ' + error.message);
      return false;
    }
    
    // حفظ بيانات تسجيل الدخول إذا تم تحديد "تذكرني"
    saveLoginData(email, rememberMe);
    
    showSuccess('تم تسجيل الدخول بنجاح! جاري التوجيه...');
    
    // التوجيه إلى الصفحة المطلوبة أو لوحة التحكم
    setTimeout(() => {
      const redirectPage = sessionStorage.getItem('redirectAfterLogin');
      if (redirectPage && redirectPage !== 'login.html') {
        sessionStorage.removeItem('redirectAfterLogin');
        window.location.href = redirectPage;
      } else {
        window.location.href = 'dashboard.html';
      }
    }, 500);
    
    return true;
    
  } catch (error) {
    showError('حدث خطأ غير متوقع: ' + error.message);
    return false;
  }
}

// دالة لمعالجة تقديم النموذج
async function handleFormSubmit(event) {
  event.preventDefault();
  
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const rememberMe = rememberMeCheckbox.checked;
  
  // إظهار حالة التحميل
  const submitButton = loginForm.querySelector('button[type="submit"]');
  const originalText = submitButton.innerHTML;
  submitButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>جاري تسجيل الدخول...';
  submitButton.disabled = true;
  
  try {
    await handleLogin(email, password, rememberMe);
  } finally {
    // إعادة تعيين حالة الزر
    submitButton.innerHTML = originalText;
    submitButton.disabled = false;
  }
}

// إضافة مستمعي الأحداث
document.addEventListener('DOMContentLoaded', function() {
  // تحميل البيانات المحفوظة
  loadSavedLoginData();
  
  // مستمع لتبديل عرض كلمة المرور
  passwordToggle.addEventListener('click', togglePasswordVisibility);
  
  // مستمع لتقديم النموذج
  loginForm.addEventListener('submit', handleFormSubmit);
  
  // مستمع للتحقق من صحة البريد الإلكتروني أثناء الكتابة
  emailInput.addEventListener('blur', function() {
    const email = this.value.trim();
    if (email && !validateEmail(email)) {
      this.classList.add('is-invalid');
    } else {
      this.classList.remove('is-invalid');
    }
  });
  
  // مستمع للتحقق من صحة كلمة المرور أثناء الكتابة
  passwordInput.addEventListener('blur', function() {
    const password = this.value;
    if (password && !validatePassword(password)) {
      this.classList.add('is-invalid');
    } else {
      this.classList.remove('is-invalid');
    }
  });
  
  // مستمع لإزالة حالة الخطأ عند الكتابة
  emailInput.addEventListener('input', function() {
    this.classList.remove('is-invalid');
  });
  
  passwordInput.addEventListener('input', function() {
    this.classList.remove('is-invalid');
  });
  
  // إضافة تأثيرات بصرية للتفاعل
  const formControls = document.querySelectorAll('.form-control');
  formControls.forEach(control => {
    control.addEventListener('focus', function() {
      this.parentElement.classList.add('focused');
    });
    
    control.addEventListener('blur', function() {
      if (!this.value) {
        this.parentElement.classList.remove('focused');
      }
    });
  });
});

// دالة للتحقق من حالة تسجيل الدخول
async function checkAuthStatus() {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    // إذا كان المستخدم مسجل دخوله بالفعل، توجيه إلى الصفحة المطلوبة أو لوحة التحكم
    const redirectPage = sessionStorage.getItem('redirectAfterLogin');
    if (redirectPage && redirectPage !== 'login.html') {
      sessionStorage.removeItem('redirectAfterLogin');
      window.location.href = redirectPage;
    } else {
      window.location.href = 'dashboard.html';
    }
  }
}

// التحقق من حالة تسجيل الدخول عند تحميل الصفحة
checkAuthStatus(); 