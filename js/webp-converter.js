// دالة تحويل الصورة إلى WebP مع الحفاظ على الجودة
export async function convertToWebP(file) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = function() {
      // الحفاظ على الأبعاد الأصلية
      canvas.width = img.width;
      canvas.height = img.height;
      
      // رسم الصورة على الكانفاس
      ctx.drawImage(img, 0, 0);
      
      // تحويل إلى WebP مع جودة 100%
      canvas.toBlob((blob) => {
        if (blob) {
          // إنشاء ملف جديد باسم WebP
          const originalName = file.name;
          const nameWithoutExt = originalName.substring(0, originalName.lastIndexOf('.'));
          const webpFile = new File([blob], `${nameWithoutExt}.webp`, {
            type: 'image/webp',
            lastModified: Date.now()
          });
          resolve(webpFile);
        } else {
          reject(new Error('فشل في تحويل الصورة إلى WebP'));
        }
      }, 'image/webp', 1.0); // جودة 100%
    };
    
    img.onerror = function() {
      reject(new Error('فشل في تحميل الصورة'));
    };
    
    img.src = URL.createObjectURL(file);
  });
}

// دالة للتحقق من دعم WebP في المتصفح
export function isWebPSupported() {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
}

// دالة تحويل الصورة مع التحقق من الدعم
export async function convertImageToWebP(file) {
  if (!isWebPSupported()) {
    console.warn('WebP غير مدعوم في هذا المتصفح، سيتم استخدام الصورة الأصلية');
    return file;
  }
  
  try {
    return await convertToWebP(file);
  } catch (error) {
    console.error('خطأ في تحويل الصورة إلى WebP:', error);
    return file; // إرجاع الملف الأصلي في حالة الفشل
  }
}
