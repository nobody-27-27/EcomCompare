const express = require('express');
const router = express.Router();
const { Website, Product, CrawlJob } = require('../database/models');
const { crawlerManager } = require('../crawlers');

// Get all websites
router.get('/', (req, res) => {
  try {
    const websites = Website.findAll();
    const websitesWithStats = websites.map(w => ({
      ...w,
      product_count: Product.count(w.id)
    }));
    res.json(websitesWithStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single website
router.get('/:id', (req, res) => {
  try {
    const website = Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }
    website.product_count = Product.count(website.id);
    website.products = Product.findByWebsite(website.id);
    res.json(website);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add new website
router.post('/', (req, res) => {
  try {
    const { url, name, is_source, crawl_type } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Check if website already exists
    const existing = Website.findByUrl(url);
    if (existing) {
      return res.status(409).json({ error: 'Website already exists', website: existing });
    }

    const website = Website.create({
      url,
      name,
      is_source: is_source || false,
      crawl_type: crawl_type || 'auto'
    });

    res.status(201).json(website);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update website
router.put('/:id', (req, res) => {
  try {
    const website = Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const { name, crawl_type, is_source } = req.body;
    const updates = {};

    if (name !== undefined) updates.name = name;
    if (crawl_type !== undefined) updates.crawl_type = crawl_type;

    if (Object.keys(updates).length > 0) {
      Website.update(req.params.id, updates);
    }

    // Handle setting as source separately
    if (is_source === true) {
      Website.setSource(req.params.id);
    }

    const updated = Website.findById(req.params.id);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set website as source
router.post('/:id/set-source', (req, res) => {
  try {
    const website = Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    Website.setSource(req.params.id);
    const updated = Website.findById(req.params.id);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete website
router.delete('/:id', (req, res) => {
  try {
    const website = Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    Website.delete(req.params.id);
    res.json({ message: 'Website deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start crawl for website
router.post('/:id/crawl', async (req, res) => {
  try {
    const website = Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    // Check if crawl is already running
    const activeJob = crawlerManager.getActiveJob(website.id);
    if (activeJob) {
      return res.status(409).json({ error: 'Crawl already in progress for this website' });
    }

    // Create crawl job
    const job = CrawlJob.create(website.id);
    Website.update(website.id, { status: 'crawling' });

    // Delete existing products for this website
    Product.deleteByWebsite(website.id);

    // Get Socket.IO instance from app
    const io = req.app.get('io');

    // Start crawl asynchronously
    const options = {
      maxPages: req.body.maxPages || 50,
      delay: req.body.delay || 1000,
      crawl_type: website.crawl_type,
      onProgress: (progress) => {
        // Update job progress
        CrawlJob.update(job.id, {
          crawled_pages: progress.pagesCrawled,
          total_products: progress.productsFound
        });

        // Emit progress via Socket.IO
        if (io) {
          io.emit('crawl-progress', {
            website_id: website.id,
            job_id: job.id,
            ...progress
          });
        }
      }
    };

    // Return immediately with job info
    res.json({
      message: 'Crawl started',
      job_id: job.id,
      website_id: website.id
    });

    // Emit initial progress
    if (io) {
      io.emit('crawl-progress', {
        website_id: website.id,
        job_id: job.id,
        status: 'initializing',
        message: 'Initializing crawler...',
        pagesCrawled: 0,
        productsFound: 0
      });
    }

    // Run crawl in background
    try {
      console.log(`Starting crawl for ${website.url} (type: ${website.crawl_type})`);
      const result = await crawlerManager.startCrawl(website.id, website.url, options);
      console.log(`Crawl completed for ${website.url}: ${result.products.length} products found`);

      // Save products
      if (result.products.length > 0) {
        const productsToSave = result.products.map(p => ({
          ...p,
          website_id: website.id
        }));
        Product.createMany(productsToSave);
      }

      // Update job and website status
      CrawlJob.complete(job.id, result.products.length);
      Website.update(website.id, {
        status: 'completed',
        last_crawled_at: new Date().toISOString()
      });

      // Emit completion
      if (io) {
        io.emit('crawl-complete', {
          website_id: website.id,
          job_id: job.id,
          products_found: result.products.length,
          crawler_type: result.crawlerType
        });
      }
    } catch (error) {
      // Update job with error
      CrawlJob.fail(job.id, error.message);
      Website.update(website.id, { status: 'failed' });

      // Emit error
      if (io) {
        io.emit('crawl-error', {
          website_id: website.id,
          job_id: job.id,
          error: error.message
        });
      }
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel crawl
router.post('/:id/crawl/cancel', (req, res) => {
  try {
    const website = Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const cancelled = crawlerManager.cancelCrawl(website.id);

    // Always update the database status, even if no active crawl found
    Website.update(website.id, { status: 'cancelled' });

    // Update latest job
    const latestJob = CrawlJob.findLatest(website.id);
    if (latestJob && latestJob.status === 'running') {
      CrawlJob.fail(latestJob.id, 'Cancelled by user');
    }

    if (cancelled) {
      res.json({ message: 'Crawl cancelled' });
    } else {
      res.json({ message: 'Crawl status reset (no active crawl was running)' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reset website status (fix stuck jobs)
router.post('/:id/reset-status', (req, res) => {
  try {
    const website = Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    // Cancel any active crawl
    crawlerManager.cancelCrawl(website.id);

    // Reset website status
    Website.update(website.id, { status: 'pending' });

    // Mark any running jobs as failed
    const jobs = CrawlJob.findByWebsite(website.id);
    jobs.forEach(job => {
      if (job.status === 'running') {
        CrawlJob.fail(job.id, 'Reset by user');
      }
    });

    res.json({ message: 'Website status reset successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get crawl jobs for website
router.get('/:id/jobs', (req, res) => {
  try {
    const jobs = CrawlJob.findByWebsite(req.params.id);
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
