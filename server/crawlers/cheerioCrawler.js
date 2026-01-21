const cheerio = require('cheerio');
const BaseCrawler = require('./baseCrawler');

class CheerioCrawler extends BaseCrawler {
  constructor(websiteUrl, options = {}) {
    super(websiteUrl, options);
    this.fetchOptions = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5,tr;q=0.3',
        'Connection': 'keep-alive'
      }
    };
    this.cancelled = false;
    this.failedPages = 0;
    this.maxFailedPages = 5; // Stop if too many pages fail
  }

  close() {
    this.cancelled = true;
  }

  async fetchPage(url) {
    const controller = new AbortController();
    const timeoutMs = this.options.timeout || 15000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...this.fetchOptions,
        signal: controller.signal
      });

      if (!response.ok) {
        clearTimeout(timeout);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Add timeout for reading body as well
      const textPromise = response.text();
      const bodyTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Body read timeout')), timeoutMs);
      });

      const html = await Promise.race([textPromise, bodyTimeout]);
      clearTimeout(timeout);
      return html;
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }

  async crawl() {
    const urlsToVisit = [this.baseUrl];
    const productUrls = new Set();
    let pagesCrawled = 0;

    this.onProgress({
      status: 'starting',
      message: 'Starting crawl...',
      pagesCrawled: 0,
      productsFound: 0
    });

    // First pass: collect all product listing pages and product URLs
    while (urlsToVisit.length > 0 && pagesCrawled < this.options.maxPages && !this.cancelled) {
      // Check if too many pages have failed
      if (this.failedPages >= this.maxFailedPages) {
        this.onProgress({
          status: 'error',
          message: `Too many failed pages (${this.failedPages}). Stopping crawl.`,
          pagesCrawled,
          productsFound: this.products.length
        });
        break;
      }

      const url = urlsToVisit.shift();

      if (this.visitedUrls.has(url)) continue;
      this.visitedUrls.add(url);

      try {
        const html = await this.fetchPage(url);
        const $ = cheerio.load(html);

        // Detect platform on first page
        if (pagesCrawled === 0) {
          this.platform = this.detectPlatform(html);
        }

        // Extract products from this page
        const pageProducts = this.extractProductsFromPage($, url);
        for (const product of pageProducts) {
          if (product.product_url) {
            productUrls.add(product.product_url);
          }
          this.products.push(product);
        }

        // Find pagination links
        const paginationLinks = this.findPaginationLinks($, url);
        for (const link of paginationLinks) {
          if (!this.visitedUrls.has(link) && !urlsToVisit.includes(link)) {
            urlsToVisit.push(link);
          }
        }

        // Find category/listing links
        const categoryLinks = this.findCategoryLinks($, url);
        for (const link of categoryLinks) {
          if (!this.visitedUrls.has(link) && !urlsToVisit.includes(link)) {
            urlsToVisit.push(link);
          }
        }

        pagesCrawled++;
        this.onProgress({
          status: 'crawling',
          message: `Crawled ${url}`,
          pagesCrawled,
          productsFound: this.products.length
        });

        // Rate limiting
        await this.sleep(this.options.delay);
      } catch (error) {
        this.failedPages++;
        console.error(`Error crawling ${url}:`, error.message);
        this.onProgress({
          status: 'error',
          message: `Error crawling ${url}: ${error.message}`,
          pagesCrawled,
          productsFound: this.products.length
        });
      }
    }

    // Deduplicate products
    this.products = this.deduplicateProducts(this.products);

    const finalStatus = this.cancelled ? 'cancelled' : 'completed';
    this.onProgress({
      status: finalStatus,
      message: `Crawl ${finalStatus}. Found ${this.products.length} products.`,
      pagesCrawled,
      productsFound: this.products.length
    });

    return this.products;
  }

  // Extract products from JSON-LD structured data
  extractProductsFromJsonLd($) {
    const products = [];

    $('script[type="application/ld+json"]').each((i, el) => {
      try {
        const json = JSON.parse($(el).html());
        const items = Array.isArray(json) ? json : [json];

        for (const item of items) {
          // Handle Product type
          if (item['@type'] === 'Product') {
            const p = this.parseJsonLdProduct(item);
            if (p) products.push(p);
          }
          // Handle ItemList with products
          if (item['@type'] === 'ItemList' && item.itemListElement) {
            for (const listItem of item.itemListElement) {
              if (listItem.item && listItem.item['@type'] === 'Product') {
                const p = this.parseJsonLdProduct(listItem.item);
                if (p) products.push(p);
              } else if (listItem['@type'] === 'Product') {
                const p = this.parseJsonLdProduct(listItem);
                if (p) products.push(p);
              }
            }
          }
          // Handle @graph with products
          if (item['@graph']) {
            for (const graphItem of item['@graph']) {
              if (graphItem['@type'] === 'Product') {
                const p = this.parseJsonLdProduct(graphItem);
                if (p) products.push(p);
              }
            }
          }
        }
      } catch (e) {
        // Invalid JSON, skip
      }
    });

    return products.filter(p => p && p.name);
  }

  parseJsonLdProduct(item) {
    if (!item) return null;

    let price = null;
    if (item.offers) {
      const offers = Array.isArray(item.offers) ? item.offers[0] : item.offers;
      price = offers.price || offers.lowPrice;
      if (price) price = parseFloat(price);
    }

    let imageUrl = item.image;
    if (Array.isArray(imageUrl)) imageUrl = imageUrl[0];
    if (typeof imageUrl === 'object') imageUrl = imageUrl.url || imageUrl['@id'];

    return {
      name: item.name,
      price: price,
      sku: item.sku || item.productID || item.mpn,
      image_url: imageUrl ? this.normalizeUrl(imageUrl) : null,
      product_url: item.url ? this.normalizeUrl(item.url) : null
    };
  }

  extractProductsFromPage($, pageUrl) {
    // First try JSON-LD structured data (most reliable)
    const jsonLdProducts = this.extractProductsFromJsonLd($);
    if (jsonLdProducts.length > 0) {
      return jsonLdProducts;
    }

    const products = [];
    const selectors = BaseCrawler.PRODUCT_SELECTORS[this.platform || 'generic'];

    // Try each container selector
    for (const containerSelector of selectors.productContainer) {
      const containers = $(containerSelector);

      if (containers.length > 0) {
        containers.each((i, el) => {
          const product = this.extractProductFromElement($, el, selectors);
          if (product && product.name) {
            products.push(product);
          }
        });

        if (products.length > 0) break;
      }
    }

    // If no products found with platform selectors, try generic
    if (products.length === 0 && this.platform !== 'generic') {
      const genericSelectors = BaseCrawler.PRODUCT_SELECTORS.generic;
      for (const containerSelector of genericSelectors.productContainer) {
        const containers = $(containerSelector);

        if (containers.length > 0) {
          containers.each((i, el) => {
            const product = this.extractProductFromElement($, el, genericSelectors);
            if (product && product.name) {
              products.push(product);
            }
          });

          if (products.length > 0) break;
        }
      }
    }

    return products;
  }

  extractProductFromElement($, element, selectors) {
    const $el = $(element);

    // Extract name
    let name = null;
    for (const selector of selectors.name) {
      const nameEl = $el.find(selector).first();
      if (nameEl.length) {
        name = nameEl.text().trim();
        if (name) break;
      }
    }

    if (!name) return null;

    // Extract price
    let price = null;
    for (const selector of selectors.price) {
      const priceEl = $el.find(selector).first();
      if (priceEl.length) {
        price = this.parsePrice(priceEl.text());
        if (price) break;
      }
    }

    // Extract SKU
    const sku = this.extractSku(element, $);

    // Extract image
    let imageUrl = null;
    for (const selector of selectors.image) {
      const imgEl = $el.find(selector).first();
      if (imgEl.length) {
        imageUrl = imgEl.attr('src') ||
                   imgEl.attr('data-src') ||
                   imgEl.attr('data-lazy-src');
        if (imageUrl) {
          imageUrl = this.normalizeUrl(imageUrl);
          break;
        }
      }
    }

    // Try to find any image if specific selectors failed
    if (!imageUrl) {
      const anyImg = $el.find('img').first();
      if (anyImg.length) {
        imageUrl = anyImg.attr('src') ||
                   anyImg.attr('data-src') ||
                   anyImg.attr('data-lazy-src');
        if (imageUrl) {
          imageUrl = this.normalizeUrl(imageUrl);
        }
      }
    }

    // Extract product URL
    let productUrl = null;
    for (const selector of selectors.link) {
      const linkEl = $el.find(selector).first();
      if (linkEl.length) {
        productUrl = linkEl.attr('href');
        if (productUrl) {
          productUrl = this.normalizeUrl(productUrl);
          break;
        }
      }
    }

    // Try to find any link if specific selectors failed
    if (!productUrl) {
      const anyLink = $el.find('a').first();
      if (anyLink.length) {
        productUrl = anyLink.attr('href');
        if (productUrl) {
          productUrl = this.normalizeUrl(productUrl);
        }
      }
    }

    return {
      name,
      price,
      sku,
      image_url: imageUrl,
      product_url: productUrl
    };
  }

  findPaginationLinks($, currentUrl) {
    const links = [];
    const paginationSelectors = [
      '.pagination a',
      '.pager a',
      'a.page-numbers',
      '.page-link',
      'a[rel="next"]',
      '.next a',
      'a.next'
    ];

    for (const selector of paginationSelectors) {
      $(selector).each((i, el) => {
        const href = $(el).attr('href');
        if (href) {
          const url = this.normalizeUrl(href);
          if (url && this.isSameDomain(url)) {
            links.push(url);
          }
        }
      });
    }

    return [...new Set(links)];
  }

  findCategoryLinks($, currentUrl) {
    const links = [];
    const categoryPatterns = [
      /\/category\//i,
      /\/collections?\//i,
      /\/shop\//i,
      /\/products?\//i,
      /\/catalog\//i,
      // Turkish patterns
      /\/kategori\//i,
      /\/urun\//i,
      /\/urunler\//i,
      /\/magaza\//i,
      /\/grup\//i,
      // Common listing patterns
      /\/c\//i,
      /\/k\//i,
      /\/g\//i,
      /\?.*kategori/i,
      /\?.*category/i
    ];

    $('a').each((i, el) => {
      const href = $(el).attr('href');
      if (href) {
        const url = this.normalizeUrl(href);
        if (url && this.isSameDomain(url)) {
          for (const pattern of categoryPatterns) {
            if (pattern.test(url)) {
              links.push(url);
              break;
            }
          }
        }
      }
    });

    return [...new Set(links)].slice(0, 30); // Limit category links
  }

  deduplicateProducts(products) {
    const seen = new Map();

    for (const product of products) {
      const key = product.sku || product.product_url || product.name;
      if (!seen.has(key)) {
        seen.set(key, product);
      } else {
        // Merge if we have better data
        const existing = seen.get(key);
        if (!existing.price && product.price) {
          existing.price = product.price;
        }
        if (!existing.sku && product.sku) {
          existing.sku = product.sku;
        }
        if (!existing.image_url && product.image_url) {
          existing.image_url = product.image_url;
        }
      }
    }

    return Array.from(seen.values());
  }
}

module.exports = CheerioCrawler;
