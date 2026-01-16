const { URL } = require('url');

class BaseCrawler {
  constructor(websiteUrl, options = {}) {
    this.baseUrl = websiteUrl;
    this.parsedUrl = new URL(websiteUrl);
    this.hostname = this.parsedUrl.hostname;
    this.options = {
      maxPages: options.maxPages || 100,
      delay: options.delay || 1000,
      timeout: options.timeout || 30000,
      ...options
    };
    this.visitedUrls = new Set();
    this.products = [];
    this.onProgress = options.onProgress || (() => {});
  }

  // Common product selectors for various e-commerce platforms
  static PRODUCT_SELECTORS = {
    // Generic selectors that work across many sites
    generic: {
      productContainer: [
        '.product',
        '.product-item',
        '.product-card',
        '[data-product]',
        '.item',
        '.listing-item',
        'article.product'
      ],
      name: [
        '.product-name',
        '.product-title',
        'h2.title',
        'h3.title',
        '[data-product-name]',
        '.item-title',
        'a.product-link',
        'h2 a',
        'h3 a'
      ],
      price: [
        '.price',
        '.product-price',
        '[data-price]',
        '.current-price',
        '.sale-price',
        '.regular-price',
        'span.amount'
      ],
      sku: [
        '[data-sku]',
        '[data-product-id]',
        '.sku',
        '.product-sku',
        '[data-item-id]'
      ],
      image: [
        '.product-image img',
        '.product-img img',
        'img.product-image',
        '[data-product-image]',
        '.item-image img'
      ],
      link: [
        'a.product-link',
        '.product-name a',
        '.product-title a',
        'a[href*="/product"]',
        'a[href*="/p/"]',
        'h2 a',
        'h3 a'
      ],
      pagination: [
        '.pagination a',
        '.pager a',
        'a.next',
        '[rel="next"]',
        '.load-more'
      ]
    },
    // Shopify-specific selectors
    shopify: {
      productContainer: ['.product-card', '.grid__item', '.product-item'],
      name: ['.product-card__title', '.product__title', 'h3'],
      price: ['.price', '.product__price', '.money'],
      sku: ['[data-variant-id]'],
      image: ['.product-card__image img', 'img.lazyload'],
      link: ['.product-card__link', 'a.product__link']
    },
    // WooCommerce-specific selectors
    woocommerce: {
      productContainer: ['.product', '.type-product'],
      name: ['.woocommerce-loop-product__title', 'h2'],
      price: ['.price', '.woocommerce-Price-amount'],
      sku: ['[data-product_id]'],
      image: ['.woocommerce-LoopProduct-link img'],
      link: ['.woocommerce-LoopProduct-link']
    },
    // Magento-specific selectors
    magento: {
      productContainer: ['.product-item', '.item.product'],
      name: ['.product-item-name', '.product-name'],
      price: ['.price-box .price', '[data-price-amount]'],
      sku: ['[data-product-id]'],
      image: ['.product-image-photo'],
      link: ['.product-item-link']
    }
  };

  // Normalize URL to absolute
  normalizeUrl(url) {
    if (!url) return null;
    try {
      if (url.startsWith('//')) {
        return `${this.parsedUrl.protocol}${url}`;
      }
      if (url.startsWith('/')) {
        return `${this.parsedUrl.origin}${url}`;
      }
      if (!url.startsWith('http')) {
        return new URL(url, this.baseUrl).href;
      }
      return url;
    } catch (e) {
      return null;
    }
  }

  // Check if URL is from same domain
  isSameDomain(url) {
    try {
      const parsed = new URL(url);
      return parsed.hostname === this.hostname;
    } catch (e) {
      return false;
    }
  }

  // Parse price string to number
  parsePrice(priceStr) {
    if (!priceStr) return null;
    // Remove currency symbols and non-numeric characters except decimal
    const cleaned = priceStr.replace(/[^0-9.,]/g, '');
    // Handle different decimal formats (1,234.56 or 1.234,56)
    if (cleaned.includes(',') && cleaned.includes('.')) {
      // Determine which is the decimal separator
      const lastComma = cleaned.lastIndexOf(',');
      const lastDot = cleaned.lastIndexOf('.');
      if (lastComma > lastDot) {
        // European format: 1.234,56
        return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
      } else {
        // US format: 1,234.56
        return parseFloat(cleaned.replace(/,/g, ''));
      }
    } else if (cleaned.includes(',')) {
      // Could be 1,234 or 1,23
      const parts = cleaned.split(',');
      if (parts[parts.length - 1].length === 2) {
        // Likely decimal: 1,23
        return parseFloat(cleaned.replace(',', '.'));
      }
      // Likely thousands separator: 1,234
      return parseFloat(cleaned.replace(',', ''));
    }
    return parseFloat(cleaned) || null;
  }

  // Extract SKU from various attributes
  extractSku(element, $) {
    const skuSelectors = [
      '[data-sku]',
      '[data-product-id]',
      '[data-variant-id]',
      '[data-item-id]'
    ];

    for (const selector of skuSelectors) {
      const el = $(element).find(selector).first();
      if (el.length) {
        const sku = el.attr('data-sku') ||
                    el.attr('data-product-id') ||
                    el.attr('data-variant-id') ||
                    el.attr('data-item-id');
        if (sku) return sku;
      }
    }

    // Try text content
    const skuText = $(element).find('.sku, .product-sku').text().trim();
    if (skuText) {
      const match = skuText.match(/(?:SKU|Item|#)?:?\s*([A-Z0-9-]+)/i);
      if (match) return match[1];
    }

    return null;
  }

  // Detect platform type
  detectPlatform(html) {
    if (html.includes('Shopify') || html.includes('cdn.shopify.com')) {
      return 'shopify';
    }
    if (html.includes('woocommerce') || html.includes('wp-content/plugins/woocommerce')) {
      return 'woocommerce';
    }
    if (html.includes('Magento') || html.includes('mage/')) {
      return 'magento';
    }
    return 'generic';
  }

  // Sleep helper
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Abstract methods to be implemented by subclasses
  async crawl() {
    throw new Error('crawl() must be implemented by subclass');
  }

  async extractProducts(html, url) {
    throw new Error('extractProducts() must be implemented by subclass');
  }
}

module.exports = BaseCrawler;
