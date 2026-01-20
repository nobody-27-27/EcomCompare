const API_BASE = '/api';

async function handleResponse(response) {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'API request failed');
  }
  return data;
}

// Websites API
export const websitesApi = {
  getAll: async () => {
    const response = await fetch(`${API_BASE}/websites`);
    return handleResponse(response);
  },

  getById: async (id) => {
    const response = await fetch(`${API_BASE}/websites/${id}`);
    return handleResponse(response);
  },

  create: async (data) => {
    const response = await fetch(`${API_BASE}/websites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse(response);
  },

  update: async (id, data) => {
    const response = await fetch(`${API_BASE}/websites/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse(response);
  },

  delete: async (id) => {
    const response = await fetch(`${API_BASE}/websites/${id}`, {
      method: 'DELETE'
    });
    return handleResponse(response);
  },

  setSource: async (id) => {
    const response = await fetch(`${API_BASE}/websites/${id}/set-source`, {
      method: 'POST'
    });
    return handleResponse(response);
  },

  startCrawl: async (id, options = {}) => {
    const response = await fetch(`${API_BASE}/websites/${id}/crawl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    });
    return handleResponse(response);
  },

  cancelCrawl: async (id) => {
    const response = await fetch(`${API_BASE}/websites/${id}/crawl/cancel`, {
      method: 'POST'
    });
    return handleResponse(response);
  },

  getJobs: async (id) => {
    const response = await fetch(`${API_BASE}/websites/${id}/jobs`);
    return handleResponse(response);
  },

  resetStatus: async (id) => {
    const response = await fetch(`${API_BASE}/websites/${id}/reset-status`, {
      method: 'POST'
    });
    return handleResponse(response);
  }
};

// Products API
export const productsApi = {
  getAll: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE}/products${query ? `?${query}` : ''}`);
    return handleResponse(response);
  },

  getById: async (id) => {
    const response = await fetch(`${API_BASE}/products/${id}`);
    return handleResponse(response);
  },

  search: async (query) => {
    const response = await fetch(`${API_BASE}/products/search/${encodeURIComponent(query)}`);
    return handleResponse(response);
  },

  getStats: async () => {
    const response = await fetch(`${API_BASE}/products/stats/overview`);
    return handleResponse(response);
  },

  delete: async (id) => {
    const response = await fetch(`${API_BASE}/products/${id}`, {
      method: 'DELETE'
    });
    return handleResponse(response);
  },

  bulkDelete: async (ids) => {
    const response = await fetch(`${API_BASE}/products/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });
    return handleResponse(response);
  }
};

// Matching API
export const matchingApi = {
  getAll: async () => {
    const response = await fetch(`${API_BASE}/matching`);
    return handleResponse(response);
  },

  getUnmatched: async () => {
    const response = await fetch(`${API_BASE}/matching/unmatched`);
    return handleResponse(response);
  },

  getUnmatchedCompetitors: async () => {
    const response = await fetch(`${API_BASE}/matching/unmatched-competitors`);
    return handleResponse(response);
  },

  getSuggestions: async (sourceId, limit = 10) => {
    const response = await fetch(`${API_BASE}/matching/suggestions/${sourceId}?limit=${limit}`);
    return handleResponse(response);
  },

  runMatching: async (options = {}) => {
    const response = await fetch(`${API_BASE}/matching/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    });
    return handleResponse(response);
  },

  createManual: async (sourceProductId, competitorProductId) => {
    const response = await fetch(`${API_BASE}/matching/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_product_id: sourceProductId,
        competitor_product_id: competitorProductId
      })
    });
    return handleResponse(response);
  },

  confirm: async (id) => {
    const response = await fetch(`${API_BASE}/matching/${id}/confirm`, {
      method: 'POST'
    });
    return handleResponse(response);
  },

  delete: async (id) => {
    const response = await fetch(`${API_BASE}/matching/${id}`, {
      method: 'DELETE'
    });
    return handleResponse(response);
  },

  getStats: async () => {
    const response = await fetch(`${API_BASE}/matching/stats`);
    return handleResponse(response);
  },

  getComparison: async () => {
    const response = await fetch(`${API_BASE}/matching/comparison`);
    return handleResponse(response);
  }
};

// Export API
export const exportApi = {
  products: (format = 'json', websiteId = null) => {
    const params = new URLSearchParams({ format });
    if (websiteId) params.append('website_id', websiteId);
    return `${API_BASE}/export/products?${params}`;
  },

  comparison: (format = 'json') => {
    return `${API_BASE}/export/comparison?format=${format}`;
  },

  unmatched: (format = 'json') => {
    return `${API_BASE}/export/unmatched?format=${format}`;
  },

  report: (format = 'json') => {
    return `${API_BASE}/export/report?format=${format}`;
  }
};

// Jobs API
export const jobsApi = {
  getAll: async () => {
    const response = await fetch(`${API_BASE}/jobs`);
    return handleResponse(response);
  },

  getRunning: async () => {
    const response = await fetch(`${API_BASE}/jobs/running`);
    return handleResponse(response);
  }
};
