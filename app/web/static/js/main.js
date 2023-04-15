// watchlist is a dict of ham callsign => symbol, packets
var watchlist = {};

function aprs_img(item, x_offset, y_offset) {
    var x = x_offset * -16;
    if (y_offset > 5) {
        y_offset = 5;
    }
    var y = y_offset * -16;
    var loc = x + 'px '+ y + 'px'
    item.css('background-position', loc);
}

function show_aprs_icon(item, symbol) {
    var offset = ord(symbol) - 33;
    var col = Math.floor(offset / 16);
    var row = offset % 16;
    //console.log("'" + symbol+"'   off: "+offset+"  row: "+ row + "   col: " + col)
    aprs_img(item, row, col);
}

function ord(str){return str.charCodeAt(0);}

function update_seen_dates(seen_list) {
    var new_list = []
    jQuery.each(seen_list, function(i, val) {
        entry = {"callsign": i,
                 "last": val["last"],
                 "count": val["count"],
                 "ts": val["ts"]};
        new_list.push(entry)
    });

    new_list.sort(function(a, b) {
        var keyA = new Date(a.last),
        keyB = new Date(b.last);
        // Compare the 2 dates
        if (keyA < keyB) return 1;
        if (keyA > keyB) return -1;
        return 0;
    });

    return new_list
}

function update_seenlist( data ) {

    var seendiv = $("#seenDiv");

    var html_str = '<table class="ui selectable celled striped table" id="seenTable">'
    html_str    += '<thead><tr><th>HAM Callsign</th><th class="selected descending">Age since last seen by APRSD</th>'
    html_str    += '<th>Number of packets RX</th></tr></thead><tbody>'
    seendiv.html('')
    var seen_list = data["aprsd"]["seen_list"]
    seen_list = update_seen_dates(seen_list)
    var len = Object.keys(seen_list).length
    $('#seen_count').html(len)
    jQuery.each(seen_list, function(i, val) {
        html_str += '<tr><td class="collapsing">' + val["callsign"] + '</td>'
        html_str += '<td>' + val["last"] + '</td>'
        html_str += '<td>' + val["count"] + '</td></tr>'
    });
    html_str += "</tbody></table>";
    seendiv.append(html_str);
    $("#seenTable").tablesorter();
}

function update_stats( data ) {
    $("#version").text( data["aprsd"]["version"] );
    $("#aprs_connection").html( data["aprs_connection"] );
    $("#uptime").text( "uptime: " + data["aprsd"]["uptime"] );
    const html_pretty = Prism.highlight(JSON.stringify(data, null, '\t'), Prism.languages.json, 'json');
    $("#jsonstats").html(html_pretty);
}


function start_update() {

    (function statsworker() {
            $.ajax({
                url: "/stats",
                type: 'GET',
                dataType: 'json',
                success: function(data) {
                    update_stats(data);
                    update_seenlist(data);
                },
                complete: function() {
                    setTimeout(statsworker, 60000);
                }
            });
    })();
}
