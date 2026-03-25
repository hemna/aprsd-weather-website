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
        this.loadData();
    },
    
    loadData: function() {
        var self = this;
        $.ajax({
            url: this.API_URL,
            type: 'GET',
            dataType: 'json',
            success: function(data) {
                self.apiData = data;
                self.frames = data.radar.past || [];
                console.log('RainViewer: Loaded ' + self.frames.length + ' radar frames');
                if (self.frames.length > 0) {
                    self.currentFrame = self.frames.length - 1; // Start with latest
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
        if (!this.frames.length) return;
        
        // Wrap index
        while (index >= this.frames.length) index -= this.frames.length;
        while (index < 0) index += this.frames.length;
        
        this.currentFrame = index;
        var frame = this.frames[index];
        
        // Remove existing layer
        if (this.radarLayer) {
            this.map.removeLayer(this.radarLayer);
        }
        
        // Add new layer
        this.radarLayer = this.createLayer(frame);
        if (this.radarLayer) {
            this.radarLayer.addTo(this.map);
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
            this.showFrame(this.currentFrame);
        }
    },
    
    hide: function() {
        this.stop();
        if (this.radarLayer) {
            this.map.removeLayer(this.radarLayer);
            this.radarLayer = null;
        }
    },
    
    play: function() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        $('#radar-play-btn').html('<i class="fa fa-pause"></i>');
        this.animate();
    },
    
    stop: function() {
        this.isPlaying = false;
        if (this.animationTimer) {
            clearTimeout(this.animationTimer);
            this.animationTimer = null;
        }
        $('#radar-play-btn').html('<i class="fa fa-play"></i>');
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
        
        this.animationTimer = setTimeout(function() {
            self.animate();
        }, 500);
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
        
        if (!apiKey) {
            console.warn('OpenWeatherMap: No API key provided');
            return;
        }
        
        // Pre-create all layers
        for (var key in this.LAYER_TYPES) {
            this.layers[key] = this.createLayer(this.LAYER_TYPES[key].layer);
        }
    },
    
    createLayer: function(layerName) {
        return L.tileLayer(
            'https://tile.openweathermap.org/map/' + layerName + '/{z}/{x}/{y}.png?appid=' + this.apiKey,
            {
                maxZoom: 18,
                opacity: 0.6,
                attribution: '<a href="https://openweathermap.org/" target="_blank">OpenWeatherMap</a>'
            }
        );
    },
    
    show: function(type) {
        // Hide current layer if different
        if (this.currentLayer && this.currentLayer !== type) {
            this.hide();
        }
        
        if (this.layers[type]) {
            this.layers[type].addTo(this.map);
            this.currentLayer = type;
            console.log('OpenWeatherMap: Showing', type);
        }
    },
    
    hide: function() {
        if (this.currentLayer && this.layers[this.currentLayer]) {
            this.map.removeLayer(this.layers[this.currentLayer]);
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
        html += '<div class="weather-section-title"><i class="fa fa-tint"></i> Weather Radar</div>';
        html += '<div class="radar-controls">';
        html += '<button id="radar-toggle" class="weather-btn" title="Toggle Radar"><i class="fa fa-eye"></i></button>';
        html += '<button id="radar-prev" class="weather-btn" title="Previous"><i class="fa fa-step-backward"></i></button>';
        html += '<button id="radar-play-btn" class="weather-btn" title="Play/Pause"><i class="fa fa-play"></i></button>';
        html += '<button id="radar-next" class="weather-btn" title="Next"><i class="fa fa-step-forward"></i></button>';
        html += '<span id="radar-timestamp" class="radar-time">--:--</span>';
        html += '</div>';
        html += '</div>';
        
        // OpenWeatherMap Section
        if (this.options.openWeatherApiKey) {
            html += '<div class="weather-section">';
            html += '<div class="weather-section-title"><i class="fa fa-map"></i> Weather Maps</div>';
            html += '<div class="owm-buttons">';
            html += '<button class="weather-btn owm-btn" data-layer="precipitation"><i class="fa fa-tint"></i> Rain</button>';
            html += '<button class="weather-btn owm-btn" data-layer="clouds"><i class="fa fa-cloud"></i> Clouds</button>';
            html += '<button class="weather-btn owm-btn" data-layer="temperature"><i class="fa fa-thermometer-half"></i> Temp</button>';
            html += '<button class="weather-btn owm-btn" data-layer="wind"><i class="fa fa-leaf"></i> Wind</button>';
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
        
        // Radar controls
        $('#radar-toggle').on('click', function() {
            $(this).toggleClass('active');
            if ($(this).hasClass('active')) {
                RainViewer.show();
            } else {
                RainViewer.hide();
            }
        });
        
        $('#radar-prev').on('click', function() {
            if ($('#radar-toggle').hasClass('active')) {
                RainViewer.prev();
            }
        });
        
        $('#radar-play-btn').on('click', function() {
            if ($('#radar-toggle').hasClass('active')) {
                RainViewer.toggle();
            }
        });
        
        $('#radar-next').on('click', function() {
            if ($('#radar-toggle').hasClass('active')) {
                RainViewer.next();
            }
        });
        
        // OpenWeatherMap buttons
        $('.owm-btn').on('click', function() {
            var layer = $(this).data('layer');
            var wasActive = $(this).hasClass('active');
            
            // Deactivate all OWM buttons
            $('.owm-btn').removeClass('active');
            
            if (wasActive) {
                OpenWeatherMapLayers.hide();
            } else {
                $(this).addClass('active');
                OpenWeatherMapLayers.show(layer);
            }
        });
        
        // Opacity slider
        $('#weather-opacity').on('input', function() {
            var value = parseFloat($(this).val());
            RainViewer.setOpacity(value);
            OpenWeatherMapLayers.setOpacity(value);
        });
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
