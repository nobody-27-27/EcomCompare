const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/ecomcompare.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  -- Websites table
  CREATE TABLE IF NOT EXISTS websites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL UNIQUE,
    name TEXT,
    is_source INTEGER DEFAULT 0,
    crawl_type TEXT DEFAULT 'auto',
    status TEXT DEFAULT 'pending',
    last_crawled_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Products table
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    website_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    price REAL,
    sku TEXT,
    image_url TEXT,
    product_url TEXT,
    raw_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE
  );

  -- Product matches table
  CREATE TABLE IF NOT EXISTS product_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_product_id INTEGER NOT NULL,
    competitor_product_id INTEGER NOT NULL,
    match_type TEXT NOT NULL,
    match_score REAL,
    is_confirmed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (competitor_product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE(source_product_id, competitor_product_id)
  );

  -- Crawl jobs table
  CREATE TABLE IF NOT EXISTS crawl_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    website_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    total_pages INTEGER DEFAULT 0,
    crawled_pages INTEGER DEFAULT 0,
    total_products INTEGER DEFAULT 0,
    error_message TEXT,
    started_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE
  );

  -- Create indexes
  CREATE INDEX IF NOT EXISTS idx_products_website ON products(website_id);
  CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
  CREATE INDEX IF NOT EXISTS idx_matches_source ON product_matches(source_product_id);
  CREATE INDEX IF NOT EXISTS idx_matches_competitor ON product_matches(competitor_product_id);
  CREATE INDEX IF NOT EXISTS idx_crawl_jobs_website ON crawl_jobs(website_id);
`);

module.exports = db;
