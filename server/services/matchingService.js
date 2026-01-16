const { distance } = require('fastest-levenshtein');
const { Product, ProductMatch } = require('../database/models');

class MatchingService {
  constructor(options = {}) {
    this.options = {
      // Minimum similarity score (0-1) for fuzzy matches
      minSimilarity: options.minSimilarity || 0.6,
      // Boost score for exact SKU match
      skuMatchBoost: options.skuMatchBoost || 1.0,
      // Weight for name similarity
      nameWeight: options.nameWeight || 0.7,
      // Weight for price similarity (when prices are close)
      priceWeight: options.priceWeight || 0.3,
      // Maximum price difference ratio for price similarity boost
      maxPriceDiffRatio: options.maxPriceDiffRatio || 0.3,
      ...options
    };
  }

  // Calculate Levenshtein-based similarity (0-1)
  calculateNameSimilarity(name1, name2) {
    if (!name1 || !name2) return 0;

    // Normalize names
    const normalize = (str) => {
      return str
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const n1 = normalize(name1);
    const n2 = normalize(name2);

    if (n1 === n2) return 1;

    const maxLen = Math.max(n1.length, n2.length);
    if (maxLen === 0) return 0;

    const dist = distance(n1, n2);
    return 1 - (dist / maxLen);
  }

  // Calculate word overlap similarity
  calculateWordSimilarity(name1, name2) {
    if (!name1 || !name2) return 0;

    const getWords = (str) => {
      return str
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2);
    };

    const words1 = new Set(getWords(name1));
    const words2 = new Set(getWords(name2));

    if (words1.size === 0 || words2.size === 0) return 0;

    const intersection = [...words1].filter(w => words2.has(w)).length;
    const union = new Set([...words1, ...words2]).size;

    return intersection / union; // Jaccard similarity
  }

  // Calculate combined similarity score
  calculateSimilarity(sourceProduct, competitorProduct) {
    let score = 0;
    let matchType = 'none';

    // Check for exact SKU match
    if (sourceProduct.sku && competitorProduct.sku) {
      const normalizedSourceSku = sourceProduct.sku.toLowerCase().trim();
      const normalizedCompSku = competitorProduct.sku.toLowerCase().trim();

      if (normalizedSourceSku === normalizedCompSku) {
        return { score: this.options.skuMatchBoost, matchType: 'sku_exact' };
      }

      // Check for partial SKU match
      if (normalizedSourceSku.includes(normalizedCompSku) ||
          normalizedCompSku.includes(normalizedSourceSku)) {
        score += 0.3;
        matchType = 'sku_partial';
      }
    }

    // Calculate name similarity using both methods
    const levenshteinSim = this.calculateNameSimilarity(
      sourceProduct.name,
      competitorProduct.name
    );
    const wordSim = this.calculateWordSimilarity(
      sourceProduct.name,
      competitorProduct.name
    );

    // Use the better of the two similarity measures
    const nameSimilarity = Math.max(levenshteinSim, wordSim);
    score += nameSimilarity * this.options.nameWeight;

    if (nameSimilarity >= 0.9) {
      matchType = matchType === 'sku_partial' ? 'sku_partial' : 'name_exact';
    } else if (nameSimilarity >= this.options.minSimilarity) {
      matchType = matchType === 'sku_partial' ? 'sku_partial' : 'name_fuzzy';
    }

    // Price similarity boost
    if (sourceProduct.price && competitorProduct.price) {
      const priceDiff = Math.abs(sourceProduct.price - competitorProduct.price);
      const avgPrice = (sourceProduct.price + competitorProduct.price) / 2;
      const priceDiffRatio = priceDiff / avgPrice;

      if (priceDiffRatio <= this.options.maxPriceDiffRatio) {
        // Prices are similar, boost the score
        const priceBoost = (1 - priceDiffRatio / this.options.maxPriceDiffRatio) *
                          this.options.priceWeight;
        score += priceBoost;
      }
    }

    return { score: Math.min(score, 1), matchType };
  }

  // Find matches for a single source product
  findMatchesForProduct(sourceProduct, competitorProducts) {
    const matches = [];

    for (const competitor of competitorProducts) {
      const { score, matchType } = this.calculateSimilarity(sourceProduct, competitor);

      if (score >= this.options.minSimilarity || matchType === 'sku_exact') {
        matches.push({
          source_product_id: sourceProduct.id,
          competitor_product_id: competitor.id,
          match_type: matchType,
          match_score: score,
          is_confirmed: matchType === 'sku_exact',
          competitor_product: competitor
        });
      }
    }

    // Sort by score descending
    matches.sort((a, b) => b.match_score - a.match_score);

    return matches;
  }

  // Run matching for all source products
  async runMatching(options = {}) {
    const sourceProducts = Product.findSourceProducts();
    const competitorProducts = Product.findCompetitorProducts();

    if (sourceProducts.length === 0) {
      throw new Error('No source products found. Please set a source website and crawl it first.');
    }

    if (competitorProducts.length === 0) {
      throw new Error('No competitor products found. Please add competitor websites and crawl them first.');
    }

    const allMatches = [];
    const matchedCompetitors = new Set();

    // For each source product, find the best matches
    for (const sourceProduct of sourceProducts) {
      const matches = this.findMatchesForProduct(sourceProduct, competitorProducts);

      // Filter out already matched competitors if unique matching is enabled
      const filteredMatches = options.allowDuplicateMatches
        ? matches
        : matches.filter(m => !matchedCompetitors.has(m.competitor_product_id));

      // Take top matches
      const topMatches = filteredMatches.slice(0, options.maxMatchesPerProduct || 5);

      for (const match of topMatches) {
        allMatches.push(match);
        if (!options.allowDuplicateMatches) {
          matchedCompetitors.add(match.competitor_product_id);
        }
      }
    }

    // Save matches to database
    if (allMatches.length > 0) {
      const matchesToSave = allMatches.map(m => ({
        source_product_id: m.source_product_id,
        competitor_product_id: m.competitor_product_id,
        match_type: m.match_type,
        match_score: m.match_score,
        is_confirmed: m.is_confirmed
      }));

      ProductMatch.createMany(matchesToSave);
    }

    return {
      total_source_products: sourceProducts.length,
      total_competitor_products: competitorProducts.length,
      matches_found: allMatches.length,
      matches: allMatches
    };
  }

  // Get suggested matches for manual review
  getSuggestedMatches(sourceProductId, limit = 10) {
    const sourceProduct = Product.findById(sourceProductId);
    if (!sourceProduct) {
      throw new Error('Source product not found');
    }

    const competitorProducts = Product.findCompetitorProducts();

    // Get all potential matches with scores
    const allMatches = [];
    for (const competitor of competitorProducts) {
      const { score, matchType } = this.calculateSimilarity(sourceProduct, competitor);
      allMatches.push({
        ...competitor,
        match_score: score,
        match_type: matchType
      });
    }

    // Sort by score and return top matches
    allMatches.sort((a, b) => b.match_score - a.match_score);
    return allMatches.slice(0, limit);
  }

  // Create manual match
  createManualMatch(sourceProductId, competitorProductId) {
    return ProductMatch.create({
      source_product_id: sourceProductId,
      competitor_product_id: competitorProductId,
      match_type: 'manual',
      match_score: 1.0,
      is_confirmed: true
    });
  }

  // Get matching statistics
  getStatistics() {
    const sourceProducts = Product.findSourceProducts();
    const competitorProducts = Product.findCompetitorProducts();
    const allMatches = ProductMatch.findAll();
    const unmatched = ProductMatch.findUnmatched();

    const matchTypeBreakdown = {};
    for (const match of allMatches) {
      matchTypeBreakdown[match.match_type] = (matchTypeBreakdown[match.match_type] || 0) + 1;
    }

    return {
      total_source_products: sourceProducts.length,
      total_competitor_products: competitorProducts.length,
      total_matches: allMatches.length,
      unmatched_source_products: unmatched.length,
      confirmed_matches: allMatches.filter(m => m.is_confirmed).length,
      match_type_breakdown: matchTypeBreakdown
    };
  }
}

module.exports = MatchingService;
