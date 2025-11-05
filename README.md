# Real-time Routing + Weather + Traffic Dashboard

A comprehensive full-stack web application that provides real-time routing with weather alerts and traffic analytics. Built with Node.js, Express, Leaflet, and integrated with OpenRouteService and OpenWeatherMap APIs.

![Dashboard Preview](https://img.shields.io/badge/Status-Production%20Ready-brightgreen) ![Node.js](https://img.shields.io/badge/Node.js-14%2B-green) ![License](https://img.shields.io/badge/License-MIT-blue)

## 🌟 Features

### 🗺️ Interactive Mapping
- **Leaflet-based Interactive Map** with customizable tile layers
- **Click-to-Set Locations** for easy route planning
- **Geolocation Support** to find user's current position
- **Responsive Map Controls** optimized for mobile and desktop

### 🚗 Advanced Routing
- **Multi-Modal Routing** (driving, walking, cycling)
- **Real-time Route Calculation** using OpenRouteService API
- **Distance & Duration Display** with formatted output
- **Visual Route Overlay** on interactive map

### 🌤️ Weather Integration
- **Live Weather Data** for route locations
- **Weather Alert System** with modal notifications
- **Current Conditions Display** with icons and details
- **Route-Specific Weather** at midpoint locations

### 📊 Analytics Dashboard
- **Traffic Usage Analytics** with Chart.js visualizations
- **Request Tracking** over time with line charts
- **Distance Distribution** analysis with doughnut charts
- **Top Origins Tracking** and summary statistics

### 📱 Responsive Design
- **Bootstrap 5** for mobile-first responsive layout
- **Collapsible Sidebar** for mobile optimization
- **Touch-Friendly Controls** for tablet and mobile users
- **Progressive Web App** features ready

## 🚀 Quick Start

### Prerequisites
- **Node.js 14+** installed on your system
- **NPM** (comes with Node.js)
- API keys from required services (see setup section)

### Installation

1. **Clone or download this project**
   ```bash
   git clone <your-repository-url>
   cd realtime-routing-dashboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   # Copy the example environment file
   copy .env.example .env
   
   # Edit .env file with your API keys (see API Setup section below)
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   ```
   http://localhost:3000
   ```

## 🔧 API Setup Guide

### 1. OpenRouteService API Key
Used for routing, directions, and geocoding.

1. Visit [OpenRouteService Developer Portal](https://openrouteservice.org/dev/#/signup)
2. Sign up for a free account
3. Generate an API key in your dashboard
4. Add to `.env`: `ORS_API_KEY=your_key_here`

**Free Tier Limits:** 2,000 requests/day

### 2. OpenWeatherMap API Key
Used for weather data and alerts.

1. Visit [OpenWeatherMap API](https://openweathermap.org/api)
2. Sign up for a free account
3. Generate an API key in your profile
4. Add to `.env`: `OWM_API_KEY=your_key_here`

**Free Tier Limits:** 60 calls/minute, 1,000,000 calls/month

### 3. Map Tiles (Optional)
The application uses OpenStreetMap tiles by default (free). For custom styling:

**Option A: Mapbox (Recommended for Production)**
1. Visit [Mapbox](https://account.mapbox.com/access-tokens/)
2. Create an account and generate access token
3. Update `.env`: 
   ```
   MAPBOX_TILE_URL=https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=YOUR_TOKEN
   ```

**Option B: Other Providers**
- Stadia Maps, CartoDB, or other Leaflet-compatible providers
- Update `MAPBOX_TILE_URL` in `.env` with provider URL

## 📂 Project Structure

```
realtime-routing-dashboard/
├── 📁 routes/
│   └── api.js              # API endpoint handlers
├── 📁 public/
│   ├── 📁 css/
│   │   └── style.css       # Custom styles
│   ├── 📁 js/
│   │   └── main.js         # Frontend application logic
│   ├── 📁 images/          # Static images
│   └── index.html          # Main application interface
├── 📁 data/                # Analytics data storage
│   └── analytics.json      # Persistent analytics (auto-generated)
├── 📄 server.js            # Express server configuration
├── 📄 package.json         # Dependencies and scripts
├── 📄 .env.example         # Environment template
└── 📄 README.md           # This file
```

## 🛠️ Configuration Options

### Environment Variables (.env)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 3000 | Server port number |
| `ORS_API_KEY` | **Yes** | - | OpenRouteService API key |
| `OWM_API_KEY` | **Yes** | - | OpenWeatherMap API key |
| `MAPBOX_TILE_URL` | No | OSM tiles | Custom tile server URL |
| `DEFAULT_LAT` | No | 40.7128 | Default map center latitude |
| `DEFAULT_LNG` | No | -74.0060 | Default map center longitude |
| `NODE_ENV` | No | development | Environment mode |

### Travel Modes Supported
- 🚗 **Driving** (`driving-car`)
- 🚶 **Walking** (`foot-walking`)  
- 🚲 **Cycling** (`cycling-regular`)

## 🎯 API Endpoints

### Core Routing API
```http
POST /api/route
Content-Type: application/json

{
  "origin": { "lat": 40.7128, "lng": -74.0060 },
  "destination": "Boston, MA",
  "profile": "driving-car"
}
```

### Weather Data API  
```http
GET /api/weather?lat=40.7128&lon=-74.0060
```

### Analytics API
```http
GET /api/analytics
```

### Health Check
```http
GET /api/health
```

## 📊 Analytics Features

The dashboard automatically tracks:
- **Total route requests** over time
- **Average route distance** calculations
- **Popular origin locations**
- **Distance distribution** across ranges
- **Request patterns** by hour

Data is stored locally in `data/analytics.json` and displayed via Chart.js visualizations.

## 🔒 Security Features

- **API Key Protection**: All external API calls proxied through backend
- **Input Validation**: Coordinates and addresses sanitized
- **CORS Configuration**: Configurable allowed origins
- **Rate Limiting Ready**: Built-in structure for request limiting
- **Environment Isolation**: Sensitive data in `.env` files

## 🧪 Testing & Demo

### Demo Route Feature
Click "Try Demo Route" to test with predefined coordinates (New York → Boston) without API keys.

### Manual Testing
1. Enter addresses in origin/destination fields
2. Click map to set coordinates
3. Use different travel modes
4. Check weather alerts functionality
5. View analytics after multiple requests

## 📱 Mobile Support

- **Responsive Design** works on all screen sizes
- **Touch-Friendly** map interactions
- **Collapsible Sidebar** for mobile screens
- **Optimized Button Sizes** for touch devices
- **Swipe Gestures** supported on map

## 🚀 Production Deployment

### Environment Setup
```bash
# Set production environment
NODE_ENV=production

# Use production-grade API limits
RATE_LIMIT_MAX=1000
CACHE_DURATION=600

# Enable security features
SECURE_COOKIES=true
CORS_ORIGINS=yourdomain.com
```

### Recommended Hosting
- **Railway** - Easy Node.js deployment
- **Heroku** - Popular PaaS option
- **DigitalOcean App Platform** - Simple and scalable
- **AWS EC2** - Full control option

### Build Script
```bash
npm run start
```

## 🔧 Customization

### Adding New Travel Modes
Edit `routes/api.js` and add to the profile validation:
```javascript
const validProfiles = ['driving-car', 'foot-walking', 'cycling-regular', 'driving-hgv'];
```

### Custom Map Styles
Update the tile URL in `.env`:
```env
MAPBOX_TILE_URL=https://your-tile-provider/{z}/{x}/{y}.png
```

### Analytics Extensions
Modify `analytics.json` structure in `routes/api.js` to track additional metrics.

## 🐛 Troubleshooting

### Common Issues

**API Key Errors**
- Verify keys are correctly set in `.env`
- Check API key validity on provider websites
- Ensure no extra spaces in environment variables

**Route Calculation Fails**
- Verify coordinates are valid (latitude: -90 to 90, longitude: -180 to 180)
- Check internet connectivity
- Try demo route to test API integration

**Map Not Loading**
- Check browser console for JavaScript errors
- Verify tile URL is accessible
- Try using OpenStreetMap default tiles

**Weather Data Missing**
- Weather API has regional limitations
- Some areas may not have alert data available
- Check API key permissions

### Debug Mode
Set `NODE_ENV=development` for detailed error messages.

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

- **Documentation**: Check this README first
- **Issues**: Create GitHub issues for bugs
- **API Help**: Refer to OpenRouteService and OpenWeatherMap docs
- **General Questions**: Use GitHub discussions

## 🎉 Acknowledgments

- **Leaflet** - Excellent open-source mapping library
- **OpenRouteService** - Powerful routing API
- **OpenWeatherMap** - Comprehensive weather data
- **Bootstrap** - Responsive CSS framework
- **Chart.js** - Beautiful data visualizations

---

**Built with ❤️ for the developer community**

*Ready to explore the world with real-time routing and weather insights!* 🌍🗺️