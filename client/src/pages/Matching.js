import React, { useState, useEffect } from 'react';
import { matchingApi, productsApi } from '../services/api';

function Matching() {
  const [stats, setStats] = useState(null);
  const [unmatched, setUnmatched] = useState([]);
  const [unmatchedCompetitors, setUnmatchedCompetitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showManualMatch, setShowManualMatch] = useState(false);
  const [matchOptions, setMatchOptions] = useState({
    minSimilarity: 0.6,
    allowDuplicateMatches: false,
    maxMatchesPerProduct: 5
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, unmatchedData, unmatchedCompData] = await Promise.all([
        matchingApi.getStats(),
        matchingApi.getUnmatched(),
        matchingApi.getUnmatchedCompetitors()
      ]);
      setStats(statsData);
      setUnmatched(unmatchedData);
      setUnmatchedCompetitors(unmatchedCompData);
    } catch (error) {
      console.error('Error loading matching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRunMatching = async () => {
    setRunning(true);
    try {
      const result = await matchingApi.runMatching(matchOptions);
      alert(`Matching complete! Found ${result.matches_found} matches.`);
      loadData();
    } catch (error) {
      alert('Error running matching: ' + error.message);
    } finally {
      setRunning(false);
    }
  };

  const handleSelectSource = async (product) => {
    setSelectedSource(product);
    setShowManualMatch(true);
    try {
      const suggestions = await matchingApi.getSuggestions(product.id, 20);
      setSuggestions(suggestions);
    } catch (error) {
      console.error('Error getting suggestions:', error);
      setSuggestions([]);
    }
  };

  const handleManualMatch = async (competitorId) => {
    try {
      await matchingApi.createManual(selectedSource.id, competitorId);
      setShowManualMatch(false);
      setSelectedSource(null);
      setSuggestions([]);
      loadData();
    } catch (error) {
      alert('Error creating match: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="matching-page">
      <div className="page-header">
        <h2>Product Matching</h2>
        <button
          className="btn btn-primary"
          onClick={handleRunMatching}
          disabled={running}
        >
          {running ? 'Running...' : 'Run Automatic Matching'}
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="label">Total Matches</div>
          <div className="value">{stats?.total_matches || 0}</div>
        </div>
        <div className="stat-card">
          <div className="label">Confirmed Matches</div>
          <div className="value">{stats?.confirmed_matches || 0}</div>
        </div>
        <div className="stat-card">
          <div className="label">Unmatched Source</div>
          <div className="value">{stats?.unmatched_source_products || 0}</div>
        </div>
        <div className="stat-card">
          <div className="label">Source Products</div>
          <div className="value">{stats?.total_source_products || 0}</div>
        </div>
      </div>

      {/* Match Type Breakdown */}
      {stats?.match_type_breakdown && Object.keys(stats.match_type_breakdown).length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3>Match Types</h3>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {Object.entries(stats.match_type_breakdown).map(([type, count]) => (
              <div key={type} className="badge badge-info" style={{ padding: '8px 12px' }}>
                {type.replace(/_/g, ' ')}: {count}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Matching Options */}
      <div className="card">
        <div className="card-header">
          <h3>Matching Options</h3>
        </div>
        <div className="grid-3">
          <div className="form-group">
            <label>Minimum Similarity (0-1)</label>
            <input
              type="number"
              className="form-control"
              min="0"
              max="1"
              step="0.1"
              value={matchOptions.minSimilarity}
              onChange={e => setMatchOptions({
                ...matchOptions,
                minSimilarity: parseFloat(e.target.value)
              })}
            />
          </div>
          <div className="form-group">
            <label>Max Matches Per Product</label>
            <input
              type="number"
              className="form-control"
              min="1"
              max="20"
              value={matchOptions.maxMatchesPerProduct}
              onChange={e => setMatchOptions({
                ...matchOptions,
                maxMatchesPerProduct: parseInt(e.target.value)
              })}
            />
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={matchOptions.allowDuplicateMatches}
                onChange={e => setMatchOptions({
                  ...matchOptions,
                  allowDuplicateMatches: e.target.checked
                })}
              />
              Allow Duplicate Matches
            </label>
          </div>
        </div>
      </div>

      {/* Unmatched Products */}
      <div className="card">
        <div className="card-header">
          <h3>Unmatched Source Products ({unmatched.length})</h3>
        </div>
        {unmatched.length === 0 ? (
          <div className="empty-state">
            <p>All source products have been matched!</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Price</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {unmatched.map(product => (
                  <tr key={product.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{product.name}</div>
                    </td>
                    <td style={{ fontFamily: 'monospace' }}>{product.sku || '-'}</td>
                    <td>{product.price !== null ? `$${product.price.toFixed(2)}` : '-'}</td>
                    <td>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleSelectSource(product)}
                      >
                        Find Match
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Matching Modal */}
      {showManualMatch && selectedSource && (
        <div className="modal-overlay" onClick={() => setShowManualMatch(false)}>
          <div className="modal" style={{ maxWidth: '800px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Find Match for: {selectedSource.name}</h3>
              <button className="modal-close" onClick={() => setShowManualMatch(false)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="alert alert-info" style={{ marginBottom: '16px' }}>
                <strong>Source Product:</strong> {selectedSource.name}
                {selectedSource.sku && <span> | SKU: {selectedSource.sku}</span>}
                {selectedSource.price && <span> | Price: ${selectedSource.price.toFixed(2)}</span>}
              </div>

              <h4 style={{ marginBottom: '12px' }}>Suggested Matches</h4>
              {suggestions.length === 0 ? (
                <p>No suggestions found. Try adjusting the matching criteria.</p>
              ) : (
                <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Website</th>
                        <th>SKU</th>
                        <th>Price</th>
                        <th>Match Score</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {suggestions.map(suggestion => (
                        <tr key={suggestion.id}>
                          <td>
                            <div style={{ fontWeight: 500 }}>{suggestion.name}</div>
                          </td>
                          <td>
                            <span className="badge badge-secondary">
                              {suggestion.website_name}
                            </span>
                          </td>
                          <td style={{ fontFamily: 'monospace' }}>
                            {suggestion.sku || '-'}
                          </td>
                          <td>
                            {suggestion.price !== null ? `$${suggestion.price.toFixed(2)}` : '-'}
                          </td>
                          <td>
                            <div className="match-score">
                              <div className="score-bar">
                                <div
                                  className="score-fill"
                                  style={{
                                    width: `${suggestion.match_score * 100}%`,
                                    background: suggestion.match_score > 0.8 ? 'var(--success)' :
                                               suggestion.match_score > 0.6 ? 'var(--warning)' : 'var(--danger)'
                                  }}
                                ></div>
                              </div>
                              <span className="score-value">
                                {(suggestion.match_score * 100).toFixed(0)}%
                              </span>
                            </div>
                          </td>
                          <td>
                            <button
                              className="btn btn-sm btn-success"
                              onClick={() => handleManualMatch(suggestion.id)}
                            >
                              Match
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <h4 style={{ marginTop: '24px', marginBottom: '12px' }}>
                All Unmatched Competitors ({unmatchedCompetitors.length})
              </h4>
              <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Website</th>
                      <th>SKU</th>
                      <th>Price</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unmatchedCompetitors.map(product => (
                      <tr key={product.id}>
                        <td>
                          <div style={{ fontWeight: 500 }}>{product.name}</div>
                        </td>
                        <td>
                          <span className="badge badge-secondary">
                            {product.website_name}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'monospace' }}>
                          {product.sku || '-'}
                        </td>
                        <td>
                          {product.price !== null ? `$${product.price.toFixed(2)}` : '-'}
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={() => handleManualMatch(product.id)}
                          >
                            Match
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowManualMatch(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Matching;
