import React, { useState, useEffect, useContext } from 'react';
import { SocketContext } from '../App';
import { websitesApi } from '../services/api';

function Websites() {
  const [websites, setWebsites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCookiesModal, setShowCookiesModal] = useState(false);
  const [editingWebsite, setEditingWebsite] = useState(null);
  const [cookiesWebsite, setCookiesWebsite] = useState(null);
  const [formData, setFormData] = useState({ url: '', name: '', crawl_type: 'auto', is_source: false });
  const [editFormData, setEditFormData] = useState({ name: '', crawl_type: 'auto' });
  const [cookiesData, setCookiesData] = useState('');
  const [hasCookies, setHasCookies] = useState(false);
  const [error, setError] = useState('');
  const { crawlProgress, clearProgress } = useContext(SocketContext);

  useEffect(() => {
    loadWebsites();
  }, []);

  // Reload websites when any crawl completes or errors
  useEffect(() => {
    const hasCompletedOrError = Object.values(crawlProgress).some(
      p => p.status === 'completed' || p.status === 'error'
    );
    if (hasCompletedOrError) {
      loadWebsites();
    }
  }, [crawlProgress]);

  const loadWebsites = async () => {
    try {
      const data = await websitesApi.getAll();
      setWebsites(data);
    } catch (error) {
      console.error('Error loading websites:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await websitesApi.create(formData);
      setShowModal(false);
      setFormData({ url: '', name: '', crawl_type: 'auto', is_source: false });
      loadWebsites();
    } catch (error) {
      setError(error.message);
    }
  };

  const handleEdit = (website) => {
    setEditingWebsite(website);
    setEditFormData({
      name: website.name || '',
      crawl_type: website.crawl_type || 'auto'
    });
    setError('');
    setShowEditModal(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await websitesApi.update(editingWebsite.id, editFormData);
      setShowEditModal(false);
      setEditingWebsite(null);
      loadWebsites();
    } catch (error) {
      setError(error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this website? All products will be deleted.')) {
      return;
    }

    try {
      await websitesApi.delete(id);
      loadWebsites();
    } catch (error) {
      alert('Error deleting website: ' + error.message);
    }
  };

  const handleSetSource = async (id) => {
    try {
      await websitesApi.setSource(id);
      loadWebsites();
    } catch (error) {
      alert('Error setting source: ' + error.message);
    }
  };

  const handleStartCrawl = async (id) => {
    try {
      await websitesApi.startCrawl(id);
      loadWebsites();
    } catch (error) {
      alert('Error starting crawl: ' + error.message);
    }
  };

  const handleCancelCrawl = async (id) => {
    try {
      const result = await websitesApi.cancelCrawl(id);
      clearProgress(id);
      loadWebsites();
      if (result.message) {
        console.log(result.message);
      }
    } catch (error) {
      alert('Error canceling crawl: ' + error.message);
    }
  };

  const handleResetStatus = async (id) => {
    try {
      await websitesApi.resetStatus(id);
      clearProgress(id);
      loadWebsites();
    } catch (error) {
      alert('Error resetting status: ' + error.message);
    }
  };

  // Cookies handlers
  const handleOpenCookies = async (website) => {
    setCookiesWebsite(website);
    setCookiesData('');
    setError('');
    try {
      const result = await websitesApi.getCookies(website.id);
      setHasCookies(result.hasCookies);
      if (result.hasCookies) {
        setCookiesData(JSON.stringify(result.cookies, null, 2));
      }
    } catch (error) {
      console.error('Error loading cookies:', error);
    }
    setShowCookiesModal(true);
  };

  const handleImportCookies = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const cookies = JSON.parse(cookiesData);
      await websitesApi.importCookies(cookiesWebsite.id, cookies);
      setShowCookiesModal(false);
      setCookiesWebsite(null);
      alert('Cookies imported successfully! The crawler will now use these cookies.');
    } catch (error) {
      if (error instanceof SyntaxError) {
        setError('Invalid JSON format. Please paste valid JSON cookies.');
      } else {
        setError(error.message);
      }
    }
  };

  const handleClearCookies = async () => {
    if (!window.confirm('Are you sure you want to clear cookies for this website?')) {
      return;
    }

    try {
      await websitesApi.clearCookies(cookiesWebsite.id);
      setCookiesData('');
      setHasCookies(false);
      alert('Cookies cleared successfully.');
    } catch (error) {
      alert('Error clearing cookies: ' + error.message);
    }
  };

  const getCrawlStatus = (website) => {
    const progress = crawlProgress[website.id];
    if (progress) {
      if (progress.status === 'completed') {
        return { status: 'completed', message: `Found ${progress.productsFound} products` };
      }
      if (progress.status === 'error') {
        return { status: 'error', message: progress.error };
      }
      return {
        status: 'running',
        pagesCrawled: progress.pagesCrawled || 0,
        productsFound: progress.productsFound || 0
      };
    }
    return null;
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="websites-page">
      <div className="page-header">
        <h2>Websites</h2>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          Add Website
        </button>
      </div>

      {websites.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <h3>No websites added yet</h3>
            <p>Add your source e-commerce website and competitor websites to start comparing prices.</p>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              Add Your First Website
            </button>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Website</th>
                  <th>Type</th>
                  <th>Crawl Method</th>
                  <th>Products</th>
                  <th>Status</th>
                  <th>Last Crawled</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {websites.map(website => {
                  const crawlStatus = getCrawlStatus(website);
                  const isRunning = crawlStatus?.status === 'running';
                  const isCompleted = crawlStatus?.status === 'completed';
                  const isError = crawlStatus?.status === 'error';
                  // Only show as stuck if database says crawling but socket says nothing or still running
                  const showAsStuck = !isRunning && !isCompleted && !isError && website.status === 'crawling';

                  return (
                    <tr key={website.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{website.name}</div>
                        <a
                          href={website.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: '0.8125rem', color: 'var(--text-light)' }}
                        >
                          {website.url}
                        </a>
                      </td>
                      <td>
                        <span className={`badge ${website.is_source ? 'badge-info' : 'badge-secondary'}`}>
                          {website.is_source ? 'Source' : 'Competitor'}
                        </span>
                      </td>
                      <td style={{ textTransform: 'capitalize' }}>{website.crawl_type}</td>
                      <td>{website.product_count}</td>
                      <td>
                        {isRunning ? (
                          <div>
                            <span className="badge badge-warning">Crawling...</span>
                            {crawlStatus && (
                              <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                                {crawlStatus.pagesCrawled} pages | {crawlStatus.productsFound} products
                              </div>
                            )}
                          </div>
                        ) : showAsStuck ? (
                          <div>
                            <span className="badge badge-warning" style={{ opacity: 0.7 }}>Stuck</span>
                            <div style={{ fontSize: '0.75rem', marginTop: '4px', color: '#999' }}>
                              Click Reset to fix
                            </div>
                          </div>
                        ) : (
                          <span className={`badge badge-${
                            website.status === 'completed' ? 'success' :
                            website.status === 'failed' ? 'danger' :
                            website.status === 'cancelled' ? 'secondary' : 'secondary'
                          }`}>
                            {website.status}
                          </span>
                        )}
                      </td>
                      <td>
                        {website.last_crawled_at
                          ? new Date(website.last_crawled_at).toLocaleString()
                          : 'Never'}
                      </td>
                      <td>
                        <div className="actions">
                          {(isRunning || showAsStuck) ? (
                            <>
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => handleCancelCrawl(website.id)}
                              >
                                Cancel
                              </button>
                              <button
                                className="btn btn-sm btn-outline"
                                onClick={() => handleResetStatus(website.id)}
                                title="Reset stuck status"
                              >
                                Reset
                              </button>
                            </>
                          ) : (
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => handleStartCrawl(website.id)}
                            >
                              Crawl
                            </button>
                          )}
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={() => handleEdit(website)}
                            title="Edit website"
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={() => handleOpenCookies(website)}
                            title="Import cookies for CAPTCHA bypass"
                            style={{ fontSize: '0.75rem' }}
                          >
                            Cookies
                          </button>
                          {!website.is_source && (
                            <button
                              className="btn btn-sm btn-outline"
                              onClick={() => handleSetSource(website.id)}
                            >
                              Set as Source
                            </button>
                          )}
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDelete(website.id)}
                            disabled={isRunning}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Website Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Website</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <div className="alert alert-danger">{error}</div>}

                <div className="form-group">
                  <label>Website URL *</label>
                  <input
                    type="url"
                    className="form-control"
                    value={formData.url}
                    onChange={e => setFormData({ ...formData, url: e.target.value })}
                    placeholder="https://example.com"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Name (optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="My Store"
                  />
                </div>

                <div className="form-group">
                  <label>Crawl Method</label>
                  <select
                    className="form-control"
                    value={formData.crawl_type}
                    onChange={e => setFormData({ ...formData, crawl_type: e.target.value })}
                  >
                    <option value="auto">Auto-detect</option>
                    <option value="cheerio">Static HTML (Cheerio)</option>
                    <option value="puppeteer">JavaScript Rendered (Puppeteer)</option>
                  </select>
                  <small style={{ color: 'var(--text-light)', marginTop: '4px', display: 'block' }}>
                    Auto-detect will analyze the website and choose the best method.
                  </small>
                </div>

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      checked={formData.is_source}
                      onChange={e => setFormData({ ...formData, is_source: e.target.checked })}
                    />
                    Set as Source Website
                  </label>
                  <small style={{ color: 'var(--text-light)', marginTop: '4px', display: 'block' }}>
                    The source website is your store. Competitor prices will be compared to it.
                  </small>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add Website
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Website Modal */}
      {showEditModal && editingWebsite && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Website</h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleUpdate}>
              <div className="modal-body">
                {error && <div className="alert alert-danger">{error}</div>}

                <div className="form-group">
                  <label>Website URL</label>
                  <input
                    type="url"
                    className="form-control"
                    value={editingWebsite.url}
                    disabled
                    style={{ background: '#f5f5f5', cursor: 'not-allowed' }}
                  />
                  <small style={{ color: 'var(--text-light)', marginTop: '4px', display: 'block' }}>
                    URL cannot be changed. Delete and re-add if needed.
                  </small>
                </div>

                <div className="form-group">
                  <label>Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editFormData.name}
                    onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                    placeholder="My Store"
                  />
                </div>

                <div className="form-group">
                  <label>Crawl Method</label>
                  <select
                    className="form-control"
                    value={editFormData.crawl_type}
                    onChange={e => setEditFormData({ ...editFormData, crawl_type: e.target.value })}
                  >
                    <option value="auto">Auto-detect</option>
                    <option value="cheerio">Static HTML (Cheerio)</option>
                    <option value="puppeteer">JavaScript Rendered (Puppeteer)</option>
                  </select>
                  <small style={{ color: 'var(--text-light)', marginTop: '4px', display: 'block' }}>
                    Try "Puppeteer" if the website uses JavaScript to load products.
                  </small>
                </div>

                <div className="alert alert-info" style={{ marginTop: '16px' }}>
                  <strong>Current Status:</strong> {editingWebsite.status} |
                  <strong> Products:</strong> {editingWebsite.product_count || 0}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Cookies Modal */}
      {showCookiesModal && cookiesWebsite && (
        <div className="modal-overlay" onClick={() => setShowCookiesModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>Import Cookies - {cookiesWebsite.name}</h3>
              <button className="modal-close" onClick={() => setShowCookiesModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleImportCookies}>
              <div className="modal-body">
                {error && <div className="alert alert-danger">{error}</div>}

                <div className="alert alert-info">
                  <strong>How to use:</strong>
                  <ol style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                    <li>Install a browser extension like "Cookie-Editor" or "EditThisCookie"</li>
                    <li>Visit <a href={cookiesWebsite.url} target="_blank" rel="noopener noreferrer">{cookiesWebsite.url}</a> and solve the CAPTCHA</li>
                    <li>Use the extension to export cookies as JSON</li>
                    <li>Paste the JSON below and click Import</li>
                  </ol>
                </div>

                <div className="form-group">
                  <label>Cookies JSON</label>
                  <textarea
                    className="form-control"
                    value={cookiesData}
                    onChange={e => setCookiesData(e.target.value)}
                    placeholder='[{"name": "session", "value": "abc123", "domain": ".example.com", ...}]'
                    rows={10}
                    style={{ fontFamily: 'monospace', fontSize: '12px' }}
                  />
                  <small style={{ color: 'var(--text-light)', marginTop: '4px', display: 'block' }}>
                    Paste the JSON array of cookies exported from your browser extension.
                  </small>
                </div>

                {hasCookies && (
                  <div className="alert alert-success" style={{ marginTop: '16px' }}>
                    This website has cookies saved. They will be used during crawling.
                  </div>
                )}
              </div>
              <div className="modal-footer">
                {hasCookies && (
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={handleClearCookies}
                    style={{ marginRight: 'auto' }}
                  >
                    Clear Cookies
                  </button>
                )}
                <button type="button" className="btn btn-outline" onClick={() => setShowCookiesModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={!cookiesData.trim()}>
                  Import Cookies
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Websites;
