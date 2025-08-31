import { supabase } from './server-superbase.js';
import { protectAdminPages } from './auth-guard.js';
import { convertImageToWebP } from './webp-converter.js';

  const colors = [];
  const sizes = [];
  const offers = [];
  const productImages = []; // مصفوفة للصور المضافة
  let products = [];
  let categories = []; // مصفوفة التصنيفات
  let editProductId = null; // معرف المنتج الجاري تعديله
  let modalCurrentImageIndex = 0; // مؤشر الصورة الحالية في المودال
  let modalProductImages = []; // مصفوفة صور المنتج في المودال

  function renderColors() {
    const container = document.getElementById("colorsList");
    container.innerHTML = "";
    colors.forEach((color, index) => {
      container.innerHTML +=
        `<div class="border rounded p-2 d-flex align-items-center gap-2">
          <span class="color-box" style="background:${color.hex}"></span>
          <span>${color.name}</span>
          <button class="btn btn-sm btn-warning" onclick="editColor(${index})">تعديل</button>
          <button class="btn btn-sm btn-danger" onclick="deleteColor(${index})">حذف</button>
        </div>`;
    });
  }

  function renderSizes() {
    const container = document.getElementById("sizesList");
    container.innerHTML = "";
    sizes.forEach((size, index) => {
      container.innerHTML +=
        `<div class="border rounded p-2 d-flex align-items-center gap-2">
          <span>${size}</span>
          <button class="btn btn-sm btn-warning" onclick="editSize(${index})">تعديل</button>
          <button class="btn btn-sm btn-danger" onclick="deleteSize(${index})">حذف</button>
        </div>`;
    });
  }

  function renderOffers() {
    const container = document.getElementById("offersList");
    container.innerHTML = "";
    offers.forEach((offer, index) => {
      container.innerHTML +=
        `<div class="border rounded p-2 d-flex align-items-center justify-content-between">
          <div><strong>${offer.qty}</strong> قطعة بـ <strong>${offer.price}</strong> دج</div>
          <div>
            <button class="btn btn-sm btn-warning" onclick="editOffer(${index})">تعديل</button>
            <button class="btn btn-sm btn-danger" onclick="deleteOffer(${index})">حذف</button>
          </div>
        </div>`;
    });
  }

  // دوال إدارة الصور
  function renderProductImages() {
    const container = document.getElementById("productImagesList");
    if (!container) return;
    container.innerHTML = "";
    productImages.forEach((image, index) => {
      container.innerHTML +=
        `<div class="border rounded p-2 d-flex align-items-center gap-2">
          <img src="${image.preview}" alt="صورة المنتج" style="width:60px;height:60px;object-fit:cover;border-radius:4px;">
          <span>${image.name}</span>
          <button class="btn btn-sm btn-danger" onclick="deleteProductImage(${index})">حذف</button>
        </div>`;
    });
  }

  async function addProductImage() {
    const imageInput = document.getElementById("productImage");
    if (imageInput && imageInput.files && imageInput.files[0]) {
      const file = imageInput.files[0];
      
      try {
        // تحويل الصورة إلى WebP
        const webpFile = await convertImageToWebP(file);
        
        const reader = new FileReader();
        reader.onload = function(e) {
          productImages.push({
            file: webpFile,
            name: webpFile.name,
            preview: e.target.result
          });
          renderProductImages();
          imageInput.value = ''; // مسح الحقل
        };
        reader.readAsDataURL(webpFile);
      } catch (error) {
        console.error('خطأ في تحويل الصورة:', error);
        alert('حدث خطأ في معالجة الصورة');
      }
    }
  }

  function deleteProductImage(index) {
    productImages.splice(index, 1);
    renderProductImages();
  }

  // دالة تحميل التصنيفات
  async function loadCategories() {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      
      if (error) {
        console.error('خطأ في تحميل التصنيفات:', error);
        return;
      }
      
      categories = data || [];
      renderCategories();
    } catch (error) {
      console.error('خطأ في تحميل التصنيفات:', error);
    }
  }

  // دالة عرض التصنيفات في القائمة المنسدلة
  function renderCategories() {
    const categorySelect = document.getElementById('productCategory');
    if (!categorySelect) return;
    
    // حفظ القيمة المحددة حالياً
    const currentValue = categorySelect.value;
    
    // إعادة ملء القائمة
    categorySelect.innerHTML = '<option value="">اختر التصنيف</option>';
    
    categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category.id;
      option.textContent = category.name;
      categorySelect.appendChild(option);
    });
    
    // إعادة تحديد القيمة السابقة إذا كانت موجودة
    if (currentValue) {
      categorySelect.value = currentValue;
    }
  }

  function addColor() {
    const name = document.getElementById("colorName").value.trim();
    const hex = document.getElementById("colorPicker").value;
    if (name) {
      colors.push({ name, hex });
      document.getElementById("colorName").value = '';
      renderColors();
    }
  }

  function deleteColor(index) {
    colors.splice(index, 1);
    renderColors();
  }

  function editColor(index) {
    const newName = prompt("تعديل اسم اللون:", colors[index].name);
    if (newName) {
      colors[index].name = newName;
      renderColors();
    }
  }

  function addSize() {
    const size = document.getElementById("sizeInput").value.trim();
    if (size) {
      sizes.push(size);
      document.getElementById("sizeInput").value = '';
      renderSizes();
    }
  }

  function deleteSize(index) {
    sizes.splice(index, 1);
    renderSizes();
  }

  function editSize(index) {
    const newSize = prompt("تعديل المقاس:", sizes[index]);
    if (newSize) {
      sizes[index] = newSize;
      renderSizes();
    }
  }

  function addOffer() {
    const qty = parseInt(document.getElementById("offerQty").value);
    const price = parseFloat(document.getElementById("offerPrice").value);
    if (!isNaN(qty) && !isNaN(price) && qty > 0) {
      offers.push({ qty, price });
      document.getElementById("offerQty").value = '';
      document.getElementById("offerPrice").value = '';
      renderOffers();
    }
  }

  function deleteOffer(index) {
    offers.splice(index, 1);
    renderOffers();
  }

  function editOffer(index) {
    const newQty = prompt("تعديل عدد القطع:", offers[index].qty);
    const newPrice = prompt("تعديل السعر الإجمالي:", offers[index].price);
    if (newQty && newPrice && !isNaN(newQty) && !isNaN(newPrice)) {
      offers[index] = { qty: parseInt(newQty), price: parseFloat(newPrice) };
      renderOffers();
    }
  }

  // إظهار/إخفاء نموذج إضافة المنتج
  const showAddProductFormBtn = document.getElementById('showAddProductFormBtn');
  const addProductFormWrapper = document.getElementById('addProductFormWrapper');
  if (showAddProductFormBtn && addProductFormWrapper) {
    showAddProductFormBtn.onclick = function() {
      addProductFormWrapper.style.display = addProductFormWrapper.style.display === 'none' ? 'block' : 'none';
    };
  }

  // دالة لإضافة منتج جديد
  async function publishProduct() {
    const name = document.getElementById('productName').value.trim();
    const descr = document.getElementById('productDesc').value.trim();
    const categoryId = document.getElementById('productCategory').value;
    const price = parseFloat(document.getElementById('price').value) || 0;
    const available = document.getElementById('productAvailable').checked;
    
    if (editProductId) {
      // التحقق من صحة البيانات قبل التعديل
      if (!name || !price || price <= 0) {
        alert('يرجى إدخال اسم المنتج وسعر صحيح');
        return;
      }
      
      // التحقق من صحة معرف التصنيف إذا تم تحديده
      if (categoryId && isNaN(parseInt(categoryId))) {
        alert('يرجى اختيار تصنيف صحيح');
        return;
      }
      
      // تعديل المنتج
      const updateObj = {
        name,
        descr,
        category_id: categoryId ? parseInt(categoryId) : null,
        price,
        available,
        colors: JSON.stringify(colors),
        sizes: JSON.stringify(sizes),
        offers: JSON.stringify(offers),
        pixel: document.getElementById('pixelSelect').value ? parseInt(document.getElementById('pixelSelect').value) : null
      };
      
      // معالجة الصور عند التعديل
      const existingImages = productImages.filter(img => img.url).map(img => img.url);
      const newImages = productImages.filter(img => img.file).map(img => img.file);
      
      // حذف الصور المحذوفة من التخزين
      const originalProduct = products.find(p => p.id === editProductId);
      if (originalProduct && originalProduct.image) {
        try {
          let originalImages = [];
          if (originalProduct.image.startsWith('[')) {
            originalImages = JSON.parse(originalProduct.image);
          } else {
            originalImages = [originalProduct.image];
          }
          
          const deletedImages = originalImages.filter(originalUrl => 
            !productImages.some(img => img.originalUrl === originalUrl)
          );
          
          for (const deletedImageUrl of deletedImages) {
            try {
              const fileName = deletedImageUrl.split('/').pop();
              if (fileName) {
                await supabase.storage
                  .from('product-images')
                  .remove([`products/${fileName}`]);
              }
            } catch (error) {
              console.log('خطأ في حذف الصورة:', error);
            }
          }
        } catch (error) {
          console.log('خطأ في تحليل الصور الأصلية:', error);
        }
      }
      
      // رفع الصور الجديدة فقط
      for (let i = 0; i < newImages.length; i++) {
        const image = newImages[i];
        const filePath = `products/${Date.now()}_${i}_${image.name}`;
        const { data, error } = await supabase.storage
          .from('product-images')
          .upload(filePath, image, { upsert: true });
        if (!error) {
          const { data: publicUrlData } = supabase
            .storage
            .from('product-images')
            .getPublicUrl(filePath);
          existingImages.push(publicUrlData.publicUrl);
        } else {
          alert('خطأ أثناء رفع الصورة: ' + error.message);
          return;
        }
      }
      
      if (existingImages.length > 0) {
        updateObj.image = JSON.stringify(existingImages);
      }
      
      const { error: updateError } = await supabase.from('products').update(updateObj).eq('id', editProductId);
      if (updateError) {
        alert('حدث خطأ أثناء التعديل: ' + updateError.message);
        return;
      }
    } else {
      // إضافة منتج جديد
      // رفع الصور المتعددة
      const imageUrls = [];
      for (let i = 0; i < productImages.length; i++) {
        const image = productImages[i];
        const filePath = `products/${Date.now()}_${i}_${image.name}`;
        const { data, error } = await supabase.storage
          .from('product-images')
          .upload(filePath, image.file, { upsert: true });
        if (!error) {
          const { data: publicUrlData } = supabase
            .storage
            .from('product-images')
            .getPublicUrl(filePath);
          imageUrls.push(publicUrlData.publicUrl);
        } else {
          alert('خطأ أثناء رفع الصورة: ' + error.message);
          return;
        }
      }
      
      if (!name || !price || price <= 0) {
        alert('يرجى إدخال اسم المنتج وسعر صحيح');
        return;
      }
      
      // التحقق من صحة معرف التصنيف إذا تم تحديده
      if (categoryId && isNaN(parseInt(categoryId))) {
        alert('يرجى اختيار تصنيف صحيح');
        return;
      }
      
      const { data: insertData, error: insertError } = await supabase.from('products').insert([
        {
          name,
          descr,
          category_id: categoryId ? parseInt(categoryId) : null,
          price,
          available,
          image: imageUrls.length > 0 ? JSON.stringify(imageUrls) : '',
          colors: JSON.stringify(colors),
          sizes: JSON.stringify(sizes),
          offers: JSON.stringify(offers),
          pixel: document.getElementById('pixelSelect').value ? parseInt(document.getElementById('pixelSelect').value) : null
        }
      ]);
      if (insertError) {
        alert('حدث خطأ أثناء الحفظ: ' + insertError.message);
        return;
      }
    }
    // إعادة تحميل المنتجات
    await fetchProductsFromSupabase();
    // إعادة تعيين النموذج
    document.getElementById('productName').value = '';
    document.getElementById('productDesc').value = '';
    document.getElementById('productCategory').value = '';
    document.getElementById('price').value = '';
    document.getElementById('productAvailable').checked = true;
    document.getElementById('productImage').value = '';
    document.getElementById('pixelSelect').value = '';
    colors.length = 0;
    sizes.length = 0;
    offers.length = 0;
    productImages.length = 0;
    renderColors();
    renderSizes();
    renderOffers();
    renderProductImages();
    addProductFormWrapper.style.display = 'none';
    editProductId = null; // إعادة تعيين معرف التعديل
    // إظهار مودال النجاح
    const modal = new bootstrap.Modal(document.getElementById('successModal'));
    modal.show();
  }

  // جلب المنتجات من supabase
  async function fetchProductsFromSupabase() {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        categories (
          id,
          name
        )
      `)
      .order('id', { ascending: false });
    
    if (!error && data) {
      products = data.map(p => {
        let images = [];
        try {
          if (p.image && p.image.startsWith('[')) {
            images = JSON.parse(p.image);
          }
        } catch(e) {
          console.log('خطأ في تحليل الصور:', e);
        }
        
        return {
          ...p,
          colors: p.colors ? JSON.parse(p.colors) : [],
          sizes: p.sizes ? JSON.parse(p.sizes) : [],
          offers: p.offers ? JSON.parse(p.offers) : [],
          images: images,
          category_name: p.categories ? p.categories.name : null
        };
      });
      renderProductsTable();
    }
  }

  // دالة تعبئة الجدول
  function renderProductsTable() {
    const tbody = document.querySelector('#productsTable tbody');
    tbody.innerHTML = '';
    products.forEach((product, idx) => {
      // معالجة رابط الصورة - عرض الصورة الأولى من الصور المتعددة أو الصورة الرئيسية
      let imageSrc = '';
      if (product.images && product.images.length > 0) {
        imageSrc = product.images[0]; // الصورة الأولى من الصور المتعددة
      } else if (product.image && !product.image.startsWith('[')) {
        imageSrc = product.image; // صورة واحدة
      } else if (product.image && product.image.startsWith('[')) {
        try {
          const images = JSON.parse(product.image);
          if (images.length > 0) {
            imageSrc = images[0];
          }
        } catch (error) {
          console.log('خطأ في تحليل الصور:', error);
        }
      }
      
      if (!imageSrc) {
        imageSrc = 'https://via.placeholder.com/40';
      }
      
      const availabilityBadge = product.available !== false 
        ? '<span class="badge bg-success availability-badge">متوفر</span>' 
        : '<span class="badge bg-danger availability-badge">غير متوفر</span>';
      
      const toggleButton = product.available !== false
        ? `<button class="btn btn-warning btn-sm availability-toggle" onclick="toggleProductAvailability(${idx})" title="إخفاء المنتج">إخفاء</button>`
        : `<button class="btn btn-success btn-sm availability-toggle" onclick="toggleProductAvailability(${idx})" title="إظهار المنتج">إظهار</button>`;
      
      tbody.innerHTML += `
        <tr>
          <td>
            <img src="${imageSrc}" alt="صورة" style="width:40px;height:40px;object-fit:cover;border-radius:6px;" 
                 onerror="this.src='https://via.placeholder.com/40'">
          </td>
          <td>${product.name}</td>
          <td>${product.category_name || 'غير محدد'}</td>
          <td>${product.price}</td>
          <td>
            ${availabilityBadge}
            <br>
            ${toggleButton}
          </td>
          <td><button class="btn btn-info btn-sm" onclick="showProductDetails(${idx})">المزيد</button></td>
          <td>
            <div class="action-buttons-container">
              <button class="btn btn-primary btn-sm" onclick="viewProduct(${product.id})" 
                      title="عرض المنتج في المتجر" data-bs-toggle="tooltip" data-bs-placement="top">
                <i class="fas fa-eye"></i> عرض المنتج
              </button>
              <button class="btn btn-warning btn-sm" onclick="editProduct(${idx})" 
                      title="تعديل المنتج" data-bs-toggle="tooltip" data-bs-placement="top">
                <i class="fas fa-edit"></i> تعديل
              </button>
              <button class="btn btn-danger btn-sm" onclick="deleteProduct(${idx})" 
                      title="حذف المنتج" data-bs-toggle="tooltip" data-bs-placement="top">
                <i class="fas fa-trash"></i> حذف
              </button>
            </div>
          </td>
        </tr>
      `;
    });
    
    // تهيئة tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
      return new bootstrap.Tooltip(tooltipTriggerEl);
    });
  }

  // دالة عرض التفاصيل في مودال
  function showProductDetails(idx) {
    const product = products[idx];
    
    // جمع جميع الصور
    let allImages = [];
    if (product.images && product.images.length > 0) {
      allImages = product.images;
    } else if (product.image && product.image.startsWith('[')) {
      try {
        allImages = JSON.parse(product.image);
      } catch (error) {
        console.log('خطأ في تحليل الصور:', error);
      }
    } else if (product.image && !product.image.startsWith('[')) {
      allImages = [product.image];
    }
    
    // الصورة الافتراضية إذا لم توجد صور
    if (allImages.length === 0) {
      allImages = ['https://via.placeholder.com/120'];
    }
    
    modalProductImages = allImages;
    modalCurrentImageIndex = 0;
    
    // إنشاء معرض الصور المتقدم
    let imagesGallery = '';
    if (allImages.length > 1) {
      imagesGallery = '<div class="mt-3"><strong>معرض الصور:</strong><div class="d-flex gap-2 mt-2 flex-wrap">';
      allImages.forEach((img, index) => {
        const isActive = index === 0;
        const isMobile = window.innerWidth <= 768;
        const size = isMobile ? '50px' : '60px';
        imagesGallery += `<div class="thumbnail-container" style="width:${size};height:${size};cursor:pointer;border:${isActive ? '3px' : '2px'} solid ${isActive ? '#007bff' : '#ddd'};border-radius:8px;overflow:hidden;transform:${isActive ? 'scale(1.05)' : 'scale(1)'};" onclick="changeModalImage(${index})">
          <img src="${img}" alt="صورة ${index + 1}" style="width:100%;height:100%;object-fit:cover;" onerror="this.src='https://via.placeholder.com/60'">
        </div>`;
      });
      imagesGallery += '</div></div>';
    }
    
    const isMobile = window.innerWidth <= 768;
    const imageSize = isMobile ? '150px' : '200px';
    const containerMinWidth = isMobile ? '170px' : '220px';
    
    let html = `<div class="text-center mb-3">
      <div class="position-relative d-inline-block" style="min-width: ${containerMinWidth};">
        <img id="modal-main-image" src="${allImages[0]}" alt="صورة المنتج" style="width:${imageSize};height:${imageSize};object-fit:cover;border-radius:10px;" onerror="this.src='https://via.placeholder.com/200'">
        ${allImages.length > 1 ? `
          <button class="image-navigation prev" onclick="changeModalImage(${(0 - 1 + allImages.length) % allImages.length})" style="left:10px;">‹</button>
          <button class="image-navigation next" onclick="changeModalImage(${(0 + 1) % allImages.length})" style="right:10px;">›</button>
          <div class="image-counter">1 / ${allImages.length}</div>
          <button class="image-zoom-btn" onclick="openModalFullscreen()" title="عرض بالحجم الكامل">🔍</button>
        ` : ''}
      </div>
      <h5 class="mt-2">${product.name}</h5>
      <p>${product.descr || ''}</p>
      <p><strong>السعر:</strong> ${product.price} دج</p>
      <p><strong>الحالة:</strong> ${product.available !== false ? '<span class="badge bg-success">متوفر</span>' : '<span class="badge bg-danger">غير متوفر</span>'}</p>
      ${imagesGallery}
    </div>`;
    
    if (product.colors && product.colors.length) {
      html += '<div><strong>الألوان:</strong> ' + product.colors.map(c => `<span class="color-box" style="background:${c.hex}" title="${c.name}"></span>`).join(' ') + '</div>';
    }
    if (product.sizes && product.sizes.length) {
      html += '<div class="mt-2"><strong>المقاسات:</strong> ' + product.sizes.join(', ') + '</div>';
    }
    if (product.offers && product.offers.length) {
      html += '<div class="mt-2"><strong>العروض الخاصة:</strong><ul>' + product.offers.map(o => `<li>${o.qty} قطعة بـ ${o.price} دج</li>`).join('') + '</ul></div>';
    }
    if (product.pixel) {
      html += `<div class="mt-2"><strong>البيكسل:</strong> ${product.pixel}</div>`;
    }
    
    document.getElementById('productDetailsBody').innerHTML = html;
    const modal = new bootstrap.Modal(document.getElementById('productDetailsModal'));
    modal.show();
  }
  
  // دالة تغيير الصورة في المودال
  function changeModalImage(index) {
    if (index < 0 || index >= modalProductImages.length) return;
    
    modalCurrentImageIndex = index;
    const mainImage = document.getElementById('modal-main-image');
    const counter = document.querySelector('.image-counter');
    
    if (mainImage) {
      mainImage.src = modalProductImages[index];
    }
    
    if (counter) {
      counter.textContent = `${index + 1} / ${modalProductImages.length}`;
    }
    
    // تحديث تحديد الصور المصغرة
    const thumbnails = document.querySelectorAll('.thumbnail-container');
    thumbnails.forEach((thumb, idx) => {
      if (idx === index) {
        thumb.style.borderColor = '#007bff';
        thumb.style.borderWidth = '3px';
        thumb.style.transform = 'scale(1.05)';
      } else {
        thumb.style.borderColor = '#ddd';
        thumb.style.borderWidth = '2px';
        thumb.style.transform = 'scale(1)';
      }
    });
    
    // تحديث أزرار التنقل
    const prevBtn = document.querySelector('.image-navigation.prev');
    const nextBtn = document.querySelector('.image-navigation.next');
    const zoomBtn = document.querySelector('.image-zoom-btn');
    
    if (prevBtn) {
      prevBtn.onclick = () => changeModalImage((index - 1 + modalProductImages.length) % modalProductImages.length);
      prevBtn.style.pointerEvents = 'auto';
      prevBtn.style.touchAction = 'manipulation';
    }
    if (nextBtn) {
      nextBtn.onclick = () => changeModalImage((index + 1) % modalProductImages.length);
      nextBtn.style.pointerEvents = 'auto';
      nextBtn.style.touchAction = 'manipulation';
    }
    if (zoomBtn) {
      zoomBtn.style.pointerEvents = 'auto';
      zoomBtn.style.touchAction = 'manipulation';
    }
    
    // تحسين الاستجابة للأجهزة المحمولة
    if (window.innerWidth <= 768) {
      if (prevBtn) {
        prevBtn.style.width = '35px';
        prevBtn.style.height = '35px';
        prevBtn.style.fontSize = '16px';
      }
      if (nextBtn) {
        nextBtn.style.width = '35px';
        nextBtn.style.height = '35px';
        nextBtn.style.fontSize = '16px';
      }
      if (zoomBtn) {
        zoomBtn.style.width = '30px';
        zoomBtn.style.height = '30px';
        zoomBtn.style.fontSize = '12px';
      }
    }
    
    // تحسين الاستجابة للأجهزة المحمولة
    if (window.innerWidth <= 768) {
      const counter = document.querySelector('.image-counter');
      if (counter) {
        counter.style.fontSize = '10px';
        counter.style.padding = '3px 8px';
      }
    }
    
    // تحسين الاستجابة للأجهزة المحمولة
    if (window.innerWidth <= 768) {
      const thumbnails = document.querySelectorAll('.thumbnail-container');
      thumbnails.forEach(thumb => {
        thumb.style.width = '50px';
        thumb.style.height = '50px';
      });
    }
  }
  
  // دالة فتح العرض بالحجم الكامل للمودال
  function openModalFullscreen() {
    const modal = document.getElementById('fullscreen-modal');
    const fullscreenImage = document.getElementById('fullscreen-image');
    const closeBtn = document.getElementById('fullscreen-close');
    const prevBtn = document.getElementById('fullscreen-prev');
    const nextBtn = document.getElementById('fullscreen-next');
    
    if (!modal || !fullscreenImage) return;
    
    fullscreenImage.src = modalProductImages[modalCurrentImageIndex];
    modal.style.display = 'flex';
    
    // إضافة أحداث النقر
    closeBtn.onclick = closeModalFullscreen;
    prevBtn.onclick = () => {
      modalCurrentImageIndex = (modalCurrentImageIndex - 1 + modalProductImages.length) % modalProductImages.length;
      fullscreenImage.src = modalProductImages[modalCurrentImageIndex];
    };
    nextBtn.onclick = () => {
      modalCurrentImageIndex = (modalCurrentImageIndex + 1) % modalProductImages.length;
      fullscreenImage.src = modalProductImages[modalCurrentImageIndex];
    };
    
    // تحسين الاستجابة للأجهزة المحمولة
    closeBtn.style.pointerEvents = 'auto';
    prevBtn.style.pointerEvents = 'auto';
    nextBtn.style.pointerEvents = 'auto';
    closeBtn.style.touchAction = 'manipulation';
    prevBtn.style.touchAction = 'manipulation';
    nextBtn.style.touchAction = 'manipulation';
    
    // تحسين الاستجابة للأجهزة المحمولة
    if (window.innerWidth <= 768) {
      closeBtn.style.width = '35px';
      closeBtn.style.height = '35px';
      closeBtn.style.fontSize = '25px';
      prevBtn.style.width = '40px';
      prevBtn.style.height = '40px';
      prevBtn.style.fontSize = '16px';
      nextBtn.style.width = '40px';
      nextBtn.style.height = '40px';
      nextBtn.style.fontSize = '16px';
    }
    
    // إغلاق بالنقر خارج الصورة
    modal.onclick = function(e) {
      if (e.target === modal) {
        closeModalFullscreen();
      }
    };
    
    // إضافة أحداث لوحة المفاتيح
    document.addEventListener('keydown', handleModalKeyboardNavigation);
  }
  
  // دالة إغلاق العرض بالحجم الكامل للمودال
  function closeModalFullscreen() {
    const modal = document.getElementById('fullscreen-modal');
    if (modal) {
      modal.style.display = 'none';
    }
    document.removeEventListener('keydown', handleModalKeyboardNavigation);
  }
  
  // دالة التعامل مع التنقل بلوحة المفاتيح للمودال
  function handleModalKeyboardNavigation(e) {
    if (modalProductImages.length <= 1) return;
    
    switch(e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        modalCurrentImageIndex = (modalCurrentImageIndex - 1 + modalProductImages.length) % modalProductImages.length;
        document.getElementById('fullscreen-image').src = modalProductImages[modalCurrentImageIndex];
        break;
      case 'ArrowRight':
        e.preventDefault();
        modalCurrentImageIndex = (modalCurrentImageIndex + 1) % modalProductImages.length;
        document.getElementById('fullscreen-image').src = modalProductImages[modalCurrentImageIndex];
        break;
      case 'Escape':
        closeModalFullscreen();
        break;
    }
  }

  // دالة تبديل حالة التوفر
  async function toggleProductAvailability(idx) {
    const product = products[idx];
    const newAvailability = !product.available;
    
    const { error } = await supabase
      .from('products')
      .update({ available: newAvailability })
      .eq('id', product.id);
    
    if (error) {
      alert('حدث خطأ أثناء تحديث حالة التوفر: ' + error.message);
      return;
    }
    
    // تحديث المصفوفة المحلية
    products[idx].available = newAvailability;
    renderProductsTable();
  }

  // دالة حذف المنتج
  async function deleteProduct(idx) {
    if (confirm('هل أنت متأكد من حذف المنتج؟')) {
      const product = products[idx];
      if (product.id) {
        // حذف الصور من التخزين إذا وجدت
        if (product.image) {
          try {
            if (product.image.startsWith('[')) {
              const images = JSON.parse(product.image);
              if (images && images.length > 0) {
                for (const imageUrl of images) {
                  try {
                    // استخراج اسم الملف من الرابط
                    const fileName = imageUrl.split('/').pop();
                    if (fileName) {
                      await supabase.storage
                        .from('product-images')
                        .remove([`products/${fileName}`]);
                    }
                  } catch (error) {
                    console.log('خطأ في حذف الصورة:', error);
                  }
                }
              }
            } else {
              // صورة واحدة
              try {
                const fileName = product.image.split('/').pop();
                if (fileName) {
                  await supabase.storage
                    .from('product-images')
                    .remove([`products/${fileName}`]);
                }
              } catch (error) {
                console.log('خطأ في حذف الصورة:', error);
              }
            }
          } catch (error) {
            console.log('خطأ في تحليل الصور:', error);
          }
        }
        
        const { error } = await supabase.from('products').delete().eq('id', product.id);
        if (error) {
          alert('حدث خطأ أثناء الحذف: ' + error.message);
          return;
        }
      }
      products.splice(idx, 1);
      renderProductsTable();
    }
  }

  // دالة تعديل المنتج (بسيطة: تعبئة النموذج بالقيم)
  function editProduct(idx) {
    const product = products[idx];
    document.getElementById('productName').value = product.name;
    document.getElementById('productDesc').value = product.descr;
    document.getElementById('productCategory').value = product.category_id || '';
    document.getElementById('price').value = product.price;
    document.getElementById('productAvailable').checked = product.available !== false;
    document.getElementById('pixelSelect').value = product.pixel || '';
    colors.length = 0; sizes.length = 0; offers.length = 0; productImages.length = 0;
    if (product.colors) product.colors.forEach(c => colors.push({...c}));
    if (product.sizes) product.sizes.forEach(s => sizes.push(s));
    if (product.offers) product.offers.forEach(o => offers.push({...o}));
    if (product.images && product.images.length > 0) {
      product.images.forEach((imageUrl, index) => {
        productImages.push({
          file: null, // لا نحتاج للفايل عند التعديل
          name: `صورة ${index + 1}`,
          preview: imageUrl,
          url: imageUrl,
          originalUrl: imageUrl // حفظ الرابط الأصلي لتتبع الصور المحذوفة
        });
      });
    } else if (product.image && !product.image.startsWith('[')) {
      // إذا كان هناك صورة واحدة فقط (ليست JSON)
      productImages.push({
        file: null,
        name: 'صورة المنتج',
        preview: product.image,
        url: product.image,
        originalUrl: product.image
      });
    } else if (product.image && product.image.startsWith('[')) {
      // إذا كان هناك صور متعددة مخزنة كـ JSON
      try {
        const images = JSON.parse(product.image);
        images.forEach((imageUrl, index) => {
          productImages.push({
            file: null,
            name: `صورة ${index + 1}`,
            preview: imageUrl,
            url: imageUrl,
            originalUrl: imageUrl
          });
        });
      } catch (error) {
        console.log('خطأ في تحليل الصور:', error);
      }
    }
    renderColors();
    renderSizes();
    renderOffers();
    renderProductImages();
    addProductFormWrapper.style.display = 'block';
    editProductId = product.id; // حفظ معرف المنتج الجاري تعديله
  }

  // جلب قائمة البيكسلات من جدول ad_pixels
  async function fetchPixels() {
    const select = document.getElementById('pixelSelect');
    if (!select) return;
    select.innerHTML = '<option value="">اختر البيكسل</option>';
    const { data, error } = await supabase.from('ad_pixels').select('*');
    if (!error && data) {
      data.forEach(pixel => {
        select.innerHTML += `<option value="${pixel.id}">${pixel.pixel_name}</option>`;
      });
    }
  }

  // عند تحميل الصفحة، التحقق من المصادقة ثم جلب البيانات
  window.onload = async function() {
    const isProtected = await protectAdminPages();
    if (isProtected) {
      console.log('تم التحقق من المصادقة، بدء تحميل البيانات...');
      if (addProductFormWrapper) addProductFormWrapper.style.display = 'none';
      fetchProductsFromSupabase();
      fetchPixels();
      loadCategories(); // تحميل التصنيفات
    } else {
      console.log('فشل في المصادقة، لن يتم تحميل البيانات');
    }
  };
window.addColor = addColor;
window.deleteColor = deleteColor;
window.editColor = editColor;
window.addSize = addSize;
window.deleteSize = deleteSize;
window.editSize = editSize;
window.addOffer = addOffer;
window.deleteOffer = deleteOffer;
window.editOffer = editOffer;
window.addProductImage = addProductImage;
window.deleteProductImage = deleteProductImage;
window.publishProduct = publishProduct;
window.showProductDetails = showProductDetails;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.changeModalImage = changeModalImage;
window.openModalFullscreen = openModalFullscreen;
window.closeModalFullscreen = closeModalFullscreen;
window.handleModalKeyboardNavigation = handleModalKeyboardNavigation;
window.toggleProductAvailability = toggleProductAvailability;
window.viewProduct = viewProduct;

// دالة عرض المنتج في المتجر
function viewProduct(productId) {
  // فتح صفحة المنتج في المتجر في نافذة جديدة
  window.open(`product.html?id=${productId}`, '_blank');
}
