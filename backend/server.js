// server.js

// Load environment variables from .env file
require('dotenv').config();

// Import core modules
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

// Import route handlers (make sure these files exist in /routes)
const metaRoutes = require('./routes/metaRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const validationRoutes = require('./routes/validationRoutes');
const aiRoutes = require('./routes/aiRoutes');
const downloadRoutes = require('./routes/downloadRoutes');

// Initialize Express app
const app = express();

// Enable CORS for the frontend dev server
app.use(cors({ origin: true }));

// Middleware to parse JSON bodies (increase limit for large question payloads)
app.use(bodyParser.json({ limit: '10mb' }));

// Serve static files from the 'uploads' directory
app.use('/uploads', express.static(require('path').join(__dirname, 'uploads')));

// ROUTES
app.use('/api/meta', metaRoutes);          // GET /api/meta
app.use('/api/upload', uploadRoutes);      // POST /api/upload/ia1, ia2, ia3
app.use('/api/validate', validationRoutes);// POST /api/validate/ia1, ia2, ia3
app.use('/api', aiRoutes);                 // POST /api/enhance-questions, /fix-question, /auto-fix
app.use('/api/download', downloadRoutes);  // GET /api/download/:paperId

// Default route for testing
app.get('/', (req, res) => {
  res.send('✅ Backend server is running');
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server started on http://localhost:${PORT}`);
});