const puppeteer = require('puppeteer');
const BaseCrawler = require('./baseCrawler');

class PuppeteerCrawler extends BaseCrawler {
  constructor(websiteUrl, options = {}) {
    super(websiteUrl, options);
    this.browser = null;
    this.page = null;
  }

  async init() {
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920x1080'
      ]
    });
    this.page = await this.browser.newPage();

    // Set viewport
    await this.page.setViewport({ width: 1920, height: 1080 });

    // Set user agent
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Block unnecessary resources for faster loading
    await this.page.setRequestInterception(true);
    this.page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['font', 'media'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  async crawl() {
    try {
      await this.init();

      const urlsToVisit = [this.baseUrl];
      let pagesCrawled = 0;

      this.onProgress({
        status: 'starting',
        message: 'Starting Puppeteer crawl...',
        pagesCrawled: 0,
        productsFound: 0
      });

      // First pass: collect products from listing pages
      while (urlsToVisit.length > 0 && pagesCrawled < this.options.maxPages) {
        const url = urlsToVisit.shift();

        if (this.visitedUrls.has(url)) continue;
        this.visitedUrls.add(url);

        try {
          await this.page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: this.options.timeout
          });

          // Wait for dynamic content
          await this.sleep(1000);

          // Scroll to load lazy content
          await this.autoScroll();

          // Detect platform on first page
          if (pagesCrawled === 0) {
            const html = await this.page.content();
            this.platform = this.detectPlatform(html);
          }

          // Extract products
          const pageProducts = await this.extractProductsFromPage();
          this.products.push(...pageProducts);

          // Find pagination and category links
          const newLinks = await this.findLinks();
          for (const link of newLinks) {
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

      this.onProgress({
        status: 'completed',
        message: `Crawl completed. Found ${this.products.length} products.`,
        pagesCrawled,
        productsFound: this.products.length
      });

      return this.products;
    } finally {
      await this.close();
    }
  }

  async autoScroll() {
    await this.page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 500;
        const maxScrolls = 10;
        let scrolls = 0;

        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          scrolls++;

          if (totalHeight >= scrollHeight || scrolls >= maxScrolls) {
            clearInterval(timer);
            window.scrollTo(0, 0);
            resolve();
          }
        }, 200);
      });
    });
  }

  async extractProductsFromPage() {
    const selectors = BaseCrawler.PRODUCT_SELECTORS[this.platform || 'generic'];
    const genericSelectors = BaseCrawler.PRODUCT_SELECTORS.generic;

    return await this.page.evaluate((selectors, genericSelectors) => {
      const products = [];

      function trySelectors(containerSelectors, fieldSelectors) {
        for (const containerSelector of containerSelectors) {
          const containers = document.querySelectorAll(containerSelector);

          if (containers.length > 0) {
            containers.forEach((container) => {
              const product = extractProduct(container, fieldSelectors);
              if (product && product.name) {
                products.push(product);
              }
            });

            if (products.length > 0) return true;
          }
        }
        return false;
      }

      function extractProduct(container, fieldSelectors) {
        // Extract name
        let name = null;
        for (const selector of fieldSelectors.name) {
          const el = container.querySelector(selector);
          if (el) {
            name = el.textContent.trim();
            if (name) break;
          }
        }
        if (!name) return null;

        // Extract price
        let price = null;
        for (const selector of fieldSelectors.price) {
          const el = container.querySelector(selector);
          if (el) {
            const priceText = el.textContent.trim();
            const cleaned = priceText.replace(/[^0-9.,]/g, '');
            if (cleaned) {
              if (cleaned.includes(',') && cleaned.includes('.')) {
                const lastComma = cleaned.lastIndexOf(',');
                const lastDot = cleaned.lastIndexOf('.');
                if (lastComma > lastDot) {
                  price = parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
                } else {
                  price = parseFloat(cleaned.replace(/,/g, ''));
                }
              } else if (cleaned.includes(',')) {
                const parts = cleaned.split(',');
                if (parts[parts.length - 1].length === 2) {
                  price = parseFloat(cleaned.replace(',', '.'));
                } else {
                  price = parseFloat(cleaned.replace(',', ''));
                }
              } else {
                price = parseFloat(cleaned);
              }
              if (price) break;
            }
          }
        }

        // Extract SKU
        let sku = null;
        const skuAttrs = ['data-sku', 'data-product-id', 'data-variant-id', 'data-item-id'];
        for (const attr of skuAttrs) {
          const el = container.querySelector(`[${attr}]`);
          if (el) {
            sku = el.getAttribute(attr);
            if (sku) break;
          }
        }
        if (!sku) {
          const skuEl = container.querySelector('.sku, .product-sku');
          if (skuEl) {
            const match = skuEl.textContent.match(/(?:SKU|Item|#)?:?\s*([A-Z0-9-]+)/i);
            if (match) sku = match[1];
          }
        }

        // Extract image
        let imageUrl = null;
        for (const selector of fieldSelectors.image) {
          const el = container.querySelector(selector);
          if (el) {
            imageUrl = el.src || el.getAttribute('data-src') || el.getAttribute('data-lazy-src');
            if (imageUrl) break;
          }
        }
        if (!imageUrl) {
          const img = container.querySelector('img');
          if (img) {
            imageUrl = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
          }
        }

        // Extract product URL
        let productUrl = null;
        for (const selector of fieldSelectors.link) {
          const el = container.querySelector(selector);
          if (el) {
            productUrl = el.href;
            if (productUrl) break;
          }
        }
        if (!productUrl) {
          const link = container.querySelector('a');
          if (link) {
            productUrl = link.href;
          }
        }

        return {
          name,
          price: price || null,
          sku: sku || null,
          image_url: imageUrl || null,
          product_url: productUrl || null
        };
      }

      // Try platform-specific selectors first
      if (!trySelectors(selectors.productContainer, selectors)) {
        // Fall back to generic selectors
        trySelectors(genericSelectors.productContainer, genericSelectors);
      }

      return products;
    }, selectors, genericSelectors);
  }

  async findLinks() {
    const hostname = this.hostname;
    return await this.page.evaluate((hostname) => {
      const links = [];
      const categoryPatterns = [
        /\/category\//i,
        /\/collections?\//i,
        /\/shop\//i,
        /\/products?\//i,
        /\/catalog\//i
      ];

      // Pagination links
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
        document.querySelectorAll(selector).forEach((el) => {
          if (el.href && new URL(el.href).hostname === hostname) {
            links.push(el.href);
          }
        });
      }

      // Category links
      document.querySelectorAll('a').forEach((el) => {
        if (el.href) {
          try {
            const url = new URL(el.href);
            if (url.hostname === hostname) {
              for (const pattern of categoryPatterns) {
                if (pattern.test(el.href)) {
                  links.push(el.href);
                  break;
                }
              }
            }
          } catch (e) {
            // Invalid URL, skip
          }
        }
      });

      return [...new Set(links)].slice(0, 30);
    }, hostname);
  }

  deduplicateProducts(products) {
    const seen = new Map();

    for (const product of products) {
      const key = product.sku || product.product_url || product.name;
      if (!seen.has(key)) {
        seen.set(key, product);
      } else {
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

module.exports = PuppeteerCrawler;
