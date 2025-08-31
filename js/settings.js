import { supabase } from './server-superbase.js';
import { protectAdminPages } from './auth-guard.js';
import { convertImageToWebP } from './webp-converter.js';

async function saveSettings() {
  try {
    const nameElement = document.getElementById('store-name');
    const headerColorElement = document.getElementById('main-header');
    const btnColorElement = document.getElementById('main-btn');
    const btnTextColorElement = document.getElementById('main-btn-text');
    const textColorElement = document.getElementById('main-text');
    const logoInput = document.getElementById('store-logo');
    
    // عناصر وسائل التواصل الاجتماعي
    const facebookUrlElement = document.getElementById('facebook-url');
    const instagramUrlElement = document.getElementById('instagram-url');
    const whatsappUrlElement = document.getElementById('whatsapp-url');
    const tiktokUrlElement = document.getElementById('tiktok-url');
    
    // عنصر وصف المتجر
    const storeDescriptionElement = document.getElementById('store-description');
    
    // عنصر البيكسل الرئيسي
    const mainPixelElement = document.getElementById('main-pixel');

    // التحقق من وجود العناصر
    if (!nameElement || !headerColorElement || !btnColorElement || !btnTextColorElement || !textColorElement) {
      throw new Error('عناصر النموذج غير موجودة');
    }

    const name = nameElement.value;
    const headercolor = headerColorElement.value;
    const btncolor = btnColorElement.value;
    const btnTextColor = btnTextColorElement.value;
    const textcolor = textColorElement.value;
    
    // روابط وسائل التواصل الاجتماعي
    const facebookUrl = facebookUrlElement ? facebookUrlElement.value.trim() : '';
    const instagramUrl = instagramUrlElement ? instagramUrlElement.value.trim() : '';
    const whatsappUrl = whatsappUrlElement ? whatsappUrlElement.value.trim() : '';
    const tiktokUrl = tiktokUrlElement ? tiktokUrlElement.value.trim() : '';
    
    // وصف المتجر
    const storeDescription = storeDescriptionElement ? storeDescriptionElement.value.trim() : '';
    console.log('وصف المتجر المراد حفظه:', storeDescription);
    
    // البيكسل الرئيسي
    const mainPixel = mainPixelElement ? mainPixelElement.value.trim() : '';
    console.log('البيكسل الرئيسي المختار:', mainPixel);

    // إنشاء كائن JSONB للأزرار
    const buttonColors = {
      backgroundColor: btncolor || '#007bff',
      textColor: btnTextColor || '#ffffff'
    };

    let logoUrl = null;
    
    if (logoInput && logoInput.files.length > 0) {
      const file = logoInput.files[0];
      
      // التحقق من نوع الملف
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('نوع الملف غير مدعوم. يرجى اختيار صورة بصيغة JPG, PNG, GIF, أو WebP');
      }

      // التحقق من حجم الملف (5MB كحد أقصى)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('حجم الملف كبير جداً. الحد الأقصى 5MB');
      }

      // تحويل الصورة إلى WebP
      const webpFile = await convertImageToWebP(file);

      // جلب الصورة القديمة لحذفها
      try {
        const { data: oldSettings } = await supabase
          .from('store_settings')
          .select('logo')
          .eq('id', 1)
          .single();
        
                 if (oldSettings && oldSettings.logo) {
           // استخراج اسم الملف من الرابط
           const oldLogoUrl = oldSettings.logo;
           const urlParts = oldLogoUrl.split('/');
           const oldFileName = urlParts[urlParts.length - 1];
           const fullOldPath = `logo/${oldFileName}`;
           
           console.log('حذف الصورة القديمة:', fullOldPath);
           
           const { error: deleteError } = await supabase.storage
             .from('product-images')
             .remove([fullOldPath]);
          
          if (deleteError) {
            console.warn('فشل في حذف الصورة القديمة:', deleteError);
          } else {
            console.log('تم حذف الصورة القديمة بنجاح');
          }
        }
      } catch (error) {
        console.warn('خطأ في حذف الصورة القديمة:', error);
      }

             // إنشاء اسم فريد للملف باستخدام اسم الملف الأصلي مع timestamp
       const timestamp = Date.now();
       const originalName = webpFile.name.replace('.webp', '');
       const fileName = `logo/${timestamp}_${originalName}.webp`;
       console.log('رفع الملف:', fileName);
       console.log('اسم الملف الأصلي:', webpFile.name);
       console.log('امتداد الملف: webp');

      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(fileName, webpFile, { upsert: true });

      if (error) {
        console.error('خطأ في رفع الملف:', error);
        throw new Error('خطأ أثناء رفع الصورة: ' + error.message);
      }

      console.log('تم رفع الملف بنجاح:', data);
      console.log('اسم الملف المحفوظ في Storage:', fileName);

      const { data: publicUrlData } = supabase
        .storage
        .from('product-images')
        .getPublicUrl(fileName);

             logoUrl = publicUrlData.publicUrl;
       console.log('رابط الصورة العام:', logoUrl);
       console.log('اسم الملف المحفوظ:', fileName);
       
       // التحقق من أن الرابط العام صحيح
       if (!logoUrl || !logoUrl.includes('supabase.co')) {
         throw new Error('فشل في الحصول على رابط الصورة العام');
       }
       
       // التحقق من أن الرابط يحتوي على المسار الصحيح
       if (!logoUrl.includes('/logo/')) {
         console.warn('تحذير: الرابط لا يحتوي على المسار المطلوب /logo/');
       }
    }

    const updateData = {
      name: name.trim(),
      headercolor: headercolor || '#007bff',
      btncolor: buttonColors, // الآن JSONB object مع لون الخلفية ولون النص
      textcolor: textcolor || '#000000',
      store_description: storeDescription || null,
      facebook_url: facebookUrl || null,
      instagram_url: instagramUrl || null,
      whatsapp_url: whatsappUrl || null,
      tiktok_url: tiktokUrl || null,
      main_pixel: mainPixel || null
    };

         if (logoUrl) {
       // التحقق من صحة رابط الصورة
       try {
         const url = new URL(logoUrl);
         if (url.hostname.includes('supabase.co') && url.pathname.includes('/storage/') && url.pathname.includes('/logo/')) {
           updateData.logo = logoUrl;
           console.log('إضافة رابط الصورة للبيانات:', logoUrl);
         } else {
           console.warn('رابط الصورة غير صالح:', logoUrl);
           throw new Error('رابط الصورة غير صالح - يجب أن يحتوي على /logo/ في المسار');
         }
       } catch (error) {
         console.error('خطأ في التحقق من رابط الصورة:', error);
         throw new Error('رابط الصورة غير صالح');
       }
     }

    console.log('بيانات التحديث:', updateData);

    // محاولة التحديث أولاً
    let result = await supabase
      .from('store_settings')
      .update(updateData)
      .eq('id', 1);

    // إذا فشل التحديث، جرب الإدراج
    if (result.error && result.error.code === 'PGRST116') {
      console.log('السجل غير موجود، جاري إنشاء سجل جديد...');
      result = await supabase
        .from('store_settings')
        .insert([{ id: 1, ...updateData }]);
    }
    
    console.log('نتيجة عملية الحفظ:', result);

    if (result.error) {
      console.error('خطأ في حفظ البيانات:', result.error);
      
      // رسائل خطأ أكثر تفصيلاً
      let errorMessage = 'حدث خطأ أثناء الحفظ';
      if (result.error.message) {
        errorMessage += ': ' + result.error.message;
      }
      
      // إذا كان الخطأ يتعلق بالجدول غير الموجود
      if (result.error.code === '42P01') {
        errorMessage = 'جدول الإعدادات غير موجود. يرجى إنشاء الجدول أولاً.';
      }
      
      throw new Error(errorMessage);
    }

    console.log('تم حفظ البيانات بنجاح:', result.data);
    
         // التحقق من أن البيانات تم حفظها بشكل صحيح
     if (result.data && result.data.length > 0) {
       const savedData = result.data[0];
       console.log('البيانات المحفوظة:', savedData);
       
       if (logoUrl && savedData.logo) {
         console.log('رابط الصورة المحفوظ:', savedData.logo);
         console.log('رابط الصورة الأصلي:', logoUrl);
         
         if (savedData.logo !== logoUrl) {
           console.warn('تحذير: رابط الصورة المحفوظ يختلف عن الرابط الأصلي');
           console.warn('الرابط المحفوظ:', savedData.logo);
           console.warn('الرابط الأصلي:', logoUrl);
           
           // محاولة تحديث الرابط إذا كان مختلفاً
           try {
             const updateResult = await supabase
               .from('store_settings')
               .update({ logo: logoUrl })
               .eq('id', 1);
             
             if (updateResult.error) {
               console.error('فشل في تحديث رابط الصورة:', updateResult.error);
             } else {
               console.log('✓ تم تحديث رابط الصورة بنجاح');
             }
           } catch (error) {
             console.error('خطأ في تحديث رابط الصورة:', error);
           }
         } else {
           console.log('✓ رابط الصورة محفوظ بشكل صحيح');
         }
       }
     }
    
    // إظهار رسالة النجاح
    showSuccessMessage();
    
    // التحقق من صحة البيانات المحفوظة
    setTimeout(async () => {
      const isValid = await validateSavedData();
      if (!isValid) {
        console.warn('تحذير: البيانات المحفوظة قد تحتوي على أخطاء');
      } else {
        console.log('✓ تم التحقق من صحة البيانات المحفوظة');
      }
    }, 1000);
    
  } catch (error) {
    console.error('خطأ في حفظ الإعدادات:', error);
    showErrorMessage(error.message);
  }
}

function showSuccessMessage() {
  // محاولة إظهار مودل Bootstrap إذا كان متاحاً
  const successModal = document.getElementById('successModal');
  if (successModal && typeof bootstrap !== 'undefined') {
    const modal = new bootstrap.Modal(successModal);
    modal.show();
  } else {
    // إظهار تنبيه بسيط إذا لم يكن Bootstrap متاحاً
    alert('تم حفظ الإعدادات بنجاح!');
  }
  
  // إخفاء أي تنبيهات سابقة
  const savedAlert = document.getElementById('saved-alert');
  if (savedAlert) {
    savedAlert.classList.add('d-none');
  }
}

function showErrorMessage(message) {
  // محاولة إظهار مودل الخطأ إذا كان متاحاً
  const errorModal = document.getElementById('errorModal');
  if (errorModal && typeof bootstrap !== 'undefined') {
    const modal = new bootstrap.Modal(errorModal);
    const errorMessageElement = errorModal.querySelector('.error-message');
    if (errorMessageElement) {
      errorMessageElement.textContent = message;
    }
    modal.show();
  } else {
    // إظهار تنبيه بسيط إذا لم يكن Bootstrap متاحاً
    alert('خطأ: ' + message);
  }
}

async function previewLogo(input) {
  if (!input || !input.files || !input.files[0]) {
    return;
  }

  const file = input.files[0];
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  
  if (!allowedTypes.includes(file.type)) {
    alert('نوع الملف غير مدعوم. يرجى اختيار صورة بصيغة JPG, PNG, GIF, أو WebP');
    input.value = '';
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    alert('حجم الملف كبير جداً. الحد الأقصى 5MB');
    input.value = '';
    return;
  }

  try {
    // تحويل الصورة إلى WebP للمعاينة
    const webpFile = await convertImageToWebP(file);
    
    const reader = new FileReader();
    reader.onload = e => {
      const previewElement = document.getElementById('logo-preview');
      if (previewElement) {
        previewElement.src = e.target.result;
        previewElement.style.display = 'block';
        console.log('تم تحميل معاينة الصورة');
        console.log('اسم الملف الأصلي:', file.name);
        console.log('اسم الملف المحول:', webpFile.name);
        console.log('نوع الملف المحول:', webpFile.type);
        console.log('حجم الملف المحول:', webpFile.size, 'bytes');
      }
    };
    reader.readAsDataURL(webpFile);
  } catch (error) {
    console.error('خطأ في تحويل الصورة:', error);
    alert('حدث خطأ في معالجة الصورة');
    input.value = '';
  }
}

// دالة لتحديث لون الأزرار مباشرة عند تغيير اللون
function updateButtonColor() {
  const btnColorElement = document.getElementById('main-btn');
  const btnTextColorElement = document.getElementById('main-btn-text');
  if (!btnColorElement || !btnTextColorElement) return;

  const btnColor = btnColorElement.value || '#007bff';
  const btnTextColor = btnTextColorElement.value || '#ffffff';
  
  // إزالة الأنماط السابقة
  removeButtonStyles();
  
  // إضافة الأنماط الجديدة
  const style = document.createElement('style');
  style.setAttribute('data-button-color', 'true');
  style.textContent = `
    .btn-main {
      background: ${btnColor} !important;
      color: ${btnTextColor} !important;
      border-radius: 25px;
      font-weight: bold;
      transition: background 0.2s;
    }
    .btn-main:hover {
      background: ${btnColor} !important;
      color: ${btnTextColor} !important;
      opacity: 0.9;
    }
  `;
  document.head.appendChild(style);
}

function removeButtonStyles() {
  const existingStyles = document.querySelectorAll('style[data-button-color]');
  existingStyles.forEach(style => style.remove());
}

// متغير عام لتخزين بيانات البيكسالات
let pixelsData = [];

// دالة لتحميل البيكسالات من جدول ad_pixels
async function loadPixels() {
  try {
    console.log('بدء تحميل البيكسالات...');
    
    const { data, error } = await supabase
      .from('ad_pixels')
      .select('*')
      .order('id', { ascending: false });

    if (error) {
      console.error('خطأ في جلب البيكسالات:', error);
      return;
    }

    if (!data || data.length === 0) {
      console.log('لا توجد بيكسالات متاحة');
      return;
    }

    console.log('تم جلب البيكسالات:', data);
    
    // عرض تفاصيل كل بيكسل للتشخيص
    data.forEach(pixel => {
      console.log(`البيكسل ${pixel.id}:`, {
        name: pixel.pixel_name,
        pixel_code: pixel.pixel_code,
        pixel_code_type: typeof pixel.pixel_code
      });
    });
    
    // تخزين البيانات محلياً
    pixelsData = data;

    // تعبئة قائمة البيكسالات
    const mainPixelElement = document.getElementById('main-pixel');
    if (mainPixelElement) {
      // إضافة الخيار الافتراضي
      mainPixelElement.innerHTML = '<option value="">اختر البيكسل الرئيسي</option>';
      
      // إضافة البيكسالات
      data.forEach(pixel => {
        const option = document.createElement('option');
        option.value = pixel.id;
        
        // استخراج نوع البيكسل من pixel_code إذا كان متاحاً
        let pixelType = 'غير محدد';
        let pixelCode = '';
        
        // محاولة استخراج البيانات من pixel_code
        if (pixel.pixel_code) {
          try {
            // إذا كان pixel_code نص JSON
            if (typeof pixel.pixel_code === 'string') {
              const parsedCode = JSON.parse(pixel.pixel_code);
              pixelType = parsedCode.type || 'غير محدد';
              pixelCode = parsedCode.code || '';
            }
            // إذا كان pixel_code كائن JavaScript
            else if (typeof pixel.pixel_code === 'object') {
              pixelType = pixel.pixel_code.type || 'غير محدد';
              pixelCode = pixel.pixel_code.code || '';
            }
          } catch (error) {
            console.warn('خطأ في تحليل pixel_code للبيكسل:', pixel.id, error);
            pixelType = 'غير محدد';
            pixelCode = '';
          }
        }
        
        // عرض اسم البيكسل ونوعه
        let displayText = pixel.pixel_name;
        
        if (pixelType && pixelType !== 'غير محدد') {
          displayText += ` (${pixelType})`;
          
          if (pixelCode) {
            // عرض جزء من الكود إذا كان طويلاً
            const shortCode = pixelCode.length > 15 ? 
              pixelCode.substring(0, 15) + '...' : 
              pixelCode;
            displayText += ` - ${shortCode}`;
          }
        } else {
          displayText += ' (غير محدد)';
        }
        
        option.textContent = displayText;
        mainPixelElement.appendChild(option);
      });
    }
  } catch (error) {
    console.error('خطأ في تحميل البيكسالات:', error);
  }
}

// دالة لجلب البيانات السابقة وتعبئة الفورم
async function loadSettings() {
  try {
    console.log('بدء تحميل الإعدادات...');
    
    const { data, error } = await supabase
      .from('store_settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (error) {
      console.error('خطأ في جلب الإعدادات:', error);
      return;
    }

    if (!data) {
      console.log('لا توجد إعدادات محفوظة');
      return;
    }

    console.log('تم جلب الإعدادات:', data);

    // تعبئة النموذج بالبيانات
    const nameElement = document.getElementById('store-name');
    const headerColorElement = document.getElementById('main-header');
    const btnColorElement = document.getElementById('main-btn');
    const btnTextColorElement = document.getElementById('main-btn-text');
    const textColorElement = document.getElementById('main-text');
    const logoPreviewElement = document.getElementById('logo-preview');
    
    // عناصر وسائل التواصل الاجتماعي
    const facebookUrlElement = document.getElementById('facebook-url');
    const instagramUrlElement = document.getElementById('instagram-url');
    const whatsappUrlElement = document.getElementById('whatsapp-url');
    const tiktokUrlElement = document.getElementById('tiktok-url');
    
    // عنصر وصف المتجر
    const storeDescriptionElement = document.getElementById('store-description');
    
    // عنصر البيكسل الرئيسي
    const mainPixelElement = document.getElementById('main-pixel');

    if (nameElement) nameElement.value = data.name || '';
    if (headerColorElement) headerColorElement.value = data.headercolor || '';
    
    // التعامل مع ألوان الأزرار الجديدة
    if (btnColorElement) {
      if (data.btncolor && typeof data.btncolor === 'object') {
        btnColorElement.value = data.btncolor.backgroundColor || '#007bff';
      } else if (typeof data.btncolor === 'string') {
        // للتوافق مع البيانات القديمة
        btnColorElement.value = data.btncolor || '#007bff';
      } else {
        btnColorElement.value = '#007bff';
      }
    }
    
    if (btnTextColorElement) {
      if (data.btncolor && typeof data.btncolor === 'object') {
        btnTextColorElement.value = data.btncolor.textColor || '#ffffff';
      } else {
        btnTextColorElement.value = '#ffffff';
      }
    }
    
    if (textColorElement) textColorElement.value = data.textcolor || '';
    
         if (logoPreviewElement && data.logo) {
       console.log('تحميل رابط الصورة:', data.logo);
       // التحقق من أن الرابط يحتوي على المسار الصحيح
       if (data.logo.includes('/logo/')) {
         logoPreviewElement.src = data.logo;
         logoPreviewElement.style.display = 'block';
         console.log('تم تحميل الصورة بنجاح من المسار الصحيح');
       } else {
         console.warn('رابط الصورة لا يحتوي على المسار المطلوب /logo/');
         logoPreviewElement.style.display = 'none';
       }
         } else if (logoPreviewElement) {
      logoPreviewElement.style.display = 'none';
    }
    
    // تعبئة روابط وسائل التواصل الاجتماعي
    if (facebookUrlElement) facebookUrlElement.value = data.facebook_url || '';
    if (instagramUrlElement) instagramUrlElement.value = data.instagram_url || '';
    if (whatsappUrlElement) whatsappUrlElement.value = data.whatsapp_url || '';
    if (tiktokUrlElement) tiktokUrlElement.value = data.tiktok_url || '';
    
    // تعبئة وصف المتجر
    if (storeDescriptionElement) {
      storeDescriptionElement.value = data.store_description || '';
      console.log('تم تعبئة وصف المتجر:', data.store_description);
    }
    
    // تعبئة البيكسل الرئيسي
    if (mainPixelElement && data.main_pixel) {
      mainPixelElement.value = data.main_pixel;
      console.log('تم تعبئة البيكسل الرئيسي:', data.main_pixel);
      
      // عرض معلومات البيكسل المحفوظ
      setTimeout(() => {
        showPixelInfo(mainPixelElement);
      }, 100);
    }
    
    // تطبيق لون الأزرار
    if (data.btncolor) {
      removeButtonStyles();
      const style = document.createElement('style');
      style.setAttribute('data-button-color', 'true');
      
      let backgroundColor = '#007bff';
      let textColor = '#ffffff';
      
      if (typeof data.btncolor === 'object') {
        backgroundColor = data.btncolor.backgroundColor || '#007bff';
        textColor = data.btncolor.textColor || '#ffffff';
      } else if (typeof data.btncolor === 'string') {
        // للتوافق مع البيانات القديمة
        backgroundColor = data.btncolor;
        textColor = '#ffffff';
      }
      
      style.textContent = `
        .btn-main {
          background: ${backgroundColor} !important;
          color: ${textColor} !important;
          border-radius: 25px;
          font-weight: bold;
          transition: background 0.2s;
        }
        .btn-main:hover {
          background: ${backgroundColor} !important;
          color: ${textColor} !important;
          opacity: 0.9;
        }
        .btn-main:focus {
          background: ${backgroundColor} !important;
          color: ${textColor} !important;
          box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
        }
      `;
      document.head.appendChild(style);
    }
  } catch (error) {
    console.error('خطأ في تحميل الإعدادات:', error);
  }
}

// دالة للتحقق من صحة البيانات المحفوظة
async function validateSavedData() {
  try {
    const { data, error } = await supabase
      .from('store_settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (error || !data) {
      console.error('فشل في التحقق من البيانات المحفوظة:', error);
      return false;
    }

    console.log('البيانات المحفوظة للتحقق:', data);
    
    // التحقق من رابط الصورة
    if (data.logo) {
      if (!data.logo.includes('/logo/')) {
        console.warn('رابط الصورة لا يحتوي على المسار المطلوب /logo/');
        return false;
      }
      
      // التحقق من أن الرابط صالح
      try {
        const url = new URL(data.logo);
        if (!url.hostname.includes('supabase.co')) {
          console.warn('رابط الصورة لا يحتوي على supabase.co');
          return false;
        }
      } catch (error) {
        console.warn('رابط الصورة غير صالح:', error);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('خطأ في التحقق من البيانات المحفوظة:', error);
    return false;
  }
}

// دالة لعرض معلومات البيكسل المختار
function showPixelInfo(selectElement) {
  const pixelInfoDiv = document.getElementById('pixel-info');
  const pixelInfoText = document.getElementById('pixel-info-text');
  
  if (!pixelInfoDiv || !pixelInfoText) return;
  
  const selectedValue = selectElement.value;
  
  if (!selectedValue) {
    pixelInfoDiv.style.display = 'none';
    return;
  }
  
  // البحث عن البيكسل المختار في البيانات المخزنة
  const selectedPixel = pixelsData.find(pixel => pixel.id == selectedValue);
  
  if (selectedPixel) {
    let infoText = `البيكسل: ${selectedPixel.pixel_name}`;
    
    // محاولة استخراج البيانات من pixel_code
    if (selectedPixel.pixel_code) {
      try {
        let pixelType = 'غير محدد';
        let pixelCode = '';
        
        // إذا كان pixel_code نص JSON
        if (typeof selectedPixel.pixel_code === 'string') {
          const parsedCode = JSON.parse(selectedPixel.pixel_code);
          pixelType = parsedCode.type || 'غير محدد';
          pixelCode = parsedCode.code || '';
        }
        // إذا كان pixel_code كائن JavaScript
        else if (typeof selectedPixel.pixel_code === 'object') {
          pixelType = selectedPixel.pixel_code.type || 'غير محدد';
          pixelCode = selectedPixel.pixel_code.code || '';
        }
        
        if (pixelType && pixelType !== 'غير محدد') {
          infoText += ` | النوع: ${pixelType}`;
          
          if (pixelCode) {
            infoText += ` | الكود: ${pixelCode.substring(0, 25)}...`;
          }
        }
      } catch (error) {
        console.warn('خطأ في تحليل pixel_code للبيكسل المختار:', error);
        infoText += ' | النوع: غير محدد';
      }
    }
    
    pixelInfoText.textContent = infoText;
    pixelInfoDiv.style.display = 'block';
  } else {
    pixelInfoDiv.style.display = 'none';
  }
}

// تصدير الدوال للاستخدام العام
window.saveSettings = saveSettings;
window.previewLogo = previewLogo;
window.updateButtonColor = updateButtonColor;
window.showPixelInfo = showPixelInfo;

// استدعاء الدالة عند تحميل الصفحة بعد التحقق من المصادقة
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const isProtected = await protectAdminPages();
    if (isProtected) {
      console.log('تم التحقق من المصادقة، بدء تحميل الإعدادات...');
      await loadPixels(); // تحميل البيكسالات أولاً
      await loadSettings(); // ثم تحميل الإعدادات
    } else {
      console.log('فشل في المصادقة، لن يتم تحميل الإعدادات');
    }
  } catch (error) {
    console.error('خطأ في تحميل الصفحة:', error);
  }
});
