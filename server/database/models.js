const db = require('./init');

// Website model
const Website = {
  create: (data) => {
    const stmt = db.prepare(`
      INSERT INTO websites (url, name, is_source, crawl_type, status)
      VALUES (@url, @name, @is_source, @crawl_type, @status)
    `);
    const result = stmt.run({
      url: data.url,
      name: data.name || new URL(data.url).hostname,
      is_source: data.is_source ? 1 : 0,
      crawl_type: data.crawl_type || 'auto',
      status: 'pending'
    });
    return { id: result.lastInsertRowid, ...data };
  },

  findById: (id) => {
    return db.prepare('SELECT * FROM websites WHERE id = ?').get(id);
  },

  findByUrl: (url) => {
    return db.prepare('SELECT * FROM websites WHERE url = ?').get(url);
  },

  findAll: () => {
    return db.prepare('SELECT * FROM websites ORDER BY created_at DESC').all();
  },

  findSource: () => {
    return db.prepare('SELECT * FROM websites WHERE is_source = 1').get();
  },

  findCompetitors: () => {
    return db.prepare('SELECT * FROM websites WHERE is_source = 0').all();
  },

  update: (id, data) => {
    const fields = Object.keys(data).map(key => `${key} = @${key}`).join(', ');
    const stmt = db.prepare(`UPDATE websites SET ${fields} WHERE id = @id`);
    return stmt.run({ ...data, id });
  },

  delete: (id) => {
    return db.prepare('DELETE FROM websites WHERE id = ?').run(id);
  },

  setSource: (id) => {
    db.prepare('UPDATE websites SET is_source = 0').run();
    return db.prepare('UPDATE websites SET is_source = 1 WHERE id = ?').run(id);
  }
};

// Product model
const Product = {
  create: (data) => {
    const stmt = db.prepare(`
      INSERT INTO products (website_id, name, price, sku, image_url, product_url, raw_data)
      VALUES (@website_id, @name, @price, @sku, @image_url, @product_url, @raw_data)
    `);
    const result = stmt.run({
      website_id: data.website_id,
      name: data.name,
      price: data.price || null,
      sku: data.sku || null,
      image_url: data.image_url || null,
      product_url: data.product_url || null,
      raw_data: data.raw_data ? JSON.stringify(data.raw_data) : null
    });
    return { id: result.lastInsertRowid, ...data };
  },

  createMany: (products) => {
    const stmt = db.prepare(`
      INSERT INTO products (website_id, name, price, sku, image_url, product_url, raw_data)
      VALUES (@website_id, @name, @price, @sku, @image_url, @product_url, @raw_data)
    `);
    const insertMany = db.transaction((items) => {
      const results = [];
      for (const item of items) {
        const result = stmt.run({
          website_id: item.website_id,
          name: item.name,
          price: item.price || null,
          sku: item.sku || null,
          image_url: item.image_url || null,
          product_url: item.product_url || null,
          raw_data: item.raw_data ? JSON.stringify(item.raw_data) : null
        });
        results.push({ id: result.lastInsertRowid, ...item });
      }
      return results;
    });
    return insertMany(products);
  },

  findById: (id) => {
    return db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  },

  findByWebsite: (websiteId) => {
    return db.prepare('SELECT * FROM products WHERE website_id = ? ORDER BY name').all(websiteId);
  },

  findBySku: (sku) => {
    return db.prepare('SELECT * FROM products WHERE sku = ?').all(sku);
  },

  findAll: () => {
    return db.prepare(`
      SELECT p.*, w.name as website_name, w.url as website_url, w.is_source
      FROM products p
      JOIN websites w ON p.website_id = w.id
      ORDER BY p.name
    `).all();
  },

  findSourceProducts: () => {
    return db.prepare(`
      SELECT p.* FROM products p
      JOIN websites w ON p.website_id = w.id
      WHERE w.is_source = 1
      ORDER BY p.name
    `).all();
  },

  findCompetitorProducts: () => {
    return db.prepare(`
      SELECT p.*, w.name as website_name FROM products p
      JOIN websites w ON p.website_id = w.id
      WHERE w.is_source = 0
      ORDER BY w.name, p.name
    `).all();
  },

  count: (websiteId) => {
    if (websiteId) {
      return db.prepare('SELECT COUNT(*) as count FROM products WHERE website_id = ?').get(websiteId).count;
    }
    return db.prepare('SELECT COUNT(*) as count FROM products').get().count;
  },

  deleteByWebsite: (websiteId) => {
    return db.prepare('DELETE FROM products WHERE website_id = ?').run(websiteId);
  },

  delete: (id) => {
    return db.prepare('DELETE FROM products WHERE id = ?').run(id);
  }
};

// ProductMatch model
const ProductMatch = {
  create: (data) => {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO product_matches
      (source_product_id, competitor_product_id, match_type, match_score, is_confirmed)
      VALUES (@source_product_id, @competitor_product_id, @match_type, @match_score, @is_confirmed)
    `);
    const result = stmt.run({
      source_product_id: data.source_product_id,
      competitor_product_id: data.competitor_product_id,
      match_type: data.match_type,
      match_score: data.match_score || null,
      is_confirmed: data.is_confirmed ? 1 : 0
    });
    return { id: result.lastInsertRowid, ...data };
  },

  createMany: (matches) => {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO product_matches
      (source_product_id, competitor_product_id, match_type, match_score, is_confirmed)
      VALUES (@source_product_id, @competitor_product_id, @match_type, @match_score, @is_confirmed)
    `);
    const insertMany = db.transaction((items) => {
      for (const item of items) {
        stmt.run({
          source_product_id: item.source_product_id,
          competitor_product_id: item.competitor_product_id,
          match_type: item.match_type,
          match_score: item.match_score || null,
          is_confirmed: item.is_confirmed ? 1 : 0
        });
      }
    });
    return insertMany(matches);
  },

  findBySourceProduct: (sourceProductId) => {
    return db.prepare(`
      SELECT pm.*, p.name, p.price, p.sku, p.image_url, p.product_url,
             w.name as website_name
      FROM product_matches pm
      JOIN products p ON pm.competitor_product_id = p.id
      JOIN websites w ON p.website_id = w.id
      WHERE pm.source_product_id = ?
    `).all(sourceProductId);
  },

  findAll: () => {
    return db.prepare(`
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
    `).all();
  },

  findUnmatched: () => {
    return db.prepare(`
      SELECT p.*, w.name as website_name
      FROM products p
      JOIN websites w ON p.website_id = w.id
      WHERE w.is_source = 1
      AND p.id NOT IN (SELECT source_product_id FROM product_matches)
      ORDER BY p.name
    `).all();
  },

  findUnmatchedCompetitors: () => {
    return db.prepare(`
      SELECT p.*, w.name as website_name
      FROM products p
      JOIN websites w ON p.website_id = w.id
      WHERE w.is_source = 0
      AND p.id NOT IN (SELECT competitor_product_id FROM product_matches)
      ORDER BY w.name, p.name
    `).all();
  },

  confirm: (id) => {
    return db.prepare('UPDATE product_matches SET is_confirmed = 1 WHERE id = ?').run(id);
  },

  delete: (id) => {
    return db.prepare('DELETE FROM product_matches WHERE id = ?').run(id);
  },

  deleteByProducts: (sourceId, competitorId) => {
    return db.prepare(
      'DELETE FROM product_matches WHERE source_product_id = ? AND competitor_product_id = ?'
    ).run(sourceId, competitorId);
  }
};

// CrawlJob model
const CrawlJob = {
  create: (websiteId) => {
    const stmt = db.prepare(`
      INSERT INTO crawl_jobs (website_id, status, started_at)
      VALUES (?, 'running', datetime('now'))
    `);
    const result = stmt.run(websiteId);
    return { id: result.lastInsertRowid, website_id: websiteId, status: 'running' };
  },

  findById: (id) => {
    return db.prepare('SELECT * FROM crawl_jobs WHERE id = ?').get(id);
  },

  findByWebsite: (websiteId) => {
    return db.prepare(
      'SELECT * FROM crawl_jobs WHERE website_id = ? ORDER BY created_at DESC'
    ).all(websiteId);
  },

  findLatest: (websiteId) => {
    return db.prepare(
      'SELECT * FROM crawl_jobs WHERE website_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(websiteId);
  },

  findAll: () => {
    return db.prepare(`
      SELECT cj.*, w.name as website_name, w.url as website_url
      FROM crawl_jobs cj
      JOIN websites w ON cj.website_id = w.id
      ORDER BY cj.created_at DESC
    `).all();
  },

  findRunning: () => {
    return db.prepare(`
      SELECT cj.*, w.name as website_name, w.url as website_url
      FROM crawl_jobs cj
      JOIN websites w ON cj.website_id = w.id
      WHERE cj.status = 'running'
    `).all();
  },

  update: (id, data) => {
    const fields = Object.keys(data).map(key => `${key} = @${key}`).join(', ');
    const stmt = db.prepare(`UPDATE crawl_jobs SET ${fields} WHERE id = @id`);
    return stmt.run({ ...data, id });
  },

  complete: (id, totalProducts) => {
    return db.prepare(`
      UPDATE crawl_jobs
      SET status = 'completed', total_products = ?, completed_at = datetime('now')
      WHERE id = ?
    `).run(totalProducts, id);
  },

  fail: (id, errorMessage) => {
    return db.prepare(`
      UPDATE crawl_jobs
      SET status = 'failed', error_message = ?, completed_at = datetime('now')
      WHERE id = ?
    `).run(errorMessage, id);
  }
};

module.exports = { Website, Product, ProductMatch, CrawlJob };
