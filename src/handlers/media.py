from tornado import gen
import tornado.web
from util.MongoEncoder import *

import re
import util.scraper

import logging

from util.callit import *

logger = logging.getLogger(__name__)

class MediaHandler(tornado.web.RequestHandler):
    
    @tornado.web.asynchronous
    @gen.coroutine
    def get(self):
        url = self.get_argument("url",strip=True)
        height = self.get_argument("height",strip=True,default="250")
        width = self.get_argument("width",strip=True,default="480")
        if len(url) == 0:
            self.finish()
            return
        embed = self.get_argument("embed",strip=True,default=False)
        link,error = yield gen.Task(CallIT.gen_run,util.scraper.get_link,url)
       
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
        try:
            self.finish(link.data)
        except Exception, e:
            logger.error(e)