# EcomCompare

E-commerce Product Comparison Crawler - A Node.js application to crawl e-commerce websites and compare product prices across competitors.

## Features

- **Web Crawling**: Automatically crawl e-commerce websites to extract products
  - **Puppeteer**: For JavaScript-rendered sites (React, Vue, Angular, etc.)
  - **Cheerio**: For static HTML sites (faster, lighter)
  - Auto-detection of the best crawling method

- **Product Extraction**: Extracts key product data
  - Product name
  - Price
  - SKU/Product ID
  - Image URL
  - Product URL

- **Product Matching**: Multiple matching strategies
  - Exact SKU matching
  - Fuzzy name matching (Levenshtein distance)
  - Word overlap similarity (Jaccard index)
  - Manual matching interface for unmatched items

- **Price Comparison**: Compare your prices with competitors
  - Visual comparison interface
  - Price difference calculations
  - Filter by price status (cheaper/same/expensive)

- **Data Export**: Export data in multiple formats
  - CSV export
  - JSON export
  - Per-website exports
  - Full comparison reports

## Tech Stack

- **Backend**: Node.js, Express
- **Database**: SQLite (via better-sqlite3)
- **Crawling**: Puppeteer, Cheerio
- **Frontend**: React
- **Real-time Updates**: Socket.IO

## Installation

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd EcomCompare
```

2. Install all dependencies:
```bash
npm run install-all
```

This will install both server and client dependencies.

## Running the Application

### Development Mode

Run both server and client with hot-reload:
```bash
npm run dev
```

Or run them separately:
```bash
# Terminal 1 - Backend
npm run server

# Terminal 2 - Frontend
npm run client
```

### Production Mode

1. Build the frontend:
```bash
npm run build
```

2. Start the server:
```bash
NODE_ENV=production npm start
```

The application will be available at `http://localhost:5000`

## Usage

### 1. Add Websites

1. Navigate to the **Websites** page
2. Click **Add Website**
3. Enter the website URL
4. Select crawl method (auto-detect recommended)
5. Mark one website as your **Source** (your store)
6. Add competitor websites

### 2. Crawl Websites

1. Click **Crawl** next to each website
2. Monitor progress in real-time via the dashboard
3. View crawled products on the **Products** page

### 3. Match Products

1. Navigate to the **Matching** page
2. Configure matching options:
   - **Minimum Similarity**: 0-1 threshold for fuzzy matching
   - **Max Matches Per Product**: Limit matches per source product
   - **Allow Duplicates**: Allow a competitor product to match multiple source products
3. Click **Run Automatic Matching**
4. For unmatched products, use **Find Match** for manual matching

### 4. View Comparisons

1. Navigate to the **Comparison** page
2. See all your products with competitor matches
3. Filter by:
   - Search term
   - Match status (matched/unmatched)
   - Price comparison (cheaper/same/expensive)
4. Confirm or remove matches as needed

### 5. Export Data

1. Navigate to the **Export** page
2. Choose export type:
   - **Products**: All crawled products
   - **Price Comparison**: Matched products with price differences
   - **Unmatched**: Products without matches
   - **Full Report**: Comprehensive data with statistics
3. Download as CSV or JSON

## API Endpoints

### Websites
- `GET /api/websites` - List all websites
- `POST /api/websites` - Add a website
- `PUT /api/websites/:id` - Update a website
- `DELETE /api/websites/:id` - Delete a website
- `POST /api/websites/:id/set-source` - Set as source
- `POST /api/websites/:id/crawl` - Start crawling
- `POST /api/websites/:id/crawl/cancel` - Cancel crawl

### Products
- `GET /api/products` - List products (with filters)
- `GET /api/products/:id` - Get product details
- `DELETE /api/products/:id` - Delete product

### Matching
- `GET /api/matching` - Get all matches
- `GET /api/matching/unmatched` - Get unmatched source products
- `GET /api/matching/suggestions/:id` - Get match suggestions
- `POST /api/matching/run` - Run automatic matching
- `POST /api/matching/manual` - Create manual match
- `POST /api/matching/:id/confirm` - Confirm a match
- `DELETE /api/matching/:id` - Delete a match
- `GET /api/matching/comparison` - Get comparison view data

### Export
- `GET /api/export/products` - Export products
- `GET /api/export/comparison` - Export price comparison
- `GET /api/export/unmatched` - Export unmatched products
- `GET /api/export/report` - Export full report

## Project Structure

```
EcomCompare/
├── package.json
├── server/
│   ├── index.js              # Express server entry point
│   ├── database/
│   │   ├── init.js           # SQLite initialization
│   │   └── models.js         # Database models
│   ├── crawlers/
│   │   ├── index.js          # Crawler manager
│   │   ├── baseCrawler.js    # Base crawler class
│   │   ├── cheerioCrawler.js # Static HTML crawler
│   │   └── puppeteerCrawler.js # JS-rendered crawler
│   ├── services/
│   │   ├── matchingService.js # Product matching logic
│   │   └── exportService.js   # Data export logic
│   └── routes/
│       ├── websites.js       # Website endpoints
│       ├── products.js       # Product endpoints
│       ├── matching.js       # Matching endpoints
│       └── export.js         # Export endpoints
├── client/
│   ├── package.json
│   ├── public/
│   └── src/
│       ├── App.js            # Main React component
│       ├── App.css           # Styles
│       ├── services/
│       │   └── api.js        # API client
│       ├── hooks/
│       │   └── useSocket.js  # Socket.IO hook
│       └── pages/
│           ├── Dashboard.js
│           ├── Websites.js
│           ├── Products.js
│           ├── Matching.js
│           ├── Comparison.js
│           └── Export.js
└── data/
    └── ecomcompare.db        # SQLite database
```

## Supported E-commerce Platforms

The crawler has optimized selectors for:
- Shopify
- WooCommerce
- Magento
- Generic e-commerce sites

## Configuration

### Crawl Options

When starting a crawl, you can configure:
- `maxPages`: Maximum pages to crawl (default: 50)
- `delay`: Delay between requests in ms (default: 1000)
- `crawl_type`: 'auto', 'cheerio', or 'puppeteer'

### Matching Options

- `minSimilarity`: Minimum similarity score (0-1, default: 0.6)
- `maxMatchesPerProduct`: Max matches per source product (default: 5)
- `allowDuplicateMatches`: Allow duplicate matches (default: false)

## License

MIT
