/**
 * Original Pothole Reporting System - JavaScript
 * 
 * This file handles:
 * - Leaflet map initialization
 * - Location detection and display
 * - Pothole reporting form
 * - File uploads with EXIF data
 * - Map interactions
 */

class PotholeReportingSystem {
    constructor() {
        // Map and location state
        this.map = null;
        this.currentLocation = null;
        this.userLocationMarker = null;
        this.potholeMarkers = [];
        
        // Form state
        this.selectedSeverity = 'medium';
        this.selectedFile = null;
        
        // Initialize the system
        this.init();
    }

    /**
     * Initialize the pothole reporting system
     */
    async init() {
        try {
            console.log('🚀 Initializing Pothole Reporting System...');
            
            // Initialize map
            this.initMap();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Get user location
            this.getCurrentLocation();
            
            // Load existing potholes
            this.loadPotholes();
            
            this.showToast('Pothole Reporting System ready!', 'success');
            
        } catch (error) {
            console.error('❌ System initialization failed:', error);
            this.showToast('Failed to initialize system. Please refresh the page.', 'error');
        }
    }

    /**
     * Initialize Leaflet map
     */
    initMap() {
        // Create map centered on India
        this.map = L.map('map', {
            zoomControl: true,
            attributionControl: true
        }).setView([20.5937, 78.9629], 5);

        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);

        // Add click handler for adding potholes
        this.map.on('click', (e) => {
            this.handleMapClick(e);
        });

        console.log('✅ Map initialized');
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Sidebar toggle
        $('#toggleSidebar').on('click', () => this.toggleSidebar());

        // Location controls
        $('#locateBtn').on('click', () => this.getCurrentLocation());
        $('#refreshLocationBtn').on('click', () => this.getCurrentLocation());
        $('#clearMapBtn').on('click', () => this.clearMap());

        // Severity selection
        $('.severity-btn').on('click', (e) => this.selectSeverity(e));

        // File upload
        $('#uploadZone').on('click', () => $('#photoInput').click());
        $('#photoInput').on('change', (e) => this.handleFileSelect(e));
        
        // Drag and drop
        const uploadZone = document.getElementById('uploadZone');
        uploadZone.addEventListener('dragover', (e) => this.handleDragOver(e));
        uploadZone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        uploadZone.addEventListener('drop', (e) => this.handleFileDrop(e));

        // Form submission
        $('#potholeForm').on('submit', (e) => this.handleFormSubmit(e));

        console.log('✅ Event listeners setup');
    }

    /**
     * Get user's current location
     */
    getCurrentLocation() {
        if (!navigator.geolocation) {
            this.showToast('Geolocation is not supported by this browser', 'error');
            return;
        }

        $('#currentCoordinates').text('Getting location...');
        $('#currentAddress').text('Please wait...');

        const options = {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 60000
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const accuracy = position.coords.accuracy;

                this.currentLocation = { lat, lng, accuracy };

                // Update location display
                $('#currentCoordinates').text(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
                $('#locationAccuracy').text(`±${Math.round(accuracy)}m`);

                // Set accuracy badge color
                const accuracyBadge = $('#locationAccuracy');
                if (accuracy <= 10) {
                    accuracyBadge.removeClass('bg-warning bg-danger').addClass('bg-success');
                } else if (accuracy <= 50) {
                    accuracyBadge.removeClass('bg-success bg-danger').addClass('bg-warning');
                } else {
                    accuracyBadge.removeClass('bg-success bg-warning').addClass('bg-danger');
                }

                // Center map on user location
                this.map.setView([lat, lng], 16);

                // Add/update user location marker
                this.updateUserLocationMarker(lat, lng);

                // Get address
                this.reverseGeocode(lat, lng);

                this.showToast(`Location found with ${Math.round(accuracy)}m accuracy!`, 'success');
            },
            (error) => {
                let errorMessage = 'Could not get your location. ';
                
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage += 'Location access denied.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage += 'Location information unavailable.';
                        break;
                    case error.TIMEOUT:
                        errorMessage += 'Location request timed out.';
                        break;
                    default:
                        errorMessage += 'An unknown error occurred.';
                        break;
                }
                
                $('#currentCoordinates').text('Location unavailable');
                $('#currentAddress').text(errorMessage);
                
                this.showToast(errorMessage, 'error');
            },
            options
        );
    }

    /**
     * Update user location marker
     */
    updateUserLocationMarker(lat, lng) {
        if (this.userLocationMarker) {
            this.map.removeLayer(this.userLocationMarker);
        }

        this.userLocationMarker = L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'current-location-marker',
                html: '<i class="fas fa-location-arrow"></i>',
                iconSize: [20, 20],
                iconAnchor: [10, 20]
            })
        }).addTo(this.map);

        this.userLocationMarker.bindPopup(`
            <div>
                <strong>Your Location</strong><br>
                ${lat.toFixed(6)}, ${lng.toFixed(6)}
            </div>
        `);
    }

    /**
     * Reverse geocode coordinates to address
     */
    async reverseGeocode(lat, lng) {
        try {
            const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
            
            if (response.ok) {
                const data = await response.json();
                
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
                
                $('#currentAddress').text(address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
            }
        } catch (error) {
            console.warn('Reverse geocoding failed:', error);
            $('#currentAddress').text(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        }
    }

    /**
     * Handle severity selection
     */
    selectSeverity(e) {
        e.preventDefault();
        
        const button = $(e.currentTarget);
        const severity = button.data('severity');
        
        // Update UI
        $('.severity-btn').removeClass('active');
        button.addClass('active');
        
        // Update state
        this.selectedSeverity = severity;
        $('#severityInput').val(severity);
    }

    /**
     * Handle file selection
     */
    handleFileSelect(e) {
        const file = e.target.files[0];
        this.processSelectedFile(file);
    }

    /**
     * Handle drag over
     */
    handleDragOver(e) {
        e.preventDefault();
        $('#uploadZone').addClass('dragover');
    }

    /**
     * Handle drag leave
     */
    handleDragLeave(e) {
        e.preventDefault();
        $('#uploadZone').removeClass('dragover');
    }

    /**
     * Handle file drop
     */
    handleFileDrop(e) {
        e.preventDefault();
        $('#uploadZone').removeClass('dragover');
        
        const file = e.dataTransfer.files[0];
        this.processSelectedFile(file);
    }

    /**
     * Process selected file
     */
    processSelectedFile(file) {
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            this.showToast('Please select an image file', 'error');
            return;
        }

        // Validate file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
            this.showToast('File size must be less than 5MB', 'error');
            return;
        }

        this.selectedFile = file;

        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            $('#imagePreview').html(`
                <img src="${e.target.result}" class="preview-image" alt="Preview">
                <div class="mt-2">
                    <small class="text-muted">${file.name} (${(file.size / 1024).toFixed(1)} KB)</small>
                    <button type="button" class="btn btn-sm btn-outline-danger ms-2" onclick="potholeSystem.clearFile()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `);
        };
        reader.readAsDataURL(file);

        this.showToast('Image selected successfully', 'success');
    }

    /**
     * Clear selected file
     */
    clearFile() {
        this.selectedFile = null;
        $('#photoInput').val('');
        $('#imagePreview').empty();
    }

    /**
     * Handle form submission
     */
    async handleFormSubmit(e) {
        e.preventDefault();

        if (!this.currentLocation) {
            this.showToast('Please wait for location to be detected', 'warning');
            return;
        }

        const formData = new FormData();
        formData.append('latitude', this.currentLocation.lat);
        formData.append('longitude', this.currentLocation.lng);
        formData.append('severity', this.selectedSeverity);
        formData.append('description', $('#description').val());
        
        if (this.selectedFile) {
            formData.append('photo', this.selectedFile);
        }

        try {
            // Show loading
            this.showLoading(true);

            const response = await fetch('/api/pothole', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                this.showToast('Pothole reported successfully!', 'success');
                
                // Add marker to map
                this.addPotholeMarker(result.pothole);
                
                // Reset form
                this.resetForm();
                
                // Refresh recent reports
                this.loadRecentReports();
            } else {
                throw new Error(result.error || 'Failed to report pothole');
            }

        } catch (error) {
            console.error('Upload error:', error);
            this.showToast('Failed to report pothole: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Reset form
     */
    resetForm() {
        $('#potholeForm')[0].reset();
        this.clearFile();
        this.selectedSeverity = 'medium';
        $('.severity-btn').removeClass('active');
        $('.severity-btn[data-severity="medium"]').addClass('active');
        $('#severityInput').val('medium');
    }

    /**
     * Load existing potholes
     */
    async loadPotholes() {
        try {
            const response = await fetch('/api/potholes');
            const result = await response.json();

            if (result.success && result.potholes) {
                result.potholes.forEach(pothole => {
                    this.addPotholeMarker(pothole);
                });
                console.log(`✅ Loaded ${result.potholes.length} potholes`);
            }
        } catch (error) {
            console.warn('Failed to load existing potholes:', error);
        }
    }

    /**
     * Add pothole marker to map
     */
    addPotholeMarker(pothole) {
        const severityColors = {
            low: '#28a745',
            medium: '#ffc107', 
            high: '#dc3545'
        };

        const marker = L.marker([pothole.latitude, pothole.longitude], {
            icon: L.divIcon({
                className: 'pothole-marker',
                html: `<i class="fas fa-exclamation-triangle" style="color: ${severityColors[pothole.severity]}"></i>`,
                iconSize: [20, 20],
                iconAnchor: [10, 20]
            })
        }).addTo(this.map);

        const popupContent = `
            <div>
                <strong>Pothole Report</strong><br>
                <strong>Severity:</strong> ${pothole.severity.toUpperCase()}<br>
                ${pothole.description ? `<strong>Description:</strong> ${pothole.description}<br>` : ''}
                <strong>Reported:</strong> ${new Date(pothole.timestamp).toLocaleString()}
                ${pothole.photoUrl ? `<br><img src="${pothole.photoUrl}" style="max-width: 200px; margin-top: 5px;">` : ''}
            </div>
        `;

        marker.bindPopup(popupContent);
        this.potholeMarkers.push(marker);
    }

    /**
     * Load recent reports
     */
    async loadRecentReports() {
        try {
            const response = await fetch('/api/potholes/recent');
            const result = await response.json();

            if (result.success && result.potholes) {
                const recentContainer = $('#recentReports');
                
                if (result.potholes.length === 0) {
                    recentContainer.html('<div class="text-muted small">No recent reports</div>');
                    return;
                }

                let html = '';
                result.potholes.forEach(pothole => {
                    const timeAgo = this.getTimeAgo(new Date(pothole.timestamp));
                    html += `
                        <div class="small mb-2 p-2 bg-light rounded">
                            <div class="d-flex justify-content-between">
                                <span class="badge bg-${pothole.severity === 'high' ? 'danger' : pothole.severity === 'medium' ? 'warning' : 'success'}">${pothole.severity}</span>
                                <span class="text-muted">${timeAgo}</span>
                            </div>
                            ${pothole.description ? `<div class="mt-1">${pothole.description.substring(0, 50)}...</div>` : ''}
                        </div>
                    `;
                });

                recentContainer.html(html);
            }
        } catch (error) {
            console.warn('Failed to load recent reports:', error);
        }
    }

    /**
     * Get time ago string
     */
    getTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    }

    /**
     * Handle map click
     */
    handleMapClick(e) {
        // You can implement click-to-add functionality here if needed
        console.log('Map clicked at:', e.latlng);
    }

    /**
     * Toggle sidebar
     */
    toggleSidebar() {
        $('#sidebarPanel').toggleClass('show');
    }

    /**
     * Clear map
     */
    clearMap() {
        // Remove all pothole markers
        this.potholeMarkers.forEach(marker => {
            this.map.removeLayer(marker);
        });
        this.potholeMarkers = [];
        
        this.showToast('Map cleared', 'info');
    }

    /**
     * Show loading state
     */
    showLoading(show) {
        if (show) {
            $('#loadingOverlay').removeClass('d-none');
        } else {
            $('#loadingOverlay').addClass('d-none');
        }
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        const toastEl = document.getElementById('liveToast');
        const toast = new bootstrap.Toast(toastEl);
        
        // Update toast content
        const toastHeader = toastEl.querySelector('.toast-header i');
        const toastMessage = document.getElementById('toastMessage');
        
        // Set icon and color based on type
        const config = {
            success: { icon: 'fa-check-circle', class: 'text-success' },
            error: { icon: 'fa-exclamation-circle', class: 'text-danger' },
            warning: { icon: 'fa-exclamation-triangle', class: 'text-warning' },
            info: { icon: 'fa-info-circle', class: 'text-primary' }
        };
        
        const typeConfig = config[type] || config.info;
        toastHeader.className = `fas ${typeConfig.icon} me-2 ${typeConfig.class}`;
        toastMessage.textContent = message;
        
        toast.show();
    }
}

// Initialize system when DOM is ready
let potholeSystem;

if (typeof $ !== 'undefined') {
    $(document).ready(() => {
        potholeSystem = new PotholeReportingSystem();
    });
} else {
    document.addEventListener('DOMContentLoaded', () => {
        potholeSystem = new PotholeReportingSystem();
    });
}