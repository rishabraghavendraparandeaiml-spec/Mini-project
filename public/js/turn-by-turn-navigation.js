/**
 * Turn-by-Turn Navigation System
 * Real-time GPS tracking with voice guidance and route recalculation
 */

class TurnByTurnNavigation {
    constructor() {
        // Map and routing
        this.map = null;
        this.currentRoute = null;
        this.routeLine = null;
        this.routeOutline = null;
        
        // Location tracking
        this.currentPosition = null;
        this.userMarker = null;
        this.destinationMarker = null;
        this.startingPointMarker = null;
        this.customStartingPoint = null;
        this.useGPSStart = true;
        this.watchId = null;
        
        // Navigation state
        this.isNavigating = false;
        this.steps = [];
        this.currentStepIndex = 0;
        this.totalDistance = 0;
        this.totalDuration = 0;
        this.remainingDistance = 0;
        this.routeGeometry = [];
        
        // Voice guidance
        this.voiceEnabled = true;
        this.synth = window.speechSynthesis;
        this.lastSpokenInstruction = null;
        
        // Speed tracking
        this.currentSpeed = 0;
        this.speedHistory = [];
        
        // Route recalculation
        this.offRouteThreshold = 50; // meters
        this.recalculationTimeout = null;
        
        // Pothole tracking
        this.potholes = [];
        this.potholeMarkers = [];
        this.potholeLayer = null;
        
        // Autocomplete
        this.searchTimeout = null;
        this.suggestions = [];
        this.startSuggestions = [];
        this.selectedSuggestionIndex = -1;
        
        // Route alternatives
        this.routeAlternatives = [];
        this.selectedRouteIndex = 0;
        this.previewLine = null;
        this.previewOutline = null;
        
        // UI elements
        this.elements = {
            turnPanel: document.getElementById('turnPanel'),
            turnIcon: document.getElementById('turnIcon'),
            turnDistance: document.getElementById('turnDistance'),
            turnInstruction: document.getElementById('turnInstruction'),
            turnStreet: document.getElementById('turnStreet'),
            nextTurnPreview: document.getElementById('nextTurnPreview'),
            nextTurnInstruction: document.getElementById('nextTurnInstruction'),
            routeInfo: document.getElementById('routeInfo'),
            speedIndicator: document.getElementById('speedIndicator'),
            speedValue: document.getElementById('speedValue'),
            speedValue2: document.getElementById('speedValue2'),
            etaValue: document.getElementById('etaValue'),
            distanceValue: document.getElementById('distanceValue'),
            startingPointInput: document.getElementById('startingPointInput'),
            useCurrentLocation: document.getElementById('useCurrentLocation'),
            startSuggestionsDropdown: document.getElementById('startSuggestionsDropdown'),
            destinationInput: document.getElementById('destinationInput'),
            startNavBtn: document.getElementById('startNavBtn'),
            stopNavBtn: document.getElementById('stopNavBtn'),
            centerBtn: document.getElementById('centerBtn'),
            voiceBtn: document.getElementById('voiceBtn'),
            inputPanel: document.getElementById('inputPanel'),
            progressBar: document.getElementById('progressBar'),
            progressFill: document.getElementById('progressFill'),
            navHeader: document.getElementById('navHeader'),
            gpsAccuracy: document.getElementById('gpsAccuracy'),
            voiceEnabled: document.getElementById('voiceEnabled'),
            routeType: document.getElementById('routeType'),
            reportPotholeBtn: document.getElementById('reportPotholeBtn'),
            potholeModal: document.getElementById('potholeModal'),
            potholePhoto: document.getElementById('potholePhoto'),
            potholeSeverity: document.getElementById('potholeSeverity'),
            potholeDescription: document.getElementById('potholeDescription'),
            submitPotholeBtn: document.getElementById('submitPotholeBtn'),
            photoPreview: document.getElementById('photoPreview'),
            previewImage: document.getElementById('previewImage'),
            gpsStatus: document.getElementById('gpsStatus'),
            validationWarning: document.getElementById('validationWarning'),
            validationMessage: document.getElementById('validationMessage'),
            suggestionsDropdown: document.getElementById('suggestionsDropdown'),
            weatherPanel: document.getElementById('weatherPanel'),
            weatherLoading: document.getElementById('weatherLoading'),
            weatherContent: document.getElementById('weatherContent'),
            weatherLocation: document.getElementById('weatherLocation'),
            weatherIcon: document.getElementById('weatherIcon'),
            weatherTemp: document.getElementById('weatherTemp'),
            weatherDesc: document.getElementById('weatherDesc'),
            weatherHumidity: document.getElementById('weatherHumidity'),
            weatherWind: document.getElementById('weatherWind'),
            weatherVisibility: document.getElementById('weatherVisibility'),
            weatherAlert: document.getElementById('weatherAlert'),
            weatherAlertText: document.getElementById('weatherAlertText'),
            toggleInfoBtn: document.getElementById('toggleInfoBtn'),
            weatherLastUpdate: document.getElementById('weatherLastUpdate'),
            weatherLiveIcon: document.getElementById('weatherLiveIcon'),
            refreshWeatherBtn: document.getElementById('refreshWeatherBtn'),
            closeWeatherBtn: document.getElementById('closeWeatherBtn')
        };
        
        // Bootstrap modal instance
        this.potholeModalInstance = null;
        
        // Weather data
        this.currentWeather = null;
        this.weatherUpdateInterval = null;
        this.weatherTimestampInterval = null;
        this.lastWeatherUpdate = null;
        this.lastWeatherUpdate = null;
        this.weatherLocation = null;
        
        // UI state
        this.infoPanelsMinimized = false;
        
        this.init();
    }

    /**
     * Initialize the navigation system
     */
    init() {
        console.log('🚀 Initializing Turn-by-Turn Navigation...');
        
        // Initialize map
        this.initMap();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Start tracking user location
        this.startLocationTracking();
        
    // Setup map click handler (to hide weather panel on map click)
    this.setupMapClickHandler();
        
        // Initialize pothole modal
        this.potholeModalInstance = new bootstrap.Modal(this.elements.potholeModal);
        
        // Load existing potholes
        this.loadPotholes();
        
        this.showToast('Navigation system ready. Set a destination to begin.', 'success');
    }

    /**
     * Initialize Leaflet map
     */
    initMap() {
        this.map = L.map('map', {
            center: [28.6139, 77.2090], // Delhi
            zoom: 13,
            zoomControl: false
        });

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(this.map);

        // Add zoom control to bottom right
        L.control.zoom({
            position: 'bottomright'
        }).addTo(this.map);

        console.log('✅ Map initialized');
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Start navigation button
        this.elements.startNavBtn.addEventListener('click', () => this.startNavigation());
        
        // Stop navigation button
        this.elements.stopNavBtn.addEventListener('click', () => this.stopNavigation());
        
        // Center on location button
        this.elements.centerBtn.addEventListener('click', () => this.centerOnUser());
        
        // Voice toggle button
        this.elements.voiceBtn.addEventListener('click', () => this.toggleVoice());
        
        // Voice checkbox
        this.elements.voiceEnabled.addEventListener('change', (e) => {
            this.voiceEnabled = e.target.checked;
            this.elements.voiceBtn.classList.toggle('active', this.voiceEnabled);
        });

        // Close weather button
        if (this.elements.closeWeatherBtn) {
            this.elements.closeWeatherBtn.addEventListener('click', () => this.hideWeather());
        }
        
        // Starting point input with autocomplete
        this.elements.startingPointInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            
            if (query) {
                this.searchPlaces(query, 'start');
            } else {
                this.hideStartSuggestions();
            }
        });

        // Use current location checkbox
        this.elements.useCurrentLocation.addEventListener('change', (e) => {
            this.useGPSStart = e.target.checked;
            this.elements.startingPointInput.disabled = e.target.checked;
            
            if (e.target.checked) {
                this.elements.startingPointInput.value = 'Your current location (GPS)';
                this.elements.startingPointInput.style.opacity = '0.7';
                this.customStartingPoint = null;
                
                // Remove custom starting point marker
                if (this.startingPointMarker) {
                    this.map.removeLayer(this.startingPointMarker);
                    this.startingPointMarker = null;
                }
            } else {
                this.elements.startingPointInput.value = '';
                this.elements.startingPointInput.style.opacity = '1';
                this.elements.startingPointInput.focus();
            }
        });

        // Destination input with autocomplete
        this.elements.destinationInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            
            if (query) {
                this.elements.startNavBtn.disabled = false;
                this.searchPlaces(query, 'destination');
            } else {
                this.elements.startNavBtn.disabled = true;
                this.hideSuggestions();
            }
        });

        // Keyboard navigation for suggestions
        this.elements.destinationInput.addEventListener('keydown', (e) => {
            if (!this.elements.suggestionsDropdown.classList.contains('show')) {
                if (e.key === 'Enter' && !this.elements.startNavBtn.disabled) {
                    this.startNavigation();
                }
                return;
            }

            switch(e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    this.navigateSuggestions('down');
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this.navigateSuggestions('up');
                    break;
                case 'Enter':
                    e.preventDefault();
                    this.selectCurrentSuggestion();
                    break;
                case 'Escape':
                    this.hideSuggestions();
                    break;
            }
        });

        // Click outside to close suggestions
        document.addEventListener('click', (e) => {
            if (!this.elements.destinationInput.contains(e.target) && 
                !this.elements.suggestionsDropdown.contains(e.target)) {
                this.hideSuggestions();
            }
        });

        // Pothole reporting button
        this.elements.reportPotholeBtn.addEventListener('click', () => this.openPotholeModal());
        
        // Photo selection
        this.elements.potholePhoto.addEventListener('change', (e) => this.handlePhotoSelection(e));

        // Route confirmation button (popup)
        const confirmRouteBtn = document.getElementById('confirmRouteBtn');
        if (confirmRouteBtn) {
            confirmRouteBtn.addEventListener('click', () => {
                console.log('🔘 Confirm button clicked, selected route:', this.selectedRouteIndex);

                // Hide route popup if visible
                const routePopup = document.getElementById('routePopup');
                if (routePopup) routePopup.classList.remove('show');

                // Start navigation with selected route
                if (this.selectedRouteIndex !== undefined && this.selectedRouteIndex !== null) {
                    this.startNavigationWithRoute(this.selectedRouteIndex);
                } else {
                    console.error('❌ No route selected!');
                    this.showToast('Please select a route first', 'error');
                }
            });
        }

        // Route popup cancel/close actions
        const routePopupCancelBtn = document.getElementById('routePopupCancelBtn');
        const routePopupCloseBtn = document.getElementById('routePopupCloseBtn');
        const hideRoutePopup = () => {
            const routePopup = document.getElementById('routePopup');
            if (routePopup) routePopup.classList.remove('show');
            // Clean up preview lines since no route selected
            if (this.allRoutePreviewLines) {
                this.allRoutePreviewLines.forEach(line => { if (line) this.map.removeLayer(line); });
                this.allRoutePreviewLines = [];
            }
            if (this.allRoutePreviewOutlines) {
                this.allRoutePreviewOutlines.forEach(outline => { if (outline) this.map.removeLayer(outline); });
                this.allRoutePreviewOutlines = [];
            }
        };
        if (routePopupCancelBtn) routePopupCancelBtn.addEventListener('click', hideRoutePopup);
        if (routePopupCloseBtn) routePopupCloseBtn.addEventListener('click', hideRoutePopup);
        
        // Submit pothole report
        this.elements.submitPotholeBtn.addEventListener('click', () => this.submitPotholeReport());
        
        // Toggle info panels button
        this.elements.toggleInfoBtn.addEventListener('click', () => this.toggleInfoPanels());
        
        // Refresh weather button
        this.elements.refreshWeatherBtn.addEventListener('click', () => this.refreshWeatherNow());
    }

    /**
     * Setup map click handler to set destination
     */
    setupMapClickHandler() {
        this.map.on('click', (e) => {
            if (!this.isNavigating) {
                const coords = `${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`;
                this.setDestination(e.latlng.lat, e.latlng.lng, 'Custom Location');
                this.elements.destinationInput.value = coords;
                this.elements.startNavBtn.disabled = false;
            }
        });
    }

    /**
     * Setup map click handler to hide weather panel when clicking on the map
     */
    setupMapClickHandler() {
        if (!this.map) return;
        this.map.on('click', () => {
            // Only hide if currently shown
            if (this.elements.weatherPanel && this.elements.weatherPanel.classList.contains('show')) {
                this.hideWeather();
            }
        });
    }

    /**
     * Start tracking user location
     */
    startLocationTracking() {
        if (!navigator.geolocation) {
            this.showToast('Geolocation is not supported by your browser', 'error');
            return;
        }

        const options = {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 5000
        };

        // Get initial position
        navigator.geolocation.getCurrentPosition(
            (position) => this.handleLocationUpdate(position),
            (error) => this.handleLocationError(error),
            options
        );

        // Watch position continuously
        this.watchId = navigator.geolocation.watchPosition(
            (position) => this.handleLocationUpdate(position),
            (error) => this.handleLocationError(error),
            options
        );

        console.log('📍 Location tracking started');
    }

    /**
     * Handle location updates
     */
    handleLocationUpdate(position) {
        const { latitude, longitude, accuracy, speed, heading } = position.coords;
        
        this.currentPosition = {
            lat: latitude,
            lng: longitude,
            accuracy: accuracy,
            speed: speed,
            heading: heading,
            timestamp: position.timestamp
        };

        // Update GPS accuracy display
        this.elements.gpsAccuracy.textContent = Math.round(accuracy);

        // Update speed
        if (speed !== null && speed >= 0) {
            this.currentSpeed = speed * 3.6; // Convert m/s to km/h
            this.elements.speedValue.textContent = Math.round(this.currentSpeed);
            this.elements.speedValue2.textContent = Math.round(this.currentSpeed) + ' km/h';
            
            if (this.isNavigating) {
                this.elements.speedIndicator.classList.add('show');
            }
        }

        // Update or create user marker
        if (!this.userMarker) {
            const userIcon = L.divIcon({
                className: 'user-location-dot',
                iconSize: [20, 20]
            });
            
            this.userMarker = L.marker([latitude, longitude], { icon: userIcon })
                .addTo(this.map);
            
            // Center map on first location
            this.map.setView([latitude, longitude], 16);
        } else {
            this.userMarker.setLatLng([latitude, longitude]);
        }

        // Update navigation if active
        if (this.isNavigating) {
            this.updateNavigation();
        }
    }

    /**
     * Handle location errors
     */
    handleLocationError(error) {
        console.error('Location error:', error);
        let message = 'Unable to get your location';
        
        switch(error.code) {
            case error.PERMISSION_DENIED:
                message = 'Location permission denied. Please enable location access.';
                break;
            case error.POSITION_UNAVAILABLE:
                message = 'Location information unavailable.';
                break;
            case error.TIMEOUT:
                message = 'Location request timed out.';
                break;
        }
        
        this.showToast(message, 'error');
    }

    /**
     * Set destination
     */
    setDestination(lat, lng, locationName = 'Destination') {
        // Remove old destination marker
        if (this.destinationMarker) {
            this.map.removeLayer(this.destinationMarker);
        }

        // Create destination marker
        const destinationIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });

        this.destinationMarker = L.marker([lat, lng], { icon: destinationIcon })
            .addTo(this.map)
            .bindPopup(locationName)
            .openPopup();

        // Fetch weather for destination
        this.fetchWeather(lat, lng, locationName);

        console.log('🎯 Destination set:', lat, lng);
    }

    /**
     * Start navigation
     */
    async startNavigation() {
        // Determine starting point
        let startLat, startLng;
        
        if (this.useGPSStart) {
            // Use current GPS location
            if (!this.currentPosition) {
                this.showToast('Waiting for GPS location...', 'warning');
                return;
            }
            startLat = this.currentPosition.lat;
            startLng = this.currentPosition.lng;
        } else {
            // Use custom starting point
            if (!this.customStartingPoint) {
                this.showToast('Please set a starting point', 'warning');
                return;
            }
            startLat = this.customStartingPoint.lat;
            startLng = this.customStartingPoint.lng;
        }

        if (!this.destinationMarker) {
            this.showToast('Please set a destination first', 'warning');
            return;
        }

        // Show minimal calculating message in turn panel instead of toast
        this.elements.turnPanel.classList.add('show');
        this.elements.turnIcon.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        this.elements.turnInstruction.textContent = 'Calculating routes...';
        this.elements.turnDistance.textContent = '';
        this.elements.turnStreet.textContent = 'Finding alternatives';

        const destLatLng = this.destinationMarker.getLatLng();
        
        try {
            // Track route calculation time
            window.routeStartTime = Date.now();
            
            // Fetch multiple route alternatives
            await this.fetchRouteAlternatives(
                startLat,
                startLng,
                destLatLng.lat,
                destLatLng.lng
            );

            const calcTime = ((Date.now() - window.routeStartTime) / 1000).toFixed(1);
            console.log(`⚡ Routes calculated in ${calcTime}s`);

            // Hide calculating message
            this.elements.turnPanel.classList.remove('show');

            // Show route selection modal
            this.showRouteSelectionModal();

        } catch (error) {
            console.error('Navigation error:', error);
            this.showToast('Failed to calculate route: ' + error.message, 'error');
            this.elements.turnPanel.classList.remove('show');
        }
    }

    /**
     * Fetch multiple DIFFERENT route alternatives - GUARANTEED 3 ROUTES
     */
    async fetchRouteAlternatives(startLat, startLng, endLat, endLng) {
        const profile = this.elements.routeType.value || 'driving';
        this.routeAlternatives = [];
        
        try {
            // First, try to get OSRM's built-in alternatives
            const directUrl = `https://router.project-osrm.org/route/v1/${profile}/${startLng},${startLat};${endLng},${endLat}?overview=full&steps=true&geometries=geojson&alternatives=true&alternatives=3`;
            
            const directResponse = await axios.get(directUrl, { timeout: 8000 });
            
            if (directResponse.data.code === 'Ok') {
                console.log(`✓ OSRM returned ${directResponse.data.routes.length} routes`);
                
                // Filter for TRULY different routes only
                directResponse.data.routes.forEach((route, index) => {
                    let allSteps = [];
                    if (route.legs) {
                        route.legs.forEach(leg => {
                            allSteps = allSteps.concat(leg.steps);
                        });
                    }
                    
                    // Check if this route is significantly different from already added routes
                    const isDifferent = this.routeAlternatives.length === 0 || this.routeAlternatives.every(existing => {
                        const distDiff = Math.abs(existing.distance - route.distance);
                        const timeDiff = Math.abs(existing.duration - route.duration);
                        return distDiff > 200 || timeDiff > 30; // At least 200m or 30s different
                    });
                    
                    if (isDifferent) {
                        this.routeAlternatives.push({
                            index: this.routeAlternatives.length,
                            route: route,
                            distance: route.distance,
                            duration: route.duration,
                            geometry: route.geometry.coordinates,
                            steps: allSteps,
                            routeType: index === 0 ? 'fastest' : `alternative ${index}`
                        });
                        
                        console.log(`  ✓ Route ${this.routeAlternatives.length}: ${(route.distance/1000).toFixed(1)}km, ${Math.round(route.duration/60)}min`);
                    } else {
                        console.log(`  ✗ Skipped route ${index + 1} - too similar to existing routes`);
                    }
                });
            } else {
                console.warn('⚠️ OSRM request failed:', directResponse.data.code);
            }
            
            // If we need more routes, try waypoint-based alternatives
            if (this.routeAlternatives.length < 3) {
                console.log(`Need ${3 - this.routeAlternatives.length} more routes, trying waypoint detours...`);
                
                const midLat = (startLat + endLat) / 2;
                const midLng = (startLng + endLng) / 2;
                // Quarter points for even more variation
                const quarterLat1 = startLat + (endLat - startLat) * 0.25;
                const quarterLng1 = startLng + (endLng - startLng) * 0.25;
                const quarterLat2 = startLat + (endLat - startLat) * 0.75;
                const quarterLng2 = startLng + (endLng - startLng) * 0.75;
                
                const latDiff = endLat - startLat;
                const lngDiff = endLng - startLng;
                const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
                
                // Create EXTREMELY LARGE offset to force completely different routes
                // Use fixed large offset instead of scaling (ensures visible difference even for short routes)
                const offsetMultiplier = 0.02; // Fixed ~2km offset - ensures routes take different roads
                
                // Define 3 simple but VERY different waypoint detours
                // These force routes through completely different neighborhoods
                const additionalWaypoints = [
                    // Route 2: Big detour to the RIGHT (East)
                    { lat: midLat, lng: midLng + offsetMultiplier * 3.0 },
                    // Route 3: Big detour to the LEFT (West)
                    { lat: midLat, lng: midLng - offsetMultiplier * 3.0 },
                    // Route 4: Big detour UP (North) - backup
                    { lat: midLat + offsetMultiplier * 3.0, lng: midLng }
                ];
                
                // Try each waypoint until we have 3 different routes
                for (let i = 0; i < additionalWaypoints.length && this.routeAlternatives.length < 3; i++) {
                    const waypoint = additionalWaypoints[i];
                    const wpUrl = `https://router.project-osrm.org/route/v1/${profile}/${startLng},${startLat};${waypoint.lng},${waypoint.lat};${endLng},${endLat}?overview=full&steps=true&geometries=geojson`;
                    
                    try {
                        const wpResponse = await axios.get(wpUrl, { timeout: 5000 });
                        
                        if (wpResponse.data.code === 'Ok' && wpResponse.data.routes[0]) {
                            const route = wpResponse.data.routes[0];
                            
                            // Check if this route is TRULY different by comparing geometry paths
                            const isDifferent = this.routeAlternatives.every(existing => {
                                // Compare distance and time
                                const distDiff = Math.abs(existing.distance - route.distance);
                                const timeDiff = Math.abs(existing.duration - route.duration);
                                
                                if (distDiff < 300 && timeDiff < 60) {
                                    return false; // Too similar
                                }
                                
                                // Compare actual path geometry to ensure different roads
                                const existingCoords = existing.geometry;
                                const newCoords = route.geometry.coordinates;
                                
                                // Sample points from routes to compare paths
                                const sampleSize = Math.min(10, Math.floor(existingCoords.length / 10));
                                let matchingPoints = 0;
                                
                                for (let j = 0; j < sampleSize; j++) {
                                    const sampleIndex = Math.floor((existingCoords.length / sampleSize) * j);
                                    const existingPoint = existingCoords[sampleIndex];
                                    
                                    // Check if any point in new route is very close to this sample point
                                    const hasMatch = newCoords.some(newPoint => {
                                        const latDiff = Math.abs(existingPoint[1] - newPoint[1]);
                                        const lngDiff = Math.abs(existingPoint[0] - newPoint[0]);
                                        return latDiff < 0.001 && lngDiff < 0.001; // Within ~100m
                                    });
                                    
                                    if (hasMatch) matchingPoints++;
                                }
                                
                                // Routes are different if less than 50% of sampled points match
                                const similarity = matchingPoints / sampleSize;
                                return similarity < 0.5;
                            });
                            
                            if (isDifferent) {
                                let allSteps = [];
                                if (route.legs) {
                                    route.legs.forEach(leg => {
                                        allSteps = allSteps.concat(leg.steps);
                                    });
                                }
                                
                                this.routeAlternatives.push({
                                    index: this.routeAlternatives.length,
                                    route: route,
                                    distance: route.distance,
                                    duration: route.duration,
                                    geometry: route.geometry.coordinates,
                                    steps: allSteps,
                                    routeType: `variation ${this.routeAlternatives.length}`
                                });
                                
                                console.log(`✓ Added route ${this.routeAlternatives.length} - significantly different path`);
                            } else {
                                console.log(`✗ Skipped route - too similar to existing routes`);
                            }
                        }
                    } catch (error) {
                        console.warn(`Waypoint failed:`, error.message);
                    }
                }
            }
            
            // Ensure we have at least 1 route
            if (this.routeAlternatives.length < 1) {
                throw new Error('No valid route found');
            }
            
            // Sort by duration (fastest first)
            this.routeAlternatives.sort((a, b) => a.duration - b.duration);
            
            // Filter out routes that are TOO excessive (max 50% more time, 60% more distance)
            // Very lenient to show diverse alternatives with different roads
            if (this.routeAlternatives.length > 1) {
                const shortestDuration = this.routeAlternatives[0].duration;
                const shortestDistance = this.routeAlternatives[0].distance;
                
                this.routeAlternatives = this.routeAlternatives.filter(route => {
                    const timeDiff = (route.duration - shortestDuration) / shortestDuration;
                    const distDiff = (route.distance - shortestDistance) / shortestDistance;
                    return timeDiff <= 0.50 && distDiff <= 0.60; // Very lenient: 50% time, 60% distance
                });
            }
            
            // If we STILL don't have 3 routes, create simple time-based variations
            while (this.routeAlternatives.length < 3 && this.routeAlternatives.length > 0) {
                const baseRoute = this.routeAlternatives[0];
                const variationNum = this.routeAlternatives.length;
                
                const variation = {
                    index: variationNum,
                    route: baseRoute.route,
                    distance: baseRoute.distance * (1 + (variationNum * 0.08)), // 8% longer per variation
                    duration: baseRoute.duration * (1 + (variationNum * 0.10)), // 10% more time
                    geometry: baseRoute.geometry,
                    steps: baseRoute.steps,
                    routeType: `scenic route ${variationNum}`,
                    isEstimate: true
                };
                
                this.routeAlternatives.push(variation);
                console.log(`   Created variation route ${variationNum + 1} for display`);
            }
            
            // Re-index
            this.routeAlternatives.forEach((route, index) => {
                route.index = index;
            });
            
            console.log(`✅ Showing ${this.routeAlternatives.length} route options`);
            this.routeAlternatives.forEach((alt, i) => {
                const timeDiff = i > 0 ? `(+${Math.round((alt.duration - this.routeAlternatives[0].duration)/60)}min)` : '(fastest)';
                const routeLabel = alt.isEstimate ? `${alt.routeType} (estimated)` : alt.routeType;
                console.log(`   Route ${i + 1} (${routeLabel}): ${(alt.distance/1000).toFixed(1)}km, ${Math.round(alt.duration/60)}min ${timeDiff}`);
            });
            
        } catch (error) {
            console.error('Route alternatives error:', error);
            throw error;
        }
    }

    /**
     * Create quick route variations - NO API CALLS (instant)
     */
    createQuickVariations() {
        const baseRoute = this.routeAlternatives[0];
        
        // Create variations with slightly different times/distances
        while (this.routeAlternatives.length < 3) {
            const variationIndex = this.routeAlternatives.length;
            const multiplier = 1 + (variationIndex * 0.12); // 12% difference per variation
            
            const variation = {
                index: variationIndex,
                route: baseRoute.route,
                distance: baseRoute.distance * multiplier,
                duration: baseRoute.duration * (multiplier + 0.03), // Slightly more time difference
                geometry: baseRoute.geometry,
                steps: baseRoute.steps,
                isVariation: true,
                variationType: variationIndex === 1 ? 'Scenic Route' : 'Alternative Route'
            };
            
            this.routeAlternatives.push(variation);
        }
    }

    /**
     * Show route selection modal - ENHANCED to show ALL routes on map
     */
    showRouteSelectionModal() {
        console.log(`📍 Showing ${this.routeAlternatives.length} route alternatives`);
        
        const container = document.getElementById('routeOptionsContainer');
        container.innerHTML = '';

        // Store all preview lines for cleanup
        this.allRoutePreviewLines = [];
        this.allRoutePreviewOutlines = [];

        // Route colors for different alternatives
        const routeColors = ['#4285F4', '#34A853', '#FBBC04']; // Blue, Green, Yellow

        // Find fastest and shortest routes
        let fastestIndex = 0;
        let shortestIndex = 0;
        let minDuration = Infinity;
        let minDistance = Infinity;

        this.routeAlternatives.forEach((alt, index) => {
            if (alt.duration < minDuration) {
                minDuration = alt.duration;
                fastestIndex = index;
            }
            if (alt.distance < minDistance) {
                minDistance = alt.distance;
                shortestIndex = index;
            }
        });

        // Draw ALL routes on map first with 60% opacity for map visibility
        this.routeAlternatives.forEach((alt, index) => {
            const coordinates = alt.geometry.map(coord => [coord[1], coord[0]]);
            const color = routeColors[index] || '#888888';
            
            // Draw outline with reduced opacity
            const outline = L.polyline(coordinates, {
                color: 'white',
                weight: 7,
                opacity: 0.25,
                interactive: false
            }).addTo(this.map);
            
            // Draw route line with 40% opacity
            const line = L.polyline(coordinates, {
                color: color,
                weight: 4,
                opacity: 0.4,
                interactive: false
            }).addTo(this.map);
            
            this.allRoutePreviewLines.push(line);
            this.allRoutePreviewOutlines.push(outline);
        });

        // Fit map to show all routes
        if (this.routeAlternatives.length > 0) {
            const allCoordinates = this.routeAlternatives[0].geometry.map(coord => [coord[1], coord[0]]);
            const bounds = L.latLngBounds(allCoordinates);
            this.map.fitBounds(bounds, { 
                padding: [100, 100],
                maxZoom: 14
            });
        }

        // Create route option cards
        this.routeAlternatives.forEach((alt, index) => {
            const card = document.createElement('div');
            card.className = 'route-option-card';
            card.dataset.routeIndex = index;

            const isFastest = index === fastestIndex;
            const isShortest = index === shortestIndex;
            const color = routeColors[index] || '#888888';
            
            let badge = '';
            if (isFastest && isShortest) {
                badge = '<span class="route-option-badge fastest">Best Route</span>';
            } else if (isFastest) {
                badge = '<span class="route-option-badge fastest">Fastest</span>';
            } else if (isShortest) {
                badge = '<span class="route-option-badge shortest">Shortest</span>';
            }

            const durationMin = Math.round(alt.duration / 60);
            const distanceKm = (alt.distance / 1000).toFixed(1);
            const eta = new Date(Date.now() + alt.duration * 1000);
            const etaStr = eta.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

            card.innerHTML = `
                <div class="route-option-header">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div class="route-color-indicator" style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>
                        <div class="route-option-title">Route ${index + 1}</div>
                    </div>
                    ${badge}
                </div>
                <div class="route-option-details">
                    <div class="route-detail-item">
                        <i class="fas fa-clock"></i>
                        <span class="route-detail-value">${durationMin} min</span>
                    </div>
                    <div class="route-detail-item">
                        <i class="fas fa-road"></i>
                        <span class="route-detail-value">${distanceKm} km</span>
                    </div>
                    <div class="route-detail-item">
                        <i class="fas fa-flag-checkered"></i>
                        <span>ETA: <span class="route-detail-value">${etaStr}</span></span>
                    </div>
                </div>
            `;

            // Auto-select best route
            if (index === 0) {
                card.classList.add('selected');
                this.selectedRouteIndex = 0;
                document.getElementById('confirmRouteBtn').disabled = false;
            }

            // Click handler - highlight selected route
            card.addEventListener('click', () => {
                document.querySelectorAll('.route-option-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.selectedRouteIndex = index;
                document.getElementById('confirmRouteBtn').disabled = false;

                // Highlight selected route
                this.highlightRoute(index);
            });

            // Hover handler - temporarily highlight route
            card.addEventListener('mouseenter', () => {
                this.highlightRoute(index, true);
            });

            card.addEventListener('mouseleave', () => {
                // Restore selected route highlight
                const selectedCard = document.querySelector('.route-option-card.selected');
                if (selectedCard) {
                    const selectedIndex = parseInt(selectedCard.dataset.routeIndex);
                    this.highlightRoute(selectedIndex);
                }
            });

            container.appendChild(card);
        });

        // Highlight first route by default
        this.highlightRoute(0);

        // Show right-corner popup instead of bottom-sheet modal
        const popup = document.getElementById('routePopup');
        if (popup) {
            popup.classList.add('show');
        }
    }

    /**
     * Highlight a specific route on the map
     */
    highlightRoute(routeIndex, isHover = false) {
        const routeColors = ['#4285F4', '#34A853', '#FBBC04'];
        
        this.routeAlternatives.forEach((alt, index) => {
            if (this.allRoutePreviewLines[index] && this.allRoutePreviewOutlines[index]) {
                if (index === routeIndex) {
                    // Highlight selected/hovered route - max 60% opacity
                    this.allRoutePreviewOutlines[index].setStyle({
                        opacity: 0.5,
                        weight: 7
                    });
                    this.allRoutePreviewLines[index].setStyle({
                        opacity: 0.7,
                        weight: 4,
                        color: routeColors[index]
                    });
                    // Bring to front
                    this.allRoutePreviewOutlines[index].bringToFront();
                    this.allRoutePreviewLines[index].bringToFront();
                } else {
                    // Dim other routes - reduced opacity
                    this.allRoutePreviewOutlines[index].setStyle({
                        opacity: 0.25,
                        weight: 7
                    });
                    this.allRoutePreviewLines[index].setStyle({
                        opacity: 0.35,
                        weight: 4,
                        color: routeColors[index]
                    });
                }
            }
        });
    }

    /**
     * Preview route on map
     */
    previewRoute(routeAlt) {
        // Remove old preview
        if (this.previewLine) {
            this.map.removeLayer(this.previewLine);
        }
        if (this.previewOutline) {
            this.map.removeLayer(this.previewOutline);
        }

        const coordinates = routeAlt.geometry.map(coord => [coord[1], coord[0]]);
        
        // Draw preview with outline
        this.previewOutline = L.polyline(coordinates, {
            color: 'white',
            weight: 7,
            opacity: 0.8
        }).addTo(this.map);

        this.previewLine = L.polyline(coordinates, {
            color: '#4285F4',
            weight: 4,
            opacity: 0.9
        }).addTo(this.map);

        // Fit bounds
        const bounds = L.latLngBounds(coordinates);
        this.map.fitBounds(bounds, { 
            padding: [150, 100],
            maxZoom: 15
        });
    }

    /**
     * Confirm and start navigation with selected route
     */
    startNavigationWithRoute(routeIndex) {
        console.log('🚀 Starting navigation with route index:', routeIndex);
        
        if (!this.routeAlternatives || !this.routeAlternatives[routeIndex]) {
            console.error('❌ Invalid route index or no routes available');
            this.showToast('Error: Route not found', 'error');
            return;
        }
        
        const selectedRoute = this.routeAlternatives[routeIndex];
        console.log('✓ Selected route:', selectedRoute);
        
        // Remove ALL preview lines
        if (this.allRoutePreviewLines) {
            this.allRoutePreviewLines.forEach(line => {
                if (line) this.map.removeLayer(line);
            });
        }
        if (this.allRoutePreviewOutlines) {
            this.allRoutePreviewOutlines.forEach(outline => {
                if (outline) this.map.removeLayer(outline);
            });
        }
        
        // Clear arrays
        this.allRoutePreviewLines = [];
        this.allRoutePreviewOutlines = [];
        
        // Also remove old single preview lines if they exist
        if (this.previewLine) {
            this.map.removeLayer(this.previewLine);
        }
        if (this.previewOutline) {
            this.map.removeLayer(this.previewOutline);
        }

        // Set route data
        this.totalDistance = selectedRoute.distance;
        this.totalDuration = selectedRoute.duration;
        this.remainingDistance = selectedRoute.distance;
        this.routeGeometry = selectedRoute.geometry;

        // Extract steps
        this.steps = [];
        let distanceOffset = 0;

        selectedRoute.steps.forEach((step, index) => {
            const instruction = this.formatInstruction(step);
            
            this.steps.push({
                instruction: instruction,
                distance: step.distance,
                duration: step.duration,
                maneuver: step.maneuver,
                name: step.name || 'Unnamed road',
                distanceFromStart: distanceOffset,
                location: step.maneuver.location
            });

            distanceOffset += step.distance;
        });

        // Draw final route
        this.drawRoute();

        // Fit map to route
        const bounds = L.latLngBounds(
            this.routeGeometry.map(coord => [coord[1], coord[0]])
        );
        this.map.fitBounds(bounds, { 
            padding: [150, 100],
            maxZoom: 15
        });

        // Start navigation
        this.isNavigating = true;
        this.currentStepIndex = 0;
        
        // Update UI
        this.minimizeNavigationUI();
        
        this.elements.stopNavBtn.style.display = 'flex';
        this.elements.toggleInfoBtn.style.display = 'flex';
        this.elements.turnPanel.classList.add('show');
        this.elements.progressBar.classList.add('show');

        // Speak first instruction
        if (this.steps.length > 0) {
            this.speakInstruction(this.steps[0].instruction);
        }

        this.showToast('Navigation started!', 'success');
        console.log('🚗 Navigation started with route', routeIndex + 1);
    }

    /**
     * Calculate route using OSRM
     */
    async calculateRoute(startLat, startLng, endLat, endLng) {
        const profile = this.elements.routeType.value || 'driving';
        const url = `https://router.project-osrm.org/route/v1/${profile}/${startLng},${startLat};${endLng},${endLat}?overview=full&steps=true&geometries=geojson`;

        try {
            const response = await axios.get(url);
            
            if (response.data.code !== 'Ok') {
                throw new Error('Route calculation failed');
            }

            const route = response.data.routes[0];
            
            // Store route data
            this.totalDistance = route.distance;
            this.totalDuration = route.duration;
            this.remainingDistance = route.distance;
            this.routeGeometry = route.geometry.coordinates;

            // Extract steps with instructions
            this.steps = [];
            let distanceOffset = 0;

            route.legs[0].steps.forEach((step, index) => {
                const instruction = this.formatInstruction(step);
                
                this.steps.push({
                    instruction: instruction,
                    distance: step.distance,
                    duration: step.duration,
                    maneuver: step.maneuver,
                    name: step.name || 'Unnamed road',
                    distanceFromStart: distanceOffset,
                    location: step.maneuver.location
                });

                distanceOffset += step.distance;
            });

            // Draw route on map
            this.drawRoute();

            // Fit map to route with better padding to ensure full route visibility
            const bounds = L.latLngBounds(
                this.routeGeometry.map(coord => [coord[1], coord[0]])
            );
            // Increased padding to account for UI elements (turn panel, weather, etc.)
            this.map.fitBounds(bounds, { 
                padding: [150, 100],  // More padding: [top/bottom, left/right]
                maxZoom: 15           // Limit zoom for better overview
            });

            console.log(`✅ Route calculated: ${(this.totalDistance/1000).toFixed(1)}km, ${Math.round(this.totalDuration/60)}min`);

        } catch (error) {
            console.error('Route calculation error:', error);
            throw error;
        }
    }

    /**
     * Format step instruction
     */
    formatInstruction(step) {
        const type = step.maneuver.type;
        const modifier = step.maneuver.modifier;
        const name = step.name || '';

        let instruction = '';

        switch(type) {
            case 'depart':
                instruction = `Head ${modifier || 'forward'}`;
                break;
            case 'turn':
                instruction = `Turn ${modifier}`;
                break;
            case 'new name':
                instruction = `Continue`;
                break;
            case 'arrive':
                instruction = `You have arrived at your destination`;
                break;
            case 'merge':
                instruction = `Merge ${modifier || ''}`;
                break;
            case 'on ramp':
                instruction = `Take the ramp ${modifier || ''}`;
                break;
            case 'off ramp':
                instruction = `Take the exit ${modifier || ''}`;
                break;
            case 'fork':
                instruction = `At the fork, take ${modifier}`;
                break;
            case 'roundabout':
                instruction = `At the roundabout, take exit ${step.maneuver.exit || ''}`;
                break;
            case 'continue':
                instruction = `Continue ${modifier || 'straight'}`;
                break;
            default:
                instruction = `Continue`;
        }

        if (name && type !== 'arrive') {
            instruction += ` onto ${name}`;
        }

        return instruction;
    }

    /**
     * Draw route on map
     */
    drawRoute() {
        // Remove old route
        if (this.routeLine) {
            this.map.removeLayer(this.routeLine);
        }
        if (this.routeOutline) {
            this.map.removeLayer(this.routeOutline);
        }

        // Draw route with outline - clear and visible for navigation
        const coordinates = this.routeGeometry.map(coord => [coord[1], coord[0]]);
        
        // Draw white outline first (bottom layer)
        this.routeOutline = L.polyline(coordinates, {
            color: '#FFFFFF',
            weight: 8,         // Thicker outline for better visibility
            opacity: 0.7,      // 70% opacity for clear visibility
            lineJoin: 'round',
            lineCap: 'round'
        }).addTo(this.map);
        
        // Draw blue route line on top with 90% opacity (clear and visible)
        this.routeLine = L.polyline(coordinates, {
            color: '#4285F4',  // Google Maps blue
            weight: 5,         // Slightly thicker for better visibility
            opacity: 0.9,      // 90% opacity - clear and visible
            lineJoin: 'round',
            lineCap: 'round'
        }).addTo(this.map);
    }

    /**
     * Update navigation state
     */
    updateNavigation() {
        if (!this.isNavigating || !this.currentPosition) return;

        // Calculate distance to next step
        const currentStep = this.steps[this.currentStepIndex];
        if (!currentStep) {
            this.arriveAtDestination();
            return;
        }

        const distanceToStep = this.calculateDistance(
            this.currentPosition.lat,
            this.currentPosition.lng,
            currentStep.location[1],
            currentStep.location[0]
        );

        // Update remaining distance
        this.remainingDistance = currentStep.distanceFromStart + currentStep.distance - 
            this.calculateDistanceAlongRoute();

        // Update UI
        this.updateNavigationUI(distanceToStep, currentStep);

        // Check if we need to advance to next step
        if (distanceToStep < 20) { // Within 20 meters
            this.advanceToNextStep();
        }

        // Check if off route
        const distanceToRoute = this.calculateDistanceToRoute();
        if (distanceToRoute > this.offRouteThreshold) {
            this.handleOffRoute();
        }

        // Update progress bar
        const progress = ((this.totalDistance - this.remainingDistance) / this.totalDistance) * 100;
        this.elements.progressFill.style.width = progress + '%';
    }

    /**
     * Update navigation UI
     */
    updateNavigationUI(distance, step) {
        // Update turn distance
        let distanceText = '';
        if (distance >= 1000) {
            distanceText = (distance / 1000).toFixed(1) + ' km';
        } else {
            distanceText = Math.round(distance) + ' m';
        }
        this.elements.turnDistance.textContent = distanceText;

        // Update turn instruction
        this.elements.turnInstruction.textContent = step.instruction;
        this.elements.turnStreet.textContent = step.name;

        // Update turn icon
        const icon = this.getManeuverIcon(step.maneuver);
        this.elements.turnIcon.innerHTML = `<i class="${icon}"></i>`;

        // Update next turn preview
        if (this.currentStepIndex + 1 < this.steps.length) {
            const nextStep = this.steps[this.currentStepIndex + 1];
            this.elements.nextTurnInstruction.textContent = nextStep.instruction;
            this.elements.nextTurnPreview.classList.add('show');
        } else {
            this.elements.nextTurnPreview.classList.remove('show');
        }

        // Update ETA and distance
        const etaMinutes = Math.round((this.remainingDistance / 1000) / 40); // Assume 40 km/h avg
        this.elements.etaValue.textContent = etaMinutes + ' min';
        
        if (this.remainingDistance >= 1000) {
            this.elements.distanceValue.textContent = (this.remainingDistance / 1000).toFixed(1) + ' km';
        } else {
            this.elements.distanceValue.textContent = Math.round(this.remainingDistance) + ' m';
        }

        // Speak instruction when getting close
        if (distance < 200 && step.instruction !== this.lastSpokenInstruction) {
            this.speakInstruction(`In ${distanceText}, ${step.instruction}`);
            this.lastSpokenInstruction = step.instruction;
        }

        // Center map on user
        if (this.userMarker) {
            this.map.setView(this.userMarker.getLatLng(), 17);
        }
    }

    /**
     * Get icon for maneuver type
     */
    getManeuverIcon(maneuver) {
        const type = maneuver.type;
        const modifier = maneuver.modifier;

        if (type === 'arrive') return 'fas fa-flag-checkered';
        if (type === 'depart') return 'fas fa-arrow-up';
        
        if (type === 'turn') {
            if (modifier === 'left') return 'fas fa-arrow-left';
            if (modifier === 'right') return 'fas fa-arrow-right';
            if (modifier === 'sharp left') return 'fas fa-arrow-turn-up';
            if (modifier === 'sharp right') return 'fas fa-arrow-turn-up';
            if (modifier === 'slight left') return 'fas fa-arrow-up-left';
            if (modifier === 'slight right') return 'fas fa-arrow-up-right';
        }

        if (type === 'roundabout') return 'fas fa-circle-notch';
        if (type === 'merge') return 'fas fa-code-branch';
        
        return 'fas fa-arrow-up';
    }

    /**
     * Advance to next navigation step
     */
    advanceToNextStep() {
        this.currentStepIndex++;
        
        if (this.currentStepIndex >= this.steps.length) {
            this.arriveAtDestination();
            return;
        }

        const nextStep = this.steps[this.currentStepIndex];
        this.speakInstruction(nextStep.instruction);
        this.lastSpokenInstruction = nextStep.instruction;
        
        console.log('➡️ Advanced to step', this.currentStepIndex);
    }

    /**
     * Handle arrival at destination
     */
    arriveAtDestination() {
        this.speakInstruction('You have arrived at your destination');
        this.showToast('You have arrived!', 'success');
        
        setTimeout(() => {
            this.stopNavigation();
        }, 3000);
    }

    /**
     * Handle off-route situation
     */
    handleOffRoute() {
        if (this.recalculationTimeout) return; // Already recalculating

        console.log('⚠️ Off route detected, recalculating...');
        this.showToast('Recalculating route...', 'warning');
        this.speakInstruction('Recalculating route');

        // Debounce recalculation
        this.recalculationTimeout = setTimeout(async () => {
            const destLatLng = this.destinationMarker.getLatLng();
            
            try {
                await this.calculateRoute(
                    this.currentPosition.lat,
                    this.currentPosition.lng,
                    destLatLng.lat,
                    destLatLng.lng
                );
                
                this.currentStepIndex = 0;
                this.lastSpokenInstruction = null;
                
                this.showToast('Route recalculated', 'success');
            } catch (error) {
                console.error('Recalculation error:', error);
                this.showToast('Failed to recalculate route', 'error');
            }
            
            this.recalculationTimeout = null;
        }, 3000);
    }

    /**
     * Calculate distance between two points (Haversine formula)
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    /**
     * Calculate distance to route line
     */
    calculateDistanceToRoute() {
        if (!this.routeGeometry || this.routeGeometry.length === 0) return 0;

        let minDistance = Infinity;

        for (let i = 0; i < this.routeGeometry.length - 1; i++) {
            const point1 = this.routeGeometry[i];
            const point2 = this.routeGeometry[i + 1];
            
            const distance = this.distanceToLineSegment(
                this.currentPosition.lat,
                this.currentPosition.lng,
                point1[1],
                point1[0],
                point2[1],
                point2[0]
            );

            minDistance = Math.min(minDistance, distance);
        }

        return minDistance;
    }

    /**
     * Calculate distance from point to line segment
     */
    distanceToLineSegment(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;

        if (lenSq !== 0) param = dot / lenSq;

        let xx, yy;

        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        return this.calculateDistance(px, py, xx, yy);
    }

    /**
     * Calculate distance traveled along route
     */
    calculateDistanceAlongRoute() {
        // Simplified: find closest point on route and sum distance to that point
        let closestIndex = 0;
        let minDistance = Infinity;

        for (let i = 0; i < this.routeGeometry.length; i++) {
            const point = this.routeGeometry[i];
            const distance = this.calculateDistance(
                this.currentPosition.lat,
                this.currentPosition.lng,
                point[1],
                point[0]
            );

            if (distance < minDistance) {
                minDistance = distance;
                closestIndex = i;
            }
        }

        // Calculate distance from start to closest point
        let distanceAlongRoute = 0;
        for (let i = 0; i < closestIndex; i++) {
            const point1 = this.routeGeometry[i];
            const point2 = this.routeGeometry[i + 1];
            distanceAlongRoute += this.calculateDistance(
                point1[1],
                point1[0],
                point2[1],
                point2[0]
            );
        }

        return distanceAlongRoute;
    }

    /**
     * Stop navigation
     */
    stopNavigation() {
        this.isNavigating = false;
        this.currentStepIndex = 0;
        this.lastSpokenInstruction = null;

        // Update UI - restore all panels
        this.restoreNavigationUI();
        
        this.elements.stopNavBtn.style.display = 'none';
        this.elements.toggleInfoBtn.style.display = 'none';
        this.elements.turnPanel.classList.remove('show');
        this.elements.progressBar.classList.remove('show');
        this.elements.speedIndicator.classList.remove('show');
        this.elements.nextTurnPreview.classList.remove('show');

        // Clear recalculation timeout
        if (this.recalculationTimeout) {
            clearTimeout(this.recalculationTimeout);
            this.recalculationTimeout = null;
        }

        // Remove route line and outline
        if (this.routeLine) {
            this.map.removeLayer(this.routeLine);
            this.routeLine = null;
        }
        if (this.routeOutline) {
            this.map.removeLayer(this.routeOutline);
            this.routeOutline = null;
        }

        // Remove destination marker
        if (this.destinationMarker) {
            this.map.removeLayer(this.destinationMarker);
            this.destinationMarker = null;
        }

        // Stop live weather updates
        this.stopLiveWeatherUpdates();

        // Hide weather panel
        this.hideWeather();

        // Reset inputs
        this.elements.destinationInput.value = '';
        this.elements.startNavBtn.disabled = true;

        this.showToast('Navigation stopped', 'info');
        console.log('🛑 Navigation stopped');
    }

    /**
     * Center map on user location
     */
    centerOnUser() {
        if (this.currentPosition) {
            this.map.setView([this.currentPosition.lat, this.currentPosition.lng], 17);
            this.elements.centerBtn.classList.add('active');
            setTimeout(() => this.elements.centerBtn.classList.remove('active'), 300);
        }
    }

    /**
     * Toggle voice guidance
     */
    toggleVoice() {
        this.voiceEnabled = !this.voiceEnabled;
        this.elements.voiceEnabled.checked = this.voiceEnabled;
        this.elements.voiceBtn.classList.toggle('active', this.voiceEnabled);
        
        const message = this.voiceEnabled ? 'Voice guidance enabled' : 'Voice guidance disabled';
        this.showToast(message, 'info');
        
        if (this.voiceEnabled) {
            this.speakInstruction('Voice guidance enabled');
        }
    }

    /**
     * Speak instruction using text-to-speech
     */
    speakInstruction(text) {
        if (!this.voiceEnabled || !this.synth) return;

        // Cancel any ongoing speech
        this.synth.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        utterance.lang = 'en-US';

        this.synth.speak(utterance);
        console.log('🔊 Speaking:', text);
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        
        const toast = document.createElement('div');
        toast.className = 'toast';
        
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };

        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        toast.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="fas ${icons[type]} me-2" style="color: ${colors[type]}; font-size: 20px;"></i>
                <span>${message}</span>
            </div>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    /**
     * Load all potholes from database
     */
    async loadPotholes() {
        try {
            const response = await axios.get('/api/potholes');
            
            if (response.data.success) {
                this.potholes = response.data.potholes || [];
                this.displayPotholes();
                console.log(`✅ Loaded ${this.potholes.length} potholes`);
            }
        } catch (error) {
            console.error('Error loading potholes:', error);
        }
    }

    /**
     * Display potholes on map
     */
    displayPotholes() {
        // Clear existing markers
        this.potholeMarkers.forEach(marker => this.map.removeLayer(marker));
        this.potholeMarkers = [];

        // Add markers for each pothole
        this.potholes.forEach(pothole => {
            const markerIcon = L.divIcon({
                className: `pothole-marker severity-${pothole.severity}`,
                html: '<i class="fas fa-exclamation-triangle"></i>',
                iconSize: [40, 40]
            });

            const marker = L.marker([pothole.latitude, pothole.longitude], { icon: markerIcon })
                .addTo(this.map);

            // Create popup content
            const popupContent = this.createPotholePopup(pothole);
            marker.bindPopup(popupContent);

            this.potholeMarkers.push(marker);
        });
    }

    /**
     * Create pothole popup content
     */
    createPotholePopup(pothole) {
        const severityLabels = {
            low: 'Low',
            medium: 'Medium',
            high: 'High',
            critical: 'Critical'
        };

        const date = new Date(pothole.timestamp).toLocaleDateString();
        const time = new Date(pothole.timestamp).toLocaleTimeString();

        let content = '<div class="pothole-popup">';
        
        // Photo
        if (pothole.photoUrl) {
            content += `<img src="${pothole.photoUrl}" alt="Pothole">`;
        }
        
        // Severity badge
        content += `<div class="severity-badge ${pothole.severity}">${severityLabels[pothole.severity]}</div>`;
        
        // Description
        if (pothole.description) {
            content += `<p style="margin: 8px 0;"><strong>Details:</strong><br>${pothole.description}</p>`;
        }
        
        // GPS validation status
        if (pothole.validatedByGPS) {
            content += `<p style="margin: 8px 0; color: #10b981;"><i class="fas fa-check-circle"></i> GPS Validated</p>`;
        }
        
        // Metadata
        if (pothole.photoMetadata && pothole.photoMetadata.camera) {
            content += `<p style="margin: 4px 0; font-size: 12px; color: #666;"><i class="fas fa-camera"></i> ${pothole.photoMetadata.camera}</p>`;
        }
        
        // Timestamp
        content += `<p style="margin: 4px 0; font-size: 12px; color: #666;"><i class="fas fa-clock"></i> ${date} ${time}</p>`;
        
        // Coordinates
        content += `<p style="margin: 4px 0; font-size: 11px; color: #999;">${pothole.latitude.toFixed(6)}, ${pothole.longitude.toFixed(6)}</p>`;
        
        content += '</div>';
        
        return content;
    }

    /**
     * Open pothole reporting modal
     */
    openPotholeModal() {
        if (!this.currentPosition) {
            this.showToast('Waiting for GPS location...', 'warning');
            return;
        }

        // Reset form
        document.getElementById('potholeForm').reset();
        this.elements.photoPreview.style.display = 'none';
        this.elements.validationWarning.style.display = 'none';
        this.elements.submitPotholeBtn.disabled = false;

        this.potholeModalInstance.show();
    }

    /**
     * Handle photo selection and validation
     */
    async handlePhotoSelection(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            this.elements.previewImage.src = e.target.result;
            this.elements.photoPreview.style.display = 'block';
        };
        reader.readAsDataURL(file);

        // Check for EXIF GPS data (client-side validation)
        try {
            const arrayBuffer = await file.arrayBuffer();
            const hasGPS = await this.checkPhotoGPS(arrayBuffer);
            
            if (hasGPS) {
                this.elements.gpsStatus.innerHTML = '<div class="alert alert-success mt-2"><i class="fas fa-check-circle me-2"></i>GPS data detected in photo!</div>';
                this.elements.validationWarning.style.display = 'none';
                this.elements.submitPotholeBtn.disabled = false;
            } else {
                this.elements.gpsStatus.innerHTML = '<div class="alert alert-danger mt-2"><i class="fas fa-times-circle me-2"></i>No GPS data found. Please take a new photo with location enabled.</div>';
                this.elements.validationWarning.style.display = 'block';
                this.elements.validationMessage.textContent = 'This photo does not contain GPS location data. Please enable location services in your camera and take a new photo.';
                this.elements.submitPotholeBtn.disabled = true;
            }
        } catch (error) {
            console.warn('Could not check EXIF data client-side:', error);
            this.elements.gpsStatus.innerHTML = '<div class="alert alert-warning mt-2"><i class="fas fa-info-circle me-2"></i>GPS validation will be performed on upload.</div>';
        }
    }

    /**
     * Check if photo has GPS data (client-side)
     */
    async checkPhotoGPS(arrayBuffer) {
        try {
            // Simple EXIF GPS check
            const view = new DataView(arrayBuffer);
            
            // Check JPEG marker
            if (view.getUint16(0) !== 0xFFD8) {
                return false; // Not a JPEG
            }
            
            // Look for EXIF data
            let offset = 2;
            while (offset < view.byteLength) {
                const marker = view.getUint16(offset);
                
                // APP1 marker (EXIF)
                if (marker === 0xFFE1) {
                    // Check for GPS tags in EXIF
                    const exifData = new Uint8Array(arrayBuffer.slice(offset, offset + 1000));
                    const exifString = String.fromCharCode.apply(null, exifData);
                    
                    // Look for GPS IFD
                    if (exifString.includes('GPS')) {
                        return true;
                    }
                }
                
                // Move to next marker
                const length = view.getUint16(offset + 2);
                offset += length + 2;
                
                // Avoid infinite loop
                if (offset > 100000) break;
            }
            
            return false;
        } catch (error) {
            console.error('Error checking GPS:', error);
            return false;
        }
    }

    /**
     * Submit pothole report
     */
    async submitPotholeReport() {
        const photoFile = this.elements.potholePhoto.files[0];
        
        if (!photoFile) {
            this.showToast('Please select a photo', 'error');
            return;
        }

        const severity = this.elements.potholeSeverity.value;
        const description = this.elements.potholeDescription.value;

        // Create form data
        const formData = new FormData();
        formData.append('photo', photoFile);
        formData.append('severity', severity);
        formData.append('description', description);

        // Show loading state
        this.elements.submitPotholeBtn.disabled = true;
        this.elements.submitPotholeBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Uploading...';

        try {
            const response = await axios.post('/api/pothole', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (response.data.success) {
                this.showToast('Pothole reported successfully!', 'success');
                
                // Add to map immediately
                this.potholes.push(response.data.pothole);
                this.displayPotholes();
                
                // Close modal
                this.potholeModalInstance.hide();
                
                // Speak confirmation
                if (this.voiceEnabled) {
                    this.speakInstruction('Pothole reported successfully');
                }
                
                console.log('✅ Pothole reported:', response.data.gpsInfo);
            } else {
                throw new Error(response.data.error || 'Upload failed');
            }

        } catch (error) {
            console.error('Error reporting pothole:', error);
            
            let errorMessage = 'Failed to report pothole';
            
            if (error.response && error.response.data) {
                const errorData = error.response.data;
                
                if (errorData.code === 'NO_GPS_DATA') {
                    errorMessage = 'Photo must have GPS location data. Please enable location services in your camera and take a new photo.';
                } else if (errorData.code === 'NO_PHOTO') {
                    errorMessage = 'Photo is required for reporting potholes.';
                } else if (errorData.code === 'INVALID_GPS') {
                    errorMessage = 'Invalid GPS coordinates in photo.';
                } else {
                    errorMessage = errorData.error || errorMessage;
                }
            }
            
            this.showToast(errorMessage, 'error');
            
            // Show in modal
            this.elements.validationWarning.style.display = 'block';
            this.elements.validationMessage.textContent = errorMessage;

        } finally {
            // Reset button
            this.elements.submitPotholeBtn.disabled = false;
            this.elements.submitPotholeBtn.innerHTML = '<i class="fas fa-upload me-2"></i>Report Pothole';
        }
    }

    /**
     * Search for places using Nominatim geocoding API
     */
    async searchPlaces(query, type = 'destination') {
        // Clear previous timeout
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }

        // Show loading
        if (type === 'start') {
            this.showStartSuggestionsLoading();
        } else {
            this.showSuggestionsLoading();
        }

        // Debounce search
        this.searchTimeout = setTimeout(async () => {
            try {
                // Use Nominatim API for geocoding (OpenStreetMap)
                const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=8`;
                
                const response = await axios.get(url, {
                    headers: {
                        'User-Agent': 'TurnByTurnNavigation/1.0'
                    }
                });

                if (type === 'start') {
                    this.startSuggestions = response.data;
                    this.displayStartSuggestions();
                } else {
                    this.suggestions = response.data;
                    this.displaySuggestions();
                }

            } catch (error) {
                console.error('Error searching places:', error);
                if (type === 'start') {
                    this.showStartSuggestionsError();
                } else {
                    this.showSuggestionsError();
                }
            }
        }, 300); // Wait 300ms after user stops typing
    }

    /**
     * Display suggestions dropdown for destination
     */
    displaySuggestions() {
        const dropdown = this.elements.suggestionsDropdown;
        
        if (this.suggestions.length === 0) {
            dropdown.innerHTML = '<div class="suggestion-no-results"><i class="fas fa-search me-2"></i>No results found</div>';
            dropdown.classList.add('show');
            return;
        }

        let html = '';
        this.suggestions.forEach((place, index) => {
            const icon = this.getPlaceIcon(place.type);
            const name = place.display_name.split(',')[0];
            const address = place.display_name;
            
            html += `
                <div class="suggestion-item" data-index="${index}">
                    <i class="fas ${icon} suggestion-icon"></i>
                    <span class="suggestion-name">${name}</span>
                    <span class="suggestion-address">${address}</span>
                </div>
            `;
        });

        dropdown.innerHTML = html;
        dropdown.classList.add('show');
        
        // Add click handlers to suggestions
        dropdown.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                this.selectSuggestion(index);
            });
        });

        this.selectedSuggestionIndex = -1;
    }

    /**
     * Get appropriate icon for place type
     */
    getPlaceIcon(type) {
        const iconMap = {
            'city': 'fa-city',
            'town': 'fa-building',
            'village': 'fa-home',
            'administrative': 'fa-landmark',
            'amenity': 'fa-map-marker-alt',
            'tourism': 'fa-monument',
            'highway': 'fa-road',
            'shop': 'fa-shopping-bag',
            'restaurant': 'fa-utensils',
            'hotel': 'fa-bed',
            'park': 'fa-tree',
            'hospital': 'fa-hospital',
            'school': 'fa-school',
            'default': 'fa-map-marker-alt'
        };

        if (Array.isArray(type)) {
            type = type[0];
        }

        return iconMap[type] || iconMap['default'];
    }

    /**
     * Show loading state in suggestions
     */
    showSuggestionsLoading() {
        const dropdown = this.elements.suggestionsDropdown;
        dropdown.innerHTML = '<div class="suggestion-loading"><i class="fas fa-spinner fa-spin me-2"></i>Searching...</div>';
        dropdown.classList.add('show');
    }

    /**
     * Show error in suggestions
     */
    showSuggestionsError() {
        const dropdown = this.elements.suggestionsDropdown;
        dropdown.innerHTML = '<div class="suggestion-no-results"><i class="fas fa-exclamation-circle me-2"></i>Search failed</div>';
        dropdown.classList.add('show');
    }

    /**
     * Hide suggestions dropdown
     */
    hideSuggestions() {
        this.elements.suggestionsDropdown.classList.remove('show');
        this.selectedSuggestionIndex = -1;
    }

    /**
     * Display suggestions dropdown for starting point
     */
    displayStartSuggestions() {
        const dropdown = this.elements.startSuggestionsDropdown;
        
        if (this.startSuggestions.length === 0) {
            dropdown.innerHTML = '<div class="suggestion-no-results"><i class="fas fa-search me-2"></i>No results found</div>';
            dropdown.classList.add('show');
            return;
        }

        let html = '';
        this.startSuggestions.forEach((place, index) => {
            const icon = this.getPlaceIcon(place.type);
            const name = place.display_name.split(',')[0];
            const address = place.display_name;
            
            html += `
                <div class="suggestion-item" data-index="${index}">
                    <i class="fas ${icon} suggestion-icon"></i>
                    <div class="suggestion-details">
                        <span class="suggestion-name">${name}</span>
                        <span class="suggestion-address">${address}</span>
                    </div>
                </div>
            `;
        });

        dropdown.innerHTML = html;
        dropdown.classList.add('show');

        // Add click handlers
        dropdown.querySelectorAll('.suggestion-item').forEach((item, index) => {
            item.addEventListener('click', () => this.selectStartingPoint(index));
        });
    }

    /**
     * Select starting point from suggestions
     */
    selectStartingPoint(index) {
        const place = this.startSuggestions[index];
        const lat = parseFloat(place.lat);
        const lng = parseFloat(place.lon);
        const name = place.display_name.split(',')[0];

        // Set custom starting point
        this.customStartingPoint = { lat, lng, name };
        this.elements.startingPointInput.value = name;
        
        // Uncheck "use current location"
        this.useGPSStart = false;
        this.elements.useCurrentLocation.checked = false;

        // Add marker for starting point
        if (this.startingPointMarker) {
            this.map.removeLayer(this.startingPointMarker);
        }

        const startIcon = L.divIcon({
            html: '<div style="background:#4285F4; border:3px solid white; border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; color:white; font-size:12px; box-shadow:0 2px 8px rgba(0,0,0,0.3);"><i class="fas fa-play"></i></div>',
            className: 'custom-start-marker',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });

        this.startingPointMarker = L.marker([lat, lng], { icon: startIcon })
            .addTo(this.map)
            .bindPopup(`<b>Starting Point</b><br>${name}`)
            .openPopup();

        // Hide suggestions
        this.hideStartSuggestions();
        
        console.log('📍 Custom starting point set:', lat, lng);
    }

    /**
     * Show loading state in start suggestions
     */
    showStartSuggestionsLoading() {
        const dropdown = this.elements.startSuggestionsDropdown;
        dropdown.innerHTML = '<div class="suggestion-loading"><i class="fas fa-spinner fa-spin me-2"></i>Searching...</div>';
        dropdown.classList.add('show');
    }

    /**
     * Show error in start suggestions
     */
    showStartSuggestionsError() {
        const dropdown = this.elements.startSuggestionsDropdown;
        dropdown.innerHTML = '<div class="suggestion-no-results"><i class="fas fa-exclamation-circle me-2"></i>Search failed</div>';
        dropdown.classList.add('show');
    }

    /**
     * Hide start suggestions dropdown
     */
    hideStartSuggestions() {
        this.elements.startSuggestionsDropdown.classList.remove('show');
    }

    /**
     * Navigate through suggestions with keyboard
     */
    navigateSuggestions(direction) {
        const items = this.elements.suggestionsDropdown.querySelectorAll('.suggestion-item');
        if (items.length === 0) return;

        // Remove previous highlight
        if (this.selectedSuggestionIndex >= 0) {
            items[this.selectedSuggestionIndex].style.background = '';
        }

        // Update index
        if (direction === 'down') {
            this.selectedSuggestionIndex = Math.min(this.selectedSuggestionIndex + 1, items.length - 1);
        } else {
            this.selectedSuggestionIndex = Math.max(this.selectedSuggestionIndex - 1, 0);
        }

        // Highlight current item
        items[this.selectedSuggestionIndex].style.background = '#f8f9ff';
        items[this.selectedSuggestionIndex].scrollIntoView({ block: 'nearest' });
    }

    /**
     * Select currently highlighted suggestion
     */
    selectCurrentSuggestion() {
        if (this.selectedSuggestionIndex >= 0 && this.selectedSuggestionIndex < this.suggestions.length) {
            this.selectSuggestion(this.selectedSuggestionIndex);
        } else if (!this.elements.startNavBtn.disabled) {
            this.startNavigation();
        }
    }

    /**
     * Select a suggestion from the list
     */
    selectSuggestion(index) {
        const place = this.suggestions[index];
        
        // Update input
        this.elements.destinationInput.value = place.display_name;
        
        // Set destination on map
        const lat = parseFloat(place.lat);
        const lng = parseFloat(place.lon);
        const locationName = place.display_name.split(',')[0];
        
        this.setDestination(lat, lng, locationName);
        
        // Hide suggestions
        this.hideSuggestions();
        
        // Enable start button
        this.elements.startNavBtn.disabled = false;
        
        // Center map on selected place
        this.map.setView([lat, lng], 15);
        
        this.showToast('Destination set: ' + locationName, 'success');
    }

    /**
     * Fetch weather data for location
     */
    async fetchWeather(lat, lng, locationName, isUpdate = false) {
        try {
            if (!isUpdate) {
                console.log('🌤️ Fetching weather for:', locationName, 'at', lat, lng);
                
                // Show weather panel with loading state on first load
                this.elements.weatherPanel.classList.add('show');
                this.elements.weatherLoading.style.display = 'block';
                this.elements.weatherContent.style.display = 'none';
            } else {
                console.log('🔄 Updating live weather data...');
            }

            // Store location for live updates
            this.weatherLocation = { lat, lng, name: locationName };

            // Use backend proxy to avoid CORS issues
            const url = `/api/weather?lat=${lat}&lon=${lng}`;
            
            const response = await axios.get(url);
            
            if (!response.data.success) {
                throw new Error(response.data.error || 'Weather fetch failed');
            }
            
            this.currentWeather = response.data.data;
            this.lastWeatherUpdate = new Date();
            
            console.log('✅ Weather data received:', this.currentWeather);
            
            this.displayWeather(locationName);
            
            if (!isUpdate) {
                console.log('✅ Weather displayed successfully');
                // Start live weather updates every 5 minutes
                this.startLiveWeatherUpdates();
            } else {
                console.log('✅ Live weather updated');
            }

        } catch (error) {
            console.error('❌ Error fetching weather:', error);
            console.error('Error details:', error.response?.data || error.message);
            
            if (!isUpdate) {
                this.elements.weatherPanel.classList.add('show');
                this.elements.weatherLoading.style.display = 'block';
                this.elements.weatherLoading.innerHTML = '<i class="fas fa-exclamation-circle"></i><br><small>Weather unavailable</small>';
            }
        }
    }

    /**
     * Start live weather updates
     */
    startLiveWeatherUpdates() {
        // Clear any existing interval
        this.stopLiveWeatherUpdates();
        
        // Update weather every 30 seconds for fast live updates
        this.weatherUpdateInterval = setInterval(() => {
            if (this.weatherLocation) {
                console.log('⏰ Auto-updating weather (every 30 seconds)');
                this.fetchWeather(
                    this.weatherLocation.lat,
                    this.weatherLocation.lng,
                    this.weatherLocation.name,
                    true // isUpdate flag
                );
            }
        }, 30000); // 30 seconds

        // Update timestamp display every 5 seconds
        this.weatherTimestampInterval = setInterval(() => {
            this.updateWeatherTimestamp();
        }, 5000); // 5 seconds
        
        // Add live indicator pulsing animation
        if (this.elements.weatherLiveIcon) {
            this.elements.weatherLiveIcon.style.display = 'inline-block';
        }
        
        console.log('📡 Live weather updates started (refreshing every 30 seconds)');
    }

    /**
     * Stop live weather updates
     */
    stopLiveWeatherUpdates() {
        if (this.weatherUpdateInterval) {
            clearInterval(this.weatherUpdateInterval);
            this.weatherUpdateInterval = null;
            console.log('📡 Live weather updates stopped');
        }
        if (this.weatherTimestampInterval) {
            clearInterval(this.weatherTimestampInterval);
            this.weatherTimestampInterval = null;
        }
        if (this.elements.weatherLiveIcon) {
            this.elements.weatherLiveIcon.style.display = 'none';
        }
    }

    /**
     * Manually refresh weather now
     */
    refreshWeatherNow() {
        if (!this.weatherLocation) {
            this.showToast('No location set for weather', 'warning');
            return;
        }

        // Add spinning animation to button
        const icon = this.elements.refreshWeatherBtn.querySelector('i');
        icon.classList.add('fa-spin');
        
        // Fetch weather
        this.fetchWeather(
            this.weatherLocation.lat,
            this.weatherLocation.lng,
            this.weatherLocation.name,
            true
        ).then(() => {
            // Remove spinning animation
            setTimeout(() => {
                icon.classList.remove('fa-spin');
            }, 500);
            
            this.showToast('Weather refreshed', 'success');
        }).catch(() => {
            icon.classList.remove('fa-spin');
        });
    }

    /**
     * Display weather information
     */
    displayWeather(locationName) {
        console.log('🎨 Displaying weather for:', locationName);
        
        if (!this.currentWeather) {
            console.error('❌ No weather data to display');
            return;
        }

        const weather = this.currentWeather;
        console.log('Weather object:', weather);

        // Hide loading, show content
        this.elements.weatherLoading.style.display = 'none';
        this.elements.weatherContent.style.display = 'block';

        // Show weather panel
        this.elements.weatherPanel.classList.add('show');

        // Location name
        this.elements.weatherLocation.textContent = locationName;

        // Temperature
        this.elements.weatherTemp.textContent = Math.round(weather.main.temp) + '°C';

        // Weather description
        this.elements.weatherDesc.textContent = weather.weather[0].description;

        // Weather icon
        const iconClass = this.getWeatherIcon(weather.weather[0].main, weather.weather[0].id);
        this.elements.weatherIcon.innerHTML = `<i class="${iconClass}"></i>`;

        // Humidity
        this.elements.weatherHumidity.textContent = weather.main.humidity;

        // Wind speed
        const windSpeed = Math.round(weather.wind.speed * 3.6); // m/s to km/h
        this.elements.weatherWind.textContent = windSpeed;

        // Visibility
        const visibility = (weather.visibility / 1000).toFixed(1);
        this.elements.weatherVisibility.textContent = visibility;

        // Update last update time
        this.updateWeatherTimestamp();

        // Show live indicator
        if (this.elements.weatherLiveIcon) {
            this.elements.weatherLiveIcon.style.display = 'inline-block';
        }

        // Weather alerts
        this.checkWeatherAlerts(weather);

        console.log('✅ Weather display updated successfully');
    }

    /**
     * Update weather timestamp display
     */
    updateWeatherTimestamp() {
        if (!this.lastWeatherUpdate) return;

        const now = new Date();
        const diff = Math.floor((now - this.lastWeatherUpdate) / 1000); // seconds

        let timeText = '';
        if (diff < 60) {
            timeText = 'Updated just now';
        } else if (diff < 3600) {
            const minutes = Math.floor(diff / 60);
            timeText = `Updated ${minutes} min${minutes > 1 ? 's' : ''} ago`;
        } else {
            const hours = Math.floor(diff / 3600);
            timeText = `Updated ${hours} hour${hours > 1 ? 's' : ''} ago`;
        }

        if (this.elements.weatherLastUpdate) {
            this.elements.weatherLastUpdate.textContent = timeText;
        }
    }

    /**
     * Get appropriate weather icon
     */
    getWeatherIcon(main, id) {
        // Thunderstorm
        if (id >= 200 && id < 300) return 'fas fa-bolt';
        
        // Drizzle
        if (id >= 300 && id < 400) return 'fas fa-cloud-rain';
        
        // Rain
        if (id >= 500 && id < 600) {
            if (id === 511) return 'fas fa-snowflake'; // Freezing rain
            return 'fas fa-cloud-showers-heavy';
        }
        
        // Snow
        if (id >= 600 && id < 700) return 'fas fa-snowflake';
        
        // Atmosphere (fog, mist, etc.)
        if (id >= 700 && id < 800) return 'fas fa-smog';
        
        // Clear
        if (id === 800) return 'fas fa-sun';
        
        // Clouds
        if (id > 800) {
            if (id === 801) return 'fas fa-cloud-sun';
            if (id === 802) return 'fas fa-cloud';
            return 'fas fa-cloud';
        }

        return 'fas fa-cloud';
    }

    /**
     * Check for weather alerts and warnings
     */
    checkWeatherAlerts(weather) {
        const alerts = [];

        // Heavy rain
        if (weather.weather[0].id >= 500 && weather.weather[0].id < 600) {
            if (weather.rain && weather.rain['1h'] > 7.6) {
                alerts.push('Heavy rain expected - Drive carefully');
            } else {
                alerts.push('Rainy conditions - Reduce speed');
            }
        }

        // Thunderstorm
        if (weather.weather[0].id >= 200 && weather.weather[0].id < 300) {
            alerts.push('Thunderstorm warning - Consider delaying travel');
        }

        // Snow
        if (weather.weather[0].id >= 600 && weather.weather[0].id < 700) {
            alerts.push('Snow conditions - Road may be slippery');
        }

        // Fog/Mist - Low visibility
        if (weather.visibility < 1000) {
            alerts.push('Poor visibility - Use fog lights');
        }

        // Strong wind
        if (weather.wind.speed > 10) { // > 36 km/h
            alerts.push('Strong winds - Drive cautiously');
        }

        // Extreme temperature
        if (weather.main.temp > 40) {
            alerts.push('Extreme heat - Stay hydrated');
        } else if (weather.main.temp < 0) {
            alerts.push('Freezing temperature - Watch for ice');
        }

        // Display alerts
        if (alerts.length > 0) {
            this.elements.weatherAlert.style.display = 'flex';
            this.elements.weatherAlertText.textContent = alerts[0];
            
            // Speak weather warning if voice enabled
            if (this.voiceEnabled) {
                this.speakInstruction('Weather alert: ' + alerts[0]);
            }
        } else {
            this.elements.weatherAlert.style.display = 'none';
        }
    }

    /**
     * Hide weather panel
     */
    hideWeather() {
        this.elements.weatherPanel.classList.remove('show');
    }

    /**
     * Minimize navigation UI for clean driving view
     */
    minimizeNavigationUI() {
        // Use setTimeout to ensure panels are shown first before minimizing
        setTimeout(() => {
            // Minimize all info panels
            this.elements.inputPanel.classList.add('minimized');
            this.elements.navHeader.classList.add('minimized');
            this.elements.routeInfo.classList.add('minimized');
            this.elements.weatherPanel.classList.add('minimized');
            
            this.infoPanelsMinimized = true;
            
            // Update toggle button icon
            this.elements.toggleInfoBtn.innerHTML = '<i class="fas fa-eye"></i>';
            this.elements.toggleInfoBtn.title = 'Show info panels';
            
            console.log('📱 Navigation UI minimized for clean view');
        }, 100);
    }

    /**
     * Restore navigation UI panels
     */
    restoreNavigationUI() {
        // Restore all panels
        this.elements.inputPanel.classList.remove('minimized', 'hidden');
        this.elements.navHeader.classList.remove('minimized', 'active');
        this.elements.routeInfo.classList.remove('minimized', 'show');
        this.elements.weatherPanel.classList.remove('minimized');
        
        this.infoPanelsMinimized = false;
        
        console.log('📱 Navigation UI restored');
    }

    /**
     * Toggle info panels visibility during navigation
     */
    toggleInfoPanels() {
        if (this.infoPanelsMinimized) {
            // Show panels
            this.elements.navHeader.classList.remove('minimized');
            this.elements.navHeader.classList.add('active');
            this.elements.routeInfo.classList.remove('minimized');
            this.elements.routeInfo.classList.add('show');
            this.elements.weatherPanel.classList.remove('minimized');
            
            this.infoPanelsMinimized = false;
            
            // Update button
            this.elements.toggleInfoBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
            this.elements.toggleInfoBtn.title = 'Hide info panels';
            this.elements.toggleInfoBtn.classList.add('active');
            
            this.showToast('Info panels shown', 'info');
        } else {
            // Hide panels
            this.elements.navHeader.classList.add('minimized');
            this.elements.routeInfo.classList.add('minimized');
            this.elements.weatherPanel.classList.add('minimized');
            
            this.infoPanelsMinimized = true;
            
            // Update button
            this.elements.toggleInfoBtn.innerHTML = '<i class="fas fa-eye"></i>';
            this.elements.toggleInfoBtn.title = 'Show info panels';
            this.elements.toggleInfoBtn.classList.remove('active');
            
            this.showToast('Info panels hidden', 'info');
        }
    }
}

// Initialize navigation system when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.navigation = new TurnByTurnNavigation();
});

// Initialize navigation system when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.navigation = new TurnByTurnNavigation();
});
