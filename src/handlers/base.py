import tornado.web
from models.user import User
import handlers.auth
from util.MongoEncoder import *

from models.receive import *
import base64
import logging

from util.callit import *


logger = logging.getLogger(__name__)


class BaseHandler(tornado.web.RequestHandler):

    def get_current_user(self):
        user = self.get_secure_cookie("user")
        if user:
            self.uid = loads(user)
            self.username = loads(self.get_secure_cookie("username"))
        if not user: 
            logger.info('Trying http')
            user_http = self._http_basic()
        if not user and not user_http:
            logger.info("Login Failed")
            return None
        return dumps(user)

    def current_uid(self):
        return self.uid
    
    def current_username(self):
        return self.username
    
    def _http_basic(self):
        auth_header = self.request.headers.get("Authorization", "")
        if auth_header.startswith("Basic "):
            string = base64.b64decode(auth_header.split(" ")[1])
            credentials = string.split(":")
            username = credentials[0]
            password = credentials[1]
            try:
                user = handlers.auth.AuthActions._login(username, password)# check the credentials against whatever datastore you are using
            except:
                raise tornado.web.HTTPError(401)
            if user == None:
                raise tornado.web.HTTPError(401) # if the credentials are incorrect raise a 403
            self.uid = user.id
            self.username = user.username 
            return user # return the user
        raise tornado.web.HTTPError(401)

class RestHandler(BaseHandler):

    def prepare(self):
        if self.request.headers.get("Content-Type") != None  and  "application/json" in self.request.headers.get("Content-Type") :
            logger.debug("request:" + self.request.body)
            self.json_args = loads(self.request.body)
            self.json_msg = ReceiveModel()
            self.json_msg.args = self.json_args.get("args",{})
            self.json_msg.models = self.json_args.get("models",{})


    def set_default_headers(self):
        self.set_header("Access-Control-Allow-Origin", "*")
        self.set_header("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, X-Requested-With")
        self.set_header("Access-Control-Allow-Methods","GET, POST, PUT, DELETE, OPTIONS")

    def get_json_arg(self,name,default=None,strip=True):
        if default != None:
            if strip:
                return self.json_msg.args.get(name,default).strip()
            else:
                return self.json_msg.args.get(name,default)
        return self.json_msg.args.get(name)

    def get_json_model(self,name,default=None):
        return self.json_msg.models.get(name,default)

    def get_json_models(self):
        return self.json_msg.models

    def write_json(self,response):
        logger.debug('response:' +str(response))
        self.write(str(response))
        self.finish()
        
class UnauthorizedHandler(tornado.web.RequestHandler):
    def get(self):
        self.set_status(401, "Unauthorized")
