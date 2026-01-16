const { Parser } = require('json2csv');
const { Product, ProductMatch, Website } = require('../database/models');

class ExportService {
  // Export all products
  exportProducts(format = 'json', websiteId = null) {
    let products;

    if (websiteId) {
      products = Product.findByWebsite(websiteId);
    } else {
      products = Product.findAll();
    }

    const data = products.map(p => ({
      id: p.id,
      website: p.website_name || '',
      website_url: p.website_url || '',
      is_source: p.is_source === 1 ? 'Yes' : 'No',
      name: p.name,
      price: p.price,
      sku: p.sku || '',
      image_url: p.image_url || '',
      product_url: p.product_url || '',
      created_at: p.created_at
    }));

    if (format === 'csv') {
      return this.toCSV(data);
    }

    return JSON.stringify(data, null, 2);
  }

  // Export price comparison data
  exportComparison(format = 'json') {
    const matches = ProductMatch.findAll();
    const sourceProducts = Product.findSourceProducts();

    // Create comparison data
    const comparisonData = [];

    for (const sourceProduct of sourceProducts) {
      const productMatches = matches.filter(m => m.source_product_id === sourceProduct.id);

      if (productMatches.length === 0) {
        // Unmatched product
        comparisonData.push({
          source_name: sourceProduct.name,
          source_sku: sourceProduct.sku || '',
          source_price: sourceProduct.price,
          source_url: sourceProduct.product_url || '',
          competitor_website: '',
          competitor_name: '',
          competitor_sku: '',
          competitor_price: null,
          competitor_url: '',
          price_difference: null,
          price_difference_percent: null,
          match_type: 'no_match',
          match_score: null
        });
      } else {
        for (const match of productMatches) {
          const priceDiff = match.competitor_price !== null && sourceProduct.price !== null
            ? match.competitor_price - sourceProduct.price
            : null;

          const priceDiffPercent = priceDiff !== null && sourceProduct.price !== null && sourceProduct.price !== 0
            ? ((priceDiff / sourceProduct.price) * 100).toFixed(2)
            : null;

          comparisonData.push({
            source_name: sourceProduct.name,
            source_sku: sourceProduct.sku || '',
            source_price: sourceProduct.price,
            source_url: sourceProduct.product_url || '',
            competitor_website: match.competitor_website,
            competitor_name: match.competitor_name,
            competitor_sku: match.competitor_sku || '',
            competitor_price: match.competitor_price,
            competitor_url: match.competitor_url || '',
            price_difference: priceDiff,
            price_difference_percent: priceDiffPercent,
            match_type: match.match_type,
            match_score: match.match_score ? match.match_score.toFixed(3) : null
          });
        }
      }
    }

    if (format === 'csv') {
      return this.toCSV(comparisonData);
    }

    return JSON.stringify(comparisonData, null, 2);
  }

  // Export unmatched products
  exportUnmatched(format = 'json') {
    const unmatchedSource = ProductMatch.findUnmatched();
    const unmatchedCompetitors = ProductMatch.findUnmatchedCompetitors();

    const data = {
      unmatched_source_products: unmatchedSource.map(p => ({
        id: p.id,
        website: p.website_name,
        name: p.name,
        price: p.price,
        sku: p.sku || '',
        product_url: p.product_url || ''
      })),
      unmatched_competitor_products: unmatchedCompetitors.map(p => ({
        id: p.id,
        website: p.website_name,
        name: p.name,
        price: p.price,
        sku: p.sku || '',
        product_url: p.product_url || ''
      }))
    };

    if (format === 'csv') {
      // For CSV, combine both lists with a type column
      const combined = [
        ...data.unmatched_source_products.map(p => ({ type: 'source', ...p })),
        ...data.unmatched_competitor_products.map(p => ({ type: 'competitor', ...p }))
      ];
      return this.toCSV(combined);
    }

    return JSON.stringify(data, null, 2);
  }

  // Export full report
  exportFullReport(format = 'json') {
    const websites = Website.findAll();
    const matches = ProductMatch.findAll();
    const sourceProducts = Product.findSourceProducts();
    const competitorProducts = Product.findCompetitorProducts();

    // Calculate statistics
    const stats = {
      total_websites: websites.length,
      source_website: websites.find(w => w.is_source === 1)?.name || 'None',
      competitor_websites: websites.filter(w => w.is_source === 0).map(w => w.name),
      total_source_products: sourceProducts.length,
      total_competitor_products: competitorProducts.length,
      total_matches: matches.length,
      average_price_source: this.calculateAveragePrice(sourceProducts),
      average_price_competitors: this.calculateAveragePrice(competitorProducts)
    };

    // Price analysis
    const priceAnalysis = this.analyzePrices(matches, sourceProducts);

    const report = {
      generated_at: new Date().toISOString(),
      statistics: stats,
      price_analysis: priceAnalysis,
      matches: matches.map(m => ({
        source: {
          name: m.source_name,
          price: m.source_price,
          sku: m.source_sku
        },
        competitor: {
          website: m.competitor_website,
          name: m.competitor_name,
          price: m.competitor_price,
          sku: m.competitor_sku
        },
        match_type: m.match_type,
        match_score: m.match_score,
        is_confirmed: m.is_confirmed === 1
      }))
    };

    if (format === 'csv') {
      // Flatten for CSV
      const flatData = matches.map(m => ({
        source_name: m.source_name,
        source_price: m.source_price,
        source_sku: m.source_sku || '',
        competitor_website: m.competitor_website,
        competitor_name: m.competitor_name,
        competitor_price: m.competitor_price,
        competitor_sku: m.competitor_sku || '',
        price_difference: m.competitor_price !== null && m.source_price !== null
          ? (m.competitor_price - m.source_price).toFixed(2)
          : '',
        match_type: m.match_type,
        match_score: m.match_score ? m.match_score.toFixed(3) : '',
        is_confirmed: m.is_confirmed === 1 ? 'Yes' : 'No'
      }));
      return this.toCSV(flatData);
    }

    return JSON.stringify(report, null, 2);
  }

  // Calculate average price
  calculateAveragePrice(products) {
    const prices = products.filter(p => p.price !== null).map(p => p.price);
    if (prices.length === 0) return null;
    return (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2);
  }

  // Analyze prices
  analyzePrices(matches, sourceProducts) {
    const analysis = {
      products_cheaper_than_competitors: 0,
      products_same_price: 0,
      products_more_expensive: 0,
      average_price_difference: 0,
      max_savings_opportunity: null,
      max_overpriced: null
    };

    let totalDiff = 0;
    let diffCount = 0;

    for (const match of matches) {
      if (match.source_price !== null && match.competitor_price !== null) {
        const diff = match.competitor_price - match.source_price;
        totalDiff += diff;
        diffCount++;

        if (diff > 1) {
          analysis.products_cheaper_than_competitors++;
          if (!analysis.max_savings_opportunity || diff > analysis.max_savings_opportunity.difference) {
            analysis.max_savings_opportunity = {
              source_product: match.source_name,
              source_price: match.source_price,
              competitor_price: match.competitor_price,
              difference: diff
            };
          }
        } else if (diff < -1) {
          analysis.products_more_expensive++;
          if (!analysis.max_overpriced || diff < analysis.max_overpriced.difference) {
            analysis.max_overpriced = {
              source_product: match.source_name,
              source_price: match.source_price,
              competitor_price: match.competitor_price,
              difference: diff
            };
          }
        } else {
          analysis.products_same_price++;
        }
      }
    }

    analysis.average_price_difference = diffCount > 0
      ? (totalDiff / diffCount).toFixed(2)
      : null;

    return analysis;
  }

  // Convert data to CSV
  toCSV(data) {
    if (!data || data.length === 0) {
      return '';
    }

    try {
      const parser = new Parser({
        flatten: true,
        flattenSeparator: '_'
      });
      return parser.parse(data);
    } catch (error) {
      console.error('Error converting to CSV:', error);
      throw new Error('Failed to convert data to CSV');
    }
  }
}

module.exports = ExportService;
