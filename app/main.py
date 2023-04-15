import aprsd.conf.common
import click
import datetime
import json
import logging as python_logging
import requests
import sys

import flask
from flask import Flask, request
from geojson import Feature, Point
from oslo_config import cfg
from whitenoise import WhiteNoise
from aprsd.rpc import client as aprsd_rpc_client

#from . import log
#from . import utils

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
CONF.register_opts(aprsd.conf.common.rpc_opts, group="rpc_settings")
API_KEY_HEADER = "X-Api-Key"
app = Flask(__name__,
            static_url_path="/static",
            static_folder="web/static",
            template_folder="web/templates")


def fetch_stats():
    stats = aprsd_rpc_client.RPCClient().get_stats_dict()
    if not stats:
        stats_dict = {
            "aprsd": {},
            "aprs-is": {"server": ""},
            "messages": {
                "sent": 0,
                "received": 0,
            },
            "email": {
                "sent": 0,
                "received": 0,
            },
            "seen_list": {
                "sent": 0,
                "received": 0,
            },
        }
    LOG.debug(f"stats {stats}")
    if "aprsd" in stats:
        if "watch_list" in stats["aprsd"]:
            del stats["aprsd"]["watch_list"]
    del stats["email"]
    del stats["messages"]
    stats["repeat"] = {}
    if "aprsd_repeat_plugins.version.VersionPlugin" in stats["plugins"]:
        stats["repeat"]["version"] = stats["plugins"]["aprsd_repeat_plugins.version.VersionPlugin"]["version"]
    else:
        stats["repeat"]["version"] = "dev"
    del stats["plugins"]

    if "REPEAT" in stats["aprsd"]["seen_list"]:
        del stats["aprsd"]["seen_list"]["REPEAT"]

    seen_list = stats["aprsd"]["seen_list"]
    for call in seen_list:
        # add a ts 2021-11-01 16:18:11.631723
        date = datetime.datetime.strptime(seen_list[call]['last'], "%Y-%m-%d %H:%M:%S.%f")
        seen_list[call]["ts"] = int(datetime.datetime.timestamp(date))
    return stats


def fetch_requests():
    url = f"http://{CONF.web.haminfo_ip}:{CONF.web.haminfo_port}/requests"
    # LOG.debug(f"Fetching {url}")
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
            # self.cs.print(json_record)
            for entry in json_record:
                # self.cs.print(entry)
                entry['stations'] = entry['stations'].replace(',', ', ')

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


@app.route("/stats")
def stats():
    return fetch_stats()


@app.route("/requests")
def get_requests():
    return fetch_requests()


@app.route("/stations", methods=['POST'])
def get_stations():
    url = f"http://{CONF.web.haminfo_ip}:{CONF.web.haminfo_port}/stations"
    # LOG.debug(f"Fetching {url}")
    try:
        request_data = request.get_json()
    except Exception as ex:
        LOG.error(ex)

    LOG.info(f"Request_data {request_data}")
    if 'repeater_ids' in request_data and request_data["repeater_ids"]:
        params = {"repeater_ids": request_data["repeater_ids"].split(',')}
    else:
        params = {'callsigns': request_data["callsigns"].split(', ')}

    LOG.info(f"Get Stations from {params}")

    stations = []
    try:
        headers = {API_KEY_HEADER: CONF.web.api_key}
        response = requests.post(url=url, json=params, headers=headers,
                                 timeout=2)
        if response.status_code == 200:
            json_record = response.json()

            for entry in json_record:
                LOG.info(entry)
                point = Point((entry['long'], entry['lat']))
                marker = Feature(geometry=point,
                                 id=entry['id'],
                                 properties=entry
                                 )
                stations.append(marker)
                # self.cs.print(entry)
        else:
            LOG.error(response)

    except Exception as ex:
        LOG.error(ex)

    return json.dumps(stations)


@app.route("/")
def index():
    aprsd_stats = fetch_stats()
    LOG.debug(aprsd_stats)
    aprs_connection = (
        "APRS-IS Server: <a href='http://status.aprs2.net' >"
        "{}</a>".format(aprsd_stats["aprs-is"]["server"])
    )

    version = aprsd_stats["repeat"]["version"]
    aprsd_version = aprsd_stats["aprsd"]["version"]
    return flask.render_template("index.html",
                                 initial_stats=aprsd_stats,
                                 aprs_connection=aprs_connection,
                                 callsign='REPEAT',
                                 version=version,
                                 aprsd_version=aprsd_version,
                                 mapbox_token=CONF.web.mapbox_token
                                 )


@app.route("/about")
def about():
    aprsd_stats = fetch_stats()
    aprs_connection = (
        "APRS-IS Server: <a href='http://status.aprs2.net' >"
        "{}</a>".format(aprsd_stats["aprs-is"]["server"])
    )

    version = aprsd_stats["repeat"]["version"]
    aprsd_version = aprsd_stats["aprsd"]["version"]
    return flask.render_template("about.html",
                                 initial_stats=aprsd_stats,
                                 aprs_connection=aprs_connection,
                                 callsign='REPEAT',
                                 version=version,
                                 aprsd_version=aprsd_version,
                                 mapbox_token=CONF.web.mapbox_token
                                 )


def create_app(config_file=None, log_level=None, gunicorn=False):
    """Used for running under gunicorn."""
    global app, LOG

    if not config_file:
        conf_file = utils.DEFAULT_CONFIG_FILE
        config_file = ["--config-file", conf_file]
    else:
        config_file = ["--config-file", config_file]

    if not log_level:
        log_level = "DEBUG"

    print(f"config file {config_file}")

    CONF(config_file, project='aprsd_repeat', version="1.0.0")
    python_logging.captureWarnings(True)
    LOG = log.setup_logging(app, gunicorn=gunicorn)
    # Dump all the config options now.
    CONF.log_opt_values(LOG, python_logging.DEBUG)
    app = WhiteNoise(app, root="/app/web/static/html")
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
    app.logger.info("main(): penis")
    app.run(host="0.0.0.0", port=8080, debug=True)


def runit():
    global app
    print("runit!")
    app = create_app(log_level="DEBUG",
                     gunicorn=False)
    app.logger.info("runit(): penis")
    app.run(host="0.0.0.0", port=8080, debug=True)



if __name__ == "app.main":
    runit()


if __name__ == "__main__" or __name__ == "app.main":
    # Only for debugging while developing
    main()
