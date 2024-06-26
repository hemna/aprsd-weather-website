import aprsd.conf.common
import click
import datetime
import json
import logging as python_logging
import requests
import sys

from aprslib import parse as aprs_parse
from cachetools import cached, TTLCache
from geojson import Feature, Point
from oslo_config import cfg
from aprsd.threads import stats as stats_threads
from aprsd.utils import json as aprsd_json

from fastapi import FastAPI, Request, Response
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

import log
import utils

CONF = cfg.CONF
grp = cfg.OptGroup('web')
cfg.CONF.register_group(grp)
web_opts = [
    cfg.StrOpt('host_ip',
               default='0.0.0.0',
               help='The hostname/ip address to listen on'
               ),
    cfg.IntOpt('host_port',
               default=80,
               help='The port to listen on for requests'
               ),
    cfg.StrOpt('api_key',
               default='abcdefg',
               help='The mapbox api_key.'
               ),
    cfg.StrOpt('mapbox_token',
               default='',
               help='The mapbox token.'
               ),
    cfg.StrOpt('haminfo_ip',
               default='0.0.0.0',
               help='The hostname/ip address to haminfo api'
               ),
    cfg.StrOpt('haminfo_port',
               default='8043',
               help='The haminfo api IP port'
               ),
    cfg.StrOpt('aprsd_repeat_ip',
               default='0.0.0.0',
               help='The hostname/ip address to aprsd instance',
               ),
    cfg.StrOpt('aprsd_repeat_port',
               default='8043',
               help='The APRSD api IP port'
               ),
]

LOG = None
CONF.register_opts(web_opts, group="web")
API_KEY_HEADER = "X-Api-Key"
app = FastAPI(
    static_url_path="/static",
    static_folder="web/static",
    template_folder="web/templates"
)


def fetch_stats():
    stats_obj = stats_threads.StatsStore()
    stats_obj.load()
    now = datetime.datetime.now()
    time_format = "%m-%d-%Y %H:%M:%S"
    stats_data = stats_obj.data
    seen_list = stats_data.get("SeenList", [])
    for call in seen_list:
        # add a ts 2021-11-01 16:18:11.631723
        date = datetime.datetime.strptime(str(seen_list[call]['last']), "%Y-%m-%d %H:%M:%S.%f")
        seen_list[call]["ts"] = int(datetime.datetime.timestamp(date))
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
        response = requests.get(url=url,
                                headers=headers,
                                timeout=60)
        if response.status_code == 200:
            json_record = response.json()

            for entry in json_record:
                #LOG.info(entry)
                point = Point((entry['longitude'], entry['latitude']))
                marker = Feature(geometry=point,
                                 id=entry['id'],
                                 properties=entry
                                 )
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

    url = (
        f"http://{CONF.web.haminfo_ip}:{CONF.web.haminfo_port}/"
        f"wxstation_report?wx_station_id={wx_station_id}"
    )
    LOG.debug(f"Fetching {url}")

    try:
        headers = {API_KEY_HEADER: CONF.web.api_key}
        LOG.debug(f"headers {headers}")
        response = requests.get(
            url=url,
            headers=headers,
            timeout=60)

        if response.status_code == 200:
            raw = response.text
            json_record = response.json()
            try:
                decoded = aprs_parse(json_record.get('raw_report'))
                json_record['decoded'] = decoded
                LOG.info(f"DECODED {decoded}")
            except Exception as ex:
                LOG.error(f"Failed DECODED {ex}")
                json_record['decoded'] = {'path': 'unknown'}
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
        response = requests.post(url=url, json=params, headers=headers,
                                 timeout=2)
        if response.status_code == 200:
            json_record = response.json()
            for entry in json_record:
                entry['station_callsigns'] = entry['station_callsigns'].replace(',', ', ')

                # Now convert each entry into a geojson feature
                point = Point((entry['latitude'], entry['longitude']))
                marker = Feature(geometry=point,
                                 id=entry['id'],
                                 properties=entry
                                 )
                markers.append(marker)
    except Exception as ex:
        LOG.error(ex)

    return json.dumps(markers)



def create_app () -> FastAPI:
    global app, LOG

    #conf_file = utils.DEFAULT_CONFIG_FILE
    conf_file = "config/aprsd_weather.conf"
    config_file = ["--config-file", conf_file]

    log_level = "DEBUG"

    CONF(config_file, project='aprsd_repeat', version="1.0.0")
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
        aprs_connection = (
            "APRS-IS Server: <a href='http://status.aprs2.net' >"
            "{}</a>".format(aprsd_stats["stats"]["APRSClientStats"]["server_string"])
        )

        version = aprsd_stats["stats"]["APRSDStats"]["version"]
        aprsd_version = aprsd_stats["stats"]["APRSDStats"]["version"]
        uptime = aprsd_stats["stats"]["APRSDStats"].get("uptime")
        return templates.TemplateResponse(
            request=request, name="index.html",
            context={
                "initial_stats": json.dumps(aprsd_stats, cls=aprsd_json.SimpleJSONEncoder),
                "aprs_connection": aprs_connection,
                "callsign": "WXNOW",
                "version": version,
                "uptime": uptime,
                "aprsd_version": aprsd_version,
                "mapbox_token": CONF.web.mapbox_token
            }
        )

    @app.get("/about", response_class=HTMLResponse)
    async def about(request: Request):
        aprsd_stats = fetch_stats()
        aprs_connection = (
            "APRS-IS Server: <a href='http://status.aprs2.net' >"
            "{}</a>".format(aprsd_stats["aprs-is"]["server"])
        )

        version = aprsd_stats["repeat"]["version"]
        aprsd_version = aprsd_stats["aprsd"]["version"]
        uptime = aprsd_stats["aprsd"].get("uptime")
        return templates.TemplateResponse(
            request=request, name="about.html",
            context={
                "initial_stats": json.dumps(aprsd_stats, cls=aprsd_json.SimpleJSONEncoder),
                "aprs_connection": aprs_connection,
                "callsign": "WXNOW",
                "version": version,
                "uptime": uptime,
                "aprsd_version": aprsd_version,
                "mapbox_token": CONF.web.mapbox_token
            }
        )

    @app.get("/wx_report/{station_id}", response_class=JSONResponse)
    async def wx_report(station_id: str, request: Request):
        LOG.info(f"Get wx_report for station_id {station_id}")
        report = fetch_wx_report(station_id, request)
        return report

    @app.get("/stations")
    async def get_stations():
        stations = _get_wx_stations()
        LOG.info(f"get_stations {len(stations)}")
        return json.dumps(stations)

    @app.get("/stats")
    async def stats():
        json.dumps(fetch_stats(), cls=aprsd_json.SimpleJSONEncoder)

    @app.get("/requests")
    async def get_requests():
        return fetch_requests()

    @app.get("/markers.js")
    async def markers_js(response: Response):
        stations = _get_wx_stations()
        LOG.warning(f"info? {_get_wx_stations.cache_info()}")
        LOG.warning(f"stations {len(stations)}")
        response.headers["Content-Type"] = "application/javascript"
        stations_str = "stations = {};"
        if stations:
            stations_str = (
                f"stations = {json.dumps(stations)};\n"
                "$(document).ready(function() {console.log('call update_map');update_map(stations);});"
            )

        #return stations_str
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
    global app, LOG

    conf_file = config_file
    if config_file != utils.DEFAULT_CONFIG_FILE:
        config_file = sys.argv[1:]

    app = create_app(config_file=config_file, log_level=log_level,
                     gunicorn=False)
    app.run(host="0.0.0.0", port=8080, debug=True)
