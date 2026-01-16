import React, { useState, useEffect } from 'react';
import { websitesApi, productsApi, matchingApi, exportApi } from '../services/api';

function Export() {
  const [stats, setStats] = useState(null);
  const [websites, setWebsites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [productStats, matchStats, sites] = await Promise.all([
        productsApi.getStats(),
        matchingApi.getStats(),
        websitesApi.getAll()
      ]);
      setStats({ ...productStats, ...matchStats });
      setWebsites(sites);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (url, filename) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="export-page">
      <div className="page-header">
        <h2>Export Data</h2>
      </div>

      {/* Summary */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="label">Total Products</div>
          <div className="value">{stats?.total_products || 0}</div>
        </div>
        <div className="stat-card">
          <div className="label">Total Matches</div>
          <div className="value">{stats?.total_matches || 0}</div>
        </div>
        <div className="stat-card">
          <div className="label">Unmatched Products</div>
          <div className="value">{stats?.unmatched_source_products || 0}</div>
        </div>
        <div className="stat-card">
          <div className="label">Websites</div>
          <div className="value">{websites.length}</div>
        </div>
      </div>

      <div className="grid-2">
        {/* Products Export */}
        <div className="card">
          <div className="card-header">
            <h3>Export Products</h3>
          </div>
          <p style={{ color: 'var(--text-light)', marginBottom: '16px' }}>
            Export all crawled products with their details including name, price, SKU, and URLs.
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              onClick={() => handleExport(exportApi.products('csv'), 'products.csv')}
            >
              Download CSV
            </button>
            <button
              className="btn btn-outline"
              onClick={() => handleExport(exportApi.products('json'), 'products.json')}
            >
              Download JSON
            </button>
          </div>
        </div>

        {/* Price Comparison Export */}
        <div className="card">
          <div className="card-header">
            <h3>Export Price Comparison</h3>
          </div>
          <p style={{ color: 'var(--text-light)', marginBottom: '16px' }}>
            Export matched products with price differences between your store and competitors.
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              onClick={() => handleExport(exportApi.comparison('csv'), 'price-comparison.csv')}
            >
              Download CSV
            </button>
            <button
              className="btn btn-outline"
              onClick={() => handleExport(exportApi.comparison('json'), 'price-comparison.json')}
            >
              Download JSON
            </button>
          </div>
        </div>

        {/* Unmatched Products Export */}
        <div className="card">
          <div className="card-header">
            <h3>Export Unmatched Products</h3>
          </div>
          <p style={{ color: 'var(--text-light)', marginBottom: '16px' }}>
            Export products that haven't been matched yet for manual review.
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              onClick={() => handleExport(exportApi.unmatched('csv'), 'unmatched-products.csv')}
            >
              Download CSV
            </button>
            <button
              className="btn btn-outline"
              onClick={() => handleExport(exportApi.unmatched('json'), 'unmatched-products.json')}
            >
              Download JSON
            </button>
          </div>
        </div>

        {/* Full Report Export */}
        <div className="card">
          <div className="card-header">
            <h3>Export Full Report</h3>
          </div>
          <p style={{ color: 'var(--text-light)', marginBottom: '16px' }}>
            Export a comprehensive report including statistics and all matches.
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              onClick={() => handleExport(exportApi.report('csv'), 'full-report.csv')}
            >
              Download CSV
            </button>
            <button
              className="btn btn-outline"
              onClick={() => handleExport(exportApi.report('json'), 'full-report.json')}
            >
              Download JSON
            </button>
          </div>
        </div>
      </div>

      {/* Per-Website Export */}
      {websites.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3>Export by Website</h3>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Website</th>
                  <th>Type</th>
                  <th>Products</th>
                  <th>Export</th>
                </tr>
              </thead>
              <tbody>
                {websites.map(website => (
                  <tr key={website.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{website.name}</div>
                      <small style={{ color: 'var(--text-light)' }}>{website.url}</small>
                    </td>
                    <td>
                      <span className={`badge ${website.is_source ? 'badge-info' : 'badge-secondary'}`}>
                        {website.is_source ? 'Source' : 'Competitor'}
                      </span>
                    </td>
                    <td>{website.product_count}</td>
                    <td>
                      <div className="actions">
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleExport(
                            exportApi.products('csv', website.id),
                            `${website.name.replace(/\s+/g, '-')}-products.csv`
                          )}
                          disabled={website.product_count === 0}
                        >
                          CSV
                        </button>
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => handleExport(
                            exportApi.products('json', website.id),
                            `${website.name.replace(/\s+/g, '-')}-products.json`
                          )}
                          disabled={website.product_count === 0}
                        >
                          JSON
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default Export;
