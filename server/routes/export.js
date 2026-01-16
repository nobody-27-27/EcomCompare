const express = require('express');
const router = express.Router();
const ExportService = require('../services/exportService');

const exportService = new ExportService();

// Export products
router.get('/products', (req, res) => {
  try {
    const format = req.query.format || 'json';
    const websiteId = req.query.website_id ? parseInt(req.query.website_id) : null;

    const data = exportService.exportProducts(format, websiteId);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="products.csv"');
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="products.json"');
    }

    res.send(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export comparison data
router.get('/comparison', (req, res) => {
  try {
    const format = req.query.format || 'json';
    const data = exportService.exportComparison(format);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="price-comparison.csv"');
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="price-comparison.json"');
    }

    res.send(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export unmatched products
router.get('/unmatched', (req, res) => {
  try {
    const format = req.query.format || 'json';
    const data = exportService.exportUnmatched(format);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="unmatched-products.csv"');
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="unmatched-products.json"');
    }

    res.send(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export full report
router.get('/report', (req, res) => {
  try {
    const format = req.query.format || 'json';
    const data = exportService.exportFullReport(format);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="full-report.csv"');
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="full-report.json"');
    }

    res.send(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
