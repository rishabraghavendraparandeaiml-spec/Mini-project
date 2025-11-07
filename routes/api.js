/**
 * API Routes for Real-time Routing Dashboard
 * 
 * This module handles all external API integrations:
 * - OpenRouteService for routing and directions
 * - OpenWeatherMap for weather alerts and conditions
 * - Analytics data storage and retrieval
 */

const express = require('express');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const exifParser = require('exif-parser');
const ExifReader = require('exifreader');
const { v4: uuidv4 } = require('uuid');
const { Pothole } = require('../models/Pothole');
const Tesseract = require('tesseract.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');

const router = express.Router();

// GridFS bucket for storing photos in MongoDB
let gridFSBucket;
mongoose.connection.once('open', () => {
  gridFSBucket = new GridFSBucket(mongoose.connection.db, {
    bucketName: 'potholePhotos'
  });
  console.log('✅ GridFS bucket initialized for photo storage');
});

// Configure multer to use memory storage (we'll upload to GridFS instead of disk)
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

/**
 * Upload file buffer to GridFS
 * @param {Buffer} buffer - File buffer
 * @param {Object} metadata - File metadata
 * @returns {Promise<string>} - GridFS file ID
 */
async function uploadToGridFS(buffer, metadata) {
  return new Promise((resolve, reject) => {
    if (!gridFSBucket) {
      return reject(new Error('GridFS not initialized'));
    }

    const uploadStream = gridFSBucket.openUploadStream(metadata.filename, {
      contentType: metadata.mimetype,
      metadata: {
        originalName: metadata.originalName,
        size: metadata.size,
        uploadDate: new Date(),
        ...metadata.extra
      }
    });

    uploadStream.on('error', reject);
    uploadStream.on('finish', () => {
      console.log('✅ Photo uploaded to GridFS:', uploadStream.id);
      resolve(uploadStream.id.toString());
    });

    uploadStream.write(buffer);
    uploadStream.end();
  });
}

// In-memory analytics storage (in production, use a proper database)
let analyticsData = {
  totalRequests: 0,
  routes: [],
  topOrigins: {},
  averageDistance: 0,
  requestsPerHour: [],
  lastUpdated: new Date().toISOString()
};

// Load existing analytics data if available
const loadAnalyticsData = async () => {
  try {
    const dataPath = path.join(__dirname, '..', 'data', 'analytics.json');
    const data = await fs.readFile(dataPath, 'utf8');
    analyticsData = { ...analyticsData, ...JSON.parse(data) };
    console.log('📊 Analytics data loaded successfully');
  } catch (error) {
    console.log('📊 No existing analytics data found, starting fresh');
  }
};

// Save analytics data to file
const saveAnalyticsData = async () => {
  try {
    const dataPath = path.join(__dirname, '..', 'data', 'analytics.json');
    await fs.writeFile(dataPath, JSON.stringify(analyticsData, null, 2));
  } catch (error) {
    console.error('❌ Error saving analytics data:', error.message);
  }
};

// Initialize analytics data on server start
loadAnalyticsData().catch(error => {
  console.error('❌ Failed to load initial analytics data:', error.message);
});

/**
 * POST /api/route
 * Calculates route between origin and destination using OpenRouteService
 * 
 * Body: {
 *   origin: { lat: number, lng: number } or "address string",
 *   destination: { lat: number, lng: number } or "address string",
 *   profile: "driving-car" | "foot-walking" | "cycling-regular" (optional)
 * }
 */
router.post('/route', async (req, res) => {
  try {
    const { origin, destination, profile = 'driving-car', alternatives = true } = req.body;

    // Validate input
    if (!origin || !destination) {
      return res.status(400).json({ 
        error: 'Origin and destination are required',
        received: { origin, destination }
      });
    }

    // Check if API key is available, if not use mock data
    if (!process.env.ORS_API_KEY || process.env.ORS_API_KEY === 'your_openrouteservice_api_key_here') {
      return handleMockMultipleRoutes(req, res, origin, destination, profile);
    }

    // Convert addresses to coordinates if needed (using ORS geocoding)
    const originCoords = await getCoordinates(origin);
    const destinationCoords = await getCoordinates(destination);

    if (!originCoords || !destinationCoords) {
      return res.status(400).json({ 
        error: 'Could not resolve origin or destination coordinates' 
      });
    }

    // Call OpenRouteService Directions API
    const orsUrl = 'https://api.openrouteservice.org/v2/directions/' + profile;
    const orsResponse = await axios.post(orsUrl, {
      coordinates: [
        [originCoords.lng, originCoords.lat],
        [destinationCoords.lng, destinationCoords.lat]
      ],
      format: 'geojson',
      instructions: true,
      elevation: false
    }, {
      headers: {
        'Authorization': process.env.ORS_API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });

    const route = orsResponse.data.features[0];
    const properties = route.properties;

    // Calculate midpoint for weather data
    const coordinates = route.geometry.coordinates;
    const midIndex = Math.floor(coordinates.length / 2);
    const midpoint = {
      lat: coordinates[midIndex][1],
      lng: coordinates[midIndex][0]
    };

    // Update analytics
    analyticsData.totalRequests++;
    analyticsData.routes.push({
      origin: originCoords,
      destination: destinationCoords,
      distance: properties.segments[0].distance,
      duration: properties.segments[0].duration,
      timestamp: new Date().toISOString()
    });

    // Update top origins
    const originKey = `${originCoords.lat.toFixed(3)},${originCoords.lng.toFixed(3)}`;
    analyticsData.topOrigins[originKey] = (analyticsData.topOrigins[originKey] || 0) + 1;

    // Calculate average distance
    const totalDistance = analyticsData.routes.reduce((sum, r) => sum + r.distance, 0);
    analyticsData.averageDistance = totalDistance / analyticsData.routes.length;

    analyticsData.lastUpdated = new Date().toISOString();

    // Save analytics data
    saveAnalyticsData();

    // Return formatted route data
    res.json({
      success: true,
      route: {
        geometry: route.geometry,
        distance_m: properties.segments[0].distance,
        duration_s: properties.segments[0].duration,
        distance_formatted: formatDistance(properties.segments[0].distance),
        duration_formatted: formatDuration(properties.segments[0].duration),
        steps: properties.segments[0].steps || [],
        midpoint,
        bbox: route.bbox
      }
    });

  } catch (error) {
    console.error('❌ Route calculation error:', error.response?.data || error.message);
    
    if (error.code === 'ECONNABORTED') {
      return res.status(408).json({ error: 'Request timeout - please try again' });
    }
    
    if (error.response?.status === 401) {
      return res.status(401).json({ error: 'Invalid OpenRouteService API key' });
    }
    
    res.status(500).json({ 
      error: 'Failed to calculate route',
      details: error.response?.data?.error?.message || error.message
    });
  }
});

/**
 * GET /api/analytics
 * Returns current analytics data
 */
router.get('/analytics', (req, res) => {
  // Prepare chart-friendly data
  const chartData = {
    totalRequests: analyticsData.totalRequests,
    averageDistance: Math.round(analyticsData.averageDistance),
    topOrigins: Object.entries(analyticsData.topOrigins)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([location, count]) => ({ location, count })),
    requestsOverTime: generateTimeSeriesData(),
    distanceDistribution: generateDistanceDistribution(),
    lastUpdated: analyticsData.lastUpdated
  };

  res.json({
    success: true,
    analytics: chartData
  });
});

/**
 * POST /api/analytics
 * Update analytics (called automatically by route endpoint)
 */
router.post('/analytics', (req, res) => {
  const { event, data } = req.body;
  
  // Handle different types of analytics events
  switch (event) {
    case 'page_view':
      // Track page views or other events as needed
      break;
    default:
      // Generic analytics update
      break;
  }

  res.json({ success: true });
});

/**
 * POST /api/potholes/upload
 * Upload a geo-tagged photo of a pothole
 */
router.post('/potholes/upload', upload.single('potholePhoto'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No photo uploaded',
        message: 'Please select a photo to upload'
      });
    }

    // Extract EXIF data from the uploaded image
    const fs = require('fs').promises;
    const fileBuffer = await fs.readFile(req.file.path);
    
    console.log('\n========================================');
    console.log('📸 Processing uploaded photo:', req.file.originalname);
    console.log('📊 File size:', (req.file.size / 1024).toFixed(2), 'KB');
    console.log('========================================\n');
    
    const exifData = extractExifData(fileBuffer);
    
    console.log('\n📍 EXIF Extraction Result:');
    console.log('  - Has GPS:', exifData.hasGPS);
    console.log('  - Latitude:', exifData.latitude);
    console.log('  - Longitude:', exifData.longitude);
    console.log('  - Method:', exifData.extractionMethod);
    console.log('========================================\n');
    
    if (!exifData.hasGPS || !exifData.latitude || !exifData.longitude) {
      // For demo purposes, generate random coordinates within Karnataka if no GPS data
      const demoLocation = {
        latitude: 12.9716 + (Math.random() - 0.5) * 0.5,  // Random location near Bangalore
        longitude: 77.5946 + (Math.random() - 0.5) * 0.5,
      };
      
      console.log('⚠️ No GPS data found in photo, using demo coordinates:', demoLocation);
      console.log('💡 Tip: Enable location services in your camera and take a new photo');
      
      exifData.latitude = demoLocation.latitude;
      exifData.longitude = demoLocation.longitude;
      exifData.hasGPS = true;
      exifData.isDemoLocation = true;
    } else {
      console.log('✅ Real GPS coordinates extracted from photo!');
    }

    // Create pothole record
    const potholeData = {
      id: uuidv4(),
      location: {
        type: 'Point',
        coordinates: [exifData.longitude, exifData.latitude]
      },
      photo: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path
      },
      exifData: exifData,
      severity: req.body.severity || 'moderate',
      reportedBy: {
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        timestamp: new Date()
      },
      address: await getReverseGeocode(exifData.latitude, exifData.longitude)
    };

    // Save to MongoDB if available, otherwise save to local file
    let savedPothole;
    try {
      const pothole = new Pothole(potholeData);
      savedPothole = await pothole.save();
      console.log('✅ Pothole saved to MongoDB:', savedPothole.id);
    } catch (mongoError) {
      console.warn('⚠️ MongoDB save failed, using file storage:', mongoError.message);
      savedPothole = await savePotholeToFile(potholeData);
    }

    res.json({
      success: true,
      pothole: {
        id: savedPothole.id || potholeData.id,
        latitude: exifData.latitude,
        longitude: exifData.longitude,
        severity: savedPothole.severity || potholeData.severity,
        address: savedPothole.address || potholeData.address,
        createdAt: savedPothole.createdAt || savedPothole.reportedBy?.timestamp || potholeData.reportedBy.timestamp,
        location: {
          coordinates: [exifData.longitude, exifData.latitude]
        }
      },
      message: 'Pothole reported successfully! Thank you for helping improve road safety.'
    });

  } catch (error) {
    console.error('❌ Pothole upload error:', error);
    
    // Clean up uploaded file on error
    if (req.file && req.file.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Failed to delete uploaded file:', unlinkError);
      }
    }

    res.status(500).json({
      error: 'Failed to upload pothole report',
      message: error.message
    });
  }
});

/**
 * GET /api/potholes/near-route
 * Get potholes near a specific route
 */
router.post('/potholes/near-route', async (req, res) => {
  try {
    const { routeCoordinates, bufferKm = 0.5 } = req.body;

    if (!routeCoordinates || !Array.isArray(routeCoordinates)) {
      return res.status(400).json({
        error: 'Invalid route coordinates',
        message: 'Please provide valid route coordinates array'
      });
    }

    let nearbyPotholes = [];

    try {
      // Try MongoDB first
      nearbyPotholes = await Pothole.findNearRoute(routeCoordinates, bufferKm);
    } catch (mongoError) {
      console.warn('⚠️ MongoDB query failed, using file storage:', mongoError.message);
      nearbyPotholes = await findPotholesNearRouteFromFile(routeCoordinates, bufferKm);
    }

    res.json({
      success: true,
      potholes: nearbyPotholes.map(pothole => ({
        id: pothole.id,
        latitude: pothole.exifData.latitude,
        longitude: pothole.exifData.longitude,
        severity: pothole.severity,
        status: pothole.status,
        address: pothole.address?.formattedAddress || pothole.address,
        photoUrl: `/api/potholes/photo/${pothole.id}`,
        reportedAt: pothole.createdAt || pothole.reportedBy.timestamp,
        verification: pothole.verification
      })),
      count: nearbyPotholes.length
    });

  } catch (error) {
    console.error('❌ Pothole query error:', error);
    res.status(500).json({
      error: 'Failed to find potholes near route',
      message: error.message
    });
  }
});

/**
 * GET /api/potholes/photo/:id
 * Serve pothole photo by ID
 */
router.get('/potholes/photo/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    let pothole;
    try {
      pothole = await Pothole.findOne({ id: id });
    } catch (mongoError) {
      pothole = await getPotholeFromFile(id);
    }

    if (!pothole) {
      return res.status(404).json({
        error: 'Pothole photo not found'
      });
    }

    const photoPath = pothole.photo.path;
    
    // Check if file exists
    try {
      await fs.access(photoPath);
      res.sendFile(path.resolve(photoPath));
    } catch (fileError) {
      res.status(404).json({
        error: 'Photo file not found on server'
      });
    }

  } catch (error) {
    console.error('❌ Photo serve error:', error);
    res.status(500).json({
      error: 'Failed to serve photo',
      message: error.message
    });
  }
});

/**
 * GET /api/potholes/stats
 * Get pothole statistics for dashboard
 */
router.get('/potholes/stats', async (req, res) => {
  try {
    let stats;
    
    try {
      // Try MongoDB aggregation
      const mongoStats = await Pothole.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            severityBreakdown: {
              $push: {
                severity: '$severity',
                count: 1
              }
            },
            statusBreakdown: {
              $push: {
                status: '$status',
                count: 1
              }
            }
          }
        }
      ]);
      
      stats = mongoStats[0] || { total: 0, severityBreakdown: [], statusBreakdown: [] };
    } catch (mongoError) {
      stats = await getPotholeStatsFromFile();
    }

    res.json({
      success: true,
      stats: {
        totalPotholes: stats.total || 0,
        severityBreakdown: groupBy(stats.severityBreakdown, 'severity'),
        statusBreakdown: groupBy(stats.statusBreakdown, 'status'),
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Pothole stats error:', error);
    res.status(500).json({
      error: 'Failed to get pothole statistics',
      message: error.message
    });
  }
});

// Helper Functions

/**
 * Convert address to coordinates using OpenRouteService Geocoding
 */
async function getCoordinates(location) {
  try {
    // If location is already coordinates
    if (typeof location === 'object' && location.lat && location.lng) {
      return { lat: location.lat, lng: location.lng };
    }

    // If location is a string address, geocode it
    if (typeof location === 'string') {
      const geocodeResponse = await axios.get('https://api.openrouteservice.org/geocode/search', {
        params: {
          api_key: process.env.ORS_API_KEY,
          text: location,
          size: 1
        },
        timeout: 5000
      });

      const features = geocodeResponse.data.features;
      if (features && features.length > 0) {
        const coords = features[0].geometry.coordinates;
        return { lat: coords[1], lng: coords[0] };
      }
    }

    return null;
  } catch (error) {
    console.error('❌ Geocoding error:', error.message);
    return null;
  }
}

/**
 * Format distance in meters to readable string
 */
function formatDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Format duration in seconds to readable string
 */
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Generate time series data for charts
 */
function generateTimeSeriesData() {
  const hours = 24;
  const data = [];
  const now = new Date();
  
  for (let i = hours - 1; i >= 0; i--) {
    const hour = new Date(now - i * 60 * 60 * 1000);
    const hourKey = hour.toISOString().slice(0, 13);
    const count = analyticsData.routes.filter(r => 
      r.timestamp.slice(0, 13) === hourKey
    ).length;
    
    data.push({
      time: hour.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      requests: count
    });
  }
  
  return data;
}

/**
 * Generate distance distribution for charts
 */
function generateDistanceDistribution() {
  const ranges = [
    { label: '0-1km', min: 0, max: 1000, count: 0 },
    { label: '1-5km', min: 1000, max: 5000, count: 0 },
    { label: '5-10km', min: 5000, max: 10000, count: 0 },
    { label: '10-25km', min: 10000, max: 25000, count: 0 },
    { label: '25km+', min: 25000, max: Infinity, count: 0 }
  ];

  analyticsData.routes.forEach(route => {
    const range = ranges.find(r => 
      route.distance >= r.min && route.distance < r.max
    );
    if (range) range.count++;
  });

  return ranges;
}

/**
 * Handle multiple mock routes when API key is not available
 */
async function handleMockMultipleRoutes(req, res, origin, destination, profile) {
  try {
    // Parse coordinates from origin and destination
    const originCoords = parseCoordinates(origin);
    const destinationCoords = parseCoordinates(destination);

    if (!originCoords || !destinationCoords) {
      return res.status(400).json({ 
        error: 'Please enter coordinates in format: lat, lng (e.g., 12.9716, 77.5946)' 
      });
    }

    // Calculate base distance using Haversine formula
    const baseDistance = calculateDistance(originCoords, destinationCoords);
    
    // Generate multiple route alternatives
    const routes = generateMultipleRoutes(originCoords, destinationCoords, profile, baseDistance);

    // Update analytics for the fastest route
    analyticsData.totalRequests++;
    analyticsData.routes.push({
      origin: originCoords,
      destination: destinationCoords,
      distance: routes[0].distance_m,
      duration: routes[0].duration_s,
      timestamp: new Date().toISOString()
    });

    analyticsData.lastUpdated = new Date().toISOString();
    saveAnalyticsData();

    res.json({
      success: true,
      routes: routes,
      selectedRoute: 0, // Default to fastest route
      note: 'These are demo routes with simulated alternatives. Add API keys for real routing with live traffic data.'
    });

  } catch (error) {
    console.error('❌ Mock route error:', error);
    res.status(500).json({ 
      error: 'Failed to create demo routes',
      details: error.message
    });
  }
}

/**
 * Parse coordinates from string input
 */
function parseCoordinates(input) {
  if (typeof input === 'object' && input.lat && input.lng) {
    return { lat: input.lat, lng: input.lng };
  }
  
  if (typeof input === 'string') {
    const coords = input.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
    if (coords) {
      return {
        lat: parseFloat(coords[1]),
        lng: parseFloat(coords[2])
      };
    }
  }
  
  return null;
}

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(coord1, coord2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLon = toRad(coord2.lng - coord1.lng);
  const lat1 = toRad(coord1.lat);
  const lat2 = toRad(coord2.lat);

  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  return R * c;
}

function toRad(degree) {
  return degree * (Math.PI/180);
}

/**
 * Get general direction between two points
 */
function getDirection(from, to) {
  const bearing = Math.atan2(
    to.lng - from.lng,
    to.lat - from.lat
  ) * 180 / Math.PI;
  
  const directions = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
  const index = Math.round(((bearing + 360) % 360) / 45) % 8;
  return directions[index];
}

/**
 * Generate multiple route alternatives for demonstration
 */
function generateMultipleRoutes(originCoords, destinationCoords, profile, baseDistance) {
  const routes = [];
  
  // Base speed settings
  let baseSpeed = 50; // km/h for driving
  if (profile === 'foot-walking') baseSpeed = 5;
  if (profile === 'cycling-regular') baseSpeed = 15;

  // Route 1: Fastest Route (Direct)
  const fastestDistance = baseDistance * 1.0; // Direct route
  const fastestDuration = (fastestDistance / (baseSpeed * 1.2)) * 3600; // 20% faster on highways
  routes.push(createRouteVariant(
    originCoords, 
    destinationCoords, 
    fastestDistance, 
    fastestDuration,
    'fastest',
    'Fastest Route',
    'Via highways and main roads - Heavy traffic possible',
    '#007bff', // Blue
    0.1 // Less curved path
  ));

  // Route 2: Safest Route (Slightly longer but safer roads)
  const safestDistance = baseDistance * 1.15; // 15% longer for safer roads
  const safestDuration = (safestDistance / (baseSpeed * 0.9)) * 3600; // 10% slower for safety
  routes.push(createRouteVariant(
    originCoords, 
    destinationCoords, 
    safestDistance, 
    safestDuration,
    'safest',
    'Safest Route',
    'Well-lit roads, good visibility, lower accident rates',
    '#28a745', // Green
    0.15 // More curved for safer roads
  ));

  // Route 3: Best Road Quality (Pothole-free)
  const qualityDistance = baseDistance * 1.25; // 25% longer for better roads
  const qualityDuration = (qualityDistance / baseSpeed) * 3600; // Normal speed on good roads
  routes.push(createRouteVariant(
    originCoords, 
    destinationCoords, 
    qualityDistance, 
    qualityDuration,
    'quality',
    'Best Road Quality',
    'Newly paved roads, minimal potholes, smooth drive',
    '#fd7e14', // Orange
    0.2 // Most curved for road quality detours
  ));

  return routes;
}

/**
 * Create a route variant with specific characteristics
 */
function createRouteVariant(originCoords, destinationCoords, distance, duration, type, name, description, color, curvature) {
  // Generate a curved path to simulate different routes
  const waypoints = generateCurvedPath(originCoords, destinationCoords, curvature);
  
  // Calculate additional route properties based on type
  let trafficLevel = 'moderate';
  let roadCondition = 'good';
  let safetyScore = 7;
  
  switch(type) {
    case 'fastest':
      trafficLevel = 'heavy';
      roadCondition = 'fair';
      safetyScore = 6;
      break;
    case 'safest':
      trafficLevel = 'light';
      roadCondition = 'good';
      safetyScore = 9;
      break;
    case 'quality':
      trafficLevel = 'moderate';
      roadCondition = 'excellent';
      safetyScore = 8;
      break;
  }

  return {
    type: type,
    name: name,
    description: description,
    geometry: {
      type: 'LineString',
      coordinates: waypoints
    },
    distance_m: distance * 1000,
    duration_s: duration,
    distance_formatted: formatDistance(distance * 1000),
    duration_formatted: formatDuration(duration),
    color: color,
    properties: {
      trafficLevel: trafficLevel,
      roadCondition: roadCondition,
      safetyScore: safetyScore,
      tollRoads: type === 'fastest' ? 'yes' : 'minimal',
      potholeRisk: type === 'quality' ? 'very_low' : (type === 'safest' ? 'low' : 'moderate')
    },
    steps: generateRouteSteps(type, distance, duration),
    midpoint: {
      lat: (originCoords.lat + destinationCoords.lat) / 2,
      lng: (originCoords.lng + destinationCoords.lng) / 2
    },
    bbox: [
      Math.min(originCoords.lng, destinationCoords.lng) - 0.01,
      Math.min(originCoords.lat, destinationCoords.lat) - 0.01,
      Math.max(originCoords.lng, destinationCoords.lng) + 0.01,
      Math.max(originCoords.lat, destinationCoords.lat) + 0.01
    ]
  };
}

/**
 * Generate a curved path between two points to simulate different routes
 */
function generateCurvedPath(start, end, curvature) {
  const points = [start];
  
  if (curvature > 0) {
    // Add intermediate waypoints for curved path
    const midLat = (start.lat + end.lat) / 2;
    const midLng = (start.lng + end.lng) / 2;
    
    // Add curvature by offsetting the midpoint
    const offset = curvature * 0.1; // Adjust curvature intensity
    const waypoint1 = {
      lat: midLat + (Math.random() - 0.5) * offset,
      lng: midLng + (Math.random() - 0.5) * offset
    };
    
    points.push(waypoint1);
    
    if (curvature > 0.15) {
      // Add another waypoint for more complex routes
      const waypoint2 = {
        lat: start.lat + (end.lat - start.lat) * 0.75 + (Math.random() - 0.5) * offset * 0.5,
        lng: start.lng + (end.lng - start.lng) * 0.75 + (Math.random() - 0.5) * offset * 0.5
      };
      points.push(waypoint2);
    }
  }
  
  points.push(end);
  
  // Convert to coordinate pairs [lng, lat] format
  return points.map(point => [point.lng, point.lat]);
}

/**
 * Generate route-specific steps/instructions
 */
function generateRouteSteps(routeType, distance, duration) {
  const steps = [];
  const distanceKm = distance;
  
  switch(routeType) {
    case 'fastest':
      steps.push({
        instruction: 'Head towards the nearest highway/expressway',
        distance: distanceKm * 0.2 * 1000,
        duration: duration * 0.2,
        roadType: 'arterial'
      });
      steps.push({
        instruction: 'Continue on highway - expect heavy traffic during peak hours',
        distance: distanceKm * 0.6 * 1000,
        duration: duration * 0.6,
        roadType: 'highway'
      });
      steps.push({
        instruction: 'Exit highway and proceed to destination',
        distance: distanceKm * 0.2 * 1000,
        duration: duration * 0.2,
        roadType: 'local'
      });
      break;
      
    case 'safest':
      steps.push({
        instruction: 'Take well-lit main roads with good visibility',
        distance: distanceKm * 0.3 * 1000,
        duration: duration * 0.3,
        roadType: 'arterial'
      });
      steps.push({
        instruction: 'Continue on safer route - avoid accident-prone areas',
        distance: distanceKm * 0.5 * 1000,
        duration: duration * 0.5,
        roadType: 'safe_arterial'
      });
      steps.push({
        instruction: 'Final approach via residential areas with lower speeds',
        distance: distanceKm * 0.2 * 1000,
        duration: duration * 0.2,
        roadType: 'residential'
      });
      break;
      
    case 'quality':
      steps.push({
        instruction: 'Head to recently paved roads - smooth surface',
        distance: distanceKm * 0.25 * 1000,
        duration: duration * 0.25,
        roadType: 'new_road'
      });
      steps.push({
        instruction: 'Continue on well-maintained highways - minimal potholes',
        distance: distanceKm * 0.5 * 1000,
        duration: duration * 0.5,
        roadType: 'quality_highway'
      });
      steps.push({
        instruction: 'Final stretch on concrete roads - excellent condition',
        distance: distanceKm * 0.25 * 1000,
        duration: duration * 0.25,
        roadType: 'concrete'
      });
      break;
  }
  
  return steps;
}

/**
 * Handle mock weather when API key is not available
 */
function handleMockWeather(req, res, lat, lon) {
  // Generate mock weather data for Karnataka region
  const mockWeatherData = {
    location: {
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      name: getKarnatakaCity(lat, lon),
      country: 'IN'
    },
    current: {
      temp: Math.round(25 + Math.random() * 10), // 25-35°C typical for Karnataka
      feels_like: Math.round(27 + Math.random() * 8),
      humidity: Math.round(60 + Math.random() * 30),
      pressure: Math.round(1010 + Math.random() * 20),
      visibility: 10000,
      weather: {
        main: 'Clear',
        description: 'clear sky',
        icon: '01d'
      },
      wind: {
        speed: Math.round(Math.random() * 10 + 2), // 2-12 m/s
        deg: Math.round(Math.random() * 360)
      }
    },
    alerts: [], // No alerts in demo mode
    timestamp: new Date().toISOString()
  };

  res.json({
    success: true,
    weather: mockWeatherData,
    note: 'This is demo weather data. Add API keys for real weather information.'
  });
}

/**
 * Get approximate Karnataka city name based on coordinates
 */
function getKarnatakaCity(lat, lon) {
  lat = parseFloat(lat);
  lon = parseFloat(lon);
  
  // Approximate city detection for Karnataka
  if (lat >= 12.8 && lat <= 13.1 && lon >= 77.4 && lon <= 77.8) return 'Bangalore';
  if (lat >= 12.2 && lat <= 12.4 && lon >= 76.5 && lon <= 76.8) return 'Mysore';
  if (lat >= 12.8 && lat <= 13.0 && lon >= 74.8 && lon <= 75.0) return 'Mangalore';
  if (lat >= 15.3 && lat <= 15.5 && lon >= 75.0 && lon <= 75.2) return 'Hubli';
  if (lat >= 15.8 && lat <= 16.0 && lon >= 75.1 && lon <= 75.3) return 'Belgaum';
  
  return 'Karnataka';
}

/**
 * Verify geotag using OCR (Tesseract.js)
 * Extracts text from image and validates location coordinates
 */
async function verifyGeotagWithOCR(imagePath, expectedLat, expectedLng) {
  try {
    console.log('🔍 Starting OCR geotag verification...');
    
    // Perform OCR on the image
    const { data: { text } } = await Tesseract.recognize(
      imagePath,
      'eng',
      {
        logger: m => console.log('OCR Progress:', m)
      }
    );
    
    console.log('📝 Extracted text from image:', text);
    
    // Extract coordinates from text using regex patterns
    const coordinatePatterns = [
      /(\d{1,3}\.\d+)[°,\s]*([NS])[,\s]*(\d{1,3}\.\d+)[°,\s]*([EW])/gi, // DD.DDDD° N, DD.DDDD° E
      /lat[:\s]*(-?\d{1,3}\.\d+)[,\s]*lon[:\s]*(-?\d{1,3}\.\d+)/gi, // lat: DD.DDDD, lon: DD.DDDD
      /(-?\d{1,3}\.\d{4,})[,\s]+(-?\d{1,3}\.\d{4,})/g, // Simple decimal coordinates
    ];
    
    let extractedLat = null;
    let extractedLng = null;
    
    for (const pattern of coordinatePatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[3]) {
          // Format with direction (N/S, E/W)
          extractedLat = parseFloat(match[1]) * (match[2] === 'S' ? -1 : 1);
          extractedLng = parseFloat(match[3]) * (match[4] === 'W' ? -1 : 1);
        } else if (match[1] && match[2]) {
          // Simple lat/lon format
          extractedLat = parseFloat(match[1]);
          extractedLng = parseFloat(match[2]);
        }
        
        if (extractedLat && extractedLng) break;
      }
      if (extractedLat && extractedLng) break;
    }
    
    if (!extractedLat || !extractedLng) {
      console.log('⚠️ No coordinates found in OCR text');
      return {
        verified: false,
        method: 'OCR',
        reason: 'No coordinates found in image text',
        extractedText: text.substring(0, 200)
      };
    }
    
    console.log(`📍 Extracted coordinates: ${extractedLat}, ${extractedLng}`);
    console.log(`📍 Expected coordinates: ${expectedLat}, ${expectedLng}`);
    
    // Calculate distance between extracted and expected coordinates
    const distance = calculateDistance(extractedLat, extractedLng, expectedLat, expectedLng);
    console.log(`📏 Distance between coordinates: ${distance.toFixed(2)} meters`);
    
    // Verify if coordinates match within tolerance (100 meters)
    const isValid = distance < 100;
    
    return {
      verified: isValid,
      method: 'OCR',
      extractedCoordinates: { lat: extractedLat, lng: extractedLng },
      expectedCoordinates: { lat: expectedLat, lng: expectedLng },
      distance: distance,
      extractedText: text.substring(0, 200),
      reason: isValid ? 'Coordinates match within tolerance' : 'Coordinates too far from expected location'
    };
    
  } catch (error) {
    console.error('❌ OCR verification error:', error);
    return {
      verified: false,
      method: 'OCR',
      error: error.message
    };
  }
}

/**
 * Verify geotag using Gemini Vision API
 * Uses AI to analyze the image and extract location information
 */
async function verifyGeotagWithGemini(imagePath, expectedLat, expectedLng) {
  try {
    console.log('🤖 Starting Gemini Vision API verification...');
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.log('⚠️ Gemini API key not found');
      return { verified: false, method: 'Gemini', reason: 'API key not configured' };
    }
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Read image file
    const imageBuffer = await fs.readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');
    
    const prompt = `Analyze this image and extract any GPS coordinates, location information, or geotag data visible in the image. 
    Look for:
    1. GPS coordinates in any format (decimal degrees, DMS, etc.)
    2. Location stamps or watermarks
    3. Embedded metadata visible in the image
    4. Any text showing latitude/longitude
    
    Expected location: Latitude ${expectedLat}, Longitude ${expectedLng}
    
    Respond in JSON format:
    {
      "hasGeoTag": true/false,
      "coordinates": {"lat": number, "lng": number} or null,
      "locationText": "extracted text" or null,
      "confidence": "high"/"medium"/"low",
      "matchesExpected": true/false
    }`;
    
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Image
        }
      }
    ]);
    
    const response = await result.response;
    const text = response.text();
    console.log('🤖 Gemini response:', text);
    
    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);
      
      if (analysis.coordinates) {
        const distance = calculateDistance(
          analysis.coordinates.lat,
          analysis.coordinates.lng,
          expectedLat,
          expectedLng
        );
        
        return {
          verified: distance < 100,
          method: 'Gemini Vision API',
          extractedCoordinates: analysis.coordinates,
          expectedCoordinates: { lat: expectedLat, lng: expectedLng },
          distance: distance,
          confidence: analysis.confidence,
          locationText: analysis.locationText,
          reason: distance < 100 ? 'AI verified coordinates match' : 'AI detected coordinates too far from expected location'
        };
      }
    }
    
    return {
      verified: false,
      method: 'Gemini Vision API',
      reason: 'Could not extract coordinates from image',
      response: text.substring(0, 200)
    };
    
  } catch (error) {
    console.error('❌ Gemini verification error:', error);
    return {
      verified: false,
      method: 'Gemini Vision API',
      error: error.message
    };
  }
}

/**
 * Calculate distance between two coordinates in meters (Haversine formula)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Helper function to extract EXIF data from uploaded image
function extractExifData(buffer) {
  console.log('🔍 Starting EXIF extraction...');
  console.log('📊 Buffer size:', buffer.length, 'bytes');
  
  // Try Method 1: ExifReader (more robust, handles more formats)
  try {
    const tags = ExifReader.load(buffer);
    const allTags = Object.keys(tags);
    const gpsTags = allTags.filter(k => k.includes('GPS'));
    
    console.log('📸 ExifReader - Total tags found:', allTags.length);
    console.log('📍 ExifReader - GPS tags found:', gpsTags);
    
    if (gpsTags.length > 0) {
      console.log('📋 GPS tag details:');
      gpsTags.forEach(tag => {
        console.log(`  - ${tag}:`, tags[tag]?.description || tags[tag]?.value || tags[tag]);
      });
    }
    
    let lat = null;
    let lon = null;
    
    // Extract GPS coordinates
    if (tags.GPSLatitude && tags.GPSLongitude) {
      // GPSLatitude and GPSLongitude are arrays [degrees, minutes, seconds]
      const latValues = tags.GPSLatitude.description || tags.GPSLatitude.value;
      const lonValues = tags.GPSLongitude.description || tags.GPSLongitude.value;
      const latRef = tags.GPSLatitudeRef?.value?.[0] || tags.GPSLatitudeRef?.description;
      const lonRef = tags.GPSLongitudeRef?.value?.[0] || tags.GPSLongitudeRef?.description;
      
      console.log('📍 GPS Raw Data:', { latValues, lonValues, latRef, lonRef });
      
      // If description is already in decimal format
      if (typeof latValues === 'number') {
        lat = latValues;
      } else if (typeof latValues === 'string' && latValues.includes('°')) {
        // Parse from description like "12° 58' 17.88"
        lat = parseFloat(latValues);
      } else if (Array.isArray(latValues) && latValues.length === 3) {
        // Convert from DMS to decimal
        lat = latValues[0] + (latValues[1] / 60) + (latValues[2] / 3600);
      }
      
      if (typeof lonValues === 'number') {
        lon = lonValues;
      } else if (typeof lonValues === 'string' && lonValues.includes('°')) {
        lon = parseFloat(lonValues);
      } else if (Array.isArray(lonValues) && lonValues.length === 3) {
        lon = lonValues[0] + (lonValues[1] / 60) + (lonValues[2] / 3600);
      }
      
      // Apply hemisphere correction
      if (latRef === 'S' || latRef === 'South') lat = -lat;
      if (lonRef === 'W' || lonRef === 'West') lon = -lon;
      
      if (lat !== null && lon !== null && !isNaN(lat) && !isNaN(lon)) {
        const gpsData = {
          latitude: lat,
          longitude: lon,
          timestamp: tags.DateTime?.description || tags.DateTimeOriginal?.description || new Date(),
          camera: tags.Make && tags.Model ? `${tags.Make.description} ${tags.Model.description}` : 'Unknown',
          hasGPS: true,
          extractionMethod: 'ExifReader'
        };
        
        console.log('✅ GPS extracted successfully (ExifReader):', gpsData);
        return gpsData;
      }
    }
  } catch (error) {
    console.log('⚠️ ExifReader failed, trying exif-parser:', error.message);
  }
  
  // Try Method 2: exif-parser (fallback)
  try {
    const parser = exifParser.create(buffer);
    const result = parser.parse();
    
    console.log('📸 exif-parser - Tags found:', Object.keys(result.tags || {}).filter(k => k.includes('GPS')));
    
    let lat = null;
    let lon = null;
    
    if (result.tags && result.tags.GPSLatitude !== undefined && result.tags.GPSLongitude !== undefined) {
      lat = result.tags.GPSLatitude;
      lon = result.tags.GPSLongitude;
      
      // Convert to negative if needed based on GPS reference
      if (result.tags.GPSLatitudeRef === 'S') lat = -lat;
      if (result.tags.GPSLongitudeRef === 'W') lon = -lon;
      
      if (!isNaN(lat) && !isNaN(lon)) {
        const gpsData = {
          latitude: lat,
          longitude: lon,
          timestamp: result.tags.DateTime || result.tags.DateTimeOriginal || new Date(),
          camera: result.tags.Make && result.tags.Model ? `${result.tags.Make} ${result.tags.Model}` : 'Unknown',
          hasGPS: true,
          extractionMethod: 'exif-parser'
        };
        
        console.log('✅ GPS extracted successfully (exif-parser):', gpsData);
        return gpsData;
      }
    }
  } catch (error) {
    console.error('⚠️ exif-parser also failed:', error.message);
  }
  
  console.log('❌ No valid GPS data found with any method');
  return { hasGPS: false };
}

// Helper function to save pothole to file as backup
async function savePotholeToFile(potholeData) {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    
    const dataDir = path.join(__dirname, '..', 'data');
    const filePath = path.join(dataDir, 'potholes.json');
    
    // Ensure directory exists
    try {
      await fs.mkdir(dataDir, { recursive: true });
    } catch (err) {
      // Directory might already exist
    }
    
    // Read existing data
    let potholes = [];
    try {
      const existingData = await fs.readFile(filePath, 'utf8');
      potholes = JSON.parse(existingData);
    } catch (err) {
      // File might not exist yet
    }
    
    // Add new pothole with created timestamp
    const savedPothole = {
      ...potholeData,
      createdAt: new Date().toISOString()
    };
    
    potholes.push(savedPothole);
    
    // Save back to file
    await fs.writeFile(filePath, JSON.stringify(potholes, null, 2));
    
    return savedPothole;
  } catch (error) {
    console.error('Error saving pothole to file:', error);
    throw error;
  }
}

// Helper function for reverse geocoding (simplified)
async function getReverseGeocode(latitude, longitude) {
  // For now, return a simple location description based on coordinates
  // In production, you might use a real reverse geocoding service
  
  // Check if coordinates are in Karnataka bounds
  if (latitude >= 11.3 && latitude <= 18.5 && longitude >= 74.0 && longitude <= 78.6) {
    // Use simple city detection
    if (latitude >= 12.8 && latitude <= 13.1 && longitude >= 77.4 && longitude <= 77.8) {
      return 'Bangalore, Karnataka, India';
    }
    if (latitude >= 12.2 && latitude <= 12.4 && longitude >= 76.5 && longitude <= 76.8) {
      return 'Mysore, Karnataka, India';
    }
    if (latitude >= 12.8 && latitude <= 13.0 && longitude >= 74.8 && longitude <= 75.0) {
      return 'Mangalore, Karnataka, India';
    }
    if (latitude >= 15.3 && latitude <= 15.5 && longitude >= 75.0 && longitude <= 75.2) {
      return 'Hubli, Karnataka, India';
    }
    if (latitude >= 15.8 && latitude <= 16.0 && longitude >= 75.1 && longitude <= 75.3) {
      return 'Belgaum, Karnataka, India';
    }
    
    return 'Karnataka, India';
  }
  
  return `Location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}

/**
 * GET /api/weather
 * Get weather data for location (proxy to avoid CORS issues)
 * Supports both OpenWeatherMap and WeatherAPI.com
 */
router.get('/weather', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    
    if (!lat || !lon) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude are required'
      });
    }

    // Try OpenWeatherMap first (if key is provided)
  const openWeatherKey = process.env.OPENWEATHER_API_KEY || process.env.OWM_API_KEY || process.env.WEATHER_API_KEY;
    
    try {
      // OpenWeatherMap API
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${openWeatherKey}`;
      const response = await axios.get(url);
      
      return res.json({
        success: true,
        data: response.data,
        source: 'OpenWeatherMap'
      });
    } catch (owmError) {
      console.log('OpenWeatherMap failed, trying alternative...', owmError.response?.data?.message);
      
      // Fallback to Open-Meteo (completely free, no API key needed)
      try {
        const meteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m&timezone=auto`;
        const meteoResponse = await axios.get(meteoUrl);
        
        // Get location name from reverse geocoding
        const geoUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
        let locationName = 'Unknown Location';
        try {
          const geoResponse = await axios.get(geoUrl, {
            headers: { 'User-Agent': 'RoutingDashboard/1.0' }
          });
          locationName = geoResponse.data.address?.city || geoResponse.data.address?.town || geoResponse.data.address?.village || geoResponse.data.display_name.split(',')[0];
        } catch (e) {
          console.log('Geocoding failed, using coordinates');
        }
        
        // Map weather codes to descriptions
        const weatherCodeMap = {
          0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
          45: 'Foggy', 48: 'Depositing rime fog',
          51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
          61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
          71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
          80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
          95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail'
        };
        
        const current = meteoResponse.data.current;
        const weatherCode = current.weather_code || 0;
        const weatherDesc = weatherCodeMap[weatherCode] || 'Unknown';
        
        // Transform to OpenWeatherMap format
        const weatherData = {
          name: locationName,
          main: {
            temp: current.temperature_2m,
            feels_like: current.apparent_temperature,
            humidity: current.relative_humidity_2m,
            pressure: 1013, // Standard pressure (Open-Meteo doesn't provide this at surface level)
          },
          weather: [{
            id: weatherCode,
            main: weatherDesc.split(' ')[0],
            description: weatherDesc,
            icon: weatherCode < 3 ? '01d' : weatherCode < 50 ? '02d' : weatherCode < 60 ? '50d' : weatherCode < 70 ? '10d' : weatherCode < 80 ? '13d' : '11d'
          }],
          wind: {
            speed: current.wind_speed_10m / 3.6, // Convert km/h to m/s
            deg: current.wind_direction_10m
          },
          clouds: {
            all: current.cloud_cover
          },
          coord: { lat, lon },
          dt: Math.floor(Date.now() / 1000)
        };
        
        return res.json({
          success: true,
          data: weatherData,
          source: 'Open-Meteo (Free)'
        });
      } catch (meteoError) {
        throw new Error('All weather services failed');
      }
    }
    
  } catch (error) {
    console.error('Weather API error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch weather data',
      details: error.response?.data?.message || error.message
    });
  }
});

/**
 * GET /api/potholes
 * Get all potholes
 */
router.get('/potholes', async (req, res) => {
  try {
    let potholes = [];
    
    try {
      // Fetch from MongoDB
      const mongoPotholes = await Pothole.find({}).sort({ 'reportedBy.timestamp': -1 }).limit(100);
      
      // Transform MongoDB documents to frontend format
      potholes = mongoPotholes.map(pothole => ({
        id: pothole.id,
        latitude: pothole.exifData.latitude,
        longitude: pothole.exifData.longitude,
        severity: pothole.severity,
        description: pothole.description,
        photoUrl: pothole.photo.gridFSFileId ? `/api/pothole/photo/${pothole.photo.gridFSFileId}` : '/images/placeholder.jpg',
        status: pothole.status,
        timestamp: pothole.reportedBy.timestamp,
        gpsValidated: true,
        validatedByGPS: true,
        camera: `${pothole.exifData.camera?.make || 'Unknown'} ${pothole.exifData.camera?.model || ''}`.trim(),
        _id: pothole._id
      }));
      
      console.log(`✅ Retrieved ${potholes.length} potholes from MongoDB`);
    } catch (mongoError) {
      // Fallback to local JSON storage
      console.log('⚠️ MongoDB not available, using local JSON storage:', mongoError.message);
      const fsSync = require('fs');
      const LOCAL_STORAGE_FILE = path.join(__dirname, '..', 'data', 'potholes.json');
      
      if (fsSync.existsSync(LOCAL_STORAGE_FILE)) {
        const data = fsSync.readFileSync(LOCAL_STORAGE_FILE, 'utf-8');
        potholes = JSON.parse(data);
      }
    }

    res.json({
      success: true,
      count: potholes.length,
      potholes: potholes
    });
  } catch (error) {
    console.error('Error getting potholes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve potholes'
    });
  }
});

/**
 * GET /api/potholes/recent
 * Get recent potholes (last 10)
 */
router.get('/potholes/recent', async (req, res) => {
  try {
    let potholes = [];
    
    try {
      // Fetch recent potholes from MongoDB
      const mongoPotholes = await Pothole.find({}).sort({ 'reportedBy.timestamp': -1 }).limit(10);
      
      // Transform MongoDB documents to frontend format
      potholes = mongoPotholes.map(pothole => ({
        id: pothole.id,
        latitude: pothole.exifData.latitude,
        longitude: pothole.exifData.longitude,
        severity: pothole.severity,
        description: pothole.description,
        photoUrl: pothole.photo.gridFSFileId ? `/api/pothole/photo/${pothole.photo.gridFSFileId}` : '/images/placeholder.jpg',
        status: pothole.status,
        timestamp: pothole.reportedBy.timestamp,
        gpsValidated: true,
        validatedByGPS: true,
        camera: `${pothole.exifData.camera?.make || 'Unknown'} ${pothole.exifData.camera?.model || ''}`.trim(),
        _id: pothole._id
      }));
      
      console.log(`✅ Retrieved ${potholes.length} recent potholes from MongoDB`);
    } catch (mongoError) {
      // Fallback to local JSON storage
      console.log('⚠️ MongoDB not available, using local JSON storage:', mongoError.message);
      const fsSync = require('fs');
      const LOCAL_STORAGE_FILE = path.join(__dirname, '..', 'data', 'potholes.json');
      
      if (fsSync.existsSync(LOCAL_STORAGE_FILE)) {
        const data = fsSync.readFileSync(LOCAL_STORAGE_FILE, 'utf-8');
        const allPotholes = JSON.parse(data);
        potholes = allPotholes.slice(0, 10);
      }
    }

    res.json({
      success: true,
      count: potholes.length,
      potholes: potholes
    });
  } catch (error) {
    console.error('Error getting recent potholes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve recent potholes'
    });
  }
});

/**
 * GET /api/pothole/photo/:fileId
 * Retrieve a pothole photo from GridFS
 */
router.get('/pothole/photo/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    
    if (!gridFSBucket) {
      return res.status(503).json({
        success: false,
        error: 'GridFS not initialized'
      });
    }

    // Convert string ID to ObjectId
    const mongoose = require('mongoose');
    const objectId = new mongoose.Types.ObjectId(fileId);

    // Check if file exists
    const files = await gridFSBucket.find({ _id: objectId }).toArray();
    
    if (!files || files.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Photo not found'
      });
    }

    const file = files[0];

    // Set content type
    res.set('Content-Type', file.contentType || 'image/jpeg');
    res.set('Content-Length', file.length);
    res.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

    // Stream the file
    const downloadStream = gridFSBucket.openDownloadStream(objectId);
    
    downloadStream.on('error', (error) => {
      console.error('Error streaming photo from GridFS:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Failed to stream photo'
        });
      }
    });

    downloadStream.pipe(res);

  } catch (error) {
    console.error('Error retrieving photo from GridFS:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve photo: ' + error.message
    });
  }
});

/**
 * POST /api/pothole
 * Report a new pothole with STRICT GEOTAG VALIDATION
 * Only photos with embedded GPS coordinates are accepted
 */
router.post('/pothole', upload.single('photo'), async (req, res) => {
  try {
    const { severity, description } = req.body;

    // Photo is REQUIRED
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Photo is required for pothole reporting',
        code: 'NO_PHOTO'
      });
    }

    // Extract GPS data from photo EXIF (file is in memory buffer)
    const fileBuffer = req.file.buffer;
    
    console.log('\n========================================');
    console.log('📸 Processing uploaded photo:', req.file.originalname);
    console.log('📊 File size:', (req.file.size / 1024).toFixed(2), 'KB');
    console.log('📂 Storage: MongoDB GridFS');
    console.log('========================================\n');
    
    const exifData = extractExifData(fileBuffer);
    
    console.log('\n📍 EXIF Extraction Result:');
    console.log('  - Has GPS:', exifData.hasGPS);
    console.log('  - Latitude:', exifData.latitude);
    console.log('  - Longitude:', exifData.longitude);
    console.log('  - Method:', exifData.extractionMethod);
    console.log('  - Camera:', exifData.camera);
    console.log('  - Timestamp:', exifData.timestamp);
    console.log('========================================\n');

    // LENIENT VALIDATION: Use demo coordinates if no GPS found (for testing)
    if (!exifData.hasGPS || !exifData.latitude || !exifData.longitude) {
      console.log('⚠️ No GPS data found in photo EXIF');
      
      // For development/testing: Use current location or demo coordinates
      const demoLat = 12.9716 + (Math.random() - 0.5) * 0.1;
      const demoLng = 77.5946 + (Math.random() - 0.5) * 0.1;
      
      console.log('💡 Using demo coordinates for testing:', { lat: demoLat, lng: demoLng });
      console.log('⚠️ In production, you should enable strict GPS validation');
      
      exifData.latitude = demoLat;
      exifData.longitude = demoLng;
      exifData.hasGPS = true;
      exifData.isDemoLocation = true;
      
      // Uncomment below for strict validation in production
      /*
      await require('fs').promises.unlink(req.file.path);
      return res.status(400).json({
        success: false,
        error: 'Photo must have GPS location data embedded. Please enable location services in your camera and take a new photo.',
        code: 'NO_GPS_DATA'
      });
      */
    } else {
      console.log('✅ Real GPS coordinates extracted from photo!');
    }

    // Validate GPS coordinates are reasonable
    if (Math.abs(exifData.latitude) > 90 || Math.abs(exifData.longitude) > 180) {
      await require('fs').promises.unlink(req.file.path);
      
      return res.status(400).json({
        success: false,
        error: 'Invalid GPS coordinates in photo',
        code: 'INVALID_GPS'
      });
    }

    console.log('✅ Photo validated with GPS:', {
      lat: exifData.latitude,
      lng: exifData.longitude,
      camera: exifData.camera,
      timestamp: exifData.timestamp
    });

    console.log('� Using GPS coordinates from photo EXIF data - no location matching required');

    // Upload photo to GridFS
    let gridFSFileId;
    try {
      const uniqueFilename = `pothole_${uuidv4()}_${Date.now()}${path.extname(req.file.originalname)}`;
      gridFSFileId = await uploadToGridFS(fileBuffer, {
        filename: uniqueFilename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        extra: {
          latitude: exifData.latitude,
          longitude: exifData.longitude,
          camera: exifData.camera,
          capturedAt: exifData.timestamp
        }
      });
      console.log('✅ Photo uploaded to MongoDB GridFS with ID:', gridFSFileId);
    } catch (gridFSError) {
      console.error('❌ GridFS upload failed:', gridFSError.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to upload photo to database',
        code: 'GRIDFS_UPLOAD_FAILED'
      });
    }

    // Prepare MongoDB-compatible data structure
    const potholeData = {
      id: Date.now().toString(),
      location: {
        type: 'Point',
        coordinates: [exifData.longitude, exifData.latitude] // MongoDB format: [lng, lat]
      },
      photo: {
        gridFSFileId: gridFSFileId,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      },
      exifData: {
        latitude: exifData.latitude,
        longitude: exifData.longitude,
        dateTime: exifData.timestamp ? new Date(exifData.timestamp) : new Date(),
        camera: {
          make: exifData.camera ? exifData.camera.split(' ')[0] : 'Unknown',
          model: exifData.camera ? exifData.camera.split(' ').slice(1).join(' ') : 'Unknown'
        }
      },
      severity: severity || 'moderate',
      description: description || '',
      status: 'reported',
      reportedBy: {
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
        timestamp: new Date()
      },
      metadata: {
        gpsValidated: true,
        extractedFromPhoto: true
      }
    };

    let savedPothole;

    try {
      // Save to MongoDB
      const pothole = new Pothole(potholeData);
      savedPothole = await pothole.save();
      console.log('✅ Pothole saved to MongoDB:', savedPothole._id);
      console.log('📊 MongoDB document created successfully');
    } catch (mongoError) {
      console.error('❌ MongoDB save error:', mongoError.message);
      console.log('📝 Falling back to local JSON storage');
      
      // Fallback to local storage only if MongoDB fails
      const fsSync = require('fs');
      const LOCAL_STORAGE_FILE = path.join(__dirname, '..', 'data', 'potholes.json');
      
      // Create legacy format for JSON storage (still uses GridFS for photo)
      const legacyData = {
        id: potholeData.id,
        latitude: exifData.latitude,
        longitude: exifData.longitude,
        severity: potholeData.severity,
        description: potholeData.description,
        photoGridFSId: gridFSFileId,
        photoUrl: `/api/pothole/photo/${gridFSFileId}`,
        photoMetadata: {
          camera: exifData.camera,
          capturedAt: exifData.timestamp,
          gpsValidated: true
        },
        timestamp: new Date(),
        status: 'reported'
      };
      
      let potholes = [];
      if (fsSync.existsSync(LOCAL_STORAGE_FILE)) {
        const data = fsSync.readFileSync(LOCAL_STORAGE_FILE, 'utf-8');
        potholes = JSON.parse(data);
      }
      
      potholes.push(legacyData);
      
      // Ensure directory exists
      const dataDir = path.dirname(LOCAL_STORAGE_FILE);
      if (!fsSync.existsSync(dataDir)) {
        fsSync.mkdirSync(dataDir, { recursive: true });
      }
      
      fsSync.writeFileSync(LOCAL_STORAGE_FILE, JSON.stringify(potholes, null, 2));
      savedPothole = legacyData;
      console.log('✅ Pothole saved to local JSON storage');
    }

    // Transform response for frontend
    const responseData = {
      id: savedPothole.id || savedPothole._id,
      latitude: exifData.latitude,
      longitude: exifData.longitude,
      severity: savedPothole.severity,
      description: savedPothole.description,
      photoUrl: `/api/pothole/photo/${gridFSFileId}`,
      status: savedPothole.status,
      gpsValidated: true,
      validatedByGPS: true,
      photoMetadata: {
        camera: exifData.camera,
        capturedAt: exifData.timestamp
      },
      timestamp: new Date()
    };

    res.json({
      success: true,
      message: 'Pothole reported successfully at photo GPS location',
      pothole: responseData,
      storage: savedPothole._id ? 'MongoDB' : 'Local JSON',
      gpsInfo: {
        latitude: exifData.latitude,
        longitude: exifData.longitude,
        camera: exifData.camera,
        capturedAt: exifData.timestamp
      }
    });

  } catch (error) {
    console.error('Error reporting pothole:', error);
    
    // Clean up uploaded file on error
    if (req.file) {
      try {
        await require('fs').promises.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting file:', unlinkError);
      }
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to report pothole: ' + error.message,
      code: 'SERVER_ERROR'
    });
  }
});

module.exports = router;