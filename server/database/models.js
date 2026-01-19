const { run, get, all, saveDatabase } = require('./init');

// Website model
const Website = {
  create: (data) => {
    const result = run(
      `INSERT INTO websites (url, name, is_source, crawl_type, status)
       VALUES (?, ?, ?, ?, ?)`,
      [
        data.url,
        data.name || new URL(data.url).hostname,
        data.is_source ? 1 : 0,
        data.crawl_type || 'auto',
        'pending'
      ]
    );
    return { id: result.lastInsertRowid, ...data };
  },

  findById: (id) => {
    return get('SELECT * FROM websites WHERE id = ?', [id]);
  },

  findByUrl: (url) => {
    return get('SELECT * FROM websites WHERE url = ?', [url]);
  },

  findAll: () => {
    return all('SELECT * FROM websites ORDER BY created_at DESC');
  },

  findSource: () => {
    return get('SELECT * FROM websites WHERE is_source = 1');
  },

  findCompetitors: () => {
    return all('SELECT * FROM websites WHERE is_source = 0');
  },

  update: (id, data) => {
    const fields = Object.keys(data);
    const values = fields.map(key => data[key]);
    const setClause = fields.map(key => `${key} = ?`).join(', ');
    return run(`UPDATE websites SET ${setClause} WHERE id = ?`, [...values, id]);
  },

  delete: (id) => {
    return run('DELETE FROM websites WHERE id = ?', [id]);
  },

  setSource: (id) => {
    run('UPDATE websites SET is_source = 0', []);
    return run('UPDATE websites SET is_source = 1 WHERE id = ?', [id]);
  }
};

// Product model
const Product = {
  create: (data) => {
    const result = run(
      `INSERT INTO products (website_id, name, price, sku, image_url, product_url, raw_data)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.website_id,
        data.name,
        data.price || null,
        data.sku || null,
        data.image_url || null,
        data.product_url || null,
        data.raw_data ? JSON.stringify(data.raw_data) : null
      ]
    );
    return { id: result.lastInsertRowid, ...data };
  },

  createMany: (products) => {
    const results = [];
    for (const item of products) {
      const result = run(
        `INSERT INTO products (website_id, name, price, sku, image_url, product_url, raw_data)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          item.website_id,
          item.name,
          item.price || null,
          item.sku || null,
          item.image_url || null,
          item.product_url || null,
          item.raw_data ? JSON.stringify(item.raw_data) : null
        ]
      );
      results.push({ id: result.lastInsertRowid, ...item });
    }
    saveDatabase();
    return results;
  },

  findById: (id) => {
    return get('SELECT * FROM products WHERE id = ?', [id]);
  },

  findByWebsite: (websiteId) => {
    return all('SELECT * FROM products WHERE website_id = ? ORDER BY name', [websiteId]);
  },

  findBySku: (sku) => {
    return all('SELECT * FROM products WHERE sku = ?', [sku]);
  },

  findAll: () => {
    return all(`
      SELECT p.*, w.name as website_name, w.url as website_url, w.is_source
      FROM products p
      JOIN websites w ON p.website_id = w.id
      ORDER BY p.name
    `);
  },

  findSourceProducts: () => {
    return all(`
      SELECT p.* FROM products p
      JOIN websites w ON p.website_id = w.id
      WHERE w.is_source = 1
      ORDER BY p.name
    `);
  },

  findCompetitorProducts: () => {
    return all(`
      SELECT p.*, w.name as website_name FROM products p
      JOIN websites w ON p.website_id = w.id
      WHERE w.is_source = 0
      ORDER BY w.name, p.name
    `);
  },

  count: (websiteId) => {
    if (websiteId) {
      const result = get('SELECT COUNT(*) as count FROM products WHERE website_id = ?', [websiteId]);
      return result ? result.count : 0;
    }
    const result = get('SELECT COUNT(*) as count FROM products');
    return result ? result.count : 0;
  },

  deleteByWebsite: (websiteId) => {
    return run('DELETE FROM products WHERE website_id = ?', [websiteId]);
  },

  delete: (id) => {
    return run('DELETE FROM products WHERE id = ?', [id]);
  }
};

// ProductMatch model
const ProductMatch = {
  create: (data) => {
    const result = run(
      `INSERT OR REPLACE INTO product_matches
       (source_product_id, competitor_product_id, match_type, match_score, is_confirmed)
       VALUES (?, ?, ?, ?, ?)`,
      [
        data.source_product_id,
        data.competitor_product_id,
        data.match_type,
        data.match_score || null,
        data.is_confirmed ? 1 : 0
      ]
    );
    return { id: result.lastInsertRowid, ...data };
  },

  createMany: (matches) => {
    for (const item of matches) {
      run(
        `INSERT OR REPLACE INTO product_matches
         (source_product_id, competitor_product_id, match_type, match_score, is_confirmed)
         VALUES (?, ?, ?, ?, ?)`,
        [
          item.source_product_id,
          item.competitor_product_id,
          item.match_type,
          item.match_score || null,
          item.is_confirmed ? 1 : 0
        ]
      );
    }
    saveDatabase();
  },

  findBySourceProduct: (sourceProductId) => {
    return all(`
      SELECT pm.*, p.name, p.price, p.sku, p.image_url, p.product_url,
             w.name as website_name
      FROM product_matches pm
      JOIN products p ON pm.competitor_product_id = p.id
      JOIN websites w ON p.website_id = w.id
      WHERE pm.source_product_id = ?
    `, [sourceProductId]);
  },

  findAll: () => {
    return all(`
      SELECT pm.*,
             sp.name as source_name, sp.price as source_price, sp.sku as source_sku,
             sp.image_url as source_image, sp.product_url as source_url,
             cp.name as competitor_name, cp.price as competitor_price, cp.sku as competitor_sku,
             cp.image_url as competitor_image, cp.product_url as competitor_url,
             sw.name as source_website, cw.name as competitor_website
      FROM product_matches pm
      JOIN products sp ON pm.source_product_id = sp.id
      JOIN products cp ON pm.competitor_product_id = cp.id
      JOIN websites sw ON sp.website_id = sw.id
      JOIN websites cw ON cp.website_id = cw.id
      ORDER BY sp.name
    `);
  },

  findUnmatched: () => {
    return all(`
      SELECT p.*, w.name as website_name
      FROM products p
      JOIN websites w ON p.website_id = w.id
      WHERE w.is_source = 1
      AND p.id NOT IN (SELECT source_product_id FROM product_matches)
      ORDER BY p.name
    `);
  },

  findUnmatchedCompetitors: () => {
    return all(`
      SELECT p.*, w.name as website_name
      FROM products p
      JOIN websites w ON p.website_id = w.id
      WHERE w.is_source = 0
      AND p.id NOT IN (SELECT competitor_product_id FROM product_matches)
      ORDER BY w.name, p.name
    `);
  },

  confirm: (id) => {
    return run('UPDATE product_matches SET is_confirmed = 1 WHERE id = ?', [id]);
  },

  delete: (id) => {
    return run('DELETE FROM product_matches WHERE id = ?', [id]);
  },

  deleteByProducts: (sourceId, competitorId) => {
    return run(
      'DELETE FROM product_matches WHERE source_product_id = ? AND competitor_product_id = ?',
      [sourceId, competitorId]
    );
  }
};

// CrawlJob model
const CrawlJob = {
  create: (websiteId) => {
    const result = run(
      `INSERT INTO crawl_jobs (website_id, status, started_at)
       VALUES (?, 'running', datetime('now'))`,
      [websiteId]
    );
    return { id: result.lastInsertRowid, website_id: websiteId, status: 'running' };
  },

  findById: (id) => {
    return get('SELECT * FROM crawl_jobs WHERE id = ?', [id]);
  },

  findByWebsite: (websiteId) => {
    return all(
      'SELECT * FROM crawl_jobs WHERE website_id = ? ORDER BY created_at DESC',
      [websiteId]
    );
  },

  findLatest: (websiteId) => {
    return get(
      'SELECT * FROM crawl_jobs WHERE website_id = ? ORDER BY created_at DESC LIMIT 1',
      [websiteId]
    );
  },

  findAll: () => {
    return all(`
      SELECT cj.*, w.name as website_name, w.url as website_url
      FROM crawl_jobs cj
      JOIN websites w ON cj.website_id = w.id
      ORDER BY cj.created_at DESC
    `);
  },

  findRunning: () => {
    return all(`
      SELECT cj.*, w.name as website_name, w.url as website_url
      FROM crawl_jobs cj
      JOIN websites w ON cj.website_id = w.id
      WHERE cj.status = 'running'
    `);
  },

  update: (id, data) => {
    const fields = Object.keys(data);
    const values = fields.map(key => data[key]);
    const setClause = fields.map(key => `${key} = ?`).join(', ');
    return run(`UPDATE crawl_jobs SET ${setClause} WHERE id = ?`, [...values, id]);
  },

  complete: (id, totalProducts) => {
    return run(
      `UPDATE crawl_jobs
       SET status = 'completed', total_products = ?, completed_at = datetime('now')
       WHERE id = ?`,
      [totalProducts, id]
    );
  },

  fail: (id, errorMessage) => {
    return run(
      `UPDATE crawl_jobs
       SET status = 'failed', error_message = ?, completed_at = datetime('now')
       WHERE id = ?`,
      [errorMessage, id]
    );
  }
};

module.exports = { Website, Product, ProductMatch, CrawlJob };
