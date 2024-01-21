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
    marker_id = station_data['id'];
    lat_str = convertToDms(station_data["properties"]["latitude"], false)
    lon_str = convertToDms(station_data["properties"]["longitude"], true)
    temperature = Math.ceil(cToF(report_data["temperature"])*100)/100
    popup_html = "<div><a class='ui large text' href='http://aprs.fi/#!mt=roadmap&z=11&call="+station_data["properties"]["callsign"]+"' target='_new'>";
    popup_html += station_data["properties"]["callsign"] + "</a>";
    popup_html += "<div style='clear:left;background-color:#0000ff;opacity:0.6;height: 2px';></div>"
    popup_html += "<div class-'ui tiny text'>"+lat_str + " " + lon_str + "\n<br>";
    popup_html += "Report Time: " + report_data["time"] + "\n";
    popup_html += "<div style='width:300px;word-wrap: break-word'><small>[<b style='margin:0px;padding:0px;color:blue;'>Path</b>]&nbsp;" + report_data['decoded']['path']+ "</small></div><br>";
    popup_html += "Comment: " + station_data["properties"]["comment"]+ "\n<br>";
    popup_html += "Temperature: <b>" + temperature + "°F </b>\n<br>";
    popup_html += "Pressure: <b>" + report_data["pressure"] + "hPa</b>&nbsp;&nbsp;\n";
    popup_html += "Humidity: <b>" + report_data["humidity"] + "</b>\n<br>";
    popup_html += "Wind Direction: <b>" + report_data["wind_direction"] + "</b>&nbsp;&nbsp;";
    popup_html += "Wind Speed: <b>" + report_data["wind_gust"] + "</b><br>";
    popup_html += "Rain last hour: <b>" + report_data["rain_1h"] + "</b>&nbsp;&nbsp;\n<br>";
    popup_html += "last 24 hours: <b>" + report_data["rain_24h"] + "</b>&nbsp;&nbsp;\n<br>";
    popup_html += "since midnight: <b>" + report_data["rain_since_midnight"] + "</b>\n";
    popup_html += "</div>";
    return popup_html;
}

function add_marker(station_data) {
    var longitude = station_data['properties']['longitude']
    var latitude = station_data['properties']['latitude']

    var wxIcon = L.icon({
        iconUrl: '/static/images/wx_icon.png',

        iconSize:     [24, 24], // size of the icon
        iconAnchor:   [12, 12], // point of the icon which will correspond to marker's location
        shadowAnchor: [4, 62],  // the same for the shadow
        popupAnchor:  [0, 0] // point from which the popup should open relative to the iconAnchor
    })
    marker = L.marker([latitude, longitude], {icon: wxIcon});
    marker.bindPopup("Loading...");

    function onMapClick(e) {
            var popup = e.target.getPopup();

            $.ajax({
                url: "/wx_report?wx_station_id="+station_data['properties']['id'],
                type: 'GET',
                dataType: 'json',
                success: function(data){
                    content = get_station_popup_html(station_data, data);
                    popup.setContent( content );
                    popup.update();
                },
                fail: function(data) {
                    alert('FAIL: ' + data);
                }
            });
    };

    marker.on('click', onMapClick );
    markers.addLayer(marker);
}

function add_request(data) {
    // console.log(data);
    var longitude = data['properties']['longitude']
    var latitude = data['properties']['latitude']
    marker_id = data['id']
    popup_html = "<b style='color: blue;'>" + data["properties"]["callsign"] + "</b>";
    popup_html += "&nbsp;-&nbsp;<b style='color: green'>n " + data["properties"]["count"] + " </b>";
    popup_html += "<p>" + data["properties"]["created"] + "</p>";
    popup_html += "<p style='color: grey'>" + data["properties"]["station_callsigns"] + "</p>";

    request_html = "<a style='padding-bottom: 0px;' href='#' id='"+marker_id+"' class='list-group-item list-group-item-action'>"
    request_html += popup_html;
    request_html += "</a>";
    $('#requests_list').append(request_html);
    $('#'+marker_id).click(function() {
      coords = [data["properties"]["latitude"], data["properties"]["longitude"]];
      var redMarker = L.ExtraMarkers.icon({
        icon: 'fa-walkie-talkie',
        markerColor: 'red',
        shape: 'square',
        prefix: 'fa-solid'
      });
      L.marker([latitude, longitude], {icon: redMarker}).bindPopup(popup_html).addTo(map);
      map.setView(coords, 11);
    });
}

function update_requests(data) {
    $('#requests_list').html('');
    $.each(data, function(index, value) {
        add_request(value);
    });

}

function update_map(data) {
    $.each(data, function(index, value) {
        add_marker(value);
    });
}

function start_requests_update() {
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
