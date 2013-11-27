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
def_image = open('static/images/placeholder.jpeg', 'rb')
fbytes = def_image.read()
def_image.close()

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

class ProfileImageHandler(BaseHandler,ThreadableMixin):

    def _worker (self):
            profilepic = ProfileImageActions.get_image(self.i)
            if profilepic == None:
                self.set_header('Content-Type', 'image/jpg' )
                self.finish(fbytes)
                return
            thumbnail = self.get_argument("thumbnail",default=False)
            image = None
            if thumbnail:
                image = profilepic.image.thumbnail
            else:
                image = profilepic.image
            self.set_header('Content-Type', 'image/png' )
            self.res = image.read()
    
    @tornado.web.authenticated
    @tornado.web.asynchronous
    def get(self,uid):
        self.i = uid
        self.start_worker ()

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