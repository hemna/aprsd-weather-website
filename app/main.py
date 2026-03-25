# Note: We don't import aprsd.conf.common to avoid requiring APRSD's full config
# This website only needs the web config options and reads stats from JSON files
import copy
import datetime
import json
import logging as python_logging
import os

import click
import log
import requests
import utils
from aprslib import parse as aprs_parse
from cachetools import TTLCache, cached
from fastapi import FastAPI, Request, Response
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from geojson import Feature, Point
from oslo_config import cfg


class SimpleJSONEncoder(json.JSONEncoder):
    """Simple JSON encoder for datetime objects."""

    def default(self, obj):
        if isinstance(obj, datetime.datetime):
            return obj.isoformat()
        elif isinstance(obj, (datetime.date, datetime.time, datetime.timedelta)):
            return str(obj)
        return super().default(obj)


CONF = cfg.CONF

# Register default options (normally from aprsd.conf.common)
default_opts = [
    cfg.StrOpt("save_location", default="/config/", help="The location where APRSD stores its data files"),
]
CONF.register_opts(default_opts)

grp = cfg.OptGroup("web")
cfg.CONF.register_group(grp)
web_opts = [
    cfg.StrOpt("host_ip", default="0.0.0.0", help="The hostname/ip address to listen on"),
    cfg.IntOpt("host_port", default=80, help="The port to listen on for requests"),
    cfg.StrOpt("api_key", default="abcdefg", help="The mapbox api_key."),
    cfg.StrOpt("mapbox_token", default="", help="The mapbox token."),
    cfg.StrOpt("openweathermap_api_key", default="", help="OpenWeatherMap API key for weather layers."),
    cfg.StrOpt("haminfo_ip", default="0.0.0.0", help="The hostname/ip address to haminfo api"),
    cfg.StrOpt("haminfo_port", default="8043", help="The haminfo api IP port"),
    cfg.StrOpt(
        "aprsd_repeat_ip",
        default="0.0.0.0",
        help="The hostname/ip address to aprsd instance",
    ),
    cfg.StrOpt("aprsd_repeat_port", default="8043", help="The APRSD api IP port"),
]

LOG = None
CONF.register_opts(web_opts, group="web")
API_KEY_HEADER = "X-Api-Key"
app = None  # Initialized in create_app()

# Default stats structure for aprsd 5.0+
DEFAULT_STATS = {
    "APRSDStats": {
        "version": "unknown",
        "uptime": "unknown",
        "callsign": "WXNOW",
    },
    "APRSClientStats": {
        "server_string": "unknown",
        "connected": False,
    },
    "SeenList": {},
}


def _get_save_location() -> str:
    """Get the save location from config, with fallback to default."""
    try:
        return CONF.save_location
    except cfg.NoSuchOptError:
        return "/config/"


def _load_stats_from_file(json_file: str) -> dict:
    """Load stats from JSON file, returning default stats on failure."""
    if not os.path.exists(json_file):
        LOG.warning(f"Stats file not found: {json_file}")
        return copy.deepcopy(DEFAULT_STATS)

    try:
        with open(json_file) as fp:
            data = json.load(fp)
            LOG.debug(f"Loaded stats from {json_file}")
            return data
    except json.JSONDecodeError as ex:
        LOG.error(f"Failed to decode JSON from {json_file}: {ex}")
    except Exception as ex:
        LOG.error(f"Failed to load stats from {json_file}: {ex}")

    return copy.deepcopy(DEFAULT_STATS)


def _parse_seen_timestamp(raw) -> int | None:
    """Parse a timestamp string or datetime to epoch seconds."""
    if not raw:
        return None
    if isinstance(raw, datetime.datetime):
        return int(raw.timestamp())
    if not isinstance(raw, str):
        return None

    # Try both timestamp formats
    for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S"):
        try:
            return int(datetime.datetime.strptime(raw, fmt).timestamp())
        except ValueError:
            continue
    return None


def _normalize_seen_list(stats_data: dict) -> None:
    """Add epoch timestamps to SeenList entries."""
    seen_list = stats_data.get("SeenList", {})
    if not isinstance(seen_list, dict):
        return

    for call, entry in seen_list.items():
        try:
            ts = _parse_seen_timestamp(entry.get("last"))
            if ts is not None:
                entry["ts"] = ts
        except Exception as ex:
            LOG.debug(f"Could not parse timestamp for {call}: {ex}")


def fetch_stats():
    """Fetch stats from the statsstore.json file.

    APRSD 5.0+ saves stats to JSON format. This function loads the stats
    and provides safe defaults if data is missing or corrupted.
    """
    now = datetime.datetime.now()
    time_format = "%m-%d-%Y %H:%M:%S"

    json_file = os.path.join(_get_save_location(), "statsstore.json")
    stats_data = _load_stats_from_file(json_file)
    _normalize_seen_list(stats_data)

    stats = {
        "time": now.strftime(time_format),
        "stats": stats_data,
    }

    LOG.warning(stats)
    return stats


@cached(cache=TTLCache(maxsize=40960, ttl=6), info=True)
def _get_wx_stations():
    url = f"http://{CONF.web.haminfo_ip}:{CONF.web.haminfo_port}/wxstations"
    LOG.debug(f"Fetching {url}")
    stations = []
    try:
        headers = {API_KEY_HEADER: CONF.web.api_key}
        LOG.debug(f"headers {headers}")
        response = requests.get(url=url, headers=headers, timeout=60)
        if response.status_code == 200:
            json_record = response.json()

            for entry in json_record:
                # LOG.info(entry)
                point = Point((entry["longitude"], entry["latitude"]))
                marker = Feature(geometry=point, id=entry["id"], properties=entry)
                stations.append(marker)
                # self.cs.print(entry)
        else:
            LOG.error(response)
            return None

    except Exception as ex:
        LOG.error(ex)
        return None

    LOG.warning(f"Size {len(stations)}")
    return stations


def fetch_wx_report(wx_station_id, request):
    if not wx_station_id:
        LOG.warning("No station id provided")
        return None

    url = f"http://{CONF.web.haminfo_ip}:{CONF.web.haminfo_port}/wxstation_report?wx_station_id={wx_station_id}"
    LOG.debug(f"Fetching {url}")

    try:
        headers = {API_KEY_HEADER: CONF.web.api_key}
        LOG.debug(f"headers {headers}")
        response = requests.get(url=url, headers=headers, timeout=60)

        if response.status_code == 200:
            json_record = response.json()
            try:
                decoded = aprs_parse(json_record.get("raw_report"))
                json_record["decoded"] = decoded
                LOG.info(f"DECODED {decoded}")
            except Exception as ex:
                LOG.error(f"Failed DECODED {ex}")
                json_record["decoded"] = {"path": "unknown"}
                pass

            return json_record
        else:
            LOG.error(response)
    except Exception as ex:
        LOG.error(ex)
        return None


def fetch_requests():
    url = f"http://{CONF.web.haminfo_ip}:{CONF.web.haminfo_port}/wxrequests"
    LOG.debug(f"Fetching {url}")
    markers = []
    try:
        params = {
            "number": 50,
        }
        headers = {API_KEY_HEADER: CONF.web.api_key}
        response = requests.post(url=url, json=params, headers=headers, timeout=2)
        if response.status_code == 200:
            json_record = response.json()
            for entry in json_record:
                entry["station_callsigns"] = entry["station_callsigns"].replace(",", ", ")

                # Now convert each entry into a geojson feature
                point = Point((entry["latitude"], entry["longitude"]))
                marker = Feature(geometry=point, id=entry["id"], properties=entry)
                markers.append(marker)
    except Exception as ex:
        LOG.error(ex)

    return json.dumps(markers)


def create_app() -> FastAPI:
    global app, LOG

    # conf_file = utils.DEFAULT_CONFIG_FILE
    conf_file = "/config/aprsd_weather.conf"
    config_file = ["--config-file", conf_file]

    CONF(config_file, project="aprsd_repeat", version="1.0.0")
    python_logging.captureWarnings(True)
    app = FastAPI()
    LOG = log.setup_logging(app, gunicorn=True)
    CONF.log_opt_values(LOG, python_logging.DEBUG)

    app.mount("/static", StaticFiles(directory="web/static"), name="static")
    templates = Jinja2Templates(directory="web/templates")

    @app.get("/", response_class=HTMLResponse)
    async def index(request: Request):
        aprsd_stats = fetch_stats()
        LOG.debug(aprsd_stats)

        # Safely access stats with defaults for aprsd 5.0+ structure
        stats_data = aprsd_stats.get("stats", {})
        aprs_client_stats = stats_data.get("APRSClientStats", {})
        aprsd_stats_data = stats_data.get("APRSDStats", {})

        server_string = aprs_client_stats.get("server_string", "unknown")
        aprs_connection = f"APRS-IS Server: <a href='http://status.aprs2.net' >{server_string}</a>"

        version = aprsd_stats_data.get("version", "unknown")
        aprsd_version = aprsd_stats_data.get("version", "unknown")
        uptime = aprsd_stats_data.get("uptime", "unknown")
        return templates.TemplateResponse(
            request=request,
            name="index.html",
            context={
                "initial_stats": json.dumps(aprsd_stats, cls=SimpleJSONEncoder),
                "aprs_connection": aprs_connection,
                "callsign": "WXNOW",
                "version": version,
                "uptime": uptime,
                "aprsd_version": aprsd_version,
                "mapbox_token": CONF.web.mapbox_token,
                "openweathermap_api_key": CONF.web.openweathermap_api_key,
            },
        )

    @app.get("/about", response_class=HTMLResponse)
    async def about(request: Request):
        aprsd_stats = fetch_stats()

        # Safely access stats with defaults for aprsd 5.0+ structure
        stats_data = aprsd_stats.get("stats", {})
        aprs_client_stats = stats_data.get("APRSClientStats", {})
        aprsd_stats_data = stats_data.get("APRSDStats", {})

        server_string = aprs_client_stats.get("server_string", "unknown")
        aprs_connection = f"APRS-IS Server: <a href='http://status.aprs2.net' >{server_string}</a>"

        version = aprsd_stats_data.get("version", "unknown")
        aprsd_version = aprsd_stats_data.get("version", "unknown")
        uptime = aprsd_stats_data.get("uptime", "unknown")
        return templates.TemplateResponse(
            request=request,
            name="about.html",
            context={
                "initial_stats": json.dumps(aprsd_stats, cls=SimpleJSONEncoder),
                "aprs_connection": aprs_connection,
                "callsign": "WXNOW",
                "version": version,
                "uptime": uptime,
                "aprsd_version": aprsd_version,
                "mapbox_token": CONF.web.mapbox_token,
            },
        )

    @app.get("/wx_report/{station_id}", response_class=JSONResponse)
    async def wx_report(station_id: str, request: Request):
        LOG.info(f"Get wx_report for station_id {station_id}")
        report = fetch_wx_report(station_id, request)
        return report

    @app.get("/wx_history/{station_id}", response_class=JSONResponse)
    async def wx_history(station_id: str, start: str, end: str, fields: str = "temperature"):
        """Get historical weather data for a station.

        Proxies to the haminfo API /api/v1/wx/history endpoint.

        :param station_id: Weather station ID
        :param start: Start time (ISO 8601 format, e.g., 2026-03-24T00:00:00)
        :param end: End time (ISO 8601 format)
        :param fields: Comma-separated field names (default: temperature)
        :returns: JSON with history array containing hourly data
        """
        url = f"http://{CONF.web.haminfo_ip}:{CONF.web.haminfo_port}/api/v1/wx/history"
        LOG.debug(f"Fetching wx_history from {url}")

        try:
            headers = {API_KEY_HEADER: CONF.web.api_key}
            params = {
                "station_id": station_id,
                "start": start,
                "end": end,
                "fields": fields,
            }
            response = requests.get(url=url, headers=headers, params=params, timeout=30)

            if response.status_code == 200:
                return response.json()
            else:
                LOG.error(f"wx_history failed: {response.status_code} - {response.text}")
                return {"error": f"Failed to fetch history: {response.status_code}"}
        except Exception as ex:
            LOG.error(f"wx_history exception: {ex}")
            return {"error": str(ex)}

    @app.get("/stations")
    async def get_stations(limit: int = 0, offset: int = 0):
        """Return weather stations as JSON.

        Supports pagination:
        - limit: max stations to return (0 = all)
        - offset: starting index (default 0)
        """
        all_stations = _get_wx_stations()
        if not all_stations:
            return json.dumps({"stations": [], "total": 0, "hasMore": False})

        total = len(all_stations)

        if limit > 0:
            stations = all_stations[offset : offset + limit]
            has_more = (offset + limit) < total
        else:
            stations = all_stations
            has_more = False

        LOG.info(f"get_stations: returning {len(stations)} of {total}")
        return json.dumps({"stations": stations, "total": total, "hasMore": has_more})

    @app.get("/stats", response_class=JSONResponse)
    async def stats():
        stats_data = fetch_stats()
        # Use JSONResponse with custom encoder for datetime serialization
        return JSONResponse(content=json.loads(json.dumps(stats_data, cls=SimpleJSONEncoder)))

    @app.get("/requests")
    async def get_requests():
        return fetch_requests()

    @app.get("/stations_by_ids")
    async def get_stations_by_ids(ids: str):
        """Return specific weather stations by their IDs.

        :param ids: Comma-separated list of station IDs (e.g., "21285,36117")
        :returns: JSON array of station features matching the IDs
        """
        all_stations = _get_wx_stations()
        if not all_stations:
            return json.dumps([])

        # Parse the requested IDs
        try:
            requested_ids = [int(id.strip()) for id in ids.split(",") if id.strip()]
        except ValueError:
            return json.dumps([])

        # Filter stations by ID
        matching = [s for s in all_stations if s.get("id") in requested_ids]
        LOG.info(f"stations_by_ids: requested {requested_ids}, found {len(matching)}")
        return json.dumps(matching)

    @app.get("/markers.js")
    async def markers_js(response: Response, limit: int = 1000, offset: int = 0):
        """Return weather station markers as JavaScript.

        Supports pagination for progressive loading:
        - limit: max stations to return (default 1000)
        - offset: starting index (default 0)

        Returns JavaScript that sets 'stations' array and calls update_map().
        Also includes metadata: total count and whether more data is available.
        """
        all_stations = _get_wx_stations()
        LOG.debug(f"markers.js cache: {_get_wx_stations.cache_info()}")

        if not all_stations:
            return Response(
                "var stations = []; var stationsTotal = 0; var stationsHasMore = false;",
                media_type="application/javascript",
            )

        total = len(all_stations)
        # Apply pagination
        stations = all_stations[offset : offset + limit]
        has_more = (offset + limit) < total

        LOG.info(f"markers.js: returning {len(stations)} of {total} (offset={offset}, limit={limit})")

        stations_str = (
            f"var stations = {json.dumps(stations)};\n"
            f"var stationsTotal = {total};\n"
            f"var stationsHasMore = {'true' if has_more else 'false'};\n"
            f"var stationsOffset = {offset};\n"
            "$(document).ready(function() {\n"
            "  console.log('Initial load: ' + stations.length + ' of ' + stationsTotal + ' stations');\n"
            "  update_map(stations);\n"
            "  if (stationsHasMore) { loadRemainingStations(); }\n"
            "});"
        )

        return Response(stations_str, media_type="application/javascript")

    return app


@click.command()
@click.option(
    "-c",
    "--config-file",
    "config_file",
    show_default=True,
    default=utils.DEFAULT_CONFIG_FILE,
    help="The aprsd config file to use for options.",
)
@click.option(
    "--log-level",
    "log_level",
    default="DEBUG",
    show_default=True,
    type=click.Choice(
        ["CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"],
        case_sensitive=False,
    ),
    show_choices=True,
    help="The log level to use for aprsd.log",
)
@click.version_option()
def main(config_file, log_level):
    """CLI entry point for local development."""
    global app, LOG

    # Note: create_app() uses hardcoded config for gunicorn/production
    # For CLI development, we could extend create_app to accept parameters
    # but for now we just call create_app() with defaults
    app = create_app()
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8080)
