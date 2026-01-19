const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { createServer } = require('http');
const { Server } = require('socket.io');

// Import database initialization
const { initDatabase } = require('./database/init');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: true,
    methods: ['GET', 'POST']
  }
});

// Make io available to routes
app.set('io', io);

// Middleware
app.use(cors());
app.use(express.json());

// Health check (available before db init)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files from React build if it exists
const buildPath = path.join(__dirname, '../client/build');
if (fs.existsSync(buildPath)) {
  app.use(express.static(buildPath));
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database first
    console.log('Initializing database...');
    await initDatabase();
    console.log('Database initialized successfully');

    // Now load routes and models (after db is ready)
    const websitesRouter = require('./routes/websites');
    const productsRouter = require('./routes/products');
    const matchingRouter = require('./routes/matching');
    const exportRouter = require('./routes/export');
    const { CrawlJob } = require('./database/models');

    // API Routes
    app.use('/api/websites', websitesRouter);
    app.use('/api/products', productsRouter);
    app.use('/api/matching', matchingRouter);
    app.use('/api/export', exportRouter);

    // Get active crawl jobs
    app.get('/api/jobs', (req, res) => {
      try {
        const jobs = CrawlJob.findAll();
        res.json(jobs);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get running jobs
    app.get('/api/jobs/running', (req, res) => {
      try {
        const jobs = CrawlJob.findRunning();
        res.json(jobs);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Catch-all for SPA routing (serve index.html for non-API routes)
    if (fs.existsSync(buildPath)) {
      app.get('*', (req, res) => {
        res.sendFile(path.join(buildPath, 'index.html'));
      });
    }

    // Socket.IO connection handling
    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      // Send current running jobs on connect
      try {
        const runningJobs = CrawlJob.findRunning();
        if (runningJobs.length > 0) {
          socket.emit('running-jobs', runningJobs);
        }
      } catch (error) {
        console.error('Error fetching running jobs:', error.message);
      }

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });

    // Start server
    const PORT = process.env.PORT || 5000;
    httpServer.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   EcomCompare Server                                      ║
║   E-commerce Product Comparison Crawler                   ║
║                                                           ║
║   Server running on: http://localhost:${PORT}               ║
║   API endpoints:     http://localhost:${PORT}/api           ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = { app, io };
