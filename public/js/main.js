/**
 * Real-time Routing Dashboard - Main Frontend JavaScript
 * 
 * This file handles:
 * - Leaflet map initialization and interactions
 * - Route calculation and display
 * - Weather data fetching and alerts
 * - Analytics charts with Chart.js
 * - UI interactions and responsive behavior
 */

class RoutingDashboard {
    constructor() {
        // Map and routing state
        this.map = null;
        this.config = null;
        this.currentRoute = null;
        this.currentWeather = null;
        this.markers = {
            origin: null,
            destination: null
        };
        this.routeLayer = null;
        
        // Location tracking
        this.userLocationMarker = null;
        this.accuracyCircle = null;
        
        // Navigation system
        this.isNavigating = false;
        this.navigationRoute = null;
        this.currentPosition = null;
        this.locationWatchId = null;
        this.navigationInstructions = [];
        this.currentInstructionIndex = 0;
        
        // Chart instances
        this.charts = {};
        
        // Click mode for map interaction
        this.clickMode = null; // 'destination'
        
        // Location debug properties
        this.lastLocationError = null;
        this.locationRequestCount = 0;
        
        // Initialize the dashboard
        this.init().catch(error => {
            console.error('🔥 Dashboard initialization error:', error);
            this.showToast('Error initializing dashboard: ' + error.message, 'error');
        });
    }

    /**
     * Initialize the dashboard
     */
    async init() {
        try {
            console.log('🔄 Loading configuration...');
            await this.loadConfig();
            console.log('✅ Configuration loaded');
            
            console.log('🗺️ Initializing map...');
            this.initMap();
            console.log('✅ Map initialized');
            
            console.log('🔗 Setting up event listeners...');
            this.setupEventListeners();
            console.log('✅ Event listeners setup');
            
            console.log('📍 Getting user location...');
            this.getUserLocation();
            
            console.log('📱 Initializing live location panel...');
            this.updateLiveLocation();
            
            console.log('✅ Dashboard initialization complete!');
            this.showToast('Welcome to Routing Dashboard! Click on the map or enter addresses to plan a route.', 'success');
            
        } catch (error) {
            console.error('❌ Dashboard initialization failed:', error);
            console.error('Full error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            this.showToast('Failed to initialize dashboard. Please refresh the page.', 'error');
        }
    }

    /**
     * Load configuration from server
     */
    async loadConfig() {
        try {
            const response = await axios.get('/api/config');
            this.config = response.data;
        } catch (error) {
            console.warn('⚠️ Could not load config, using defaults');
            this.config = {
                mapboxTileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                defaultCenter: { lat: 15.3173, lng: 75.7139 } // Karnataka, India center
            };
        }
    }

    /**
     * Initialize Leaflet map
     */
    initMap() {
        // Create map
        this.map = L.map('map', {
            zoomControl: true,
            attributionControl: true
        }).setView([this.config.defaultCenter.lat, this.config.defaultCenter.lng], 10);

        // Add tile layer
        L.tileLayer(this.config.mapboxTileUrl, {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18,
            id: 'mapbox/streets-v11'
        }).addTo(this.map);

        // Add click handler for setting origin/destination
        this.map.on('click', (e) => this.handleMapClick(e));

        // Add locate control
        this.map.on('locationfound', (e) => this.onLocationFound(e));
        this.map.on('locationerror', (e) => this.onLocationError(e));

        console.log('🗺️ Map initialized successfully');
    }

    /**
     * Setup event listeners for UI interactions
     */
    setupEventListeners() {
        // Route form submission
        $('#routeForm').on('submit', (e) => {
            e.preventDefault();
            this.calculateRoute();
        });

        // Demo route button
        $('#demoRouteBtn').on('click', () => this.loadDemoRoute());

        // Navigation buttons
        $('#planRouteBtn').on('click', () => this.showRoutePanel());
        $('#showAlertsBtn').on('click', () => this.showWeatherAlerts());
        $('#startNavigationBtn').on('click', () => this.startNavigation());
        $('#stopNavigationBtn').on('click', () => this.stopNavigation());
        $('#refreshLocationBtn').on('click', () => this.updateLiveLocation());

        // Quick destination buttons
        $('.quick-dest').on('click', (e) => {
            const destination = $(e.target).closest('.quick-dest').data('dest');
            $('#destination').val(destination);
            this.startNavigation();
        });

        // Map controls
        $('#locateBtn').on('click', () => this.getUserLocation());
        $('#locationDiagnosticsBtn').on('click', () => this.runLocationDiagnostics());
        $('#clearMapBtn').on('click', () => this.clearMap());

        // Sidebar toggle
        $('#toggleSidebar').on('click', () => this.toggleSidebar());

        // Input field click handlers for map interaction
        $('#destination').on('focus', () => {
            this.clickMode = 'destination';
            this.showToast('Click on the map to set destination', 'info');
        });

        // Clear click mode when input loses focus
        $('#destination').on('blur', () => {
            setTimeout(() => { this.clickMode = null; }, 200);
        });

        // Pothole form submission
        $('#potholeForm').on('submit', (e) => {
            e.preventDefault();
            this.uploadPothole();
        });

        // Responsive behavior
        $(window).on('resize', () => this.handleResize());
    }

    /**
     * Handle map click events
     */
    handleMapClick(e) {
        const { lat, lng } = e.latlng;
        
        if (this.clickMode === 'destination') {
            this.setDestinationMarker(lat, lng);
            // Use reverse geocoding to get a readable address
            this.reverseGeocode(lat, lng).then(address => {
                $('#destination').val(address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
            });
            this.clickMode = null;
        }
    }

    /**
     * Set origin marker on map
     */
    setOriginMarker(lat, lng) {
        if (this.markers.origin) {
            this.map.removeLayer(this.markers.origin);
        }

        this.markers.origin = L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'custom-marker origin-marker',
                html: '<i class="fas fa-map-marker-alt"></i>',
                iconSize: [20, 20],
                iconAnchor: [10, 20]
            })
        }).addTo(this.map).bindPopup('Origin');
    }

    /**
     * Set destination marker on map
     */
    setDestinationMarker(lat, lng) {
        if (this.markers.destination) {
            this.map.removeLayer(this.markers.destination);
        }

        this.markers.destination = L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'custom-marker destination-marker',
                html: '<i class="fas fa-flag-checkered"></i>',
                iconSize: [20, 20],
                iconAnchor: [10, 20]
            })
        }).addTo(this.map).bindPopup('Destination');
    }

    /**
     * Calculate route between origin and destination
     */
    async calculateRoute() {
        const origin = $('#origin').val().trim();
        const destination = $('#destination').val().trim();
        const profile = $('#profile').val();

        if (!origin || !destination) {
            this.showToast('Please enter both origin and destination', 'error');
            return;
        }

        this.showLoading(true);

        try {
            // Parse coordinates or use address strings
            const originData = this.parseLocationInput(origin);
            const destinationData = this.parseLocationInput(destination);

            // Call backend API
            const response = await axios.post('/api/route', {
                origin: originData,
                destination: destinationData,
                profile: profile
            });

            if (response.data.success) {
                if (response.data.routes) {
                    // Multiple routes available
                    this.displayMultipleRoutes(response.data.routes);
                    await this.fetchWeatherForRoute(response.data.routes[0].midpoint);
                    this.showToast(`${response.data.routes.length} route options found!`, 'success');
                } else {
                    // Single route (backward compatibility)
                    this.displayRoute(response.data.route);
                    await this.fetchWeatherForRoute(response.data.route.midpoint);
                    this.showToast('Route calculated successfully!', 'success');
                }
            } else {
                throw new Error(response.data.error || 'Failed to calculate route');
            }

        } catch (error) {
            console.error('❌ Route calculation error:', error);
            const message = error.response?.data?.error || error.message || 'Failed to calculate route';
            this.showToast(message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Parse location input (coordinates or address string)
     */
    parseLocationInput(input) {
        const coords = input.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
        if (coords) {
            return {
                lat: parseFloat(coords[1]),
                lng: parseFloat(coords[2])
            };
        }
        return input; // Return as address string
    }

    /**
     * Display calculated route on map
     */
    displayRoute(route) {
        // Remove existing route layer
        if (this.routeLayer) {
            this.map.removeLayer(this.routeLayer);
        }

        // Add route to map
        this.routeLayer = L.geoJSON(route.geometry, {
            style: {
                color: '#007bff',
                weight: 5,
                opacity: 0.8
            }
        }).addTo(this.map);

        // Fit map to route bounds
        if (route.bbox) {
            const bounds = [
                [route.bbox[1], route.bbox[0]],
                [route.bbox[3], route.bbox[2]]
            ];
            this.map.fitBounds(bounds, { padding: [20, 20] });
        }

        // Store current route
        this.currentRoute = route;

        // Update route summary
        this.displayRouteSummary(route);
    }

    /**
     * Display multiple route alternatives on map
     */
    displayMultipleRoutes(routes) {
        // Remove existing route layers
        if (this.routeLayer) {
            this.map.removeLayer(this.routeLayer);
        }
        
        // Store routes
        this.currentRoutes = routes;
        this.currentRoute = routes[0]; // Default to first route

        // Create layer group for all routes
        this.routeLayer = L.layerGroup().addTo(this.map);

        // Add each route with different styling
        routes.forEach((route, index) => {
            const isSelected = index === 0; // First route is selected by default
            
            const routeLine = L.geoJSON(route.geometry, {
                style: {
                    color: route.color,
                    weight: isSelected ? 6 : 4,
                    opacity: isSelected ? 0.9 : 0.6,
                    dashArray: isSelected ? null : '10, 5'
                }
            });

            // Add click handler for route selection
            routeLine.on('click', () => {
                this.selectRoute(index);
            });

            // Add route to layer group
            this.routeLayer.addLayer(routeLine);

            // Add route popup with details
            const popupContent = `
                <div class="route-popup">
                    <strong>${route.name}</strong><br>
                    <small>${route.description}</small><br>
                    <div class="mt-2">
                        <span class="badge bg-primary">${route.distance_formatted}</span>
                        <span class="badge bg-info">${route.duration_formatted}</span>
                    </div>
                    <div class="mt-1">
                        <small>Safety: ${route.properties.safetyScore}/10</small><br>
                        <small>Road: ${route.properties.roadCondition}</small><br>
                        <small>Traffic: ${route.properties.trafficLevel}</small>
                    </div>
                </div>
            `;
            routeLine.bindPopup(popupContent);
        });

        // Fit map to show all routes
        const allCoords = routes.flatMap(route => route.geometry.coordinates.map(coord => [coord[1], coord[0]]));
        if (allCoords.length > 0) {
            const group = new L.featureGroup(allCoords.map(coord => L.marker(coord)));
            this.map.fitBounds(group.getBounds().pad(0.1));
        }

        // Update route summary with multiple options
        this.displayMultipleRouteSummary(routes);
        
        // Load potholes for the selected route (first route by default)
        if (routes.length > 0 && routes[0].geometry && routes[0].geometry.coordinates) {
            this.loadPotholesForRoute(routes[0].geometry.coordinates);
        }
    }

    /**
     * Select a specific route from alternatives
     */
    selectRoute(routeIndex) {
        if (!this.currentRoutes || routeIndex >= this.currentRoutes.length) return;

        this.currentRoute = this.currentRoutes[routeIndex];

        // Update route styling
        this.routeLayer.eachLayer((layer) => {
            layer.setStyle({
                weight: 4,
                opacity: 0.6,
                dashArray: '10, 5'
            });
        });

        // Highlight selected route
        const selectedLayer = Object.values(this.routeLayer._layers)[routeIndex];
        if (selectedLayer) {
            selectedLayer.setStyle({
                weight: 6,
                opacity: 0.9,
                dashArray: null
            });
        }

        // Update summary
        this.displayMultipleRouteSummary(this.currentRoutes, routeIndex);
        this.showToast(`Selected: ${this.currentRoute.name}`, 'info');
        
        // Load potholes for the newly selected route
        if (this.currentRoute.geometry && this.currentRoute.geometry.coordinates) {
            this.loadPotholesForRoute(this.currentRoute.geometry.coordinates);
        }
    }

    /**
     * Display multiple routes summary in sidebar
     */
    displayMultipleRouteSummary(routes, selectedIndex = 0) {
        const selectedRoute = routes[selectedIndex];
        
        const summaryHtml = `
            <div class="route-options mb-3">
                <h6 class="mb-2"><i class="fas fa-route me-2"></i>Route Options</h6>
                ${routes.map((route, index) => `
                    <div class="route-option ${index === selectedIndex ? 'selected' : ''}" 
                         onclick="window.dashboard.selectRoute(${index})"
                         style="cursor: pointer; border: 2px solid ${index === selectedIndex ? route.color : '#e9ecef'}; 
                                border-radius: 8px; padding: 10px; margin-bottom: 8px; 
                                background: ${index === selectedIndex ? route.color + '15' : '#fff'}">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <div class="fw-bold text-truncate" style="color: ${route.color}">
                                    ${route.name}
                                </div>
                                <small class="text-muted">${route.description}</small>
                            </div>
                            <div class="text-end">
                                <div class="fw-bold">${route.distance_formatted}</div>
                                <small class="text-muted">${route.duration_formatted}</small>
                            </div>
                        </div>
                        <div class="mt-2">
                            <div class="row g-1">
                                <div class="col-4 text-center">
                                    <small class="d-block text-muted">Safety</small>
                                    <span class="badge bg-${route.properties.safetyScore >= 8 ? 'success' : route.properties.safetyScore >= 6 ? 'warning' : 'danger'} rounded-pill">
                                        ${route.properties.safetyScore}/10
                                    </span>
                                </div>
                                <div class="col-4 text-center">
                                    <small class="d-block text-muted">Road</small>
                                    <span class="badge bg-${route.properties.roadCondition === 'excellent' ? 'success' : route.properties.roadCondition === 'good' ? 'primary' : 'warning'} rounded-pill">
                                        ${route.properties.roadCondition}
                                    </span>
                                </div>
                                <div class="col-4 text-center">
                                    <small class="d-block text-muted">Traffic</small>
                                    <span class="badge bg-${route.properties.trafficLevel === 'light' ? 'success' : route.properties.trafficLevel === 'moderate' ? 'warning' : 'danger'} rounded-pill">
                                        ${route.properties.trafficLevel}
                                    </span>
                                </div>
                            </div>
                        </div>
                        ${route.properties.potholeRisk ? `
                            <div class="mt-2">
                                <small class="text-muted">
                                    <i class="fas fa-road me-1"></i>
                                    Pothole Risk: <span class="text-${route.properties.potholeRisk === 'very_low' ? 'success' : route.properties.potholeRisk === 'low' ? 'warning' : 'danger'}">${route.properties.potholeRisk.replace('_', ' ')}</span>
                                </small>
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        `;

        $('#routeSummaryContent').html(summaryHtml);
        $('#routeSummaryCard').removeClass('d-none');
    }

    /**
     * Display route summary in sidebar
     */
    displayRouteSummary(route) {
        const summaryHtml = `
            <div class="row g-2">
                <div class="col-6">
                    <div class="text-center p-2 bg-light rounded">
                        <i class="fas fa-route text-primary"></i>
                        <div class="fw-bold">${route.distance_formatted}</div>
                        <small class="text-muted">Distance</small>
                    </div>
                </div>
                <div class="col-6">
                    <div class="text-center p-2 bg-light rounded">
                        <i class="fas fa-clock text-info"></i>
                        <div class="fw-bold">${route.duration_formatted}</div>
                        <small class="text-muted">Duration</small>
                    </div>
                </div>
            </div>
            <div class="mt-2">
                <small class="text-muted">
                    <i class="fas fa-info-circle me-1"></i>
                    Route calculated using ${$('#profile option:selected').text()}
                </small>
            </div>
        `;

        $('#routeSummaryContent').html(summaryHtml);
        $('#routeSummaryCard').removeClass('d-none');
    }

    /**
     * Fetch weather data for route midpoint
     */
    async fetchWeatherForRoute(midpoint) {
        try {
            const response = await axios.get('/api/weather', {
                params: {
                    lat: midpoint.lat,
                    lon: midpoint.lng
                }
            });

            if (response.data.success) {
                this.currentWeather = response.data.weather;
                this.displayWeatherInfo(response.data.weather);
                
                // Show weather alerts if any
                if (response.data.weather.alerts.length > 0) {
                    this.showWeatherAlerts();
                }
            }

        } catch (error) {
            console.error('❌ Weather fetch error:', error);
            // Don't show error toast for weather - it's not critical
        }
    }

    /**
     * Display weather information
     */
    displayWeatherInfo(weather) {
        const weatherHtml = `
            <div class="d-flex align-items-center mb-2">
                <img src="https://openweathermap.org/img/wn/${weather.current.weather.icon}@2x.png" 
                     width="40" height="40" alt="Weather icon">
                <div class="ms-2">
                    <div class="fw-bold">${Math.round(weather.current.temp)}°C</div>
                    <small class="text-muted">${weather.current.weather.description}</small>
                </div>
            </div>
            <div class="row g-2 text-center">
                <div class="col-4">
                    <small class="text-muted d-block">Humidity</small>
                    <strong>${weather.current.humidity}%</strong>
                </div>
                <div class="col-4">
                    <small class="text-muted d-block">Wind</small>
                    <strong>${weather.current.wind.speed} m/s</strong>
                </div>
                <div class="col-4">
                    <small class="text-muted d-block">Feels like</small>
                    <strong>${Math.round(weather.current.feels_like)}°C</strong>
                </div>
            </div>
            ${weather.alerts.length > 0 ? `
                <div class="alert alert-warning mt-2 p-2">
                    <i class="fas fa-exclamation-triangle me-1"></i>
                    ${weather.alerts.length} weather alert(s)
                </div>
            ` : ''}
        `;

        $('#weatherContent').html(weatherHtml);
        $('#weatherCard').removeClass('d-none');
    }

    /**
     * Show weather alerts modal
     */
    showWeatherAlerts() {
        if (!this.currentWeather) {
            this.showToast('No weather data available. Please calculate a route first.', 'info');
            return;
        }

        const alerts = this.currentWeather.alerts;
        let alertsHtml = '';

        if (alerts.length === 0) {
            alertsHtml = `
                <div class="text-center py-4">
                    <i class="fas fa-sun text-warning fa-3x mb-3"></i>
                    <h5>No Weather Alerts</h5>
                    <p class="text-muted">Current conditions are normal for your route area.</p>
                </div>
            `;
        } else {
            alertsHtml = alerts.map(alert => `
                <div class="alert alert-warning">
                    <h6><i class="fas fa-exclamation-triangle me-2"></i>${alert.event}</h6>
                    <p class="mb-1">${alert.description}</p>
                    <small class="text-muted">
                        <i class="fas fa-clock me-1"></i>
                        ${new Date(alert.start * 1000).toLocaleString()} - 
                        ${new Date(alert.end * 1000).toLocaleString()}
                    </small>
                </div>
            `).join('');
        }

        // Add current weather summary
        alertsHtml = `
            <div class="mb-3 p-3 bg-light rounded">
                <h6>Current Conditions - ${this.currentWeather.location.name}</h6>
                <div class="d-flex align-items-center">
                    <img src="https://openweathermap.org/img/wn/${this.currentWeather.current.weather.icon}@2x.png" 
                         width="50" height="50" alt="Weather icon">
                    <div class="ms-3">
                        <div class="h5 mb-0">${Math.round(this.currentWeather.current.temp)}°C</div>
                        <div class="text-muted">${this.currentWeather.current.weather.description}</div>
                    </div>
                </div>
            </div>
            ${alertsHtml}
        `;

        $('#weatherAlertsContent').html(alertsHtml);
        const weatherModal = new bootstrap.Modal(document.getElementById('weatherAlertsModal'));
        weatherModal.show();
    }

    /**
     * Show analytics modal with charts
     */
    async showAnalytics() {
        try {
            const response = await axios.get('/api/analytics');
            
            if (response.data.success) {
                this.displayAnalytics(response.data.analytics);
                const analyticsModal = new bootstrap.Modal(document.getElementById('analyticsModal'));
                analyticsModal.show();
            }

        } catch (error) {
            console.error('❌ Analytics fetch error:', error);
            this.showToast('Failed to load analytics data', 'error');
        }
    }

    /**
     * Display analytics charts
     */
    displayAnalytics(analytics) {
        // Update summary stats
        const summaryHtml = `
            <div class="row g-3">
                <div class="col-md-3">
                    <div class="card text-center">
                        <div class="card-body">
                            <i class="fas fa-route fa-2x text-primary mb-2"></i>
                            <h4 class="mb-0">${analytics.totalRequests}</h4>
                            <small class="text-muted">Total Routes</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card text-center">
                        <div class="card-body">
                            <i class="fas fa-ruler fa-2x text-success mb-2"></i>
                            <h4 class="mb-0">${(analytics.averageDistance / 1000).toFixed(1)} km</h4>
                            <small class="text-muted">Avg Distance</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card text-center">
                        <div class="card-body">
                            <i class="fas fa-map-marked-alt fa-2x text-info mb-2"></i>
                            <h4 class="mb-0">${analytics.topOrigins.length}</h4>
                            <small class="text-muted">Unique Origins</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card text-center">
                        <div class="card-body">
                            <i class="fas fa-clock fa-2x text-warning mb-2"></i>
                            <h4 class="mb-0">${new Date(analytics.lastUpdated).toLocaleTimeString()}</h4>
                            <small class="text-muted">Last Updated</small>
                        </div>
                    </div>
                </div>
            </div>
        `;

        $('#summaryStats').html(summaryHtml);

        // Create charts
        this.createRequestsChart(analytics.requestsOverTime);
        this.createDistanceChart(analytics.distanceDistribution);
    }

    /**
     * Create requests over time chart
     */
    createRequestsChart(data) {
        const ctx = document.getElementById('requestsChart').getContext('2d');
        
        if (this.charts.requests) {
            this.charts.requests.destroy();
        }

        this.charts.requests = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => d.time),
                datasets: [{
                    label: 'Route Requests',
                    data: data.map(d => d.requests),
                    borderColor: '#007bff',
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    /**
     * Create distance distribution chart
     */
    createDistanceChart(data) {
        const ctx = document.getElementById('distanceChart').getContext('2d');
        
        if (this.charts.distance) {
            this.charts.distance.destroy();
        }

        this.charts.distance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.map(d => d.label),
                datasets: [{
                    data: data.map(d => d.count),
                    backgroundColor: [
                        '#28a745',
                        '#17a2b8',
                        '#007bff',
                        '#6f42c1',
                        '#e83e8c'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    /**
     * Load demo route for testing
     */
    loadDemoRoute() {
        // Set demo coordinates (Bangalore to Mysore, Karnataka)
        const demoOrigin = { lat: 12.9716, lng: 77.5946 }; // Bangalore
        const demoDestination = { lat: 12.2958, lng: 76.6394 }; // Mysore

        $('#origin').val(`${demoOrigin.lat}, ${demoOrigin.lng}`);
        $('#destination').val(`${demoDestination.lat}, ${demoDestination.lng}`);

        this.setOriginMarker(demoOrigin.lat, demoOrigin.lng);
        this.setDestinationMarker(demoDestination.lat, demoDestination.lng);

        this.calculateRoute();
    }

    /**
     * Get user's current location
     */
    getUserLocation() {
        console.log('📍 getUserLocation() called');
        
        if (!navigator.geolocation) {
            console.error('❌ Geolocation not supported');
            this.showToast('Geolocation is not supported by this browser', 'error');
            return;
        }

        console.log('✅ Geolocation API available');

        // Check if we're on HTTPS or localhost (required for high accuracy)
        const isSecureContext = window.isSecureContext || window.location.hostname === 'localhost';
        console.log('🔒 Secure context:', isSecureContext);
        
        if (!isSecureContext) {
            console.warn('⚠️ Not in secure context');
            this.showToast('For accurate location, please use HTTPS or localhost', 'warning');
        }

        // Show loading message and update button
        console.log('🔄 Starting location request...');
        this.showToast('Getting your precise location...', 'info');
        const locateBtn = document.getElementById('locateBtn');
        const originalBtnContent = locateBtn.innerHTML;
        locateBtn.disabled = true;
        locateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span class="d-none d-md-inline ms-1">Locating...</span>';

        // Check permission status first
        this.checkLocationPermission().then(() => {
            try {
                this.performLocationRequest(locateBtn, originalBtnContent);
            } catch (error) {
                console.error('🔥 Location request error:', error);
                this.showToast(`Location error: ${error.message}`, 'error');
                locateBtn.disabled = false;
                locateBtn.innerHTML = originalBtnContent;
            }
        }).catch((error) => {
            console.error('🔥 Permission check error:', error);
            this.showToast(`Location permission: ${error.message}`, 'error');
            locateBtn.disabled = false;
            locateBtn.innerHTML = originalBtnContent;
        });
    }

    /**
     * Check location permission status
     */
    async checkLocationPermission() {
        if ('permissions' in navigator) {
            try {
                const permission = await navigator.permissions.query({ name: 'geolocation' });
                
                if (permission.state === 'denied') {
                    throw new Error('Location access is blocked. Please enable location permissions in your browser settings.');
                }
                
                if (permission.state === 'prompt') {
                    this.showToast('Please allow location access when prompted', 'info');
                }
                
                return permission.state;
            } catch (error) {
                // Permission API not supported, continue anyway
                console.warn('Permission API not supported:', error);
            }
        }
        return 'granted'; // Assume granted if can't check
    }

    /**
     * Perform the actual location request
     */
    performLocationRequest(locateBtn, originalBtnContent) {
        const options = {
            enableHighAccuracy: true,    // Use GPS if available
            timeout: 15000,             // 15 seconds timeout
            maximumAge: 0               // Force fresh location, no cache
        };

        // Use native geolocation API for better precision
        navigator.geolocation.getCurrentPosition(
            (position) => {
                this.handleLocationSuccess(position, locateBtn, originalBtnContent);
            },
            (error) => {
                this.handleLocationError(error, locateBtn, originalBtnContent, options);
            },
            options
        );
    }

    /**
     * Handle location errors with detailed messages and retry options
     */
    handleLocationError(error, locateBtn, originalBtnContent, options, retryCount = 0) {
        let errorMessage = '';
        let shouldRetry = false;
        let useIPFallback = false;
        
        switch (error.code) {
            case error.PERMISSION_DENIED:
                errorMessage = 'Location access denied. Please enable location permissions in your browser settings and refresh the page.';
                useIPFallback = true;
                break;
                
            case error.POSITION_UNAVAILABLE:
                errorMessage = 'Your location is currently unavailable. This may be due to poor GPS signal.';
                shouldRetry = retryCount < 2;
                if (!shouldRetry) useIPFallback = true;
                break;
                
            case error.TIMEOUT:
                errorMessage = 'Location request timed out. Checking your connection...';
                shouldRetry = retryCount < 3;
                if (!shouldRetry) useIPFallback = true;
                break;
                
            default:
                errorMessage = 'An unexpected error occurred while getting your location.';
                shouldRetry = retryCount < 1;
                useIPFallback = true;
                break;
        }
        
        console.error(`Location error (attempt ${retryCount + 1}):`, error);
        
        if (shouldRetry) {
            // Show retry message
            this.showToast(`${errorMessage} Retrying... (${retryCount + 1}/3)`, 'warning');
            
            // Retry with adjusted options
            const retryOptions = { ...options };
            if (retryCount > 0) {
                retryOptions.enableHighAccuracy = false; // Use network-based location
                retryOptions.timeout = Math.min(30000, retryOptions.timeout + 5000); // Increase timeout
            }
            
            setTimeout(() => {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        this.handleLocationSuccess(position, locateBtn, originalBtnContent);
                    },
                    (retryError) => {
                        this.handleLocationError(retryError, locateBtn, originalBtnContent, retryOptions, retryCount + 1);
                    },
                    retryOptions
                );
            }, 1000 * (retryCount + 1)); // Progressive delay
            
        } else {
            // Final error handling
            this.showToast(errorMessage, 'error');
            
            // Reset button state
            locateBtn.disabled = false;
            locateBtn.innerHTML = originalBtnContent;
            
            // Try IP-based location as fallback
            if (useIPFallback) {
                setTimeout(() => this.tryIPLocation(), 1500);
            }
        }
    }

    /**
     * Handle successful location retrieval
     */
    handleLocationSuccess(position, locateBtn, originalBtnContent) {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        // Center map on user location
        this.map.setView([lat, lng], 16);

        // Remove existing location marker
        if (this.userLocationMarker) {
            this.map.removeLayer(this.userLocationMarker);
        }

        // Create precise location marker
        this.userLocationMarker = L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'current-location-marker',
                html: '<i class="fas fa-location-arrow" style="color: #007bff; font-size: 18px;"></i>',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            })
        }).addTo(this.map);

        // Add accuracy circle
        if (this.accuracyCircle) {
            this.map.removeLayer(this.accuracyCircle);
        }

        this.accuracyCircle = L.circle([lat, lng], {
            radius: accuracy,
            color: '#007bff',
            fillColor: '#007bff',
            fillOpacity: 0.1,
            weight: 2
        }).addTo(this.map);

        // Create detailed popup with location info
        const popupContent = `
            <div class="location-popup">
                <h6><i class="fas fa-map-marker-alt me-2"></i>Your Location</h6>
                <p class="mb-1"><strong>Coordinates:</strong><br>
                   ${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
                <p class="mb-1"><strong>Accuracy:</strong> ±${Math.round(accuracy)}m</p>
                <button class="btn btn-sm btn-primary" onclick="dashboard.setAsOrigin(${lat}, ${lng})">
                    <i class="fas fa-play me-1"></i>Set as Origin
                </button>
            </div>
        `;

        this.userLocationMarker.bindPopup(popupContent).openPopup();

        // Reverse geocode to get address
        this.reverseGeocode(lat, lng).then(address => {
            if (address) {
                const updatedPopup = `
                    <div class="location-popup">
                        <h6><i class="fas fa-map-marker-alt me-2"></i>Your Location</h6>
                        <p class="mb-1"><strong>Address:</strong><br>${address}</p>
                        <p class="mb-1"><strong>Coordinates:</strong><br>
                           ${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
                        <p class="mb-1"><strong>Accuracy:</strong> ±${Math.round(accuracy)}m</p>
                        <button class="btn btn-sm btn-primary" onclick="dashboard.setAsOrigin(${lat}, ${lng})">
                            <i class="fas fa-play me-1"></i>Set as Origin
                        </button>
                    </div>
                `;
                this.userLocationMarker.setPopupContent(updatedPopup);
            }
        });

        // Show success message with accuracy info
        let accuracyMessage = '';
        if (accuracy <= 10) {
            accuracyMessage = `Excellent location accuracy: ±${Math.round(accuracy)}m`;
        } else if (accuracy <= 50) {
            accuracyMessage = `Good location accuracy: ±${Math.round(accuracy)}m`;
        } else {
            accuracyMessage = `Approximate location: ±${Math.round(accuracy)}m`;
        }
        
        this.showToast(accuracyMessage, 'success');
        
        // Reset button state
        locateBtn.disabled = false;
        locateBtn.innerHTML = originalBtnContent;

        // Update live location panel
        this.updateLocationPanel({
            lat: lat,
            lng: lng,
            accuracy: accuracy,
            timestamp: Date.now()
        });
    }

    /**
     * Fallback IP-based location detection
     */
    async tryIPLocation() {
        try {
            this.showToast('Trying IP-based location...', 'info');
            
            const response = await fetch('https://ipapi.co/json/');
            if (response.ok) {
                const data = await response.json();
                
                if (data.latitude && data.longitude) {
                    const lat = parseFloat(data.latitude);
                    const lng = parseFloat(data.longitude);
                    
                    // Center map on IP location
                    this.map.setView([lat, lng], 12);
                    
                    // Remove existing location marker
                    if (this.userLocationMarker) {
                        this.map.removeLayer(this.userLocationMarker);
                    }
                    
                    // Create IP-based location marker with different styling
                    this.userLocationMarker = L.marker([lat, lng], {
                        icon: L.divIcon({
                            className: 'ip-location-marker',
                            html: '<i class="fas fa-wifi" style="color: #28a745; font-size: 16px;"></i>',
                            iconSize: [20, 20],
                            iconAnchor: [10, 10]
                        })
                    }).addTo(this.map);
                    
                    const popupContent = `
                        <div class="location-popup">
                            <h6><i class="fas fa-wifi me-2"></i>Approximate Location</h6>
                            <p class="mb-1"><strong>City:</strong> ${data.city || 'Unknown'}</p>
                            <p class="mb-1"><strong>Region:</strong> ${data.region || 'Unknown'}</p>
                            <p class="mb-1"><strong>Country:</strong> ${data.country_name || 'Unknown'}</p>
                            <p class="mb-2"><small class="text-muted">Based on your IP address</small></p>
                            <button class="btn btn-sm btn-success" onclick="dashboard.setAsOrigin(${lat}, ${lng})">
                                <i class="fas fa-play me-1"></i>Set as Origin
                            </button>
                        </div>
                    `;
                    
                    this.userLocationMarker.bindPopup(popupContent).openPopup();
                    
                    this.showToast('Approximate location found via IP', 'warning');
                    return;
                }
            }
        } catch (error) {
            console.warn('IP-based location failed:', error);
        }
        
        // Ultimate fallback - default to Karnataka center
        this.showToast('Using default location (Karnataka center)', 'info');
        this.map.setView([12.9716, 77.5946], 10);
    }

    /**
     * Check geolocation permission status
     */
    async checkLocationPermission() {
        if (!navigator.permissions) return 'unknown';
        
        try {
            const permission = await navigator.permissions.query({ name: 'geolocation' });
            return permission.state; // 'granted', 'denied', or 'prompt'
        } catch (error) {
            console.warn('Could not check location permission:', error);
            return 'unknown';
        }
    }

    /**
     * Set coordinates as origin point
     */
    setAsOrigin(lat, lng) {
        this.setOriginMarker(lat, lng);
        $('#origin').val(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        this.showToast('Origin set to your current location', 'success');
        
        // Close the popup
        if (this.userLocationMarker) {
            this.userLocationMarker.closePopup();
        }
    }

    /**
     * Reverse geocode coordinates to get address
     */
    async reverseGeocode(lat, lng) {
        try {
            // Use a free reverse geocoding service
            const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
            
            if (response.ok) {
                const data = await response.json();
                
                // Build a readable address
                let address = '';
                if (data.locality) address += data.locality;
                if (data.city && data.city !== data.locality) {
                    address += (address ? ', ' : '') + data.city;
                }
                if (data.principalSubdivision) {
                    address += (address ? ', ' : '') + data.principalSubdivision;
                }
                if (data.countryName) {
                    address += (address ? ', ' : '') + data.countryName;
                }
                
                return address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            }
        } catch (error) {
            console.warn('Reverse geocoding failed:', error);
        }
        
        // Fallback to coordinates
        return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }

    /**
     * Handle successful location detection (legacy for Leaflet map.locate)
     */
    onLocationFound(e) {
        // This is now handled by the improved getUserLocation method
        console.log('Location found via Leaflet:', e.latlng);
    }

    /**
     * Handle location detection error
     */
    onLocationError(e) {
        this.showToast('Could not find your location: ' + e.message, 'error');
    }

    /**
     * Clear all markers and routes from map
     */
    clearMap() {
        // Remove markers
        Object.values(this.markers).forEach(marker => {
            if (marker) this.map.removeLayer(marker);
        });
        this.markers = { origin: null, destination: null };

        // Remove route layer
        if (this.routeLayer) {
            this.map.removeLayer(this.routeLayer);
            this.routeLayer = null;
        }

        // Clear form inputs
        $('#origin, #destination').val('');

        // Hide summary cards
        $('#routeSummaryCard, #weatherCard').addClass('d-none');

        // Clear current data
        this.currentRoute = null;
        this.currentWeather = null;

        this.showToast('Map cleared!', 'success');
    }

    /**
     * Show/hide route planning panel
     */
    showRoutePanel() {
        $('#routePlanningCard').removeClass('d-none');
        if (window.innerWidth < 992) {
            $('#sidebarPanel').removeClass('d-none');
        }
    }

    /**
     * Toggle sidebar visibility on mobile
     */
    toggleSidebar() {
        $('#sidebarPanel').toggleClass('d-none');
    }

    /**
     * Handle window resize
     */
    handleResize() {
        if (this.map) {
            setTimeout(() => {
                this.map.invalidateSize();
            }, 200);
        }
    }

    /**
     * Show loading overlay
     */
    showLoading(show) {
        if (show) {
            $('#loadingOverlay').removeClass('d-none');
            $('#calculateRouteBtn').prop('disabled', true).html('<i class="spinner-border spinner-border-sm me-1"></i>Calculating...');
        } else {
            $('#loadingOverlay').addClass('d-none');
            $('#calculateRouteBtn').prop('disabled', false).html('<i class="fas fa-compass me-1"></i>Calculate Route');
        }
    }

    /**
     * Start turn-by-turn navigation
     */
    async startNavigation() {
        const destination = $('#destination').val().trim();
        
        if (!destination) {
            this.showToast('Please enter a destination', 'error');
            return;
        }

        this.showToast('Starting navigation...', 'info');

        try {
            // Get current location first
            await this.getCurrentLocationForNavigation();
            
            if (!this.currentPosition) {
                throw new Error('Could not get current location');
            }

            // Calculate route to destination
            const route = await this.calculateNavigationRoute(this.currentPosition, destination);
            
            if (!route) {
                throw new Error('Could not calculate route');
            }

            // Start navigation
            this.navigationRoute = route;
            this.isNavigating = true;
            this.currentInstructionIndex = 0;

            // Show navigation panel
            $('#navigationPanel').removeClass('d-none');
            
            // Start live location tracking
            this.startLocationTracking();
            
            // Update navigation display
            this.updateNavigationDisplay();
            
            this.showToast('Navigation started!', 'success');

        } catch (error) {
            console.error('Navigation start error:', error);
            this.showToast(`Navigation failed: ${error.message}`, 'error');
        }
    }

    /**
     * Stop navigation
     */
    stopNavigation() {
        this.isNavigating = false;
        this.navigationRoute = null;
        this.currentInstructionIndex = 0;
        
        // Stop location tracking
        if (this.locationWatchId) {
            navigator.geolocation.clearWatch(this.locationWatchId);
            this.locationWatchId = null;
        }

        // Hide navigation panel
        $('#navigationPanel').addClass('d-none');
        
        // Clear navigation route from map
        if (this.routeLayer) {
            this.map.removeLayer(this.routeLayer);
            this.routeLayer = null;
        }

        this.showToast('Navigation stopped', 'info');
    }

    /**
     * Get current location for navigation with improved accuracy
     */
    async getCurrentLocationForNavigation(retryCount = 0) {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }

            const options = {
                enableHighAccuracy: true,
                timeout: retryCount > 1 ? 15000 : 8000, // Longer timeout for retries
                maximumAge: retryCount > 0 ? 60000 : 30000 // Allow older cache for retries
            };

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.currentPosition = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        speed: position.coords.speed || 0,
                        heading: position.coords.heading,
                        timestamp: Date.now()
                    };

                    // If accuracy is poor and we haven't retried much, try again
                    if (position.coords.accuracy > 100 && retryCount < 2) {
                        console.log(`Poor accuracy (${position.coords.accuracy}m), retrying...`);
                        setTimeout(() => {
                            this.getCurrentLocationForNavigation(retryCount + 1)
                                .then(resolve)
                                .catch(reject);
                        }, 1000);
                        return;
                    }

                    resolve(this.currentPosition);
                },
                (error) => {
                    if (retryCount < 2) {
                        console.log(`Location error (attempt ${retryCount + 1}), retrying...`);
                        setTimeout(() => {
                            this.getCurrentLocationForNavigation(retryCount + 1)
                                .then(resolve)
                                .catch(reject);
                        }, 2000);
                    } else {
                        reject(new Error(`Location error after ${retryCount + 1} attempts: ${error.message}`));
                    }
                },
                options
            );
        });
    }

    /**
     * Calculate navigation route using real road routing
     */
    async calculateNavigationRoute(origin, destination) {
        try {
            console.log('🚗 Calculating real road route from', origin, 'to', destination);
            
            // Use OSRM (Open Source Routing Machine) for real road-based routing
            const osrmApiUrl = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
            
            try {
                const response = await fetch(`${osrmApiUrl}?overview=full&geometries=geojson&steps=true&alternatives=false`);
                
                if (!response.ok) {
                    throw new Error(`OSRM API error: ${response.status}`);
                }
                
                const data = await response.json();
                
                if (!data.routes || data.routes.length === 0) {
                    throw new Error('No route found');
                }
                
                const route = data.routes[0];
                
                // Convert OSRM response to our format
                const realRoute = {
                    distance: Math.round(route.distance), // meters
                    duration: Math.round(route.duration), // seconds
                    instructions: this.convertOSRMInstructions(route.legs[0].steps),
                    geometry: {
                        coordinates: route.geometry.coordinates // [lng, lat] format
                    },
                    source: 'OSRM Road Network'
                };
                
                console.log('✅ Real route calculated:', realRoute);
                
                // Display route on map
                this.displayNavigationRoute(realRoute);
                
                return realRoute;
                
            } catch (apiError) {
                console.warn('🔄 OSRM API failed, generating road approximation:', apiError);
                return await this.generateRoadApproximation(origin, destination);
            }
            
        } catch (error) {
            console.error('❌ Route calculation error:', error);
            return await this.generateRoadApproximation(origin, destination);
        }
    }

    /**
     * Convert OSRM step instructions to our format
     */
    convertOSRMInstructions(steps) {
        const instructions = [];
        
        steps.forEach((step, index) => {
            let instruction = {
                type: this.getInstructionType(step.maneuver.type),
                text: this.generateInstructionText(step),
                distance: Math.round(step.distance),
                icon: this.getInstructionIcon(step.maneuver.type, step.maneuver.modifier)
            };
            
            instructions.push(instruction);
        });
        
        // Add arrival instruction
        instructions.push({
            type: 'arrive',
            text: 'You have arrived at your destination',
            distance: 0,
            icon: 'fa-flag-checkered'
        });
        
        return instructions;
    }

    /**
     * Generate human-readable instruction text
     */
    generateInstructionText(step) {
        const maneuver = step.maneuver;
        const roadName = step.name || 'the road';
        const distance = Math.round(step.distance);
        
        if (maneuver.type === 'depart') {
            return `Head ${this.getDirectionFromBearing(maneuver.bearing_after)} on ${roadName}`;
        }
        
        if (maneuver.type === 'arrive') {
            return 'You have arrived at your destination';
        }
        
        if (maneuver.type === 'turn') {
            const direction = maneuver.modifier || '';
            return `Turn ${direction} onto ${roadName}`;
        }
        
        if (maneuver.type === 'continue' || maneuver.type === 'new name') {
            return `Continue on ${roadName} for ${this.formatDistance(distance)}`;
        }
        
        if (maneuver.type === 'roundabout') {
            return `Enter the roundabout and take exit onto ${roadName}`;
        }
        
        // Default instruction
        return `Continue ${maneuver.modifier || ''} on ${roadName}`;
    }

    /**
     * Get instruction type from OSRM maneuver
     */
    getInstructionType(maneuverType) {
        const typeMap = {
            'depart': 'straight',
            'turn': 'turn',
            'new name': 'straight',
            'continue': 'straight',
            'merge': 'merge',
            'on ramp': 'ramp',
            'off ramp': 'ramp',
            'fork': 'fork',
            'end of road': 'turn',
            'roundabout': 'roundabout',
            'arrive': 'arrive'
        };
        
        return typeMap[maneuverType] || 'straight';
    }

    /**
     * Get FontAwesome icon for instruction
     */
    getInstructionIcon(maneuverType, modifier) {
        if (maneuverType === 'arrive') return 'fa-flag-checkered';
        if (maneuverType === 'depart') return 'fa-play';
        if (maneuverType === 'roundabout') return 'fa-circle-notch';
        
        if (modifier) {
            if (modifier.includes('left')) return 'fa-arrow-left';
            if (modifier.includes('right')) return 'fa-arrow-right';
            if (modifier.includes('straight')) return 'fa-arrow-up';
            if (modifier.includes('uturn')) return 'fa-undo';
        }
        
        // Default based on type
        const iconMap = {
            'turn': 'fa-share',
            'merge': 'fa-code-branch',
            'fork': 'fa-code-branch',
            'ramp': 'fa-long-arrow-alt-right',
            'continue': 'fa-arrow-up'
        };
        
        return iconMap[maneuverType] || 'fa-arrow-up';
    }

    /**
     * Get direction from bearing
     */
    getDirectionFromBearing(bearing) {
        if (bearing === undefined) return '';
        
        const directions = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
        const index = Math.round(bearing / 45) % 8;
        return directions[index];
    }

    /**
     * Generate road approximation when APIs fail
     */
    async generateRoadApproximation(origin, destination) {
        console.log('📍 Generating road approximation...');
        
        const distance = this.calculateDistance(origin.lat, origin.lng, destination.lat, destination.lng);
        const bearing = this.calculateBearing(origin.lat, origin.lng, destination.lat, destination.lng);
        
        // Generate waypoints that approximate road network
        const waypoints = this.generateRoadWaypoints(origin, destination, 6);
        
        const approximateRoute = {
            distance: Math.round(distance * 1000 * 1.3), // Add 30% for road curves
            duration: Math.round((distance * 1000 * 1.3) / 13.89), // Assume 50 km/h average speed
            instructions: [
                {
                    type: 'straight',
                    text: `Head ${this.getBearingDirection(bearing)} toward destination`,
                    distance: Math.round(distance * 800),
                    icon: 'fa-arrow-up'
                },
                {
                    type: 'turn',
                    text: 'Continue following the road toward destination',
                    distance: Math.round(distance * 300),
                    icon: 'fa-share'
                },
                {
                    type: 'straight',
                    text: 'Continue straight to destination',
                    distance: Math.round(distance * 200),
                    icon: 'fa-arrow-up'
                },
                {
                    type: 'arrive',
                    text: 'You have arrived at your destination',
                    distance: 0,
                    icon: 'fa-flag-checkered'
                }
            ],
            geometry: {
                coordinates: waypoints.map(wp => [wp.lng, wp.lat])
            },
            source: 'Road Approximation'
        };
        
        console.log('✅ Road approximation generated:', approximateRoute);
        this.displayNavigationRoute(approximateRoute);
        
        return approximateRoute;
    }

    /**
     * Generate waypoints that approximate roads
     */
    generateRoadWaypoints(origin, destination, numWaypoints) {
        const waypoints = [origin];
        
        for (let i = 1; i < numWaypoints; i++) {
            const ratio = i / numWaypoints;
            let lat = origin.lat + (destination.lat - origin.lat) * ratio;
            let lng = origin.lng + (destination.lng - origin.lng) * ratio;
            
            // Add some realistic road-like curves
            const curveOffset = 0.0005 * Math.sin(ratio * Math.PI * 3);
            const randomOffset = (Math.random() - 0.5) * 0.0002;
            
            lat += curveOffset + randomOffset;
            lng += curveOffset * 0.7 + randomOffset;
            
            waypoints.push({ lat, lng });
        }
        
        waypoints.push(destination);
        return waypoints;
    }

    /**
     * Get bearing direction as text
     */
    getBearingDirection(bearing) {
        const directions = [
            'north', 'north-northeast', 'northeast', 'east-northeast',
            'east', 'east-southeast', 'southeast', 'south-southeast',
            'south', 'south-southwest', 'southwest', 'west-southwest',
            'west', 'west-northwest', 'northwest', 'north-northwest'
        ];
        
        const index = Math.round(bearing / 22.5) % 16;
        return directions[index];
    }

    /**
     * Display navigation route on map
     */
    displayNavigationRoute(route) {
        // Remove existing route
        if (this.routeLayer) {
            this.map.removeLayer(this.routeLayer);
        }

        // Create route line
        const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
        
        this.routeLayer = L.polyline(coordinates, {
            color: '#2196F3',
            weight: 6,
            opacity: 0.8,
            dashArray: '10, 5'
        }).addTo(this.map);

        // Fit map to route
        this.map.fitBounds(this.routeLayer.getBounds(), { padding: [20, 20] });

        // Add destination marker
        const destCoord = coordinates[coordinates.length - 1];
        L.marker(destCoord, {
            icon: L.divIcon({
                className: 'destination-marker',
                html: '<i class="fas fa-flag-checkered" style="color: #f44336; font-size: 20px;"></i>',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            })
        }).addTo(this.map).bindPopup('Destination');
    }

    /**
     * Start live location tracking during navigation with enhanced precision
     */
    startLocationTracking() {
        if (!navigator.geolocation) {
            this.showToast('Location tracking not available', 'error');
            return;
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 5000,        // 5 seconds timeout
            maximumAge: 0         // Always force fresh GPS reading
        };

        this.locationWatchId = navigator.geolocation.watchPosition(
            (position) => {
                // Only update if accuracy is reasonable or we don't have a position yet
                if (!this.currentPosition || position.coords.accuracy <= 100) {
                    this.updateCurrentPosition(position);
                } else {
                    console.log(`Skipping low accuracy position: ${position.coords.accuracy}m`);
                }
            },
            (error) => {
                console.warn('Location tracking error:', error);
                
                // Show user-friendly error message
                let message = 'Location tracking issue';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        message = 'Location permission denied';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        message = 'GPS signal weak';
                        break;
                    case error.TIMEOUT:
                        message = 'Location timeout';
                        break;
                }
                
                // Don't spam with toast messages during navigation
                if (!this.lastLocationError || Date.now() - this.lastLocationError > 10000) {
                    this.showToast(message, 'warning');
                    this.lastLocationError = Date.now();
                }
            },
            options
        );

        // Also update location panel immediately
        this.updateLiveLocation();
    }

    /**
     * Update current position during navigation with enhanced real-time tracking
     */
    updateCurrentPosition(position) {
        const newPosition = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            speed: position.coords.speed || 0,
            heading: position.coords.heading,
            timestamp: Date.now()
        };

        // Check if position actually changed (avoid duplicate updates)
        if (this.currentPosition) {
            const distance = this.calculateDistance(
                this.currentPosition.lat, this.currentPosition.lng,
                newPosition.lat, newPosition.lng
            );
            
            // If moved less than 2 meters, skip update (except for first reading or if accuracy improved)
            if (distance < 0.002 && newPosition.accuracy >= this.currentPosition.accuracy) {
                console.log('📍 Position unchanged, skipping update');
                return;
            }
        }

        console.log(`📍 Position updated: ${newPosition.lat.toFixed(6)}, ${newPosition.lng.toFixed(6)} (±${Math.round(newPosition.accuracy)}m)`);
        
        this.currentPosition = newPosition;

        // Update user location marker with better styling
        if (this.userLocationMarker) {
            this.map.removeLayer(this.userLocationMarker);
        }

        // Create animated marker for navigation
        const markerIcon = this.isNavigating ? 
            L.divIcon({
                className: 'navigation-location-marker pulsing',
                html: `<div class="location-dot">
                        <i class="fas fa-location-arrow" style="color: #2196F3; font-size: 14px; transform: rotate(${newPosition.heading || 0}deg);"></i>
                      </div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            }) :
            L.divIcon({
                className: 'current-location-marker pulsing',
                html: '<div class="location-dot"><i class="fas fa-circle" style="color: #2196F3; font-size: 8px;"></i></div>',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });

        this.userLocationMarker = L.marker([newPosition.lat, newPosition.lng], {
            icon: markerIcon
        }).addTo(this.map);

        // Update accuracy circle
        if (this.accuracyCircle) {
            this.map.removeLayer(this.accuracyCircle);
        }

        if (newPosition.accuracy < 100) { // Only show circle if accuracy is reasonable
            this.accuracyCircle = L.circle([newPosition.lat, newPosition.lng], {
                radius: newPosition.accuracy,
                color: '#2196F3',
                fillColor: '#2196F3',
                fillOpacity: 0.1,
                weight: 1
            }).addTo(this.map);
        }

        // Center map on user location during navigation
        if (this.isNavigating) {
            this.map.setView([newPosition.lat, newPosition.lng], Math.max(this.map.getZoom(), 16));
            this.updateNavigationDisplay();
        }

        // Update live location panel
        this.updateLocationPanel(newPosition);

        // Log GPS quality
        const quality = newPosition.accuracy <= 10 ? 'Excellent' : 
                       newPosition.accuracy <= 30 ? 'Good' : 
                       newPosition.accuracy <= 100 ? 'Fair' : 'Poor';
        
        console.log(`📡 GPS Quality: ${quality} (${Math.round(newPosition.accuracy)}m accuracy)`);
    }

    /**
     * Update navigation display with current instruction
     */
    updateNavigationDisplay() {
        if (!this.navigationRoute || !this.isNavigating) return;

        const instructions = this.navigationRoute.instructions;
        const currentInstruction = instructions[this.currentInstructionIndex];
        
        if (!currentInstruction) return;

        // Update current instruction
        $('#currentInstruction').text(currentInstruction.text);
        $('#instructionDistance').text(this.formatDistance(currentInstruction.distance));
        
        // Update instruction icon
        $('.instruction-icon i').removeClass().addClass(`fas ${currentInstruction.icon} text-primary`);

        // Update navigation stats
        const remainingDistance = this.calculateRemainingDistance();
        const eta = this.calculateETA(remainingDistance);
        
        $('#remainingDistance').text(this.formatDistance(remainingDistance));
        $('#eta').text(eta);
        $('#currentSpeed').text(this.currentPosition?.speed ? 
            `${Math.round(this.currentPosition.speed * 3.6)} km/h` : '--');

        // Update progress
        const progress = ((this.navigationRoute.distance - remainingDistance) / this.navigationRoute.distance) * 100;
        $('#routeProgress').css('width', `${Math.max(0, Math.min(100, progress))}%`);

        // Update next instructions
        this.updateNextInstructions();
    }

    /**
     * Update next instructions list
     */
    updateNextInstructions() {
        const instructions = this.navigationRoute.instructions;
        const nextInstructions = instructions.slice(this.currentInstructionIndex + 1, this.currentInstructionIndex + 3);
        
        const html = nextInstructions.map(instruction => `
            <div class="next-instruction mb-2">
                <i class="fas ${instruction.icon} text-muted me-2"></i>
                <small>${instruction.text} ${instruction.distance > 0 ? 'in ' + this.formatDistance(instruction.distance) : ''}</small>
            </div>
        `).join('');
        
        $('#nextInstructionsList').html(html || '<small class="text-muted">No more instructions</small>');
    }

    /**
     * Update live location panel with enhanced error handling
     */
    updateLiveLocation() {
        if (!navigator.geolocation) {
            $('#currentCoordinates').text('Geolocation not available');
            $('#currentAddress').text('Unable to get location');
            $('#locationAccuracy').text('N/A').removeClass('bg-success bg-warning').addClass('bg-secondary');
            return;
        }

        // Show loading state
        $('#locationAccuracy').text('Getting...').removeClass('bg-success bg-warning bg-danger bg-secondary').addClass('bg-info');

        const options = {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 0              // Always get fresh location
        };

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const locationData = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: Date.now()
                };

                // Update the location panel with new data
                this.updateLocationPanel(locationData);
                
                // Store current position
                this.currentPosition = locationData;
            },
            (error) => {
                let errorMessage = '';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Location access denied';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Location unavailable';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'Location timeout';
                        break;
                    default:
                        errorMessage = 'Location error';
                        break;
                }
                
                $('#currentCoordinates').text('Location unavailable');
                $('#currentAddress').text(errorMessage);
                $('#locationAccuracy').text('Error').removeClass('bg-success bg-warning bg-info bg-secondary').addClass('bg-danger');
                
                console.warn('Live location update error:', error);
            },
            options
        );
    }

    /**
     * Update location panel with current position
     */
    updateLocationPanel(position = null) {
        const locationData = position || this.currentPosition;
        
        if (!locationData) {
            $('#currentCoordinates').text('Location not available');
            $('#currentAddress').text('Enable location services');
            $('#locationAccuracy').text('N/A').removeClass('bg-success bg-warning').addClass('bg-secondary');
            return;
        }

        const { lat, lng, accuracy } = locationData;
        
        $('#currentCoordinates').text(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        
        const accuracyBadge = $('#locationAccuracy');
        accuracyBadge.text(`±${Math.round(accuracy)}m`);
        
        if (accuracy <= 10) {
            accuracyBadge.removeClass('bg-warning bg-danger bg-secondary').addClass('bg-success');
        } else if (accuracy <= 50) {
            accuracyBadge.removeClass('bg-success bg-danger bg-secondary').addClass('bg-warning');
        } else {
            accuracyBadge.removeClass('bg-success bg-warning bg-secondary').addClass('bg-danger');
        }

        // Update address if we have coordinates
        this.reverseGeocode(lat, lng).then(address => {
            if (address) {
                $('#currentAddress').text(address);
            } else {
                $('#currentAddress').text(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
            }
        }).catch(() => {
            $('#currentAddress').text(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        });
    }

    /**
     * Run location diagnostics to help troubleshoot location issues
     */
    async runLocationDiagnostics() {
        const diagnostics = {
            timestamp: new Date().toISOString(),
            geolocationSupported: !!navigator.geolocation,
            isSecureContext: window.isSecureContext,
            isLocalhost: window.location.hostname === 'localhost',
            userAgent: navigator.userAgent,
            permissions: null,
            position: null,
            errors: []
        };

        // Check permissions
        if ('permissions' in navigator) {
            try {
                const permission = await navigator.permissions.query({ name: 'geolocation' });
                diagnostics.permissions = {
                    state: permission.state,
                    onchange: typeof permission.onchange
                };
            } catch (error) {
                diagnostics.errors.push(`Permission check failed: ${error.message}`);
            }
        }

        // Try to get position
        if (navigator.geolocation) {
            try {
                const position = await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error('Timeout')), 10000);
                    navigator.geolocation.getCurrentPosition(
                        (pos) => {
                            clearTimeout(timeout);
                            resolve(pos);
                        },
                        (err) => {
                            clearTimeout(timeout);
                            reject(err);
                        },
                        { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
                    );
                });

                diagnostics.position = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    altitude: position.coords.altitude,
                    speed: position.coords.speed,
                    heading: position.coords.heading,
                    timestamp: position.timestamp
                };
            } catch (error) {
                diagnostics.errors.push(`Position request failed: ${error.message} (code: ${error.code || 'unknown'})`);
            }
        }

        console.group('🗺️ Location Diagnostics');
        console.log('Full Report:', diagnostics);
        
        // Show user-friendly summary
        let summary = '📍 Location Diagnostics Summary:\n\n';
        
        if (!diagnostics.geolocationSupported) {
            summary += '❌ Geolocation not supported by your browser\n';
        } else {
            summary += '✅ Geolocation API supported\n';
        }
        
        if (!diagnostics.isSecureContext && !diagnostics.isLocalhost) {
            summary += '⚠️  Insecure context - Use HTTPS for better accuracy\n';
        } else {
            summary += '✅ Secure context (HTTPS or localhost)\n';
        }
        
        if (diagnostics.permissions) {
            summary += `📋 Permission state: ${diagnostics.permissions.state}\n`;
        }
        
        if (diagnostics.position) {
            summary += `📍 Current position: ${diagnostics.position.latitude.toFixed(6)}, ${diagnostics.position.longitude.toFixed(6)}\n`;
            summary += `🎯 Accuracy: ±${Math.round(diagnostics.position.accuracy)}m\n`;
        }
        
        if (diagnostics.errors.length > 0) {
            summary += '\n❌ Issues found:\n';
            diagnostics.errors.forEach(error => {
                summary += `   • ${error}\n`;
            });
        }
        
        console.log(summary);
        console.groupEnd();
        
        // Show toast with key info
        if (diagnostics.position) {
            this.showToast(`Location working! Accuracy: ±${Math.round(diagnostics.position.accuracy)}m`, 'success');
        } else if (diagnostics.errors.length > 0) {
            this.showToast(`Location issues detected. Check browser console for details.`, 'error');
        }
        
        return diagnostics;
    }

    /**
     * Calculate remaining distance to destination
     */
    calculateRemainingDistance() {
        // Mock calculation based on current instruction index
        if (!this.navigationRoute) return 0;
        
        const remainingInstructions = this.navigationRoute.instructions.slice(this.currentInstructionIndex);
        return remainingInstructions.reduce((total, instruction) => total + instruction.distance, 0);
    }

    /**
     * Calculate ETA
     */
    calculateETA(distance) {
        const avgSpeed = 30; // km/h average speed
        const timeMinutes = (distance / 1000) * (60 / avgSpeed);
        return `${Math.round(timeMinutes)} min`;
    }

    /**
     * Format distance for display
     */
    formatDistance(meters) {
        if (meters < 1000) {
            return `${Math.round(meters)} m`;
        } else {
            return `${(meters / 1000).toFixed(1)} km`;
        }
    }

    /**
     * Use network-based location (lower accuracy but faster)
     */
    useNetworkLocation() {
        if (!navigator.geolocation) {
            this.showToast('Network location not supported', 'error');
            return;
        }

        this.showToast('Getting network location...', 'info');

        const options = {
            enableHighAccuracy: false, // Use network instead of GPS
            timeout: 8000,
            maximumAge: 60000
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const accuracy = Math.round(position.coords.accuracy);

                this.setLocationFromAlternative(lat, lng, `Network Location (±${accuracy}m)`, accuracy);
                this.showToast(`Network location found with ${accuracy}m accuracy`, 'success');
            },
            (error) => {
                console.warn('Network location failed:', error);
                this.showToast('Network location failed, trying IP location...', 'warning');
                this.useIPLocation();
            },
            options
        );
    }

    /**
     * Use IP-based geolocation
     */
    async useIPLocation() {
        try {
            this.showToast('Getting IP-based location...', 'info');
            
            const response = await fetch('https://ipapi.co/json/');
            const data = await response.json();
            
            if (data.latitude && data.longitude) {
                const lat = parseFloat(data.latitude);
                const lng = parseFloat(data.longitude);
                const cityInfo = data.city ? ` (${data.city})` : '';
                
                this.setLocationFromAlternative(lat, lng, `IP Location${cityInfo}`, 5000); // ~5km accuracy
                this.showToast(`IP location found: ${data.city || 'Unknown City'}`, 'success');
            } else {
                throw new Error('No location data in response');
            }
        } catch (error) {
            console.error('IP location failed:', error);
            this.showToast('IP location failed. Try test location or manual selection.', 'error');
        }
    }

    /**
     * Use a test location for demonstration
     */
    useTestLocation() {
        const testLocations = [
            { name: 'Bangalore, India', lat: 12.9716, lng: 77.5946 },
            { name: 'Mumbai, India', lat: 19.0760, lng: 72.8777 },
            { name: 'Delhi, India', lat: 28.6139, lng: 77.2090 },
            { name: 'New York, USA', lat: 40.7128, lng: -74.0060 }
        ];

        // Pick a random test location
        const location = testLocations[Math.floor(Math.random() * testLocations.length)];
        
        this.setLocationFromAlternative(location.lat, location.lng, `Test: ${location.name}`, 0);
        this.showToast(`Using test location: ${location.name}`, 'info');
    }

    /**
     * Set location from alternative source
     */
    setLocationFromAlternative(lat, lng, source, accuracy) {
        // Center map on location
        this.map.setView([lat, lng], 14);

        // Remove existing location marker
        if (this.userLocationMarker) {
            this.map.removeLayer(this.userLocationMarker);
        }

        // Create alternative location marker
        this.userLocationMarker = L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'alternative-location-marker',
                html: '<i class="fas fa-map-marker-alt" style="color: #28a745; font-size: 18px;"></i>',
                iconSize: [24, 24],
                iconAnchor: [12, 24]
            })
        }).addTo(this.map);

        // Add accuracy circle if needed
        if (this.accuracyCircle) {
            this.map.removeLayer(this.accuracyCircle);
        }

        if (accuracy > 0 && accuracy < 10000) {
            this.accuracyCircle = L.circle([lat, lng], {
                radius: accuracy,
                color: '#28a745',
                fillColor: '#28a745',
                fillOpacity: 0.1,
                weight: 2
            }).addTo(this.map);
        }

        // Create popup with location info
        const popupContent = `
            <div class="location-popup">
                <h6><i class="fas fa-map-marked-alt me-2"></i>Alternative Location</h6>
                <p class="mb-1"><strong>Source:</strong><br>${source}</p>
                <p class="mb-1"><strong>Coordinates:</strong><br>
                   ${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
                ${accuracy > 0 ? `<p class="mb-1"><strong>Accuracy:</strong> ±${Math.round(accuracy)}m</p>` : ''}
                <button class="btn btn-sm btn-primary" onclick="dashboard.setAsOrigin(${lat}, ${lng})">
                    <i class="fas fa-play me-1"></i>Set as Origin
                </button>
            </div>
        `;

        this.userLocationMarker.bindPopup(popupContent).openPopup();

        // Update current position
        this.currentPosition = {
            lat: lat,
            lng: lng,
            accuracy: accuracy || 0,
            timestamp: Date.now(),
            source: source
        };

        // Update live location panel
        this.updateLocationPanel(this.currentPosition);

        // Reverse geocode to get address
        this.reverseGeocode(lat, lng).then(address => {
            if (address) {
                const updatedPopup = `
                    <div class="location-popup">
                        <h6><i class="fas fa-map-marked-alt me-2"></i>Alternative Location</h6>
                        <p class="mb-1"><strong>Address:</strong><br>${address}</p>
                        <p class="mb-1"><strong>Source:</strong><br>${source}</p>
                        <p class="mb-1"><strong>Coordinates:</strong><br>
                           ${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
                        ${accuracy > 0 ? `<p class="mb-1"><strong>Accuracy:</strong> ±${Math.round(accuracy)}m</p>` : ''}
                        <button class="btn btn-sm btn-primary" onclick="dashboard.setAsOrigin(${lat}, ${lng})">
                            <i class="fas fa-play me-1"></i>Set as Origin
                        </button>
                    </div>
                `;
                this.userLocationMarker.setPopupContent(updatedPopup);
            }
        });
    }

    /**
     * Calculate distance between two coordinates (Haversine formula)
     * Returns distance in kilometers
     */
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // Earth's radius in kilometers
        const dLat = this.toRadians(lat2 - lat1);
        const dLng = this.toRadians(lng2 - lng1);
        
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Calculate bearing between two coordinates
     * Returns bearing in degrees
     */
    calculateBearing(lat1, lng1, lat2, lng2) {
        const dLng = this.toRadians(lng2 - lng1);
        const lat1Rad = this.toRadians(lat1);
        const lat2Rad = this.toRadians(lat2);
        
        const y = Math.sin(dLng) * Math.cos(lat2Rad);
        const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
                  Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
        
        let bearing = Math.atan2(y, x);
        bearing = this.toDegrees(bearing);
        return (bearing + 360) % 360; // Normalize to 0-360
    }

    /**
     * Convert degrees to radians
     */
    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    /**
     * Convert radians to degrees
     */
    toDegrees(radians) {
        return radians * (180 / Math.PI);
    }

    /**
     * Upload pothole report with geo-tagged photo
     */
    async uploadPothole() {
        try {
            const form = document.getElementById('potholeForm');
            const formData = new FormData();
            
            // Get form elements
            const photoInput = document.getElementById('potholePhoto');
            const severitySelect = document.getElementById('potholeSeverity');
            const descriptionTextarea = document.getElementById('potholeDescription');
            
            // Validation
            if (!photoInput.files[0]) {
                this.showToast('Please select a photo', 'error');
                return;
            }
            
            if (!severitySelect.value) {
                this.showToast('Please select severity level', 'error');
                return;
            }
            
            // Show progress
            this.showUploadProgress(true);
            
            // Prepare form data
            formData.append('potholePhoto', photoInput.files[0]);
            formData.append('severity', severitySelect.value);
            formData.append('description', descriptionTextarea.value || '');
            
            // Upload to server
            const response = await fetch('/api/potholes/upload', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.showToast('Pothole reported successfully!', 'success');
                this.addRecentUpload(result.pothole);
                form.reset();
            } else {
                throw new Error(result.error || 'Upload failed');
            }
            
        } catch (error) {
            console.error('Error uploading pothole:', error);
            this.showToast(error.message || 'Failed to upload pothole report', 'error');
        } finally {
            this.showUploadProgress(false);
        }
    }
    
    /**
     * Show/hide upload progress indicator
     */
    showUploadProgress(show) {
        const progressDiv = document.getElementById('uploadProgress');
        const submitBtn = document.getElementById('uploadPotholeBtn');
        
        if (show) {
            progressDiv.classList.remove('d-none');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Uploading...';
            
            // Animate progress bar
            let progress = 0;
            const interval = setInterval(() => {
                progress += Math.random() * 15;
                if (progress >= 90) {
                    progress = 90;
                    clearInterval(interval);
                }
                progressDiv.querySelector('.progress-bar').style.width = progress + '%';
            }, 200);
            
            progressDiv.dataset.interval = interval;
        } else {
            progressDiv.classList.add('d-none');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-upload me-2"></i>Upload Pothole Report';
            
            // Clear progress animation
            if (progressDiv.dataset.interval) {
                clearInterval(progressDiv.dataset.interval);
                delete progressDiv.dataset.interval;
            }
            progressDiv.querySelector('.progress-bar').style.width = '0%';
        }
    }
    
    /**
     * Add recent upload to the list
     */
    addRecentUpload(pothole) {
        const recentUploads = document.getElementById('recentUploads');
        const uploadsList = document.getElementById('recentUploadsList');
        
        // Show recent uploads section
        recentUploads.classList.remove('d-none');
        
        // Create upload item
        const uploadItem = document.createElement('div');
        uploadItem.className = 'alert alert-success alert-sm mb-2';
        uploadItem.innerHTML = `
            <div class="d-flex justify-content-between align-items-start">
                <div>
                    <strong>${this.getSeverityIcon(pothole.severity)} ${pothole.severity.toUpperCase()}</strong>
                    <br>
                    <small class="text-muted">
                        <i class="fas fa-map-marker-alt me-1"></i>
                        ${pothole.location?.address || `${pothole.location?.coordinates[1]?.toFixed(4)}, ${pothole.location?.coordinates[0]?.toFixed(4)}`}
                    </small>
                    <br>
                    <small class="text-muted">
                        <i class="fas fa-clock me-1"></i>
                        ${new Date(pothole.createdAt).toLocaleString()}
                    </small>
                </div>
                <button class="btn btn-sm btn-outline-primary" onclick="dashboard.viewPotholeOnMap('${pothole.id}', ${pothole.location?.coordinates[1]}, ${pothole.location?.coordinates[0]})">
                    <i class="fas fa-eye"></i>
                </button>
            </div>
        `;
        
        // Add to top of list
        uploadsList.insertBefore(uploadItem, uploadsList.firstChild);
        
        // Keep only last 3 uploads visible
        const items = uploadsList.children;
        if (items.length > 3) {
            uploadsList.removeChild(items[items.length - 1]);
        }
    }
    
    /**
     * Get severity icon
     */
    getSeverityIcon(severity) {
        const icons = {
            minor: '🟢',
            moderate: '🟡',
            major: '🟠',
            severe: '🔴'
        };
        return icons[severity] || '⚠️';
    }
    
    /**
     * View pothole on map
     */
    viewPotholeOnMap(potholeId, lat, lng) {
        // Center map on pothole location
        this.map.setView([lat, lng], 16);
        
        // Add temporary marker for pothole
        const potholeMarker = L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'pothole-marker',
                html: '<i class="fas fa-exclamation-triangle" style="color: #ff6b35; font-size: 20px;"></i>',
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            })
        }).addTo(this.map);
        
        // Remove marker after 5 seconds
        setTimeout(() => {
            this.map.removeLayer(potholeMarker);
        }, 5000);
        
        this.showToast('Pothole location highlighted on map', 'info');
    }
    
    /**
     * Load potholes near current route
     */
    async loadPotholesForRoute(routeCoordinates) {
        try {
            const response = await fetch('/api/potholes/near-route', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    route: routeCoordinates,
                    buffer: 100 // 100 meters buffer
                })
            });
            
            const result = await response.json();
            
            if (response.ok && result.potholes) {
                this.displayPotholesOnMap(result.potholes);
            }
        } catch (error) {
            console.error('Error loading potholes for route:', error);
        }
    }
    
    /**
     * Display potholes on map
     */
    displayPotholesOnMap(potholes) {
        // Remove existing pothole markers
        if (this.potholeLayer) {
            this.map.removeLayer(this.potholeLayer);
        }
        
        // Create new layer for potholes
        this.potholeLayer = L.layerGroup();
        
        potholes.forEach(pothole => {
            const [lng, lat] = pothole.location.coordinates;
            const severity = pothole.severity;
            
            // Create marker with severity-based styling
            const marker = L.marker([lat, lng], {
                icon: L.divIcon({
                    className: `pothole-marker pothole-${severity}`,
                    html: `<div class="pothole-icon">${this.getSeverityIcon(severity)}</div>`,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                })
            });
            
            // Add popup with pothole details
            marker.bindPopup(`
                <div class="pothole-popup">
                    <h6>${this.getSeverityIcon(severity)} ${severity.toUpperCase()} Pothole</h6>
                    <p class="mb-1"><strong>Status:</strong> ${pothole.status}</p>
                    ${pothole.description ? `<p class="mb-1"><strong>Description:</strong> ${pothole.description}</p>` : ''}
                    <p class="mb-1"><small class="text-muted">Reported: ${new Date(pothole.createdAt).toLocaleDateString()}</small></p>
                    ${pothole.photoUrl ? `<a href="${pothole.photoUrl}" target="_blank" class="btn btn-sm btn-primary">View Photo</a>` : ''}
                </div>
            `);
            
            this.potholeLayer.addLayer(marker);
        });
        
        // Add layer to map
        this.map.addLayer(this.potholeLayer);
        
        if (potholes.length > 0) {
            this.showToast(`${potholes.length} pothole(s) found along route`, 'warning');
        }
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        const iconMap = {
            success: 'fas fa-check-circle text-success',
            error: 'fas fa-exclamation-circle text-danger',
            warning: 'fas fa-exclamation-triangle text-warning',
            info: 'fas fa-info-circle text-info'
        };

        const toastHtml = `
            <i class="${iconMap[type]} me-2"></i>
            ${message}
        `;

        $('#toastMessage').html(toastHtml);
        
        const toastElement = document.getElementById('alertToast');
        const toast = new bootstrap.Toast(toastElement);
        toast.show();
    }
}

// Initialize dashboard when document is ready
function initializeDashboard() {
    try {
        window.dashboard = new RoutingDashboard();
        
        // Add some global error handling
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            if (window.dashboard) {
                window.dashboard.showToast('An unexpected error occurred', 'error');
            }
        });
    } catch (error) {
        console.error('Failed to initialize dashboard:', error);
        document.body.innerHTML = `
            <div class="alert alert-danger m-3">
                <h4>Initialization Error</h4>
                <p>Failed to start the routing dashboard. Please refresh the page.</p>
                <small>Error: ${error.message}</small>
            </div>
        `;
    }
}

// Use multiple initialization methods for better compatibility
if (typeof $ !== 'undefined') {
    $(document).ready(initializeDashboard);
} else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDashboard);
} else {
    initializeDashboard();
}