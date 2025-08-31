import { supabase } from './server-superbase.js';
import { protectAdminPages } from './auth-guard.js';

// جلب جميع الولايات من قاعدة البيانات
async function fetchStates() {
  try {
    const { data, error } = await supabase
      .from('shipping_states')
      .select('*');

    if (error) throw error;

    displayStates(data);
  } catch (error) {
    window.alert('خطأ في جلب البيانات: ' + error.message);
  }
}

// عرض البيانات في جدول HTML مع الإجراءات
function displayStates(states) {
  const tableBody = document.getElementById('statesTableBody');
  tableBody.innerHTML = '';

  states.forEach((state) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${state.state_name || state.name}</td>
      <td>${state.home_delivery_price ?? state.home_price}</td>
      <td>${state.office_delivery_price ?? state.office_price}</td>
      <td>${state.is_available ?? state.enabled ? 'متاح' : 'غير متاح'}</td>
      <td>
        <button class="btn btn-sm btn-primary mx-1" onclick="editState(${state.id})">تعديل</button>
        <button class="btn btn-sm btn-danger mx-1" onclick="deleteState(${state.id})">حذف</button>
        <button class="btn btn-sm btn-${(state.is_available ?? state.enabled) ? 'warning' : 'success'} mx-1" onclick="toggleDelivery(${state.id}, ${state.is_available ?? state.enabled})">
          ${(state.is_available ?? state.enabled) ? 'إلغاء التفعيل' : 'تفعيل'}
        </button>
      </td>
    `;
    tableBody.appendChild(row);
  });
}

// إضافة ولاية جديدة
const addStateForm = document.getElementById('addStateForm');

// تعريف defaultAddHandler لإرجاعه للفورم بعد التعديل
function defaultAddHandler(e) {
  e.preventDefault();
  const state_name = document.getElementById('stateName').value;
  const home_delivery_price = parseFloat(document.getElementById('homePrice').value);
  const office_delivery_price = parseFloat(document.getElementById('officePrice').value);

  supabase.from('shipping_states').insert([
    { state_name, home_delivery_price, office_delivery_price, is_available: true }
  ]).then(({ error }) => {
    if (error) {
      window.alert('فشل في الإضافة: ' + error.message);
      return;
    }
    window.alert('تمت الإضافة بنجاح');
    addStateForm.reset();
    fetchStates();
  });
}

// عند تحميل الصفحة: تعيين دالة الإضافة الافتراضية
addStateForm.onsubmit = defaultAddHandler;

// حذف ولاية
window.deleteState = async function(id) {
  if (!window.confirm('هل أنت متأكد من حذف هذه الولاية؟')) return;
  const { error } = await supabase.from('shipping_states').delete().eq('id', id);
  if (error) {
    window.alert('خطأ في الحذف: ' + error.message);
    return;
  }
  window.alert('تم الحذف بنجاح');
  fetchStates();
};

// تعديل ولاية (فتح البيانات في الفورم)
window.editState = async function(id) {
  const { data, error } = await supabase.from('shipping_states').select('*').eq('id', id).single();
  if (error) {
    window.alert('لم يتم العثور على الولاية');
    return;
  }

  // تعبئة البيانات في الفورم
  document.getElementById('stateName').value = data.state_name || data.name;
  document.getElementById('homePrice').value = data.home_delivery_price ?? data.home_price;
  document.getElementById('officePrice').value = data.office_delivery_price ?? data.office_price;

  // تغيير عنوان النافذة وزر الحفظ
  document.querySelector('#addStateModal h5').textContent = 'تعديل ولاية';
  document.querySelector('#addStateForm button[type="submit"]').textContent = 'حفظ التعديل';

  // إظهار النافذة (modal) عبر Bootstrap
  const modal = new bootstrap.Modal(document.getElementById('addStateModal'));
  modal.show();

  // عند الحفظ يتم التعديل بدل الإضافة
  addStateForm.onsubmit = async function(e) {
    e.preventDefault();
    const state_name = document.getElementById('stateName').value;
    const home_delivery_price = parseFloat(document.getElementById('homePrice').value);
    const office_delivery_price = parseFloat(document.getElementById('officePrice').value);

    const { error } = await supabase.from('shipping_states').update({
      state_name, home_delivery_price, office_delivery_price
    }).eq('id', id);

    if (error) {
      window.alert('فشل التعديل: ' + error.message);
    } else {
      window.alert('تم التعديل بنجاح');
      addStateForm.reset();
      addStateForm.onsubmit = defaultAddHandler;
      // إعادة العنوان وزر الحفظ للوضع الافتراضي
      document.querySelector('#addStateModal h5').textContent = 'إضافة ولاية جديدة';
      document.querySelector('#addStateForm button[type="submit"]').textContent = 'إضافة';
      modal.hide();
      fetchStates();
    }
  };
};

// تفعيل أو تعطيل التوصيل
window.toggleDelivery = async function(id, currentStatus) {
  const { error } = await supabase.from('shipping_states').update({ is_available: !currentStatus }).eq('id', id);
  if (error) {
    window.alert('فشل في التحديث: ' + error.message);
    return;
  }
  window.alert('تم تحديث حالة التوصيل بنجاح');
  fetchStates();
};

// أول تحميل للبيانات بعد التحقق من المصادقة
protectAdminPages().then(isProtected => {
  if (isProtected) {
    console.log('تم التحقق من المصادقة، بدء تحميل البيانات...');
    fetchStates();
  } else {
    console.log('فشل في المصادقة، لن يتم تحميل البيانات');
  }
});
