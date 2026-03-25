/**
 * Weather Layers for APRS Weather Map
 * Implements RainViewer radar and OpenWeatherMap tile layers
 */

// ========================================
// RainViewer Weather Radar
// ========================================
var RainViewer = {
    API_URL: "https://api.rainviewer.com/public/weather-maps.json",
    TILE_SIZE: window.devicePixelRatio >= 2 ? 512 : 256,
    COLOR_SCHEME: 2, // Universal Blue
    SMOOTH: 1,
    SNOW: 1,
    
    apiData: null,
    frames: [],
    currentFrame: 0,
    radarLayer: null,
    animationTimer: null,
    isPlaying: false,
    opacity: 0.6,
    
    init: function(map) {
        this.map = map;
        console.log('RainViewer: Initializing...');
        this.loadData();
    },
    
    loadData: function() {
        var self = this;
        console.log('RainViewer: Fetching API data...');
        $.ajax({
            url: this.API_URL,
            type: 'GET',
            dataType: 'json',
            success: function(data) {
                self.apiData = data;
                self.frames = data.radar.past || [];
                console.log('RainViewer: Loaded ' + self.frames.length + ' radar frames');
                console.log('RainViewer: Host =', data.host);
                if (self.frames.length > 0) {
                    self.currentFrame = self.frames.length - 1; // Start with latest
                    console.log('RainViewer: Latest frame =', self.frames[self.currentFrame].path);
                }
            },
            error: function(xhr, status, error) {
                console.error('RainViewer: Failed to load data:', error);
            }
        });
    },
    
    createLayer: function(frame) {
        if (!this.apiData || !frame) return null;
        
        var url = this.apiData.host + frame.path + '/' + this.TILE_SIZE + 
                  '/{z}/{x}/{y}/' + this.COLOR_SCHEME + '/' + 
                  this.SMOOTH + '_' + this.SNOW + '.png';
        
        return L.tileLayer(url, {
            tileSize: 256,
            opacity: this.opacity,
            maxNativeZoom: 7,
            maxZoom: 18,
            attribution: '<a href="https://www.rainviewer.com/" target="_blank">RainViewer</a>'
        });
    },
    
    showFrame: function(index) {
        if (!this.frames.length) {
            console.warn('RainViewer: No frames available');
            return;
        }
        
        // Wrap index
        while (index >= this.frames.length) index -= this.frames.length;
        while (index < 0) index += this.frames.length;
        
        this.currentFrame = index;
        var frame = this.frames[index];
        
        console.log('RainViewer: Showing frame', index, frame.path);
        
        // Remove existing layer
        if (this.radarLayer) {
            this.map.removeLayer(this.radarLayer);
        }
        
        // Add new layer
        this.radarLayer = this.createLayer(frame);
        if (this.radarLayer) {
            this.radarLayer.addTo(this.map);
            console.log('RainViewer: Layer added to map');
        }
        
        // Update timestamp display
        this.updateTimestamp(frame.time);
    },
    
    updateTimestamp: function(unixTime) {
        var date = new Date(unixTime * 1000);
        var timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        $('#radar-timestamp').text(timeStr);
    },
    
    show: function() {
        if (this.frames.length > 0) {
            console.log('RainViewer: Showing latest frame (not animating)');
            this.showFrame(this.currentFrame);
        } else {
            console.warn('RainViewer: No frames loaded yet');
        }
    },
    
    hide: function() {
        this.stop();
        if (this.radarLayer) {
            this.map.removeLayer(this.radarLayer);
            this.radarLayer = null;
        }
        console.log('RainViewer: Hidden');
    },
    
    play: function() {
        if (this.isPlaying) return;
        if (!this.frames.length) {
            console.warn('RainViewer: No frames to animate');
            return;
        }
        this.isPlaying = true;
        var playBtn = document.getElementById('radar-play-btn');
        if (playBtn) playBtn.textContent = 'Pause';
        console.log('RainViewer: Starting animation');
        this.animate();
    },
    
    stop: function() {
        this.isPlaying = false;
        if (this.animationTimer) {
            clearTimeout(this.animationTimer);
            this.animationTimer = null;
        }
        var playBtn = document.getElementById('radar-play-btn');
        if (playBtn) playBtn.textContent = 'Play';
        console.log('RainViewer: Stopped animation');
    },
    
    toggle: function() {
        if (this.isPlaying) {
            this.stop();
        } else {
            this.play();
        }
    },
    
    animate: function() {
        var self = this;
        if (!this.isPlaying) return;
        
        this.showFrame(this.currentFrame + 1);
        
        // Slower animation to avoid rate limiting - 1 second between frames
        this.animationTimer = setTimeout(function() {
            self.animate();
        }, 1000);
    },
    
    prev: function() {
        this.stop();
        this.showFrame(this.currentFrame - 1);
    },
    
    next: function() {
        this.stop();
        this.showFrame(this.currentFrame + 1);
    },
    
    setOpacity: function(value) {
        this.opacity = value;
        if (this.radarLayer) {
            this.radarLayer.setOpacity(value);
        }
    }
};

// ========================================
// OpenWeatherMap Tile Layers
// ========================================
var OpenWeatherMapLayers = {
    apiKey: null, // Set via init
    layers: {},
    currentLayer: null,
    
    LAYER_TYPES: {
        precipitation: { name: 'Precipitation', layer: 'precipitation_new' },
        clouds: { name: 'Clouds', layer: 'clouds_new' },
        temperature: { name: 'Temperature', layer: 'temp_new' },
        wind: { name: 'Wind Speed', layer: 'wind_new' },
        pressure: { name: 'Pressure', layer: 'pressure_new' }
    },
    
    init: function(map, apiKey) {
        this.map = map;
        this.apiKey = apiKey;
        
        console.log('OpenWeatherMap: Initializing with API key:', apiKey ? apiKey.substring(0, 8) + '...' : 'NONE');
        
        if (!apiKey) {
            console.warn('OpenWeatherMap: No API key provided');
            return;
        }
        
        // Pre-create all layers
        for (var key in this.LAYER_TYPES) {
            this.layers[key] = this.createLayer(this.LAYER_TYPES[key].layer);
            console.log('OpenWeatherMap: Created layer', key);
        }
    },
    
    createLayer: function(layerName) {
        var url = 'https://tile.openweathermap.org/map/' + layerName + '/{z}/{x}/{y}.png?appid=' + this.apiKey;
        console.log('OpenWeatherMap: Layer URL pattern:', url.replace(this.apiKey, 'API_KEY'));
        return L.tileLayer(url,
            {
                maxZoom: 18,
                opacity: 0.6,
                attribution: '<a href="https://openweathermap.org/" target="_blank">OpenWeatherMap</a>'
            }
        );
    },
    
    show: function(type) {
        console.log('OpenWeatherMap: Showing layer', type);
        
        // Hide current layer if different
        if (this.currentLayer && this.currentLayer !== type) {
            this.hide();
        }
        
        if (this.layers[type]) {
            this.layers[type].addTo(this.map);
            this.currentLayer = type;
            console.log('OpenWeatherMap: Layer added to map:', type);
        } else {
            console.error('OpenWeatherMap: Layer not found:', type);
        }
    },
    
    hide: function() {
        if (this.currentLayer && this.layers[this.currentLayer]) {
            this.map.removeLayer(this.layers[this.currentLayer]);
            console.log('OpenWeatherMap: Layer removed:', this.currentLayer);
        }
        this.currentLayer = null;
    },
    
    toggle: function(type) {
        if (this.currentLayer === type) {
            this.hide();
        } else {
            this.show(type);
        }
    },
    
    setOpacity: function(value) {
        for (var key in this.layers) {
            this.layers[key].setOpacity(value);
        }
    }
};

// ========================================
// Weather Control Panel
// ========================================
L.Control.WeatherLayers = L.Control.extend({
    options: {
        position: 'topright',
        openWeatherApiKey: null
    },
    
    onAdd: function(map) {
        this._map = map;
        
        var container = L.DomUtil.create('div', 'leaflet-control-weather leaflet-bar');
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);
        
        // Main toggle button
        this._button = L.DomUtil.create('a', 'leaflet-control-weather-button', container);
        this._button.href = '#';
        this._button.title = 'Weather Layers';
        this._button.innerHTML = '<i class="fa fa-cloud"></i>';
        
        // Dropdown panel
        this._panel = L.DomUtil.create('div', 'leaflet-control-weather-panel', container);
        this._panel.style.display = 'none';
        
        this._createPanelContent();
        
        L.DomEvent.on(this._button, 'click', this._togglePanel, this);
        
        // Initialize weather providers
        RainViewer.init(map);
        if (this.options.openWeatherApiKey) {
            OpenWeatherMapLayers.init(map, this.options.openWeatherApiKey);
        }
        
        return container;
    },
    
    _createPanelContent: function() {
        var html = '<div class="weather-panel-header">Weather Layers</div>';
        
        // RainViewer Section
        html += '<div class="weather-section">';
        html += '<div class="weather-section-title">Weather Radar</div>';
        html += '<div class="radar-controls">';
        html += '<button id="radar-toggle" class="weather-btn" title="Toggle Radar">Show</button>';
        html += '<button id="radar-prev" class="weather-btn" title="Previous">&lt;</button>';
        html += '<button id="radar-play-btn" class="weather-btn" title="Play/Pause">Play</button>';
        html += '<button id="radar-next" class="weather-btn" title="Next">&gt;</button>';
        html += '<span id="radar-timestamp" class="radar-time">--:--</span>';
        html += '</div>';
        html += '</div>';
        
        // OpenWeatherMap Section
        if (this.options.openWeatherApiKey) {
            html += '<div class="weather-section">';
            html += '<div class="weather-section-title"><i class="fa fa-map"></i> Weather Maps</div>';
            html += '<div class="owm-buttons">';
            html += '<button class="weather-btn owm-btn" data-layer="precipitation">Rain</button>';
            html += '<button class="weather-btn owm-btn" data-layer="clouds">Clouds</button>';
            html += '<button class="weather-btn owm-btn" data-layer="temperature">Temp</button>';
            html += '<button class="weather-btn owm-btn" data-layer="wind">Wind</button>';
            html += '</div>';
            html += '</div>';
        }
        
        // Opacity control
        html += '<div class="weather-section">';
        html += '<div class="weather-section-title"><i class="fa fa-adjust"></i> Opacity</div>';
        html += '<input type="range" id="weather-opacity" min="0.1" max="1" step="0.1" value="0.6" class="weather-slider">';
        html += '</div>';
        
        this._panel.innerHTML = html;
        
        // Bind events after DOM is ready
        var self = this;
        setTimeout(function() {
            self._bindEvents();
        }, 0);
    },
    
    _bindEvents: function() {
        var self = this;
        var panel = this._panel;
        
        // Use native DOM queries within our panel to avoid jQuery selector issues
        var radarToggle = panel.querySelector('#radar-toggle');
        var radarPrev = panel.querySelector('#radar-prev');
        var radarPlayBtn = panel.querySelector('#radar-play-btn');
        var radarNext = panel.querySelector('#radar-next');
        var opacitySlider = panel.querySelector('#weather-opacity');
        var owmButtons = panel.querySelectorAll('.owm-btn');
        
        // Radar toggle (Show button)
        if (radarToggle) {
            radarToggle.addEventListener('click', function() {
                this.classList.toggle('active');
                if (this.classList.contains('active')) {
                    this.textContent = 'Hide';
                    console.log('RainViewer: Showing radar');
                    RainViewer.show();
                } else {
                    this.textContent = 'Show';
                    console.log('RainViewer: Hiding radar');
                    RainViewer.hide();
                }
            });
        }
        
        // Radar prev
        if (radarPrev) {
            radarPrev.addEventListener('click', function() {
                // Auto-enable radar if not already
                if (radarToggle && !radarToggle.classList.contains('active')) {
                    radarToggle.click();
                }
                RainViewer.prev();
            });
        }
        
        // Radar play/pause
        if (radarPlayBtn) {
            radarPlayBtn.addEventListener('click', function() {
                // Auto-enable radar if not already
                if (radarToggle && !radarToggle.classList.contains('active')) {
                    radarToggle.click();
                }
                RainViewer.toggle();
            });
        }
        
        // Radar next
        if (radarNext) {
            radarNext.addEventListener('click', function() {
                // Auto-enable radar if not already
                if (radarToggle && !radarToggle.classList.contains('active')) {
                    radarToggle.click();
                }
                RainViewer.next();
            });
        }
        
        // OpenWeatherMap buttons
        owmButtons.forEach(function(btn) {
            btn.addEventListener('click', function() {
                var layer = this.getAttribute('data-layer');
                var wasActive = this.classList.contains('active');
                
                // Deactivate all OWM buttons
                owmButtons.forEach(function(b) { b.classList.remove('active'); });
                
                if (wasActive) {
                    OpenWeatherMapLayers.hide();
                } else {
                    this.classList.add('active');
                    OpenWeatherMapLayers.show(layer);
                }
            });
        });
        
        // Opacity slider
        if (opacitySlider) {
            opacitySlider.addEventListener('input', function() {
                var value = parseFloat(this.value);
                RainViewer.setOpacity(value);
                OpenWeatherMapLayers.setOpacity(value);
            });
        }
        
        console.log('Weather layers control: events bound');
    },
    
    _togglePanel: function(e) {
        L.DomEvent.preventDefault(e);
        if (this._panel.style.display === 'none') {
            this._panel.style.display = 'block';
            L.DomUtil.addClass(this._button, 'active');
        } else {
            this._panel.style.display = 'none';
            L.DomUtil.removeClass(this._button, 'active');
        }
    }
});

L.control.weatherLayers = function(options) {
    return new L.Control.WeatherLayers(options);
};
