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
      console.log(`[Crawler] Puppeteer not available, using cheerio`);
      return 'cheerio';
    }

    try {
      console.log(`[Crawler] Auto-detecting crawler type for ${url}...`);
      // First try with a simple fetch with strict timeout (5 seconds)
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'max-age=0',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"'
        },
        signal: controller.signal
      });

      // Add timeout for reading body (5 seconds)
      const textPromise = response.text();
      const bodyTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Body read timeout')), 5000);
      });

      const html = await Promise.race([textPromise, bodyTimeout]);
      clearTimeout(timeout);

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
          console.log(`[Crawler] Detected JS framework (${indicator}), using puppeteer`);
          return 'puppeteer';
        }
      }

      // If body has very little content, likely needs JS
      if (textContent.length < 500) {
        console.log(`[Crawler] Minimal content (${textContent.length} chars), using puppeteer`);
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
          console.log(`[Crawler] Detected static platform, using cheerio`);
          return 'cheerio';
        }
      }

      console.log(`[Crawler] No JS framework detected, using cheerio`);
      return 'cheerio';
    } catch (error) {
      console.error(`[Crawler] Detection failed: ${error.message}, falling back to cheerio`);
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
    console.log(`[Crawler] Creating crawler for ${url}, type: ${options.crawl_type || 'auto'}`);
    const { crawler, type } = await this.createCrawler(url, options);
    console.log(`[Crawler] Using ${type} crawler for ${url}`);

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
    let timeoutId = null;

    const crawlPromise = crawler.crawl();
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        jobInfo.cancelled = true;
        if (crawler.close) crawler.close();
        reject(new Error(`Crawl timed out after ${maxCrawlTime / 1000} seconds`));
      }, maxCrawlTime);
    });

    try {
      const products = await Promise.race([crawlPromise, timeoutPromise]);
      clearTimeout(timeoutId); // Clear timeout on success
      this.activeJobs.delete(websiteId);
      return { success: true, products, crawlerType: type };
    } catch (error) {
      clearTimeout(timeoutId); // Clear timeout on error too
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
