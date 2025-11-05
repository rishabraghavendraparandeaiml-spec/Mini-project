/**
 * Real-time Routing + Weather + Traffic Dashboard Server
 * 
 * This Express server provides:
 * - Static file serving for the frontend
 * - API endpoints for routing, weather, and analytics
 * - Proxy for external API calls to keep keys secure
 * - CORS enabled for development
 */

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config(); // Load environment variables from .env file

// Import API routes
const apiRoutes = require('./routes/api');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB Connection
const connectMongoDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/routing-dashboard';
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('📊 MongoDB connected successfully');
  } catch (error) {
    console.warn('⚠️ MongoDB connection failed, using local storage only:', error.message);
    // Continue without MongoDB - the app will still work with file-based storage
  }
};

// Connect to MongoDB
connectMongoDB();

// Middleware setup
app.use(cors()); // Enable CORS for all routes (useful for development)
app.use(bodyParser.json({ limit: '10mb' })); // Parse JSON bodies
app.use(bodyParser.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Health check endpoint (must be before /api router)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Config endpoint - provides frontend with necessary configuration
app.get('/api/config', (req, res) => {
  res.json({
    mapboxTileUrl: process.env.MAPBOX_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    defaultCenter: {
      lat: parseFloat(process.env.DEFAULT_LAT) || 40.7128,
      lng: parseFloat(process.env.DEFAULT_LNG) || -74.0060
    }
  });
});

// API Routes - all external API calls are proxied through our server
// This keeps API keys secure and prevents CORS issues
app.use('/api', apiRoutes);

// Serve uploaded files (pothole photos)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve the main application
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Catch-all handler: serve main page for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Real-time Routing Dashboard Server running on port ${PORT}`);
  console.log(`📍 Access the application at: http://localhost:${PORT}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Check if required environment variables are set
  const requiredEnvVars = ['ORS_API_KEY'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.warn(`⚠️  Missing required environment variables: ${missingVars.join(', ')}`);
    console.warn('   Please check your .env file and ensure all API keys are set');
  }

  // Weather API key is optional; support multiple names and fall back to Open-Meteo
  const hasWeatherKey = Boolean(
    process.env.OPENWEATHER_API_KEY ||
    process.env.OWM_API_KEY ||
    process.env.WEATHER_API_KEY
  );
  if (!hasWeatherKey) {
    console.log('ℹ️  No OpenWeather/WeatherAPI key found. Using Open-Meteo fallback (no key required).');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 Received SIGTERM. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('👋 Received SIGINT. Shutting down gracefully...');
  process.exit(0);
});

module.exports = app;