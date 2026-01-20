import React, { useState, useEffect } from 'react';
import { productsApi, websitesApi } from '../services/api';

function Products() {
  const [products, setProducts] = useState([]);
  const [websites, setWebsites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ website_id: '', search: '' });
  const [activeTab, setActiveTab] = useState('all');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadProducts();
  }, [activeTab, filter.website_id]);

  const loadData = async () => {
    try {
      const sites = await websitesApi.getAll();
      setWebsites(sites);
    } catch (error) {
      console.error('Error loading websites:', error);
    }
    await loadProducts();
  };

  const loadProducts = async () => {
    setLoading(true);
    setSelectedIds(new Set()); // Clear selection when reloading
    try {
      let params = {};
      if (filter.website_id) {
        params.website_id = filter.website_id;
      } else if (activeTab === 'source') {
        params.source_only = 'true';
      } else if (activeTab === 'competitor') {
        params.competitor_only = 'true';
      }

      const data = await productsApi.getAll(params);
      setProducts(data);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) {
      return;
    }

    try {
      await productsApi.delete(id);
      loadProducts();
    } catch (error) {
      alert('Error deleting product: ' + error.message);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} products?`)) {
      return;
    }

    setDeleting(true);
    try {
      await productsApi.bulkDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
      loadProducts();
    } catch (error) {
      alert('Error deleting products: ' + error.message);
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelect = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map(p => p.id)));
    }
  };

  const filteredProducts = products.filter(p => {
    if (!filter.search) return true;
    const search = filter.search.toLowerCase();
    return p.name.toLowerCase().includes(search) ||
           (p.sku && p.sku.toLowerCase().includes(search));
  });

  const allSelected = filteredProducts.length > 0 && selectedIds.size === filteredProducts.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < filteredProducts.length;

  return (
    <div className="products-page">
      <div className="page-header">
        <h2>Products</h2>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {selectedIds.size > 0 && (
            <button
              className="btn btn-danger"
              onClick={handleBulkDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : `Delete Selected (${selectedIds.size})`}
            </button>
          )}
          <span style={{ color: 'var(--text-light)' }}>
            {filteredProducts.length} products
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All Products
        </button>
        <button
          className={`tab ${activeTab === 'source' ? 'active' : ''}`}
          onClick={() => setActiveTab('source')}
        >
          Source Products
        </button>
        <button
          className={`tab ${activeTab === 'competitor' ? 'active' : ''}`}
          onClick={() => setActiveTab('competitor')}
        >
          Competitor Products
        </button>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0, flex: '1', minWidth: '200px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search by name or SKU..."
              value={filter.search}
              onChange={e => setFilter({ ...filter, search: e.target.value })}
            />
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: '200px' }}>
            <select
              className="form-control"
              value={filter.website_id}
              onChange={e => setFilter({ ...filter, website_id: e.target.value })}
            >
              <option value="">All Websites</option>
              {websites.map(w => (
                <option key={w.id} value={w.id}>
                  {w.name} {w.is_source ? '(Source)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Products Table */}
      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <h3>No products found</h3>
            <p>
              {products.length === 0
                ? 'Start by crawling a website to collect products.'
                : 'Try adjusting your search or filter criteria.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={el => {
                        if (el) el.indeterminate = someSelected;
                      }}
                      onChange={toggleSelectAll}
                      title="Select all"
                    />
                  </th>
                  <th style={{ width: '60px' }}>Image</th>
                  <th>Name</th>
                  <th>Website</th>
                  <th>SKU</th>
                  <th>Price</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map(product => (
                  <tr key={product.id} className={selectedIds.has(product.id) ? 'selected-row' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(product.id)}
                        onChange={() => toggleSelect(product.id)}
                      />
                    </td>
                    <td>
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          style={{
                            width: '50px',
                            height: '50px',
                            objectFit: 'cover',
                            borderRadius: '4px',
                            background: 'var(--background)'
                          }}
                          onError={e => {
                            e.target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '50px',
                            height: '50px',
                            background: 'var(--background)',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-light)',
                            fontSize: '0.75rem'
                          }}
                        >
                          No img
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{product.name}</div>
                      {product.product_url && (
                        <a
                          href={product.product_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: '0.75rem', color: 'var(--primary)' }}
                        >
                          View Product
                        </a>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${product.is_source ? 'badge-info' : 'badge-secondary'}`}>
                        {product.website_name}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                      {product.sku || '-'}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {product.price !== null ? `₺${product.price.toFixed(2)}` : '-'}
                    </td>
                    <td>
                      <div className="actions">
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(product.id)}
                        >
                          Delete
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

export default Products;
