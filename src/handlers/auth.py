
from models.response import ResponseModel
from util.MongoEncoder import *
from models.user import User
from handlers.user import UserActions

from tornado import gen
import tornado.web

from handlers.base import RestHandler
import hashlib
import bcrypt
import sys
import logging

logger = logging.getLogger(__name__)


class LoginHandler(RestHandler):
    
    """Expecting json args"""
    @tornado.web.asynchronous
    @gen.coroutine
    def post(self):
        try:
            username = self.get_json_arg("username", strip=True)
            password = self.get_json_arg("password", strip=True)
            response = ResponseModel()
            print username,password

            user = yield gen.Task(AuthActions._login,username, password)
            if user != None and user.active:
                self.set_current_user(user)
                self.uid = user.id
                self.username = user.username
                response.success = user != None
                response.model['user'] = user
                self.write_json(response)
            else:
                self.set_status(401, "Unauthorized")
                if not user.active:
                    response.args['Message'] = 'You must verify your email first'
                    response.args['Error'] = 1
                    self.write_json(response)
                    return

        except AttributeError as e:
            logger.error(self.request)
            self.set_status(401, "Unauthorized")
        except:
            self.set_status(401, "Unauthorized")


    
    def set_current_user(self, user):
        if user:
            self.set_secure_cookie("user", dumps(user.id))
            self.set_secure_cookie("username", dumps(user.username))
        else:
            self.clear_cookie("user")
            


class LogoutHandler(RestHandler):

    def get(self):
        self.clear_cookie("user")
        response = ResponseModel(success=True)
        self.write_json(response)


class PasswordChangeHandler(RestHandler):

    @tornado.web.authenticated
    @tornado.web.asynchronous
    @gen.coroutine
    def post(self,username=None):
        response = ResponseModel()
        try:
            old_pass = self.get_argument("old_pass", strip=True)
            new_pass = self.get_argument("new_pass", strip=True)
            curr_user = yield gen.Task(UserActions._get_user_by_id,self.current_uid(),detailed=True,deref=False)
            success = yield gen.Task(AuthActions._change_password,curr_user, old_pass, new_pass)
            response.model['password_change'] = success
#             print user.default_tags
        except Exception, e:
            response.success = False
            logger.error(e)

        self.write_json(response) 

class EmailConfirmHandler(RestHandler):

    def get(self):
        response = ResponseModel()
        try:
            uniqueid = self.get_argument('regid',strip=True).lower()
            user = User.objects(reg_id=uniqueid).first()
            if user != None:
                if user.active:
                    response.model['verification'] = True
                    self.write_json(response) 
                    return
                user.active = True
                user.save()
                response.model['verification'] = True
                
            else:
                response.model['verification'] = False
        except Exception, e:
            response.success = False
            response.model['verification'] = False
            logger.error(e)
        self.write_json(response) 


class AuthActions:
    
    @staticmethod
    def _login(username,password,callback=None):
        user = User.objects(username=username.lower()).only("username","password","salt","active").first()
        if user != None:
            salt = user.salt
            password = hashlib.sha224(password + salt).hexdigest()
            if user.password != password:
                user = None
        if callback != None:
            return callback(user)
        return user
    
    @staticmethod
    def _change_password(user,old_pass,new_pass,callback=None):
        if user != None:
            salt = user.salt
            password = hashlib.sha224(old_pass + salt).hexdigest()
            if user.password != password:
                if callback != None:
                    return callback(False)
                return False
            else:
                salt = bcrypt.gensalt()
                password = hashlib.sha224(new_pass + salt).hexdigest()
                user.salt = salt
                user.password = password
                user.save()
                if callback != None:
                    return callback(True)
                return True
        if callback != None:
                return callback(False)
        return False