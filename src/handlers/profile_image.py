from handlers.base import BaseHandler
from models.response import ResponseModel
from models.user import User
from models.tag import Tag
from models.profile_image import ProfileImage
from util.MongoEncoder import *

from tornado import gen
import tornado.web
from mongoengine import *
import bcrypt
import hashlib
import logging
import cStringIO

from util.callit import *
logger = logging.getLogger(__name__)


class ProfileImageHandler(BaseHandler):

    @tornado.web.authenticated
    @tornado.web.asynchronous
    @gen.coroutine 
    def get(self,uid):
            profilepic,error = yield gen.Task(CallIT.gen_run,ProfileImageActions.get_image, uid)
            if profilepic == None:
                self.set_header('Content-Type', 'image/jpg' )
                self.render(self.settings['static_path']+"/images/placeholder.jpeg")
                return
            thumbnail = self.get_argument("thumbnail",default=False)
            image = None
            if thumbnail:
                image = profilepic.image.thumbnail
            else:
                image = profilepic.image
            self.set_header('Content-Type', 'image/png' )
            self.finish(image.read())


class ProfileImageActions:
    @staticmethod
    def get_image(uid,callback=None):

        profilepic = ProfileImage.objects(owner=uid).first()
        if profilepic == None:
            profilepic = ProfileImage.objects(id=uid).first()
        if callback != None:
            return callback(profilepic)
        return profilepic
        
    #image is base64
    @staticmethod
    def save_profile_image(uid,owner,image,callback=None):
            image = cStringIO.StringIO(base64.b64decode(image))
            cur_img = ProfileImage.objects(owner=uid).first()
            if cur_img != None:
                if image != None:
                    cur_img.image.replace(image,filename=owner.username)
                    cur_img.save()
                    user = Tag.objects(id=uid).first()
                    user.profile_img = cur_img
                    user.save()
            else:
                if image != None:
                    cur_img = ProfileImage(owner=uid)
                    cur_img.image.put(image,filename=owner.username)
                    cur_img.save()
                    user = Tag.objects(id=uid).first()
                    user.profile_img = cur_img
                    user.save()
            if callback != None:
                return callback(cur_img)
            return cur_img
