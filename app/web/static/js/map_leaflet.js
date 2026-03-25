/**
 * Converts decimal degrees to degrees minutes seconds.
 *
 * @param dd the decimal degrees value.
 * @param isLng specifies whether the decimal degrees value is a longitude.
 * @return degrees minutes seconds string in the format 49°15'51.35"N
 */
function convertToDms(dd, isLng) {
  var dir = dd < 0
    ? isLng ? 'W' : 'S'
    : isLng ? 'E' : 'N';

  var absDd = Math.abs(dd);
  var deg = absDd | 0;
  var frac = absDd - deg;
  var min = (frac * 60) | 0;
  var sec = frac * 3600 - min * 60;
  // Round it to 2 decimal points.
  sec = Math.round(sec * 100) / 100;
  return deg + "°" + min + "'" + sec + '"' + dir;
}

function cToF(celsius) {
  const cTemp = celsius;
  const cToFahr = cTemp * 9 / 5 + 32;
  return cToFahr
}

function fToC(fahrenheit) {
  const fTemp = fahrenheit;
  const fToCel = (fTemp - 32) * 5 / 9;
  return fToCel
}


function get_station_popup_html(station_data, report_data) {
    var station_id = station_data['properties']['id'];
    var lat_str = convertToDms(station_data["properties"]["latitude"], false);
    var lon_str = convertToDms(station_data["properties"]["longitude"], true);
    var temperature = Math.ceil(cToF(report_data["temperature"])*100)/100;
    var chart_id = 'temp-chart-' + station_id;
    
    var popup_html = "<div style='min-width:300px;'><a class='ui large text' href='http://aprs.fi/#!mt=roadmap&z=11&call="+station_data["properties"]["callsign"]+"' target='_new'>";
    popup_html += station_data["properties"]["callsign"] + "</a>";
    popup_html += "<div style='clear:left;background-color:#0000ff;opacity:0.6;height: 2px';></div>";
    popup_html += "<div class='ui tiny text'>"+lat_str + " " + lon_str + "<br>";
    popup_html += "Report Time: " + report_data["time"] + "<br>";
    popup_html += "<div style='width:300px;word-wrap: break-word'><small>[<b class='popup-path-label'>Path</b>]&nbsp;" + report_data['decoded']['path']+ "</small></div><br>";
    popup_html += "Comment: " + station_data["properties"]["comment"]+ "<br>";
    popup_html += "Temperature: <b>" + temperature + "°F </b><br>";
    popup_html += "Pressure: <b>" + report_data["pressure"] + "hPa</b>&nbsp;&nbsp;";
    popup_html += "Humidity: <b>" + report_data["humidity"] + "%</b><br>";
    popup_html += "Wind Direction: <b>" + report_data["wind_direction"] + "°</b>&nbsp;&nbsp;";
    popup_html += "Wind Speed: <b>" + report_data["wind_gust"] + " mph</b><br>";
    popup_html += "Rain last hour: <b>" + report_data["rain_1h"] + "</b>&nbsp;&nbsp;";
    popup_html += "24h: <b>" + report_data["rain_24h"] + "</b>&nbsp;&nbsp;";
    popup_html += "midnight: <b>" + report_data["rain_since_midnight"] + "</b>";
    popup_html += "</div>";
    
    // Add temperature chart container
    popup_html += "<div style='margin-top:10px;border-top:1px solid var(--border-color, #ccc);padding-top:10px;'>";
    popup_html += "<div style='font-size:11px;font-weight:bold;margin-bottom:5px;'>24h Temperature</div>";
    popup_html += "<div id='" + chart_id + "-container' style='width:280px;height:120px;'>";
    popup_html += "<canvas id='" + chart_id + "' width='280' height='120'></canvas>";
    popup_html += "</div></div>";
    popup_html += "</div>";
    
    return popup_html;
}

// Track active chart instances to destroy on popup close
var activeCharts = {};

function loadTemperatureChart(stationId, reportTime) {
    var chart_id = 'temp-chart-' + stationId;
    var canvas = document.getElementById(chart_id);
    
    if (!canvas) {
        console.log('Chart canvas not found:', chart_id);
        return;
    }
    
    // Parse the report time to get the date range for history
    var reportDate = new Date(reportTime);
    var startDate = new Date(reportDate);
    startDate.setHours(0, 0, 0, 0);
    var endDate = new Date(reportDate);
    endDate.setHours(23, 59, 59, 999);
    
    var start = startDate.toISOString().split('.')[0];
    var end = endDate.toISOString().split('.')[0];
    
    $.ajax({
        url: '/wx_history/' + stationId + '?start=' + start + '&end=' + end + '&fields=temperature',
        type: 'GET',
        dataType: 'json',
        success: function(data) {
            if (data.error || !data.history || data.history.length === 0) {
                $('#' + chart_id + '-container').html('<div style="font-size:10px;color:var(--text-muted, #888);">No history data available</div>');
                return;
            }
            
            // Destroy existing chart if any
            if (activeCharts[chart_id]) {
                activeCharts[chart_id].destroy();
            }
            
            var labels = data.history.map(function(h) {
                var d = new Date(h.time);
                return d.getHours() + ':00';
            });
            
            var temps = data.history.map(function(h) {
                return Math.round(cToF(h.temperature) * 10) / 10;
            });
            
            var ctx = canvas.getContext('2d');
            var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            var gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
            var textColor = isDark ? '#8b949e' : '#666';
            var lineColor = isDark ? '#58a6ff' : '#0969da';
            
            activeCharts[chart_id] = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Temp (°F)',
                        data: temps,
                        borderColor: lineColor,
                        backgroundColor: lineColor + '33',
                        fill: true,
                        tension: 0.3,
                        pointRadius: 2,
                        pointHoverRadius: 4,
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return context.parsed.y + '°F';
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                color: gridColor
                            },
                            ticks: {
                                color: textColor,
                                font: { size: 9 },
                                maxRotation: 0,
                                maxTicksLimit: 6
                            }
                        },
                        y: {
                            grid: {
                                color: gridColor
                            },
                            ticks: {
                                color: textColor,
                                font: { size: 9 },
                                callback: function(value) {
                                    return value + '°';
                                }
                            }
                        }
                    }
                }
            });
        },
        error: function() {
            $('#' + chart_id + '-container').html('<div style="font-size:10px;color:var(--text-muted, #888);">Failed to load history</div>');
        }
    });
}

// Store markers by station ID for lookup
var stationMarkersById = {};

function add_marker(station_data) {
    var longitude = station_data['properties']['longitude']
    var latitude = station_data['properties']['latitude']
    var station_id = station_data['properties']['id']

    var wxIcon = L.icon({
        iconUrl: '/static/images/wx_icon.png',

        iconSize:     [24, 24], // size of the icon
        iconAnchor:   [12, 12], // point of the icon which will correspond to marker's location
        shadowAnchor: [4, 62],  // the same for the shadow
        popupAnchor:  [0, 0] // point from which the popup should open relative to the iconAnchor
    })
    var marker = L.marker([latitude, longitude], {icon: wxIcon});
    marker.bindPopup("Loading...");
    
    // Store reference by station ID
    marker.stationId = station_id;
    marker.stationData = station_data;
    stationMarkersById[station_id] = marker;

    function onMapClick(e) {
            var popup = e.target.getPopup();

            $.ajax({
                url: "/wx_report/"+station_data['properties']['id'],
                type: 'GET',
                dataType: 'json',
                success: function(data){
                    if (!data || data.temperature === undefined) {
                        popup.setContent("<div style='padding:10px;'><b>" + station_data['properties']['callsign'] + "</b><br><br>No weather data available for this station.</div>");
                        popup.update();
                        return;
                    }
                    var content = get_station_popup_html(station_data, data);
                    popup.setContent(content);
                    popup.update();
                    // Load temperature chart after popup is rendered
                    setTimeout(function() {
                        loadTemperatureChart(station_data['properties']['id'], data['time']);
                    }, 100);
                },
                error: function(xhr, status, error) {
                    popup.setContent("<div style='padding:10px;'><b>" + station_data['properties']['callsign'] + "</b><br><br>Failed to load weather data.</div>");
                    popup.update();
                }
            });
    };

    marker.on('click', onMapClick );
    markers.addLayer(marker);
}

// Track the current request marker and highlighted WX stations so we can remove them on next click
var currentRequestMarker = null;
var currentWxMarkers = [];

// Helper function to create a WX station marker
function createWxStationMarker(stationData, requesterCallsign) {
    var wxCoords = [stationData.properties.latitude, stationData.properties.longitude];
    
    var greenMarker = L.ExtraMarkers.icon({
      icon: 'fa-cloud',
      markerColor: 'green',
      shape: 'circle',
      prefix: 'fa'
    });
    
    var wxMarker = L.marker(wxCoords, {icon: greenMarker});
    wxMarker.bindPopup("Loading...");
    
    // Fetch weather report on click (same as regular station markers)
    wxMarker.on('click', function(e) {
        var popup = e.target.getPopup();
        
        $.ajax({
            url: "/wx_report/" + stationData.properties.id,
            type: 'GET',
            dataType: 'json',
            success: function(data) {
                if (!data || data.temperature === undefined) {
                    popup.setContent("<div style='padding:10px;'><b>" + stationData.properties.callsign + "</b><br><br>No weather data available.<br><br><span class='popup-station-list'>Returned for request from <b>" + requesterCallsign + "</b></span></div>");
                    popup.update();
                    return;
                }
                var content = get_station_popup_html(stationData, data);
                // Add note about which request this was for
                content = content.replace('</div></div></div>', '</div></div><p class="popup-station-list" style="margin-top:8px;border-top:1px solid var(--border-color);padding-top:8px;">Returned for request from <b>' + requesterCallsign + '</b></p></div>');
                popup.setContent(content);
                popup.update();
                // Load temperature chart after popup is rendered
                setTimeout(function() {
                    loadTemperatureChart(stationData.properties.id, data['time']);
                }, 100);
            },
            error: function() {
                popup.setContent("<div style='padding:10px;'><b>" + stationData.properties.callsign + "</b><br><br>Failed to load weather data.</div>");
                popup.update();
            }
        });
    });
    
    wxMarker.addTo(map);
    return wxMarker;
}

// Function to show WX stations for a request - fetches from server if not in cache
function showWxStations(wx_station_ids, callsign, coords, bounds) {
    if (!wx_station_ids) {
        map.setView(coords, 11);
        return;
    }
    
    var ids = wx_station_ids.split(',').map(function(id) { return parseInt(id.trim()); });
    var missingIds = [];
    var foundStations = [];
    
    // Check which stations we already have
    ids.forEach(function(id) {
        var stationMarker = stationMarkersById[id];
        if (stationMarker && stationMarker.stationData) {
            foundStations.push(stationMarker.stationData);
        } else {
            missingIds.push(id);
        }
    });
    
    // If we have all stations, show them immediately
    if (missingIds.length === 0) {
        foundStations.forEach(function(stationData) {
            var wxMarker = createWxStationMarker(stationData, callsign);
            currentWxMarkers.push(wxMarker);
            bounds.extend([stationData.properties.latitude, stationData.properties.longitude]);
        });
        
        if (currentWxMarkers.length > 0) {
            map.fitBounds(bounds, {padding: [50, 50], maxZoom: 12});
        } else {
            map.setView(coords, 11);
        }
        return;
    }
    
    // Fetch missing stations from server
    console.log("Fetching missing station IDs:", missingIds);
    $.ajax({
        url: "/stations_by_ids?ids=" + ids.join(','),
        type: 'GET',
        dataType: 'json',
        success: function(data) {
            var stations = typeof data === 'string' ? JSON.parse(data) : data;
            
            stations.forEach(function(stationData) {
                // Add to cache for future use
                stationMarkersById[stationData.id] = {stationData: stationData};
                
                var wxMarker = createWxStationMarker(stationData, callsign);
                currentWxMarkers.push(wxMarker);
                bounds.extend([stationData.properties.latitude, stationData.properties.longitude]);
            });
            
            if (currentWxMarkers.length > 0) {
                map.fitBounds(bounds, {padding: [50, 50], maxZoom: 12});
            } else {
                map.setView(coords, 11);
            }
        },
        error: function() {
            console.error("Failed to fetch station data");
            map.setView(coords, 11);
        }
    });
}

function add_request(data) {
    // console.log(data);
    var longitude = data['properties']['longitude']
    var latitude = data['properties']['latitude']
    var marker_id = data['id']
    var callsign = data["properties"]["callsign"];
    var count = data["properties"]["count"];
    var created = data["properties"]["created"];
    var station_callsigns = data["properties"]["station_callsigns"];
    var wx_station_ids = data["properties"]["wx_station_ids"] || "";
    
    // Popup shows the requesting station info
    var popup_html = "<b class='popup-callsign'>" + callsign + "</b>";
    popup_html += "&nbsp;-&nbsp;<b style='color: var(--accent-green, green)'>n " + count + " </b>";
    popup_html += "<p>" + created + "</p>";
    popup_html += "<p class='popup-station-list'>Nearby WX: " + station_callsigns + "</p>";

    var request_html = "<a style='padding-bottom: 0px;' href='#' id='req_"+marker_id+"' class='list-group-item list-group-item-action'>"
    request_html += popup_html;
    request_html += "</a>";
    $('#requests_list').append(request_html);
    
    $('#req_'+marker_id).click(function() {
      // Remove previous request marker if exists
      if (currentRequestMarker) {
        map.removeLayer(currentRequestMarker);
      }
      
      // Remove previous WX station markers
      currentWxMarkers.forEach(function(m) {
        map.removeLayer(m);
      });
      currentWxMarkers = [];
      
      var coords = [latitude, longitude];
      var redMarker = L.ExtraMarkers.icon({
        icon: 'fa-broadcast-tower',
        markerColor: 'red',
        shape: 'square',
        prefix: 'fa'
      });
      
      // Create marker for requesting station
      currentRequestMarker = L.marker(coords, {icon: redMarker})
        .bindPopup(popup_html)
        .addTo(map);
      
      // Show WX stations (fetches from server if needed)
      var bounds = L.latLngBounds([coords]);
      showWxStations(wx_station_ids, callsign, coords, bounds);
      
      // Open the popup after a short delay to ensure map has moved
      setTimeout(function() {
        currentRequestMarker.openPopup();
      }, 300);
    });
}

function update_requests(data) {
    console.log("update_requests " + Object.keys(data).length + " requests");
    //console.log(data);
    $('#requests_list').html('');
    $.each(JSON.parse(data), function(index, value) {
        add_request(value);
    });

}


function update_map(data) {
    console.log("update_map " + Object.keys(data).length + " stations");
    $.each(data, function(index, value) {
        add_marker(value);
    });
}

// Progressive loading: fetch remaining stations in batches after initial load
var BATCH_SIZE = 2000;
var loadedStations = 0;

function loadRemainingStations() {
    if (typeof stationsTotal === 'undefined' || typeof stationsOffset === 'undefined') {
        console.log('Progressive loading not available');
        return;
    }

    // Start from where markers.js left off
    var nextOffset = stationsOffset + (typeof stations !== 'undefined' ? stations.length : BATCH_SIZE);
    loadedStations = nextOffset;

    console.log('Loading remaining stations from offset ' + nextOffset);
    showLoadingIndicator(loadedStations, stationsTotal);

    loadStationBatch(nextOffset);
}

function loadStationBatch(offset) {
    $.ajax({
        url: "/stations?limit=" + BATCH_SIZE + "&offset=" + offset,
        type: 'GET',
        dataType: 'json',
        success: function(data) {
            if (data.stations && data.stations.length > 0) {
                console.log('Loaded batch: ' + data.stations.length + ' stations (offset=' + offset + ')');
                update_map(data.stations);
                loadedStations += data.stations.length;
                updateLoadingIndicator(loadedStations, data.total);

                // Load next batch if more available
                if (data.hasMore) {
                    // Small delay to keep UI responsive
                    setTimeout(function() {
                        loadStationBatch(offset + BATCH_SIZE);
                    }, 100);
                } else {
                    hideLoadingIndicator();
                    console.log('All ' + data.total + ' stations loaded');
                }
            } else {
                hideLoadingIndicator();
            }
        },
        error: function(xhr, status, error) {
            console.error('Failed to load stations batch: ' + error);
            hideLoadingIndicator();
        }
    });
}

function showLoadingIndicator(loaded, total) {
    if ($('#loading-indicator').length === 0) {
        var indicator = '<div id="loading-indicator" style="' +
            'position: fixed; bottom: 20px; right: 20px; z-index: 1000; ' +
            'background: var(--bg-tertiary, #21262d); color: var(--text-primary, #e6edf3); ' +
            'padding: 10px 15px; border-radius: 6px; font-size: 13px; ' +
            'border: 1px solid var(--border-color, #30363d); box-shadow: 0 2px 8px rgba(0,0,0,0.3);">' +
            '<i class="fa fa-spinner fa-spin"></i> Loading stations: ' +
            '<span id="loading-count">' + loaded + '</span> / ' + total +
            '</div>';
        $('body').append(indicator);
    }
}

function updateLoadingIndicator(loaded, total) {
    $('#loading-count').text(loaded);
}

function hideLoadingIndicator() {
    $('#loading-indicator').fadeOut(500, function() {
        $(this).remove();
    });
}


function start_requests_update() {

/*
    (function requestsworker() {
            $.ajax({
                url: "/stations",
                type: 'GET',
                dataType: 'json',
                success: function(data) {
                    update_map(data);
                },
            });
    })();

*/

    (function requestsworker() {
            $.ajax({
                url: "/requests",
                type: 'GET',
                dataType: 'json',
                success: function(data) {
                    update_requests(data);
                },
                complete: function() {
                    setTimeout(requestsworker, 60000);
                }
            });
    })();
}
