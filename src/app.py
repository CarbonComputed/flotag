#!/usr/bin/env python

import tornado.httpserver
import tornado.ioloop
import tornado.web
from tornado.options import options

from settings import settings
from urls import url_patterns
import logging
from mongoengine import *
from util.callit import *

logger = logging.getLogger(__name__)


class Flotag(tornado.web.Application):
    def __init__(self,numthreads):
        if settings['log_file']:
            pass
#             fh = logging.FileHandler(settings['log_file'])
#             logger.setLevel(settings['log_level'])
#             logger.addHandler(fh)
        tornado.web.Application.__init__(self, url_patterns, **settings)
        CallIT.start_pool(numthreads);
        connect(options.db)

def main():
    app = Flotag(20)
    app.listen(options.port)
    logger.info ('http://127.0.0.1:'+str(options.port))
    tornado.ioloop.IOLoop.instance().start()

if __name__ == "__main__":
    main()