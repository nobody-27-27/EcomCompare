import React, { useState, useEffect } from 'react';
import { matchingApi } from '../services/api';

function Comparison() {
  const [comparison, setComparison] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    search: '',
    priceFilter: 'all', // all, cheaper, same, expensive
    matchStatus: 'all' // all, matched, unmatched
  });

  useEffect(() => {
    loadComparison();
  }, []);

  const loadComparison = async () => {
    try {
      const data = await matchingApi.getComparison();
      setComparison(data);
    } catch (error) {
      console.error('Error loading comparison:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMatch = async (matchId) => {
    if (!window.confirm('Are you sure you want to remove this match?')) {
      return;
    }

    try {
      await matchingApi.delete(matchId);
      loadComparison();
    } catch (error) {
      alert('Error deleting match: ' + error.message);
    }
  };

  const handleConfirmMatch = async (matchId) => {
    try {
      await matchingApi.confirm(matchId);
      loadComparison();
    } catch (error) {
      alert('Error confirming match: ' + error.message);
    }
  };

  const filteredComparison = comparison.filter(item => {
    // Search filter
    if (filter.search) {
      const search = filter.search.toLowerCase();
      const matchesSearch = item.source.name.toLowerCase().includes(search) ||
        (item.source.sku && item.source.sku.toLowerCase().includes(search)) ||
        item.matches.some(m => m.name.toLowerCase().includes(search));
      if (!matchesSearch) return false;
    }

    // Match status filter
    if (filter.matchStatus === 'matched' && !item.has_matches) return false;
    if (filter.matchStatus === 'unmatched' && item.has_matches) return false;

    // Price filter
    if (filter.priceFilter !== 'all' && item.has_matches) {
      const hasCheaper = item.matches.some(m => m.price_difference < -1);
      const hasSame = item.matches.some(m => Math.abs(m.price_difference) <= 1);
      const hasExpensive = item.matches.some(m => m.price_difference > 1);

      if (filter.priceFilter === 'cheaper' && !hasCheaper) return false;
      if (filter.priceFilter === 'same' && !hasSame) return false;
      if (filter.priceFilter === 'expensive' && !hasExpensive) return false;
    }

    return true;
  });

  const formatPriceDiff = (diff) => {
    if (diff === null) return '-';
    const sign = diff > 0 ? '+' : '';
    const className = diff > 1 ? 'positive' : diff < -1 ? 'negative' : 'neutral';
    return (
      <span className={`price-diff ${className}`}>
        {sign}${diff.toFixed(2)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="comparison-page">
      <div className="page-header">
        <h2>Price Comparison</h2>
        <span style={{ color: 'var(--text-light)' }}>
          {filteredComparison.length} products
        </span>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0, flex: '1', minWidth: '200px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search products..."
              value={filter.search}
              onChange={e => setFilter({ ...filter, search: e.target.value })}
            />
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: '150px' }}>
            <select
              className="form-control"
              value={filter.matchStatus}
              onChange={e => setFilter({ ...filter, matchStatus: e.target.value })}
            >
              <option value="all">All Products</option>
              <option value="matched">Matched Only</option>
              <option value="unmatched">Unmatched Only</option>
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: '150px' }}>
            <select
              className="form-control"
              value={filter.priceFilter}
              onChange={e => setFilter({ ...filter, priceFilter: e.target.value })}
            >
              <option value="all">All Prices</option>
              <option value="cheaper">Competitors Cheaper</option>
              <option value="same">Same Price</option>
              <option value="expensive">Competitors More Expensive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Comparison List */}
      {filteredComparison.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <h3>No products to compare</h3>
            <p>Run product matching first to see price comparisons.</p>
          </div>
        </div>
      ) : (
        filteredComparison.map(item => (
          <div key={item.source.id} className="card" style={{ marginBottom: '16px' }}>
            {/* Source Product */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: item.has_matches ? '16px' : 0 }}>
              {item.source.image_url && (
                <img
                  src={item.source.image_url}
                  alt={item.source.name}
                  style={{
                    width: '80px',
                    height: '80px',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    background: 'var(--background)'
                  }}
                  onError={e => { e.target.style.display = 'none'; }}
                />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <h4 style={{ margin: '0 0 4px' }}>{item.source.name}</h4>
                    {item.source.sku && (
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-light)' }}>
                        SKU: {item.source.sku}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--primary)' }}>
                      {item.source.price !== null ? `$${item.source.price.toFixed(2)}` : 'No price'}
                    </div>
                    <span className="badge badge-info">Your Price</span>
                  </div>
                </div>
                {item.source.product_url && (
                  <a
                    href={item.source.product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '0.8125rem' }}
                  >
                    View Product
                  </a>
                )}
              </div>
            </div>

            {/* Matches */}
            {item.has_matches ? (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-light)', marginBottom: '12px' }}>
                  {item.matches.length} competitor{item.matches.length !== 1 ? 's' : ''} |
                  Lowest: ${item.lowest_competitor_price?.toFixed(2)} |
                  Highest: ${item.highest_competitor_price?.toFixed(2)}
                </div>
                <div className="table-container">
                  <table style={{ marginBottom: 0 }}>
                    <thead>
                      <tr>
                        <th>Competitor</th>
                        <th>Product</th>
                        <th>SKU</th>
                        <th>Price</th>
                        <th>Difference</th>
                        <th>Match</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.matches.map(match => (
                        <tr key={match.id}>
                          <td>
                            <span className="badge badge-secondary">{match.website}</span>
                          </td>
                          <td>
                            <div>{match.name}</div>
                            {match.product_url && (
                              <a
                                href={match.product_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ fontSize: '0.75rem' }}
                              >
                                View
                              </a>
                            )}
                          </td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                            {match.sku || '-'}
                          </td>
                          <td style={{ fontWeight: 500 }}>
                            {match.price !== null ? `$${match.price.toFixed(2)}` : '-'}
                          </td>
                          <td>{formatPriceDiff(match.price_difference)}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span className={`badge badge-${
                                match.match_type === 'sku_exact' ? 'success' :
                                match.match_type === 'manual' ? 'info' : 'secondary'
                              }`}>
                                {match.match_type.replace(/_/g, ' ')}
                              </span>
                              {match.is_confirmed && (
                                <span className="badge badge-success">Confirmed</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="actions">
                              {!match.is_confirmed && (
                                <button
                                  className="btn btn-sm btn-success"
                                  onClick={() => handleConfirmMatch(match.id)}
                                >
                                  Confirm
                                </button>
                              )}
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => handleDeleteMatch(match.id)}
                              >
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{
                borderTop: '1px solid var(--border)',
                paddingTop: '16px',
                color: 'var(--text-light)',
                textAlign: 'center'
              }}>
                No competitor matches found
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

export default Comparison;
