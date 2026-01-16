const express = require('express');
const cors = require('cors');
const path = require('path');
const { createServer } = require('http');
const { Server } = require('socket.io');

// Import routes
const websitesRouter = require('./routes/websites');
const productsRouter = require('./routes/products');
const matchingRouter = require('./routes/matching');
const exportRouter = require('./routes/export');

// Import database to initialize
require('./database/init');

// Import crawl job manager
const { CrawlJob } = require('./database/models');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST']
  }
});

// Make io available to routes
app.set('io', io);

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/websites', websitesRouter);
app.use('/api/products', productsRouter);
app.use('/api/matching', matchingRouter);
app.use('/api/export', exportRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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

// Serve static files from React build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Send current running jobs on connect
  const runningJobs = CrawlJob.findRunning();
  if (runningJobs.length > 0) {
    socket.emit('running-jobs', runningJobs);
  }

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
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

module.exports = { app, io };
