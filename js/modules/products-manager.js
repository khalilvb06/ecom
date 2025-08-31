// مدير المنتجات المحسن
import { supabaseService } from '../services/supabase-service.js';
import { stateService } from '../services/state-service.js';
import { uiService } from '../services/ui-service.js';
import { cacheManager } from '../utils/cache.js';
import { errorHandler } from '../utils/errors.js';

export class ProductsManager {
  constructor() {
    this.filters = {
      category: '',
      price: '',
      search: '',
      sort: 'newest'
    };
    
    this.pagination = {
      currentPage: 1,
      itemsPerPage: 12,
      totalItems: 0,
      totalPages: 0
    };

    this.renderQueue = [];
    this.isRendering = false;
    this.searchDebounceTimer = null;
    
    this.setupEventListeners();
  }

  // إعداد مستمعي الأحداث
  setupEventListeners() {
    // الاشتراك في تغييرات الحالة
    stateService.subscribe('products', (products) => {
      this.handleProductsChange(products);
    });

    stateService.subscribe('filters', (filters) => {
      this.filters = { ...filters };
      this.applyFilters();
    });

    // أحداث البحث
    document.addEventListener('input', (e) => {
      if (e.target.matches('#search-input, #search-modal-input')) {
        this.handleSearchInput(e.target.value);
      }
    });

    // أحداث الفلترة
    document.addEventListener('change', (e) => {
      if (e.target.matches('#category-filter')) {
        this.setFilter('category', e.target.value);
      } else if (e.target.matches('#price-filter')) {
        this.setFilter('price', e.target.value);
      } else if (e.target.matches('#sort-filter')) {
        this.setFilter('sort', e.target.value);
      }
    });

    // أحداث مسح الفلاتر
    document.addEventListener('click', (e) => {
      if (e.target.matches('#clear-filters, .clear-filters')) {
        this.clearFilters();
      }
    });
  }

  // تحميل المنتجات
  async loadProducts(options = {}) {
    const { useCache = true, showLoading = true } = options;

    if (showLoading) {
      uiService.showLoading('products-list', {
        text: 'جاري تحميل المنتجات...',
        overlay: true
      });
    }

    try {
      const result = await supabaseService.getProducts({ useCache });
      
      if (result.error) {
        throw new Error(result.error.message);
      }

      const products = result.data || [];
      
      // فلترة المنتجات المتوفرة فقط
      const availableProducts = products.filter(product => product.available !== false);
      
      stateService.setState({ products: availableProducts }, 'load-products');
      
      this.pagination.totalItems = availableProducts.length;
      this.pagination.totalPages = Math.ceil(this.pagination.totalItems / this.pagination.itemsPerPage);
      
      return availableProducts;
    } catch (error) {
      errorHandler.handleError(error, 'products-load');
      uiService.showNotification('حدث خطأ في تحميل المنتجات', 'danger');
      return [];
    } finally {
      if (showLoading) {
        uiService.hideLoading('products-list');
      }
    }
  }

  // تحميل منتج محدد
  async loadProduct(productId, options = {}) {
    const { useCache = true } = options;

    try {
      const result = await supabaseService.getProduct(productId, { useCache });
      
      if (result.error) {
        throw new Error(result.error.message);
      }

      return result.data;
    } catch (error) {
      errorHandler.handleError(error, 'product-load', { productId });
      return null;
    }
  }

  // معالجة البحث
  handleSearchInput(searchTerm) {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }

    this.searchDebounceTimer = setTimeout(() => {
      this.setFilter('search', searchTerm.trim());
    }, 300);
  }

  // تعيين فلتر
  setFilter(key, value) {
    stateService.setFilter(key, value);
  }

  // مسح جميع الفلاتر
  clearFilters() {
    stateService.clearFilters();
    
    // مسح حقول الإدخال
    const searchInputs = document.querySelectorAll('#search-input, #search-modal-input');
    searchInputs.forEach(input => input.value = '');
    
    const filterSelects = document.querySelectorAll('#category-filter, #price-filter, #sort-filter');
    filterSelects.forEach(select => {
      if (select.id === 'sort-filter') {
        select.value = 'newest';
      } else {
        select.value = '';
      }
    });
  }

  // تطبيق الفلاتر
  async applyFilters() {
    if (this.isRendering) return;
    
    const products = stateService.getState('products');
    if (!products || products.length === 0) return;

    let filteredProducts = [...products];

    // فلترة بالبحث
    if (this.filters.search) {
      const searchTerm = this.filters.search.toLowerCase();
      filteredProducts = filteredProducts.filter(product => 
        product.name.toLowerCase().includes(searchTerm) ||
        (product.descr && product.descr.toLowerCase().includes(searchTerm))
      );
    }

    // فلترة بالتصنيف
    if (this.filters.category) {
      filteredProducts = filteredProducts.filter(product => 
        product.category_id == this.filters.category
      );
    }

    // فلترة بالسعر
    if (this.filters.price) {
      filteredProducts = this.filterByPrice(filteredProducts, this.filters.price);
    }

    // الترتيب
    filteredProducts = this.sortProducts(filteredProducts, this.filters.sort);

    // تحديث الصفحة الحالية إذا لزم الأمر
    this.pagination.totalItems = filteredProducts.length;
    this.pagination.totalPages = Math.ceil(this.pagination.totalItems / this.pagination.itemsPerPage);
    
    if (this.pagination.currentPage > this.pagination.totalPages) {
      this.pagination.currentPage = Math.max(1, this.pagination.totalPages);
    }

    // عرض المنتجات المفلترة
    await this.renderProducts(filteredProducts);
    this.updateFilterResults(filteredProducts.length);
  }

  // فلترة بالسعر
  filterByPrice(products, priceRange) {
    if (!priceRange) return products;

    if (priceRange === '10000+') {
      return products.filter(product => Number(product.price) >= 10000);
    }

    const [min, max] = priceRange.split('-').map(Number);
    return products.filter(product => {
      const price = Number(product.price);
      return price >= min && price <= max;
    });
  }

  // ترتيب المنتجات
  sortProducts(products, sortBy) {
    const sortedProducts = [...products];
    
    switch (sortBy) {
      case 'newest':
        return sortedProducts.sort((a, b) => b.id - a.id);
      case 'oldest':
        return sortedProducts.sort((a, b) => a.id - b.id);
      case 'price-low':
        return sortedProducts.sort((a, b) => Number(a.price) - Number(b.price));
      case 'price-high':
        return sortedProducts.sort((a, b) => Number(b.price) - Number(a.price));
      case 'name-asc':
        return sortedProducts.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
      case 'name-desc':
        return sortedProducts.sort((a, b) => b.name.localeCompare(a.name, 'ar'));
      default:
        return sortedProducts;
    }
  }

  // عرض المنتجات
  async renderProducts(products) {
    if (this.isRendering) {
      this.renderQueue.push(() => this.renderProducts(products));
      return;
    }

    this.isRendering = true;

    try {
      const container = document.getElementById('products-list');
      if (!container) return;

      if (!products || products.length === 0) {
        container.innerHTML = '<div class="col-12"><div class="alert alert-info text-center">لا توجد منتجات مطابقة للبحث</div></div>';
        return;
      }

      // حساب المنتجات للصفحة الحالية
      const startIndex = (this.pagination.currentPage - 1) * this.pagination.itemsPerPage;
      const endIndex = startIndex + this.pagination.itemsPerPage;
      const pageProducts = products.slice(startIndex, endIndex);

      // إنشاء fragment للأداء الأفضل
      const fragment = document.createDocumentFragment();

      for (const product of pageProducts) {
        const productElement = await this.createProductCard(product);
        fragment.appendChild(productElement);
      }

      // تحديث DOM مرة واحدة
      container.innerHTML = '';
      container.appendChild(fragment);

      // إعداد lazy loading للصور
      uiService.setupLazyLoading(container);

      // عرض pagination إذا لزم الأمر
      this.renderPagination();

    } catch (error) {
      errorHandler.handleError(error, 'products-render');
    } finally {
      this.isRendering = false;
      
      // تنفيذ العمليات المؤجلة
      if (this.renderQueue.length > 0) {
        const nextRender = this.renderQueue.shift();
        setTimeout(nextRender, 0);
      }
    }
  }

  // إنشاء بطاقة منتج
  async createProductCard(product) {
    const div = document.createElement('div');
    div.className = 'col-lg-4 col-md-6 col-sm-6 col-6 d-flex align-items-stretch product-card';
    div.dataset.name = product.name.toLowerCase();
    div.dataset.price = product.price;

    const image = this.getProductImage(product);
    const description = this.getProductDescription(product);
    const offers = this.getProductOffers(product);

    div.innerHTML = `
      <div class="card h-100 w-100" style="cursor: pointer;" onclick="window.location.href='product.html?id=${product.id}'">
        <div class="product-image-wrapper">
          <img data-src="${image}" class="card-img-top" alt="${product.name}" 
               onerror="this.src='https://via.placeholder.com/300x200?text=خطأ+في+التحميل'"
               src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='200' viewBox='0 0 300 200'%3E%3Crect width='300' height='200' fill='%23f8f9fa'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23666'%3Eجاري التحميل...%3C/text%3E%3C/svg%3E">
        </div>
        <div class="card-body d-flex flex-column">
          <h5 class="card-title">${product.name}</h5>
          <p class="card-text flex-grow-1">${description}</p>
          <div class="mb-2"><strong>السعر:</strong> ${product.price} دج</div>
          ${offers}
          <a href="product.html?id=${product.id}" class="btn btn-main mt-2" onclick="event.stopPropagation()">اطلب الآن</a>
        </div>
      </div>
    `;

    return div;
  }

  // الحصول على صورة المنتج
  getProductImage(product) {
    let image = 'https://via.placeholder.com/300x200?text=لا+توجد+صورة';
    
    try {
      if (product.image && product.image.startsWith('[')) {
        const images = JSON.parse(product.image);
        if (images.length > 0) {
          image = images[0];
        }
      } else if (product.image && !product.image.startsWith('[')) {
        image = product.image;
      }
    } catch (e) {
      if (product.image && !product.image.startsWith('[')) {
        image = product.image;
      }
    }
    
    return image;
  }

  // الحصول على وصف المنتج
  getProductDescription(product) {
    if (!product.descr) return '';
    return product.descr.length > 50 ? product.descr.substring(0, 50) + '...' : product.descr;
  }

  // الحصول على عروض المنتج
  getProductOffers(product) {
    try {
      const offers = product.offers ? JSON.parse(product.offers) : [];
      if (offers.length > 0) {
        return `<div class="mt-2"><span class="badge bg-warning text-dark">عرض خاص: ${offers[0].qty} قطعة بـ ${offers[0].price} دج</span></div>`;
      }
    } catch (e) {
      // تجاهل أخطاء تحليل JSON
    }
    return '';
  }

  // عرض pagination
  renderPagination() {
    if (this.pagination.totalPages <= 1) return;

    const paginationContainer = document.getElementById('pagination-container');
    if (!paginationContainer) return;

    let paginationHtml = '<nav><ul class="pagination justify-content-center">';
    
    // زر السابق
    if (this.pagination.currentPage > 1) {
      paginationHtml += `
        <li class="page-item">
          <a class="page-link" href="#" onclick="productsManager.goToPage(${this.pagination.currentPage - 1})">السابق</a>
        </li>
      `;
    }

    // أرقام الصفحات
    const startPage = Math.max(1, this.pagination.currentPage - 2);
    const endPage = Math.min(this.pagination.totalPages, this.pagination.currentPage + 2);

    for (let i = startPage; i <= endPage; i++) {
      paginationHtml += `
        <li class="page-item ${i === this.pagination.currentPage ? 'active' : ''}">
          <a class="page-link" href="#" onclick="productsManager.goToPage(${i})">${i}</a>
        </li>
      `;
    }

    // زر التالي
    if (this.pagination.currentPage < this.pagination.totalPages) {
      paginationHtml += `
        <li class="page-item">
          <a class="page-link" href="#" onclick="productsManager.goToPage(${this.pagination.currentPage + 1})">التالي</a>
        </li>
      `;
    }

    paginationHtml += '</ul></nav>';
    paginationContainer.innerHTML = paginationHtml;
  }

  // الانتقال لصفحة محددة
  async goToPage(pageNumber) {
    if (pageNumber < 1 || pageNumber > this.pagination.totalPages) return;
    
    this.pagination.currentPage = pageNumber;
    
    // التمرير لأعلى
    document.getElementById('products-list')?.scrollIntoView({ behavior: 'smooth' });
    
    // إعادة تطبيق الفلاتر
    await this.applyFilters();
  }

  // تحديث نتائج الفلترة
  updateFilterResults(count) {
    const resultsElement = document.getElementById('results-count');
    if (resultsElement) {
      resultsElement.innerHTML = `تم العثور على <strong>${count}</strong> منتج`;
    }

    const searchResults = document.getElementById('search-results');
    if (searchResults) {
      if (this.filters.search || this.filters.category || this.filters.price) {
        searchResults.style.display = 'block';
      } else {
        searchResults.style.display = 'none';
      }
    }
  }

  // معالجة تغييرات المنتجات
  handleProductsChange(products) {
    this.pagination.totalItems = products.length;
    this.pagination.totalPages = Math.ceil(this.pagination.totalItems / this.pagination.itemsPerPage);
    this.pagination.currentPage = 1;
    
    this.applyFilters();
  }

  // فلترة بالتصنيف
  filterByCategory(categoryId, categoryName) {
    this.setFilter('category', categoryId);
    
    // التمرير للمنتجات
    const productsSection = document.getElementById('products-list');
    if (productsSection) {
      productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // تأثير بصري
    this.highlightCategorySelection();
  }

  // تمييز اختيار التصنيف
  highlightCategorySelection() {
    const categoryCards = document.querySelectorAll('.card');
    categoryCards.forEach(card => {
      card.classList.remove('category-selected');
    });

    // إضافة تأثير للبطاقة المحددة
    setTimeout(() => {
      const selectedCard = event?.target?.closest('.card');
      if (selectedCard) {
        selectedCard.classList.add('category-selected');
        setTimeout(() => {
          selectedCard.classList.remove('category-selected');
        }, 600);
      }
    }, 100);
  }

  // إحصائيات
  getStats() {
    return {
      totalProducts: stateService.getState('products')?.length || 0,
      currentFilters: this.filters,
      pagination: this.pagination,
      isRendering: this.isRendering,
      queuedRenders: this.renderQueue.length
    };
  }

  // تنظيف
  cleanup() {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.renderQueue = [];
    console.log('تم تنظيف مدير المنتجات');
  }
}

export const productsManager = new ProductsManager();

// تصدير للاستخدام العام
window.productsManager = productsManager;
window.filterByCategory = (categoryId, categoryName) => 
  productsManager.filterByCategory(categoryId, categoryName);
