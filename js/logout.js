// استيراد Supabase
import { supabase } from './server-superbase.js';

// دالة عرض مودل تأكيد تسجيل الخروج
function showLogoutModal() {
    // إنشاء مودل التأكيد
    const modalHtml = `
        <div class="modal fade" id="logoutConfirmModal" tabindex="-1" aria-labelledby="logoutConfirmLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header bg-danger text-white">
                        <h5 class="modal-title" id="logoutConfirmLabel">
                            <span>🚪</span> تأكيد تسجيل الخروج
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="إغلاق"></button>
                    </div>
                    <div class="modal-body text-center">
                        <div class="mb-3">
                            <span style="font-size: 3rem;">⚠️</span>
                        </div>
                        <h6 class="mb-3">هل أنت متأكد من أنك تريد تسجيل الخروج؟</h6>
                        <p class="text-muted">سيتم حذف جميع بيانات الجلسة وإعادة توجيهك إلى صفحة تسجيل الدخول</p>
                    </div>
                    <div class="modal-footer justify-content-center">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                            <span>❌</span> إلغاء
                        </button>
                        <button type="button" class="btn btn-danger" onclick="performLogout()">
                            <span>🚪</span> تسجيل الخروج
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // إضافة المودل إلى الصفحة إذا لم يكن موجوداً
    if (!document.getElementById('logoutConfirmModal')) {
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
    
    // عرض المودل
    const modal = new bootstrap.Modal(document.getElementById('logoutConfirmModal'));
    modal.show();
}

// دالة تنفيذ تسجيل الخروج
async function performLogout() {
    try {
        // إغلاق المودل
        const modal = bootstrap.Modal.getInstance(document.getElementById('logoutConfirmModal'));
        if (modal) {
            modal.hide();
        }
        
        // تسجيل الخروج من Supabase
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('خطأ في تسجيل الخروج:', error);
            alert('حدث خطأ في تسجيل الخروج: ' + error.message);
            return;
        }
        
        // مسح البيانات المحفوظة
        localStorage.removeItem('rememberedEmail');
        localStorage.removeItem('rememberMe');
        sessionStorage.clear();
        
        // حذف بيانات الجلسة من localStorage أيضاً للتأكد
        localStorage.removeItem('user');
        localStorage.removeItem('userToken');
        localStorage.removeItem('isLoggedIn');
        
        // إعادة توجيه المستخدم إلى صفحة تسجيل الدخول
        window.location.href = 'login.html';
    } catch (error) {
        console.error('خطأ في تسجيل الخروج:', error);
        alert('حدث خطأ في تسجيل الخروج: ' + error.message);
    }
}

// دالة تسجيل الخروج الرئيسية
function logout() {
    showLogoutModal();
}

// جعل الدوال متاحة عالمياً
window.logout = logout;
window.performLogout = performLogout; 