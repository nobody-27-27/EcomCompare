const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/ecomcompare.db');
const dataDir = path.dirname(dbPath);

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db = null;
let SQL = null;

// Schema definition
const schema = `
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
`;

// Initialize database
async function initDatabase() {
  if (db) return db;

  SQL = await initSqlJs();

  // Try to load existing database
  if (fs.existsSync(dbPath)) {
    try {
      const fileBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(fileBuffer);
      console.log('Loaded existing database from', dbPath);
    } catch (error) {
      console.log('Error loading database, creating new one:', error.message);
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
    console.log('Created new database');
  }

  // Enable foreign keys and create schema
  db.run('PRAGMA foreign_keys = ON');
  db.run(schema);

  // Save to disk
  saveDatabase();

  return db;
}

// Save database to disk
function saveDatabase() {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  } catch (error) {
    console.error('Error saving database:', error.message);
  }
}

// Get database instance (sync version for compatibility)
function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

// Helper to run a query and return affected rows info
function run(sql, params = []) {
  const database = getDb();
  database.run(sql, params);
  saveDatabase();
  return {
    lastInsertRowid: database.exec('SELECT last_insert_rowid()')[0]?.values[0][0] || 0,
    changes: database.getRowsModified()
  };
}

// Helper to get a single row
function get(sql, params = []) {
  const database = getDb();
  const stmt = database.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return undefined;
}

// Helper to get all rows
function all(sql, params = []) {
  const database = getDb();
  const stmt = database.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// Helper to execute multiple statements
function exec(sql) {
  const database = getDb();
  database.run(sql);
  saveDatabase();
}

module.exports = {
  initDatabase,
  saveDatabase,
  getDb,
  run,
  get,
  all,
  exec
};
