/**
 * MongoDB Models for Pothole Reporting System
 */

const mongoose = require('mongoose');

// Pothole Schema
const potholeSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
    required: true
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
      index: '2dsphere' // Enable geospatial queries
    }
  },
  photo: {
    filename: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    mimetype: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    path: {
      type: String,
      required: true
    }
  },
  exifData: {
    latitude: {
      type: Number,
      required: true
    },
    longitude: {
      type: Number,
      required: true
    },
    dateTime: {
      type: Date
    },
    camera: {
      make: String,
      model: String
    },
    gpsAltitude: Number,
    gpsAccuracy: Number
  },
  severity: {
    type: String,
    enum: ['minor', 'moderate', 'major', 'severe'],
    default: 'moderate'
  },
  status: {
    type: String,
    enum: ['reported', 'verified', 'in_progress', 'fixed', 'dismissed'],
    default: 'reported'
  },
  reportedBy: {
    ipAddress: String,
    userAgent: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  verification: {
    isVerified: {
      type: Boolean,
      default: false
    },
    verifiedAt: Date,
    verificationCount: {
      type: Number,
      default: 1
    },
    geotagVerification: {
      method: {
        type: String,
        enum: ['OCR', 'Gemini Vision API', 'EXIF', 'None'],
        default: 'EXIF'
      },
      verified: {
        type: Boolean,
        default: false
      },
      distance: Number,
      extractedCoordinates: {
        lat: Number,
        lng: Number
      },
      reason: String
    }
  },
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    formattedAddress: String
  },
  metadata: {
    roadType: {
      type: String,
      enum: ['highway', 'arterial', 'residential', 'service', 'unclassified'],
      default: 'unclassified'
    },
    weatherCondition: String,
    nearbyLandmarks: [String],
    gpsValidated: {
      type: Boolean,
      default: true
    },
    geotagVerified: {
      type: Boolean,
      default: false
    },
    verificationMethod: String
  },
  description: {
    type: String,
    default: ''
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Indexes for better performance
potholeSchema.index({ location: '2dsphere' });
potholeSchema.index({ status: 1 });
potholeSchema.index({ severity: 1 });
potholeSchema.index({ createdAt: -1 });
potholeSchema.index({ 'verification.isVerified': 1 });

// Instance methods
potholeSchema.methods.isNearLocation = function(lat, lng, radiusKm = 1) {
  const earthRadiusKm = 6371;
  const dLat = this.toRadians(lat - this.exifData.latitude);
  const dLng = this.toRadians(lng - this.exifData.longitude);
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(this.toRadians(this.exifData.latitude)) * Math.cos(this.toRadians(lat)) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = earthRadiusKm * c;
  
  return distance <= radiusKm;
};

potholeSchema.methods.toRadians = function(degrees) {
  return degrees * (Math.PI/180);
};

// Static methods
potholeSchema.statics.findNearRoute = function(routeCoordinates, bufferKm = 0.5) {
  // Create a buffer around the route and find potholes within it
  const bufferDegrees = bufferKm / 111.32; // Approximate conversion
  
  const routeBounds = {
    minLat: Math.min(...routeCoordinates.map(coord => coord[1])) - bufferDegrees,
    maxLat: Math.max(...routeCoordinates.map(coord => coord[1])) + bufferDegrees,
    minLng: Math.min(...routeCoordinates.map(coord => coord[0])) - bufferDegrees,
    maxLng: Math.max(...routeCoordinates.map(coord => coord[0])) + bufferDegrees
  };
  
  return this.find({
    'location.coordinates.0': { $gte: routeBounds.minLng, $lte: routeBounds.maxLng },
    'location.coordinates.1': { $gte: routeBounds.minLat, $lte: routeBounds.maxLat },
    status: { $in: ['reported', 'verified'] }
  });
};

potholeSchema.statics.findByLocation = function(lat, lng, radiusKm = 5) {
  return this.find({
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [lng, lat]
        },
        $maxDistance: radiusKm * 1000 // Convert km to meters
      }
    },
    status: { $in: ['reported', 'verified'] }
  });
};

const Pothole = mongoose.model('Pothole', potholeSchema);

module.exports = {
  Pothole
};