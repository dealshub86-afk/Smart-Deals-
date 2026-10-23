window.smartDealsProductSource = 'local';
window.smartDealsProductApi = window.smartDealsProductApi || {
  async fetchProducts() {
    try {
      const response = await fetch('/api/products');
      if (!response.ok) throw new Error('Failed to fetch products');
      const data = await response.json();
      const products = Array.isArray(data?.products) ? data.products : [];
      if (products.length) {
        window.smartDealsProductSource = data?.source || 'api';
        return products;
      }
    } catch (error) {
      console.warn('API fallback used:', error);
    }

    window.smartDealsProductSource = 'local';
    return Array.isArray(window.smartDealsProducts) ? window.smartDealsProducts : [];
  }
};
