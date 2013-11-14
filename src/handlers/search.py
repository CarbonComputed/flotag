from handlers.base import RestHandler
from models.response import ResponseModel
from models.user import User,Vote,Notification,TagNotification
from models.tag import *
from models.profile_image import ProfileImage
from handlers.profile_image import ProfileImageActions
from util.MongoEncoder import *

from tornado import gen
import tornado.web
from mongoengine import *
import bcrypt
import hashlib
import base64
import logging
import datetime

logger = logging.getLogger(__name__)

class SearchHandler(RestHandler):
    
    @tornado.web.authenticated
    @tornado.web.asynchronous
    @gen.coroutine
    def get(self):
        response = ResponseModel()
        try:

            query = self.get_argument("q",strip=True)
            fields = self.get_argument("fields",default=[])
            if fields != []:
                fields = fields.split(",")
            
            response.model['search'] = yield gen.Task(SearchActions.search,query)
        except Exception, e:
            response.success = False
            response.args['Message'] = e.message
            logger.error(e)
        self.write_json(response)
        
class SearchActions:

    #check if active
    
    @staticmethod
    def search(query,callback=None):
        results = {}
        results['users'] = User.objects(Q(name__istartswith=query) |  Q(username__istartswith=query)).only("_id","name","username","about")
        results['tags'] = Tag.objects(Q(name__istartswith=query)).no_sub_classes().only("_id","name","about")
        if callback != None:
            return callback(results)
        return results