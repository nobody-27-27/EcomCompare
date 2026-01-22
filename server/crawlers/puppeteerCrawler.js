const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const BaseCrawler = require('./baseCrawler');

// Add stealth plugin to avoid bot detection and CAPTCHA
puppeteer.use(StealthPlugin());

class PuppeteerCrawler extends BaseCrawler {
  constructor(websiteUrl, options = {}) {
    super(websiteUrl, options);
    this.browser = null;
    this.page = null;
    this.cancelled = false;
    this.failedPages = 0;
    this.maxFailedPages = 5;
  }

  async init() {
    console.log('[Puppeteer] Launching browser with stealth mode...');
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--lang=tr-TR,tr,en-US,en'
      ],
      timeout: 60000
    });
    console.log('[Puppeteer] Browser launched, creating page...');
    this.page = await this.browser.newPage();

    // Set viewport with realistic dimensions
    await this.page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

    // Set extra HTTP headers to look more like a real browser
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
    });

    // Don't block resources - some sites check for this
    // Allow all resources to load for better bot detection evasion
    console.log('[Puppeteer] Browser ready (stealth mode)');
  }

  async close() {
    this.cancelled = true;
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (e) {
        // Ignore close errors
      }
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
          console.log(`[Puppeteer] Navigating to ${url}...`);
          await this.page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 30000
          });
          console.log(`[Puppeteer] Page loaded: ${url}`);

          // Wait for dynamic content and potential CAPTCHA checks to complete
          await this.sleep(2000);

          // Check if we hit a CAPTCHA or block page
          const pageContent = await this.page.content();
          if (pageContent.includes('captcha') || pageContent.includes('robot') ||
              pageContent.includes('güvenlik') || pageContent.includes('doğrulama')) {
            console.log(`[Puppeteer] Possible CAPTCHA detected, waiting longer...`);
            await this.sleep(5000);
          }

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
