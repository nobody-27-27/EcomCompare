const express = require('express');
const router = express.Router();
const { ProductMatch, Product } = require('../database/models');
const MatchingService = require('../services/matchingService');

const matchingService = new MatchingService();

// Get all matches
router.get('/', (req, res) => {
  try {
    const matches = ProductMatch.findAll();
    res.json(matches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get matches for a source product
router.get('/source/:sourceId', (req, res) => {
  try {
    const matches = ProductMatch.findBySourceProduct(req.params.sourceId);
    res.json(matches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get unmatched source products
router.get('/unmatched', (req, res) => {
  try {
    const unmatched = ProductMatch.findUnmatched();
    res.json(unmatched);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get unmatched competitor products
router.get('/unmatched-competitors', (req, res) => {
  try {
    const unmatched = ProductMatch.findUnmatchedCompetitors();
    res.json(unmatched);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get suggested matches for a source product
router.get('/suggestions/:sourceId', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const suggestions = matchingService.getSuggestedMatches(req.params.sourceId, limit);
    res.json(suggestions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Run automatic matching
router.post('/run', async (req, res) => {
  try {
    const options = {
      minSimilarity: req.body.minSimilarity || 0.6,
      allowDuplicateMatches: req.body.allowDuplicateMatches || false,
      maxMatchesPerProduct: req.body.maxMatchesPerProduct || 5
    };

    const result = await matchingService.runMatching(options);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create manual match
router.post('/manual', (req, res) => {
  try {
    const { source_product_id, competitor_product_id } = req.body;

    if (!source_product_id || !competitor_product_id) {
      return res.status(400).json({ error: 'source_product_id and competitor_product_id are required' });
    }

    // Verify products exist
    const sourceProduct = Product.findById(source_product_id);
    const competitorProduct = Product.findById(competitor_product_id);

    if (!sourceProduct) {
      return res.status(404).json({ error: 'Source product not found' });
    }
    if (!competitorProduct) {
      return res.status(404).json({ error: 'Competitor product not found' });
    }

    const match = matchingService.createManualMatch(source_product_id, competitor_product_id);
    res.status(201).json(match);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Confirm a match
router.post('/:id/confirm', (req, res) => {
  try {
    ProductMatch.confirm(req.params.id);
    res.json({ message: 'Match confirmed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a match
router.delete('/:id', (req, res) => {
  try {
    ProductMatch.delete(req.params.id);
    res.json({ message: 'Match deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get matching statistics
router.get('/stats', (req, res) => {
  try {
    const stats = matchingService.getStatistics();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get comparison view data
router.get('/comparison', (req, res) => {
  try {
    const sourceProducts = Product.findSourceProducts();
    const matches = ProductMatch.findAll();

    const comparison = sourceProducts.map(source => {
      const productMatches = matches.filter(m => m.source_product_id === source.id);

      return {
        source: {
          id: source.id,
          name: source.name,
          price: source.price,
          sku: source.sku,
          image_url: source.image_url,
          product_url: source.product_url
        },
        matches: productMatches.map(m => ({
          id: m.id,
          competitor_id: m.competitor_product_id,
          website: m.competitor_website,
          name: m.competitor_name,
          price: m.competitor_price,
          sku: m.competitor_sku,
          image_url: m.competitor_image,
          product_url: m.competitor_url,
          match_type: m.match_type,
          match_score: m.match_score,
          is_confirmed: m.is_confirmed === 1,
          price_difference: m.competitor_price !== null && source.price !== null
            ? m.competitor_price - source.price
            : null
        })),
        has_matches: productMatches.length > 0,
        lowest_competitor_price: productMatches.length > 0
          ? Math.min(...productMatches.filter(m => m.competitor_price !== null).map(m => m.competitor_price))
          : null,
        highest_competitor_price: productMatches.length > 0
          ? Math.max(...productMatches.filter(m => m.competitor_price !== null).map(m => m.competitor_price))
          : null
      };
    });

    res.json(comparison);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
