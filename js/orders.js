import { supabase } from './server-superbase.js';
import { protectAdminPages } from './auth-guard.js';

// تعريف حالات الطلب
const ORDER_STATUS = [
  { value: 'pending', label: 'في انتظار التأكيد ⏳' },
  { value: 'call1', label: 'الاتصال الأول ☎️' },
  { value: 'call2', label: 'الاتصال الثاني ☎️' },
  { value: 'call3', label: 'الاتصال الثالث ☎️' },
  { value: 'confirmed', label: 'تم التأكيد ✅' },
  { value: 'cancelled', label: 'تم إلغاء الطلبية ❌' },
  { value: 'delivered', label: 'وصول الطلبية 🚚' },
];

// تحميل الطلبات عند تحميل الصفحة بعد التحقق من المصادقة
window.addEventListener('DOMContentLoaded', async () => {
  const isProtected = await protectAdminPages();
  if (isProtected) {
    console.log('تم التحقق من المصادقة، بدء تحميل الطلبات...');
    loadOrders();
  } else {
    console.log('فشل في المصادقة، لن يتم تحميل الطلبات');
  }
});

// متغير عام لتخزين الطلبات الأصلية
let allOrders = [];

async function loadOrders() {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    alert('حدث خطأ أثناء جلب الطلبات');
    return;
  }
  allOrders = orders; // حفظ الطلبات الأصلية
  renderOrdersTable(orders);
  renderStats(orders);
  renderSummary(orders);
  setupFilterEvents();
}

function setupFilterEvents() {
  const statusFilter = document.getElementById('status-filter');
  const resetFilter = document.getElementById('reset-filter');
  
  statusFilter.addEventListener('change', filterOrders);
  resetFilter.addEventListener('click', resetFilterOrders);
}

function filterOrders() {
  const selectedStatus = document.getElementById('status-filter').value;
  let filteredOrders = allOrders;
  
  if (selectedStatus) {
    filteredOrders = allOrders.filter(order => order.status === selectedStatus);
  }
  
  renderOrdersTable(filteredOrders);
  renderStats(filteredOrders);
  renderSummary(filteredOrders);
}

function resetFilterOrders() {
  document.getElementById('status-filter').value = '';
  renderOrdersTable(allOrders);
  renderStats(allOrders);
  renderSummary(allOrders);
}

function renderOrdersTable(orders) {
  const tbody = document.querySelector('#orders-table tbody');
  tbody.innerHTML = '';
  orders.forEach((order, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${order.id}</td>
      <td>${order.product_name || ''}</td>
      <td><img src="${getMainImage(order.product_image)}" class="order-img" alt="صورة المنتج"></td>
      <td>${order.full_name}</td>
      <td>${order.quantity}</td>
      <td>${order.state_name || ''}</td>
      <td>${order.total_price} دج</td>
      <td>
        <select class="form-select order-status-select" data-id="${order.id}">
          ${ORDER_STATUS.map(s => `<option value="${s.value}" ${order.status === s.value ? 'selected' : ''}>${s.label}</option>`).join('')}
        </select>
      </td>
      <td class="action-btns">
        <button class="btn btn-info btn-sm" title="تفاصيل" data-details>المزيد 🔎</button>
        <button class="btn btn-warning btn-sm" title="تعديل" data-edit>تعديل ✏️</button>
        <button class="btn btn-danger btn-sm" title="حذف" data-delete>حذف 🗑️</button>
      </td>
    `;
    // حفظ بيانات الطلب في العنصر نفسه
    tr.querySelector('[data-details]').onclick = () => showOrderDetails(order);
    tr.querySelector('[data-edit]').onclick = () => showOrderEdit(order);
    tr.querySelector('[data-delete]').onclick = () => deleteOrder(order.id);
    tr.querySelector('.order-status-select').onchange = (e) => updateOrderStatus(order.id, e.target.value);
    tbody.appendChild(tr);
  });
}

function getMainImage(img) {
  if (!img) return 'https://via.placeholder.com/60x60';
  try {
    if (img.startsWith('[')) {
      const arr = JSON.parse(img);
      return arr[0] || 'https://via.placeholder.com/60x60';
    }
    return img;
  } catch {
    return 'https://via.placeholder.com/60x60';
  }
}

function renderStats(orders) {
  document.getElementById('total-orders').textContent = orders.length;
  document.getElementById('pending-orders').textContent = orders.filter(o => o.status === 'pending').length;
  document.getElementById('confirmed-orders').textContent = orders.filter(o => o.status === 'confirmed').length;
}

function renderSummary(orders) {
  const delivered = orders.filter(o => o.status === 'delivered');
  document.getElementById('delivered-orders-count').textContent = delivered.length;
  // صافي الأرباح = مجموع الطلبات المنجزة - مجموع الشحن
  let total = 0, shipping = 0, turnover = 0;
  delivered.forEach(o => {
    total += o.total_price || 0;
    shipping += o.shipping_price || 0;
  });
  // رقم الأعمال = مجموع كل الطلبات (total_price)
  orders.forEach(o => { turnover += o.total_price || 0; });
  document.getElementById('net-profit').textContent = total - shipping;
  const turnoverEl = document.getElementById('turnover-total');
  if (turnoverEl) turnoverEl.textContent = turnover;
}

function showOrderDetails(order) {
  const modalBody = document.getElementById('order-details-body');
  
  // جلب معلومات المنتج من قاعدة البيانات
  const getProductInfo = async () => {
    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', order.product_id)
      .single();
    
    if (error || !product) {
      return null;
    }
    return product;
  };

  getProductInfo().then(product => {
    let productName = order.product_name || '';
    let productImage = getMainImage(order.product_image);
    let productDescription = '';
    
    if (product) {
      productName = product.name || productName;
      productDescription = product.descr || '';
      if (product.image) {
        productImage = getMainImage(product.image);
      }
    }

    modalBody.innerHTML = `
      <div class="row">
        <div class="col-md-4 text-center mb-3">
          <img src="${productImage}" class="img-fluid rounded mb-2" style="max-height:120px;object-fit:cover;">
          <h5>${productName}</h5>
          ${productDescription ? `<p class="text-muted small">${productDescription}</p>` : ''}
        </div>
        <div class="col-md-8">
          <ul class="list-group list-group-flush">
            <li class="list-group-item d-flex justify-content-between">
              <span>الاسم الكامل:</span>
              <strong>${order.full_name}</strong>
            </li>
            <li class="list-group-item d-flex justify-content-between">
              <span>رقم الهاتف:</span>
              <strong>${order.phone_number}</strong>
            </li>
            <li class="list-group-item d-flex justify-content-between">
              <span>العنوان التفصيلي:</span>
              <strong>${order.address}</strong>
            </li>
            <li class="list-group-item d-flex justify-content-between">
              <span>الولاية:</span>
              <strong>${order.state_name || ''}</strong>
            </li>
            <li class="list-group-item d-flex justify-content-between">
              <span>البلدية:</span>
              <strong>${order.municipality_name || ''}</strong>
            </li>
            <li class="list-group-item d-flex justify-content-between">
              <span>نوع الشحن:</span>
              <strong>${order.shipping_type === 'home' ? 'إلى باب المنزل 🏠' : 'إلى المكتب 🏢'}</strong>
            </li>
            ${order.color ? `<li class="list-group-item d-flex justify-content-between">
              <span>اللون:</span>
              <div class="d-flex align-items-center">
                <span style="background:${order.color_hex || '#ccc'};display:inline-block;width:18px;height:18px;border-radius:50%;margin-inline-end:5px;"></span>
                <strong>${order.color}</strong>
              </div>
            </li>` : ''}
            ${order.size ? `<li class="list-group-item d-flex justify-content-between">
              <span>المقاس:</span>
              <strong>${order.size}</strong>
            </li>` : ''}
            <li class="list-group-item d-flex justify-content-between">
              <span>الكمية:</span>
              <strong>${order.quantity}</strong>
            </li>
            <li class="list-group-item d-flex justify-content-between">
              <span>العرض الخاص:</span>
              <strong>${order.offer_label || 'بدون عرض خاص'}</strong>
            </li>
            <li class="list-group-item d-flex justify-content-between">
              <span>وقت الطلب:</span>
              <strong>${formatDate(order.created_at)}</strong>
            </li>
            <li class="list-group-item d-flex justify-content-between">
              <span>سعر الوحدة:</span>
              <strong>${order.product_price} دج</strong>
            </li>
            <li class="list-group-item d-flex justify-content-between">
              <span>سعر الشحن:</span>
              <strong>${order.shipping_price} دج</strong>
            </li>
            <li class="list-group-item d-flex justify-content-between">
              <span>المجموع الإجمالي:</span>
              <strong class="text-success fs-5">${order.total_price} دج</strong>
            </li>
            <li class="list-group-item d-flex justify-content-between">
              <span>حالة الطلب:</span>
              <strong class="badge bg-${getStatusBadgeColor(order.status)}">${getStatusLabel(order.status)}</strong>
            </li>
          </ul>
        </div>
      </div>
    `;
  });
  
  showModal('orderDetailsModal');
}

function showOrderEdit(order) {
  const modalBody = document.getElementById('order-edit-body');
  
  // جلب معلومات المنتج والولايات
  const getProductAndStates = async () => {
    const [productResult, statesResult] = await Promise.all([
      supabase.from('products').select('*').eq('id', order.product_id).single(),
      supabase.from('shipping_states').select('*').eq('is_available', true)
    ]);
    
    return {
      product: productResult.data,
      states: statesResult.data || []
    };
  };

  getProductAndStates().then(({ product, states }) => {
    let offers = [];
    let colors = [];
    let sizes = [];
    
    if (product) {
      try { offers = product.offers ? JSON.parse(product.offers) : []; } catch(e) { offers = []; }
      try { colors = product.colors ? JSON.parse(product.colors) : []; } catch(e) { colors = []; }
      try { sizes = product.sizes ? JSON.parse(product.sizes) : []; } catch(e) { sizes = []; }
    }

    // بناء HTML للعروض الخاصة
    let offerSelectHtml = '';
    if (offers.length > 0) {
      offerSelectHtml = `<div class="col-md-6">
        <label class="form-label">العرض الخاص</label>
        <select class="form-select" name="offer_label" id="edit-offer-select">
          <option value="">بدون عرض خاص</option>
          ${offers.map((o, idx) => `<option value="${o.qty} قطعة بـ ${o.price} دج" data-offer-index="${idx}" ${order.offer_label === `${o.qty} قطعة بـ ${o.price} دج` ? 'selected' : ''}>${o.qty} قطعة بـ ${o.price} دج</option>`).join('')}
        </select>
      </div>`;
    }

    // بناء HTML للألوان
    let colorSelectHtml = '';
    if (colors.length > 0) {
      colorSelectHtml = `<div class="col-md-6">
        <label class="form-label">اللون</label>
        <select class="form-select" name="color" id="edit-color-select">
          <option value="">اختر اللون</option>
          ${colors.map(c => `<option value="${c.name}" data-color-hex="${c.hex}" ${order.color === c.name ? 'selected' : ''}>${c.name}</option>`).join('')}
        </select>
      </div>`;
    }

    // بناء HTML للقياسات
    let sizeSelectHtml = '';
    if (sizes.length > 0) {
      sizeSelectHtml = `<div class="col-md-6">
        <label class="form-label">المقاس</label>
        <select class="form-select" name="size" id="edit-size-select">
          <option value="">اختر المقاس</option>
          ${sizes.map(s => `<option value="${s}" ${order.size === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>`;
    }

    // بناء HTML للولايات
    const statesOptions = states.map(s => 
      `<option value="${s.id}" data-home="${s.home_delivery_price}" data-office="${s.office_delivery_price}" ${order.state_id == s.id ? 'selected' : ''}>${s.state_name}</option>`
    ).join('');

    modalBody.innerHTML = `
      <form id="edit-order-form">
        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label">الاسم الكامل</label>
            <input type="text" class="form-control" name="full_name" value="${order.full_name}" required>
          </div>
          <div class="col-md-6">
            <label class="form-label">رقم الهاتف</label>
            <input type="text" class="form-control" name="phone_number" value="${order.phone_number}" required>
          </div>
          <div class="col-md-6">
            <label class="form-label">الولاية</label>
            <select class="form-select" name="state_id" id="edit-state-select" required>
              <option value="">اختر الولاية</option>
              ${statesOptions}
            </select>
          </div>
          <div class="col-md-6">
            <label class="form-label">البلدية</label>
            <select class="form-select" name="municipality_id" id="edit-municipality-select" required>
              <option value="">اختر الولاية أولاً</option>
            </select>
          </div>
          <div class="col-md-12">
            <label class="form-label">العنوان التفصيلي</label>
            <input type="text" class="form-control" name="address" value="${order.address}" placeholder="اسم الشارع، رقم المنزل، إلخ..." required>
          </div>
          <div class="col-md-6">
            <label class="form-label">نوع الشحن</label>
            <select class="form-select" name="shipping_type" id="edit-shipping-type">
              <option value="office" ${order.shipping_type === 'office' ? 'selected' : ''}>إلى المكتب</option>
              <option value="home" ${order.shipping_type === 'home' ? 'selected' : ''}>إلى باب المنزل</option>
            </select>
          </div>
          ${colorSelectHtml}
          ${sizeSelectHtml}
          ${offerSelectHtml}
          <div class="col-md-4">
            <label class="form-label">الكمية</label>
            <input type="number" class="form-control" name="quantity" id="edit-quantity" value="${order.quantity}" min="1" required>
          </div>
          <div class="col-md-4">
            <label class="form-label">سعر الوحدة</label>
            <input type="number" class="form-control" name="product_price" id="edit-product-price" value="${order.product_price}" min="0" required>
          </div>
          <div class="col-md-4">
            <label class="form-label">سعر الشحن</label>
            <input type="number" class="form-control" name="shipping_price" id="edit-shipping-price" value="${order.shipping_price}" min="0" required>
          </div>
        </div>
        
        <!-- ملخص الطلبية المحدث -->
        <div class="mt-4 p-3 bg-light rounded">
          <h6>ملخص الطلبية المحدث:</h6>
          <div class="row">
            <div class="col-md-4">
              <strong>سعر الوحدة:</strong> <span id="summary-edit-product-price">${order.product_price}</span> دج
            </div>
            <div class="col-md-4">
              <strong>الكمية:</strong> <span id="summary-edit-quantity">${order.quantity}</span>
            </div>
            <div class="col-md-4">
              <strong>سعر الشحن:</strong> <span id="summary-edit-shipping-price">${order.shipping_price}</span> دج
            </div>
          </div>
          <div class="mt-2">
            <strong class="text-success fs-5">المجموع الإجمالي: <span id="summary-edit-total">${order.total_price}</span> دج</strong>
          </div>
        </div>
        
        <div class="mt-3 text-end">
          <button type="submit" class="btn btn-success">حفظ التعديلات ✅</button>
        </div>
      </form>
    `;

    // إضافة أحداث لتحديث الأسعار تلقائياً
    setupEditFormEvents(order, offers, states);
  });
  
  showModal('orderEditModal');
}

// دالة إعداد أحداث النموذج للتعديل
function setupEditFormEvents(order, offers, states) {
  const form = document.getElementById('edit-order-form');
  const quantityInput = document.getElementById('edit-quantity');
  const productPriceInput = document.getElementById('edit-product-price');
  const shippingPriceInput = document.getElementById('edit-shipping-price');
  const stateSelect = document.getElementById('edit-state-select');
  const municipalitySelect = document.getElementById('edit-municipality-select');
  const shippingTypeSelect = document.getElementById('edit-shipping-type');
  const offerSelect = document.getElementById('edit-offer-select');
  const colorSelect = document.getElementById('edit-color-select');

  // متغير لتخزين بيانات البلديات
  let municipalitiesData = {};

  // دالة جلب البلديات حسب الولاية
  async function fetchMunicipalities(stateId) {
    if (!stateId) {
      if (municipalitySelect) {
        municipalitySelect.innerHTML = '<option value="">اختر الولاية أولاً</option>';
      }
      return;
    }

    // التحقق من وجود البيانات في الذاكرة
    if (municipalitiesData[stateId]) {
      updateMunicipalitiesSelect(stateId);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('municipalities')
        .select('*')
        .eq('state_id', stateId)
        .eq('is_available', true)
        .order('municipality_name');

      if (error) {
        console.error('خطأ في جلب البلديات:', error);
        return;
      }

      municipalitiesData[stateId] = data || [];
      updateMunicipalitiesSelect(stateId);
    } catch (error) {
      console.error('خطأ في جلب البلديات:', error);
    }
  }

  // دالة تحديث قائمة البلديات
  function updateMunicipalitiesSelect(stateId) {
    const municipalities = municipalitiesData[stateId] || [];
    
    if (!municipalitySelect) return;

    if (municipalities.length === 0) {
      municipalitySelect.innerHTML = '<option value="">لا توجد بلديات متاحة</option>';
      return;
    }

    const optionsHtml = '<option value="">اختر البلدية</option>' +
      municipalities.map(m => `<option value="${m.id}" data-name="${m.municipality_name}" ${order.municipality_id == m.id ? 'selected' : ''}>${m.municipality_name}</option>`).join('');
    
    municipalitySelect.innerHTML = optionsHtml;
  }

  // حفظ الألوان في المتغير العام للوصول إليها لاحقاً
  if (window.productColors) {
    window.productColors = window.productColors || [];
  }

  // دالة تحديث الأسعار
  function updateEditPrices() {
    let quantity = parseInt(quantityInput.value) || 1;
    let unitPrice = parseFloat(productPriceInput.value) || 0;
    let shippingPrice = parseFloat(shippingPriceInput.value) || 0;
    let totalPrice = 0;

    // حساب السعر حسب العرض الخاص
    if (offerSelect && offerSelect.value) {
      const selectedOption = offerSelect.options[offerSelect.selectedIndex];
      const offerIndex = selectedOption.dataset.offerIndex;
      if (offerIndex !== undefined && offers[offerIndex]) {
        const offer = offers[offerIndex];
        unitPrice = offer.price / offer.qty;
        // تحديث الكمية لتكون مضاعفة للعرض
        quantity = Math.ceil(quantity / offer.qty) * offer.qty;
        quantityInput.value = quantity;
        totalPrice = (Math.ceil(quantity / offer.qty) * offer.price) + shippingPrice;
      }
    } else {
      totalPrice = (unitPrice * quantity) + shippingPrice;
    }

    // تحديث عرض الأسعار
    document.getElementById('summary-edit-product-price').textContent = unitPrice;
    document.getElementById('summary-edit-quantity').textContent = quantity;
    document.getElementById('summary-edit-shipping-price').textContent = shippingPrice;
    document.getElementById('summary-edit-total').textContent = totalPrice;
  }

  // إضافة الأحداث
  if (quantityInput) quantityInput.addEventListener('input', updateEditPrices);
  if (productPriceInput) productPriceInput.addEventListener('input', updateEditPrices);
  if (shippingPriceInput) shippingPriceInput.addEventListener('input', updateEditPrices);
  if (offerSelect) offerSelect.addEventListener('change', updateEditPrices);

  // تحديث سعر الشحن عند تغيير الولاية أو نوع الشحن
  function updateShippingPrice() {
    if (stateSelect && shippingTypeSelect) {
      const selectedState = states.find(s => s.id == stateSelect.value);
      if (selectedState) {
        const shippingPrice = shippingTypeSelect.value === 'home' 
          ? selectedState.home_delivery_price 
          : selectedState.office_delivery_price;
        shippingPriceInput.value = shippingPrice;
        updateEditPrices();
      }
    }
  }

  if (stateSelect) {
    stateSelect.addEventListener('change', () => {
      fetchMunicipalities(stateSelect.value);
      updateShippingPrice();
    });
  }
  if (shippingTypeSelect) shippingTypeSelect.addEventListener('change', updateShippingPrice);

  // تحميل البلديات عند التحميل إذا كانت الولاية محددة
  if (order.state_id) {
    fetchMunicipalities(order.state_id);
  }

  // معالجة إرسال النموذج
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = new FormData(form);
    const updateData = {
      full_name: formData.get('full_name'),
      phone_number: formData.get('phone_number'),
      address: formData.get('address'),
      state_id: formData.get('state_id'),
      state_name: stateSelect.options[stateSelect.selectedIndex]?.textContent || '',
      municipality_id: formData.get('municipality_id'),
      municipality_name: municipalitySelect.options[municipalitySelect.selectedIndex]?.textContent || '',
      shipping_type: formData.get('shipping_type'),
      color: formData.get('color') || '',
      color_hex: getColorHex(formData.get('color')),
      size: formData.get('size') || '',
      quantity: parseInt(formData.get('quantity')) || 1,
      offer_label: formData.get('offer_label') || '',
      product_price: parseFloat(formData.get('product_price')) || 0,
      shipping_price: parseFloat(formData.get('shipping_price')) || 0,
      total_price: parseFloat(document.getElementById('summary-edit-total').textContent) || 0
    };

    console.log('بيانات التحديث:', updateData); // للتأكد من البيانات

    const { error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', order.id);

    if (error) {
      alert('حدث خطأ أثناء التعديل: ' + error.message);
    } else {
      alert('تم تحديث الطلبية بنجاح!');
      hideModal('orderEditModal');
      loadOrders();
    }
  });

  // تحديث الأسعار عند التحميل
  updateEditPrices();
}

// دالة مساعدة للحصول على كود اللون
function getColorHex(colorName) {
  // البحث عن اللون في قائمة الألوان المحفوظة
  if (colorName && window.productColors) {
    const colorObj = window.productColors.find(c => c.name === colorName);
    if (colorObj) {
      return colorObj.hex;
    }
  }
  return '#ccc'; // قيمة افتراضية
}

async function deleteOrder(id) {
  if (!confirm('هل أنت متأكد من حذف الطلب؟')) return;
  const { error } = await supabase.from('orders').delete().eq('id', id);
  if (error) alert('حدث خطأ أثناء الحذف');
  else loadOrders();
}

async function updateOrderStatus(id, status) {
  const { error } = await supabase.from('orders').update({ status }).eq('id', id);
  if (error) alert('حدث خطأ أثناء تحديث الحالة');
  else loadOrders();
}

function showModal(id) {
  const modal = new bootstrap.Modal(document.getElementById(id));
  modal.show();
}
function hideModal(id) {
  const modalEl = document.getElementById(id);
  const modal = bootstrap.Modal.getInstance(modalEl);
  if (modal) modal.hide();
}
function formatDate(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  // ضبط المنطقة الزمنية على الجزائر (GMT+1) والأرقام إنجليزية
  return d.toLocaleString('en', { timeZone: 'Africa/Algiers' });
}

// دالة مساعدة للحصول على لون البادج حسب الحالة
function getStatusBadgeColor(status) {
  switch(status) {
    case 'pending': return 'warning';
    case 'call1': return 'info';
    case 'call2': return 'info';
    case 'call3': return 'info';
    case 'confirmed': return 'success';
    case 'cancelled': return 'danger';
    case 'delivered': return 'success';
    default: return 'secondary';
  }
}

// دالة مساعدة للحصول على نص الحالة
function getStatusLabel(status) {
  switch(status) {
    case 'pending': return 'في انتظار التأكيد ⏳';
    case 'call1': return 'الاتصال الأول ☎️';
    case 'call2': return 'الاتصال الثاني ☎️';
    case 'call3': return 'الاتصال الثالث ☎️';
    case 'confirmed': return 'تم التأكيد ✅';
    case 'cancelled': return 'تم إلغاء الطلبية ❌';
    case 'delivered': return 'وصول الطلبية 🚚';
    default: return 'غير محدد';
  }
}
