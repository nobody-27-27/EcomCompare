const express = require('express');
const router = express.Router();
const { Product, Website } = require('../database/models');

// Get all products
router.get('/', (req, res) => {
  try {
    const { website_id, source_only, competitor_only } = req.query;

    let products;

    if (website_id) {
      products = Product.findByWebsite(parseInt(website_id));
    } else if (source_only === 'true') {
      products = Product.findSourceProducts();
    } else if (competitor_only === 'true') {
      products = Product.findCompetitorProducts();
    } else {
      products = Product.findAll();
    }

    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get product by ID
router.get('/:id', (req, res) => {
  try {
    const product = Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Get website info
    const website = Website.findById(product.website_id);
    product.website = website;

    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search products
router.get('/search/:query', (req, res) => {
  try {
    const query = req.params.query.toLowerCase();
    const products = Product.findAll();

    const results = products.filter(p =>
      p.name.toLowerCase().includes(query) ||
      (p.sku && p.sku.toLowerCase().includes(query))
    );

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create product manually
router.post('/', (req, res) => {
  try {
    const { website_id, name, price, sku, image_url, product_url } = req.body;

    if (!website_id || !name) {
      return res.status(400).json({ error: 'website_id and name are required' });
    }

    const website = Website.findById(website_id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const product = Product.create({
      website_id,
      name,
      price: price || null,
      sku: sku || null,
      image_url: image_url || null,
      product_url: product_url || null
    });

    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete product
router.delete('/:id', (req, res) => {
  try {
    const product = Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    Product.delete(req.params.id);
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk delete products
router.post('/bulk-delete', (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }

    let deleted = 0;
    for (const id of ids) {
      try {
        Product.delete(id);
        deleted++;
      } catch (e) {
        // Skip if product not found
      }
    }

    res.json({ message: `Deleted ${deleted} products`, deleted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get product statistics
router.get('/stats/overview', (req, res) => {
  try {
    const sourceProducts = Product.findSourceProducts();
    const competitorProducts = Product.findCompetitorProducts();
    const websites = Website.findAll();

    // Calculate price stats
    const sourcePrices = sourceProducts.filter(p => p.price !== null).map(p => p.price);
    const competitorPrices = competitorProducts.filter(p => p.price !== null).map(p => p.price);

    const stats = {
      total_products: sourceProducts.length + competitorProducts.length,
      source_products: sourceProducts.length,
      competitor_products: competitorProducts.length,
      total_websites: websites.length,
      source_website: websites.find(w => w.is_source === 1)?.name || null,
      competitor_websites: websites.filter(w => w.is_source === 0).length,
      price_stats: {
        source: {
          count: sourcePrices.length,
          min: sourcePrices.length > 0 ? Math.min(...sourcePrices) : null,
          max: sourcePrices.length > 0 ? Math.max(...sourcePrices) : null,
          avg: sourcePrices.length > 0 ? (sourcePrices.reduce((a, b) => a + b, 0) / sourcePrices.length).toFixed(2) : null
        },
        competitor: {
          count: competitorPrices.length,
          min: competitorPrices.length > 0 ? Math.min(...competitorPrices) : null,
          max: competitorPrices.length > 0 ? Math.max(...competitorPrices) : null,
          avg: competitorPrices.length > 0 ? (competitorPrices.reduce((a, b) => a + b, 0) / competitorPrices.length).toFixed(2) : null
        }
      }
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
