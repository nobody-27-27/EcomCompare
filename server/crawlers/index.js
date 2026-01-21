const CheerioCrawler = require('./cheerioCrawler');

// Try to load Puppeteer, but it's optional
let PuppeteerCrawler = null;
let puppeteerAvailable = false;

try {
  PuppeteerCrawler = require('./puppeteerCrawler');
  puppeteerAvailable = true;
  console.log('Puppeteer crawler available');
} catch (error) {
  console.log('Puppeteer not available - will use Cheerio for all crawls');
  console.log('To enable Puppeteer, install Chrome/Chromium and puppeteer package');
}

class CrawlerManager {
  constructor() {
    this.activeJobs = new Map();
  }

  isPuppeteerAvailable() {
    return puppeteerAvailable;
  }

  // Detect if a website needs JavaScript rendering
  async detectCrawlerType(url) {
    // If Puppeteer is not available, always use Cheerio
    if (!puppeteerAvailable) {
      return 'cheerio';
    }

    try {
      // First try with a simple fetch
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        signal: controller.signal
      });
      clearTimeout(timeout);

      const html = await response.text();

      // Check for indicators of JavaScript-heavy sites
      const jsIndicators = [
        'window.__NEXT_DATA__', // Next.js
        'window.__NUXT__', // Nuxt.js
        '__GATSBY', // Gatsby
        'react-root', // React
        'ng-app', // Angular
        'v-app', // Vue
        'data-reactroot',
        'data-react-helmet'
      ];

      // Check if the page has minimal content (likely JS-rendered)
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      const bodyContent = bodyMatch ? bodyMatch[1] : '';
      const textContent = bodyContent.replace(/<[^>]+>/g, '').trim();

      // If very little text content or JS framework detected, use Puppeteer
      for (const indicator of jsIndicators) {
        if (html.includes(indicator)) {
          return 'puppeteer';
        }
      }

      // If body has very little content, likely needs JS
      if (textContent.length < 500) {
        return 'puppeteer';
      }

      // Check for common e-commerce platforms that work with Cheerio
      const staticPlatforms = [
        'woocommerce',
        'Magento',
        'OpenCart',
        'PrestaShop',
        'osCommerce'
      ];

      for (const platform of staticPlatforms) {
        if (html.includes(platform)) {
          return 'cheerio';
        }
      }

      return 'cheerio';
    } catch (error) {
      console.error('Error detecting crawler type:', error.message);
      // Default to Cheerio if detection fails
      return 'cheerio';
    }
  }

  async createCrawler(url, options = {}) {
    let crawlerType = options.crawl_type || 'auto';

    if (crawlerType === 'auto') {
      crawlerType = await this.detectCrawlerType(url);
    }

    // Force Cheerio if Puppeteer requested but not available
    if (crawlerType === 'puppeteer' && !puppeteerAvailable) {
      console.log('Puppeteer not available, falling back to Cheerio');
      crawlerType = 'cheerio';
    }

    const CrawlerClass = crawlerType === 'puppeteer' && puppeteerAvailable
      ? PuppeteerCrawler
      : CheerioCrawler;

    return {
      crawler: new CrawlerClass(url, options),
      type: crawlerType
    };
  }

  async startCrawl(websiteId, url, options = {}) {
    const { crawler, type } = await this.createCrawler(url, options);

    const jobInfo = {
      websiteId,
      url,
      type,
      crawler,
      startTime: Date.now(),
      cancelled: false
    };

    this.activeJobs.set(websiteId, jobInfo);

    // Global timeout for entire crawl (5 minutes)
    const maxCrawlTime = options.maxCrawlTime || 300000;

    const crawlPromise = crawler.crawl();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        jobInfo.cancelled = true;
        if (crawler.close) crawler.close();
        reject(new Error(`Crawl timed out after ${maxCrawlTime / 1000} seconds`));
      }, maxCrawlTime);
    });

    try {
      const products = await Promise.race([crawlPromise, timeoutPromise]);
      this.activeJobs.delete(websiteId);
      return { success: true, products, crawlerType: type };
    } catch (error) {
      this.activeJobs.delete(websiteId);
      throw error;
    }
  }

  getActiveJob(websiteId) {
    return this.activeJobs.get(websiteId);
  }

  getAllActiveJobs() {
    return Array.from(this.activeJobs.values());
  }

  cancelCrawl(websiteId) {
    const job = this.activeJobs.get(websiteId);
    if (job && job.crawler) {
      if (job.crawler.close) {
        job.crawler.close();
      }
      this.activeJobs.delete(websiteId);
      return true;
    }
    return false;
  }
}

// Singleton instance
const crawlerManager = new CrawlerManager();

module.exports = {
  CheerioCrawler,
  PuppeteerCrawler,
  crawlerManager,
  puppeteerAvailable
};
