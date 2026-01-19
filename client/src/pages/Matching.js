import React, { useState, useEffect, useMemo } from 'react';
import { matchingApi } from '../services/api';

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

  // Search and filter state for modal
  const [searchQuery, setSearchQuery] = useState('');
  const [websiteFilter, setWebsiteFilter] = useState('all');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [sortBy, setSortBy] = useState('match_score');

  // Search and filter state for unmatched source products
  const [sourceSearch, setSourceSearch] = useState('');

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
    setSearchQuery('');
    setWebsiteFilter('all');
    setPriceMin('');
    setPriceMax('');
    setSortBy('match_score');
    try {
      const suggestions = await matchingApi.getSuggestions(product.id, 50);
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

  // Get unique websites for filter
  const websites = useMemo(() => {
    const sites = new Set();
    unmatchedCompetitors.forEach(p => sites.add(p.website_name));
    suggestions.forEach(p => sites.add(p.website_name));
    return Array.from(sites).sort();
  }, [unmatchedCompetitors, suggestions]);

  // Filter and sort suggestions
  const filteredSuggestions = useMemo(() => {
    let filtered = [...suggestions];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        (p.sku && p.sku.toLowerCase().includes(query))
      );
    }

    // Website filter
    if (websiteFilter !== 'all') {
      filtered = filtered.filter(p => p.website_name === websiteFilter);
    }

    // Price filter
    if (priceMin !== '') {
      filtered = filtered.filter(p => p.price !== null && p.price >= parseFloat(priceMin));
    }
    if (priceMax !== '') {
      filtered = filtered.filter(p => p.price !== null && p.price <= parseFloat(priceMax));
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'match_score':
          return (b.match_score || 0) - (a.match_score || 0);
        case 'name':
          return a.name.localeCompare(b.name);
        case 'price_asc':
          return (a.price || 0) - (b.price || 0);
        case 'price_desc':
          return (b.price || 0) - (a.price || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [suggestions, searchQuery, websiteFilter, priceMin, priceMax, sortBy]);

  // Filter and sort unmatched competitors
  const filteredCompetitors = useMemo(() => {
    let filtered = [...unmatchedCompetitors];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        (p.sku && p.sku.toLowerCase().includes(query))
      );
    }

    // Website filter
    if (websiteFilter !== 'all') {
      filtered = filtered.filter(p => p.website_name === websiteFilter);
    }

    // Price filter
    if (priceMin !== '') {
      filtered = filtered.filter(p => p.price !== null && p.price >= parseFloat(priceMin));
    }
    if (priceMax !== '') {
      filtered = filtered.filter(p => p.price !== null && p.price <= parseFloat(priceMax));
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'price_asc':
          return (a.price || 0) - (b.price || 0);
        case 'price_desc':
          return (b.price || 0) - (a.price || 0);
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return filtered;
  }, [unmatchedCompetitors, searchQuery, websiteFilter, priceMin, priceMax, sortBy]);

  // Filter unmatched source products
  const filteredUnmatched = useMemo(() => {
    if (!sourceSearch) return unmatched;
    const query = sourceSearch.toLowerCase();
    return unmatched.filter(p =>
      p.name.toLowerCase().includes(query) ||
      (p.sku && p.sku.toLowerCase().includes(query))
    );
  }, [unmatched, sourceSearch]);

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
          <div style={{ marginLeft: 'auto' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search products..."
              value={sourceSearch}
              onChange={e => setSourceSearch(e.target.value)}
              style={{ width: '250px' }}
            />
          </div>
        </div>
        {filteredUnmatched.length === 0 ? (
          <div className="empty-state">
            <p>{unmatched.length === 0 ? 'All source products have been matched!' : 'No products match your search.'}</p>
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
                {filteredUnmatched.map(product => (
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
          <div className="modal" style={{ maxWidth: '900px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Find Match for: {selectedSource.name}</h3>
              <button className="modal-close" onClick={() => setShowManualMatch(false)}>
                &times;
              </button>
            </div>
            <div className="modal-body" style={{ overflow: 'auto', flex: 1 }}>
              <div className="alert alert-info" style={{ marginBottom: '16px' }}>
                <strong>Source Product:</strong> {selectedSource.name}
                {selectedSource.sku && <span> | SKU: {selectedSource.sku}</span>}
                {selectedSource.price && <span> | Price: ${selectedSource.price.toFixed(2)}</span>}
              </div>

              {/* Search and Filters */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '12px',
                marginBottom: '16px',
                padding: '12px',
                background: '#f8f9fa',
                borderRadius: '8px'
              }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '12px', marginBottom: '4px' }}>Search</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search by name or SKU..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '12px', marginBottom: '4px' }}>Website</label>
                  <select
                    className="form-control"
                    value={websiteFilter}
                    onChange={e => setWebsiteFilter(e.target.value)}
                  >
                    <option value="all">All Websites</option>
                    {websites.map(site => (
                      <option key={site} value={site}>{site}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '12px', marginBottom: '4px' }}>Min Price</label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="Min"
                    value={priceMin}
                    onChange={e => setPriceMin(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '12px', marginBottom: '4px' }}>Max Price</label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="Max"
                    value={priceMax}
                    onChange={e => setPriceMax(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '12px', marginBottom: '4px' }}>Sort By</label>
                  <select
                    className="form-control"
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value)}
                  >
                    <option value="match_score">Match Score</option>
                    <option value="name">Name</option>
                    <option value="price_asc">Price (Low to High)</option>
                    <option value="price_desc">Price (High to Low)</option>
                  </select>
                </div>
              </div>

              <h4 style={{ marginBottom: '12px' }}>
                Suggested Matches ({filteredSuggestions.length})
              </h4>
              {filteredSuggestions.length === 0 ? (
                <p style={{ color: '#666', marginBottom: '16px' }}>No suggestions match your filters.</p>
              ) : (
                <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '16px' }}>
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
                      {filteredSuggestions.map(suggestion => (
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

              <h4 style={{ marginTop: '16px', marginBottom: '12px' }}>
                All Unmatched Competitors ({filteredCompetitors.length})
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
                    {filteredCompetitors.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', color: '#666' }}>
                          No products match your filters.
                        </td>
                      </tr>
                    ) : (
                      filteredCompetitors.map(product => (
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
                      ))
                    )}
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
