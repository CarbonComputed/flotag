import logging
import tornado
import tornado.template
import os
from tornado.options import define, options

import environment
import logconfig

# Make filepaths relative to settings.
path = lambda root,*a: os.path.join(root, *a)
ROOT = os.path.dirname(os.path.abspath(__file__))

define("port", default=8000, help="run on the given port", type=int)
define("config", default=None, help="tornado config file")
define("debug", default=True, help="debug mode")
define("db", default="flotag_dev", help="run on the given database", type=str)
define("log", default=None, help="Log to the given file", type=str)


tornado.options.parse_command_line()

MEDIA_ROOT = path(ROOT, 'static')
TEMPLATE_ROOT = path(ROOT, 'templates')

# Deployment Configuration

class DeploymentType:
    PRODUCTION = "PRODUCTION"
    DEV = "DEV"
    SOLO = "SOLO"
    STAGING = "STAGING"
    dict = {
        SOLO: 1,
        PRODUCTION: 2,
        DEV: 3,
        STAGING: 4
    }

if 'DEPLOYMENT_TYPE' in os.environ:
    DEPLOYMENT = os.environ['DEPLOYMENT_TYPE'].upper()
else:
    DEPLOYMENT = DeploymentType.SOLO

settings = {}
settings['debug'] = DEPLOYMENT != DeploymentType.PRODUCTION or options.debug
settings['static_path'] = MEDIA_ROOT
settings['cookie_secret'] = os.environ.get('COOKIE_SECRET',"fancy")
if not os.environ.get('COOKIE_SECRET',False):
    logging.error("COOKE SECRET NOT SET")
settings['xsrf_cookies'] = False
settings['template_loader'] = tornado.template.Loader(TEMPLATE_ROOT)
settings['login_url'] = '/unauthorized'
settings['local_ip'] = '66.44.225.102'
settings['captcha_priv'] = os.environ.get('CAPTCHA_PRIV',"secret")
if not os.environ.get('COOKIE_SECRET',False):
    logging.error("Captcha private not set!")
settings['log_file'] = options.log


SYSLOG_TAG = "flotag"
SYSLOG_FACILITY = logging.handlers.SysLogHandler.LOG_LOCAL2

# See PEP 391 and logconfig for formatting help.  Each section of LOGGERS
# will get merged into the corresponding section of log_settings.py.
# Handlers and log levels are set up automatically based on LOG_LEVEL and DEBUG
# unless you set them here.  Messages will not propagate through a logger
# unless propagate: True is set.
LOGGERS = {
   'loggers': {
        'boilerplate': {},
    },
}

if settings['debug']:
    LOG_LEVEL = logging.DEBUG
else:
    LOG_LEVEL = logging.INFO
settings['log_level'] = LOG_LEVEL
USE_SYSLOG = DEPLOYMENT != DeploymentType.SOLO

if settings['log_file']:
    logging.basicConfig(filename=settings['log_file'], filemode='w', level=LOG_LEVEL)

if options.config:
    tornado.options.parse_config_file(options.config)