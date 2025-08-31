import { supabase } from './js/server-superbase.js';
import { protectAdminPages } from './auth-guard.js';

async function loadStoreSettings() {
  const { data, error } = await supabase
    .from('store_settings')
    .select('*')
    .eq('id', 1) // نفترض أن الإعدادات الوحيدة ID=1
    .single();

  if (error) return console.error('خطأ في تحميل الإعدادات:', error.message);

  if (data.name) {
    document.querySelectorAll('#store-name, #footer-store-name').forEach(el => el.textContent = data.name);
  }

  if (data.logo) {
    document.querySelectorAll('#store-logo').forEach(img => img.src = data.logo);
  }

  if (data.headercolor) {
    document.querySelectorAll('.main-header, .main-footer').forEach(el => el.style.backgroundColor = data.headercolor);
  }

  if (data.btncolor) {
    const style = document.createElement('style');
    style.textContent = `.btn-main { background-color: ${data.btncolor}; color: #fff; }`;
    document.head.appendChild(style);
  }

  if (data.textcolor) {
    document.body.style.color = data.textcolor;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // حماية الصفحات الإدارية
  await protectAdminPages();
  
  // تحميل إعدادات المتجر
  loadStoreSettings();
});
