function add_repeater_markers(stations, request_info) {
  stations = JSON.parse(stations);
  //console.log(stations);
  $.each(stations, function(index, value) {
        add_repeater_marker(value, request_info);
    });
}

function fetch_repeaters(data_dict) {
    params = {
     'callsigns': data_dict['properties']['stations'],
     'repeater_ids': data_dict['properties']['repeater_ids']
     };

    $.ajax({
        url: "/stations",
        type: 'POST',
        data: JSON.stringify(params),
        cache: false,
        contentType: 'application/json',
        success: function(data) {
            add_repeater_markers(data, data_dict);
        },
        error: function(xhr) {
            console.log("failed to fetch repeaters");
        },
    });
}

function add_repeater_marker(repeater, request_info) {
   popup_html = repeater["properties"]["callsign"];
   const rptr = repeater["properties"];
   const req = request_info["properties"];

   if (rptr['allstar_node'] == true) {
       allstar_html = `<span style='color: blue; text-decoration: underline red;'>Allstar</span>`
   } else {
       allstar_html = `<span style='color: grey; text-decoration: line-through'>Allstar</span>`
   }
   if (rptr['echolink_node'] == true) {
       echo_html = `<span style='color: blue; text-decoration: underline red;'>EchoLink</span>`
   } else {
       echo_html = `<span style='color: grey; text-decoration: line-through'>EchoLink</span>`
   }
   if (rptr['dstar'] == true) {
       dstar_html = `<span style='color: blue; text-decoration: underline red;'>DStar</span>`
   } else {
       dstar_html = `<span style='color: grey; text-decoration: line-through red;'>DStar</span>`
   }
   if (rptr['irlp_node'] == true) {
       irlp_html = `<span style='color: blue; text-decoration: underline red;'>IRLP</span>`
   } else {
       irlp_html = `<span style='color: grey; text-decoration: line-through red;'>IRLP</span>`
   }
   if (rptr['races'] == true) {
       races_html = `<span style='color: blue; text-decoration: underline red;'>RACES</span>`
   } else {
       races_html = `<span style='color: grey; text-decoration: line-through red;'>RACES</span>`
   }

   switch (rptr['country'].toLowerCase()) {
     case 'united states':
     case 'canada':
     case 'mexico':
        rptr_base_url = 'https://repeaterbook.com/repeaters/details.php';
        break;
     default:
        // Rest oF World
        rptr_base_url = 'https://repeaterbook.com/row_repeaters/details.php';
        break;
   }

   popup_html = `
   <div class="ui text">
     <div style="float:left;">
       <span style="background:url('/static/images/aprs-symbols-24-0.png') no-repeat -24px -120px; background-size: 384px 144px; width: 24px; height: 24px; margin: 0px; vertical-align:middle; display:inline-block;"></span>
        <b><a href="${rptr_base_url}?state_id=${rptr['state_id']}&ID=${rptr['repeater_id']}" target="_new">${rptr['callsign']} · ${rptr['frequency']} · ${rptr['freq_band']}</a></b>
     </div>
     <div style="width:14px;float:left;"></div>
     <div style="clear:left;background-color:#ff00ff;opacity:0.6;height: 2px;"></div>
     ${req['created']}<br>
     <span style="color:#0a7100; font-style:italic;" title="Comment text">${rptr["landmark"]} · ${rptr["nearest_city"]}</span><br>
     <small>${allstar_html} · ${dstar_html} · ${echo_html} · ${irlp_html} · ${races_html}</small>
   </div>`
   latitude = repeater["properties"]["lat"]
   longitude = repeater["properties"]["long"]
   // color: #b40219
   //var marker = L.marker([latitude, longitude]).bindPopup(popup_html).addTo(map);

   var redMarker = L.ExtraMarkers.icon({
    icon: 'fa-tower-cell',
    markerColor: 'red',
    shape: 'square',
    prefix: 'fa-solid'
  });

  L.marker([latitude, longitude], {icon: redMarker}).bindPopup(popup_html).addTo(map);
}

function get_station_popup_html(station_data, report_data) {
    console.log(report_data);
    marker_id = station_data['id'];
    popup_html = "<div class='ui text'><h3><a href='http://aprs.fi/#!mt=roadmap&z=11&call="+station_data["properties"]["callsign"]+"' target='_new'>";
    popup_html += station_data["properties"]["callsign"] + "</a> - </h3>";
    popup_html += "<p>"+station_data["properties"]["latitude"] + " " + station_data["properties"]["longitude"] + " </p>";
    popup_html += "<p>Comment: " + station_data["properties"]["comment"]+ "</p>";
    popup_html += "<p>Last Report Time: " + report_data["time"] + "</p>";
    popup_html += "<p>Temperature: " + report_data["temperature"] + "</p>";
    popup_html += "<p>Humidity: " + report_data["humidity"] + "</p>";
    popup_html += "<p>Pressure: " + report_data["pressure"] + "</p>";
    popup_html += "<p>Rain last hour: " + report_data["rain_1h"] + "</p>";
    popup_html += "<p>Rain last 24 hours: " + report_data["rain_24h"] + "</p>";
    popup_html += "<p>Rain since midnight: " + report_data["rain_since_midnight"] + "</p>";
    popup_html += "</div>";
    console.log(popup_html);
    return popup_html;
}


function add_marker(station_data) {
    var longitude = station_data['properties']['longitude']
    var latitude = station_data['properties']['latitude']

    var blueMarker = L.ExtraMarkers.icon({
        icon: 'fa-walkie-talkie',
        markerColor: 'blue',
        shape: 'square',
        prefix: 'fa-solid'
    });
    marker = L.marker([latitude, longitude], {icon: blueMarker});
    marker.bindPopup("Loading...");

    function onMapClick(e) {
            var popup = e.target.getPopup();
            console.log(popup);

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

    /*request_html = "<div class='item' id='"+marker_id+"'><i class='large map pin middle aligned icon'></i>"
    request_html += "<div class='content'><a class='header' href='http://aprs.fi/#!mnt=roadmap&z=11&call=" + data["properties"]["callsign"] + "' target='_new'>"
    request_html += data["properties"]["callsign"] + " - ";
    request_html += "n " + data["properties"]["count"] + " " + data["properties"]["band"] + " </a>";
    request_html += "<div class='description'>" + data["properties"]["created"] + "</div>"
    request_html += "<div class='description'>" + data["properties"]["stations"] + "</div>"
    request_html += "</div>"
    $('#requests_list').append(request_html);
    $('#'+marker_id).click(function() {
      coords = [data["properties"]["latitude"], data["properties"]["longitude"]];
      map.setView(coords, 11);
      fetch_repeaters(data);
    });
    */
}

function update_map(data) {
    $('#requests_list').html('');

    $.each(data, function(index, value) {
        add_marker(value);
    });
}

function start_map_update() {
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

    /*
    map.once('idle', function() {
      map.resize();
    })
    */
}