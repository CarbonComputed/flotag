from tornado import gen
import tornado.web
from util.MongoEncoder import *

import re
import util.scraper

import logging

from util.callit import *

logger = logging.getLogger(__name__)


class ThreadableMixin:
    def start_worker (self):
        threading.Thread (target = self.worker). start ()
 
    def worker (self):
        try:
            self._worker ()
        except tornado.web.HTTPError, e:
            self.set_status (e.status_code)
        except:
            logging.error ("_worker problem ", exc_info = True)
            self.set_status (500)
        tornado.ioloop.IOLoop.instance (). add_callback (self.async_callback (self.results))
 
    def results (self):
        if self.get_status () != 200:
            self.send_error (self.get_status ())
            return
        if hasattr (self, 'res'):
            self.finish (self.res)
            return
        if hasattr (self, 'redir'):
            self.redirect (self.redir)
            return
        self.send_error (500)


class MediaHandler(tornado.web.RequestHandler,ThreadableMixin):
    def _worker (self):
        url = self.get_argument("url",strip=True)
        height = self.get_argument("height",strip=True,default="250")
        width = self.get_argument("width",strip=True,default="480")
        if len(url) == 0:
            self.finish()
            return
        embed = self.get_argument("embed",strip=True,default=False)
        link = util.scraper.get_link(url)
        try:
            self.res = link.data
        except Exception, e:
            logger.error(e)
    
    @tornado.web.asynchronous
    def get(self):
        self.start_worker ()

       
#         if embed:
#             if link.embed != None:
# #                 link.embed = re.sub(r'width="\d+"', 'width='+width, link.embed)
# #                 link.embed = re.sub(r'height="\d+"', 'height='+height, link.embed)
#                 self.write(link.data)
# #                 self.write(link.embed)
#         else:
#             if link.image != None:
#                 self.write(link.data)
        #self.write()
#                 self.write(link.image)
