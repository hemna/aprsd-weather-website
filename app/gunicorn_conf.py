# Gunicorn config variables
loglevel = "info"
errorlog = "-"  # stderr
accesslog = "logs/access.log"  # stdout
worker_tmp_dir = "logs/"
graceful_timeout = 120
timeout = 120
keepalive = 5
threads = 3
