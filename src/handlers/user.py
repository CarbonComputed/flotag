from handlers.base import RestHandler
from models.response import ResponseModel
from models.user import User,Vote,Notification,TagNotification
from models.tag import *
from models.profile_image import ProfileImage
from handlers.profile_image import ProfileImageActions
from util.MongoEncoder import *
import lib.emailer

from tornado import gen
import tornado.web
from mongoengine import *
import bcrypt
import hashlib
import base64
import logging
import datetime

from util.callit import *

from sys import platform as _platform
from recaptcha.client import captcha


logger = logging.getLogger(__name__)



class UserHandlerById(RestHandler):
    
    @tornado.web.authenticated
    @tornado.web.asynchronous
    @gen.coroutine
    def get(self,id):
        response = ResponseModel()
        try:

            if id == None:
                raise Exception("No id provided")
            detailed = self.get_argument("detailed",False)
            fields = self.get_argument("fields",default=[])
            if fields != []:
                fields = fields.split(",")
            elif self.current_uid != id and detailed:
                raise Exception("Invalid Permissions")
            else:
                response.model['user'],error = yield gen.Task(CallIT.gen_run,UserActions._get_user_by_id,id,detailed=False,includes=fields)
                if response.model['user'] == None:
                    self.set_status(404, "User not found")
        except Exception, e:
            response.success = False
            response.args['Message'] = e.message
            logger.error(e)
        self.write_json(response)

class UserHandlerByName(RestHandler):
    
    @tornado.web.authenticated
    @tornado.web.asynchronous
    @gen.coroutine
    def get(self,username):
        response = ResponseModel()
        try:
            username = username.lower()
            if username == None:
                raise Exception("No username provided")
            detailed = self.get_argument("detailed",False)
            fields = self.get_argument("fields",default=[])
            if fields != []:
                fields = fields.split(",")
            elif self.current_username() != username and detailed:
                raise Exception("Invalid Permissions")
            else:
                response.model['user'],error = yield gen.Task(CallIT.gen_run,UserActions._get_user_by_name,username,detailed,includes=fields)
        except Exception, e:
            response.success = False
            response.args['Message'] = e.message
            logger.error(e)
        self.write_json(response)
 
    @tornado.web.asynchronous
    @gen.coroutine
    def post(self,username):
        response = ResponseModel()
        user = None
        pro_img = None
        try:
            rip = self.request.remote_ip
            if rip == '127.0.0.1':
                rip = self.settings['local_ip']
            recaptcha = self.get_json_model("recaptcha")
            cap_resp = captcha.submit(recaptcha['challenge'],recaptcha['response'],self.settings['captcha_priv'],rip)
            if not cap_resp.is_valid:
                response.success = False
                response.args['Message'] = 'Captcha Fail'
                response.args['Error'] = 1
                self.write_json(response) 
                return
            img = self.get_json_model("profile_img",default=None)
            user_data = self.get_json_model('user')
            
            user,error = yield gen.Task (CallIT.gen_run,UserActions._register,user_data,user_data['password'])
            pro_img,error = yield gen.Task(CallIT.gen_run,ProfileImageActions.save_profile_image,user.id, user, img)
            #Maybe return user here,
            response.model['user'] = "success"
        except Exception, e:
            if isinstance(user,Document):
                user.delete()
            if isinstance(pro_img,Document):
                pro_img.delete()
            response.success = False
            response.args['Message'] = e.message
            logger.error(e)
            if "username" in e.message and "duplicate" in e.message:
                response.args['Error'] = 2
            if "email" in e.message and "duplicate" in e.message:
                response.args['Error'] = 3
                self.write_json(response)
                return
        if _platform == "linux" or _platform == "linux2":
            lib.emailer.send_confirmation(user.email,user.reg_id)
        self.write_json(response) 

    @tornado.web.authenticated
    @tornado.web.asynchronous 
    @gen.coroutine
    def put(self,username):
        response = ResponseModel()
        try:
            img = self.get_json_model("profile_img",default=None)
            cur_user = yield gen.Task(UserActions._get_me_by_id,self.current_uid())
            user = yield gen.Task (UserActions._update,cur_user,self.get_json_model('user'))
            if img != None:
                yield gen.Task(ProfileImageActions.save_profile_image,user.id, user, img)
                    
            response.model['user'] = yield gen.Task(UserActions._get_user_by_id,self.current_uid())
        except Exception, e:
            response.success = False
            logger.error(e)
        self.write_json(response) 

    @tornado.web.authenticated
    @tornado.web.asynchronous
    @gen.coroutine
    def delete(self,username):
        response = ResponseModel()
        try:
            cur_user = yield gen.Task(UserActions._get_user_by_id,self.current_uid())
            user = yield gen.Task (UserActions._delete_user,cur_user)
            response.model['user'] = user
        except Exception, e:
            response.success = False
            logger.error(e)
        self.write_json(response) 
    

class UserMeHandler(UserHandlerByName):
    
    @tornado.web.authenticated
    def get(self):
        super(UserMeHandler, self).get(self.current_username())


class UserFollowerHandler(RestHandler):
    
    @tornado.web.authenticated
    @tornado.web.asynchronous
    @gen.coroutine
    def get(self,username=None):
        response = ResponseModel()
        try:
            if username == None:
                username = self.current_uid()
            tags,error = yield gen.Task(CallIT.gen_run,UserActions._get_followers,username)
            response.model['followers'] = tags

        except Exception, e:
            response.success = False
            logger.error(e)
        self.write_json(response)
    

class UserDefaultTagHandler(RestHandler):
    
    @tornado.web.authenticated
    @tornado.web.asynchronous
    @gen.coroutine
    def get(self,username=None):
        response = ResponseModel()
        try:
            if username == None:
                cur_user = yield gen.Task(UserActions._get_user_by_id,self.current_uid())
            else:
                cur_user = yield gen.Task(UserActions._get_user_by_id,username)
            tags,error = yield gen.Task(CallIT.gen_run,UserActions._get_default_tags,cur_user)
            response.model['tags'] = tags
        except Exception, e:
            response.success = False
            logger.error(e)
        self.write_json(response)
    
    @tornado.web.authenticated
    @tornado.web.asynchronous
    @gen.coroutine
    def post(self,username=None):
        response = ResponseModel()
        try:
            tags = self.get_json_model('tags')
            cur_user = yield gen.Task(UserActions._get_user_by_id,self.current_uid(),detailed=True,deref=False)
            cur_user.reload()
            user,error = yield gen.Task (CallIT.gen_run,UserActions._add_tags_default,cur_user, tags, save=True)
            response.model['user'] = "user"
#             print user.default_tags
        except Exception, e:
            response.success = False
            logger.error(e)

        self.write_json(response) 
    

    @tornado.web.authenticated
    @tornado.web.asynchronous
    @gen.coroutine
    def delete(self,username=None):
        response = ResponseModel()
        try:
            tags = self.get_json_model('tags')
            cur_user = yield gen.Task(UserActions._get_user_by_id,self.current_uid(),detailed=True,deref=False)
            cur_user.reload()

            user,error = yield gen.Task (CallIT.gen_run,UserActions._remove_tags_default,cur_user, tags, save=True)
            response.model['user'] = "user"
#             print user.default_tags
        except Exception, e:
            response.success = False
            logger.error(e)
        self.write_json(response) 

class NotificationHandler(RestHandler):
    
    @tornado.web.authenticated
    @tornado.web.asynchronous
    @gen.coroutine
    def get(self):
        response = ResponseModel()
        try:
            nresults = int(self.get_argument("nresults",strip=True,default=20))
            page = int(self.get_argument("page",strip=True,default=1))
        except Exception, e:
            response.success = False
            response.args['Message'] = "Error parsing arguments"
            logger.error(e)
            self.write_json(response)
            return  
        try:
            response.model['notifications'],error = yield gen.Task(CallIT.gen_run,UserActions._get_notifications,self.current_uid(), nresults, page)
        except Exception, e:
            response.success = False
            response.args['Message'] = e.message
            logger.error(e)
        self.write_json(response)

class ReadNotificationHandler(RestHandler):

    @tornado.web.authenticated
    @tornado.web.asynchronous
    @gen.coroutine
    def post(self,not_id=None):
        response = ResponseModel()

        try:
            user = yield gen.Task(UserActions._get_me_by_id,self.current_uid())
            if not_id == None:
                resp = UserActions._read_all_notifications(user)
                response.model['read'] = resp
            else:
                resp = UserActions._read_notification(user, not_id)
                response.model['read'] = resp
        except Exception, e:
            response.success = False
            response.args['Message'] = e.message
            logger.error(e)
        self.write_json(response)


class CheckLoginHandler(RestHandler):
    
    @tornado.web.authenticated
    @tornado.web.asynchronous
    @gen.coroutine
    def get(self):
        response = ResponseModel()
        response.success = True
        response.args['Message'] = "Status: OK"
        self.write_json(response)


class UserActions:

    @staticmethod
    def _get_me_by_id(_id,detailed=False,excludes=None,includes=None,callback=None):
            if includes == None:
                includes = []
            if excludes == None:
                excludes = []
            if not detailed:
                excludes.extend(excludes)
            if callback != None:
                return callback(User.objects(id=_id).exclude(*excludes).only(*includes).first())
            return User.objects(id=_id).exclude(*excludes).only(*includes).first()
    

    """Retrieves the user by username"""
    @staticmethod
    def _get_user_by_name(usernamet,detailed=False,deref=False,excludes=None,includes=None,callback=None):
            if includes == None:
                includes = []
            if excludes == None:
                excludes = ["date_modified","reg_id","password","salt"]
            if not detailed:
                excludes.extend(["reg_id","password","notifications","current_tags","votes","salt","email","date_modified"])
            if not deref:

                user = User.objects(username=usernamet).no_dereference().exclude(*excludes).only(*includes).first()
            else:
                user = User.objects(username=usernamet).exclude(*excludes).only(*includes).first()
            if callback != None:
                return callback(user)
            return user
    
    """Retrieves the user by id"""
    @staticmethod
    def _get_user_by_id(_id,detailed=False,deref=False,excludes=None,includes=None,callback=None):
            if includes == None:
                includes = []
            if excludes == None:
                excludes = ["date_modified","reg_id","password","salt"]
            if not detailed:
                excludes.extend(["password","notifications","current_tags","votes","salt","email","reg_id"])
            if not deref:
                user =User.objects(id=_id).no_dereference().exclude(*excludes).only(*includes).first()
            else:
                user = User.objects(id=_id).exclude(*excludes).only(*includes).first()
            if callback != None:
                return callback(user)
            return user

    @staticmethod
    def _register(user,password,callback=None):
            user = UserActions._clean_user_json(user)
            salt = bcrypt.gensalt()
            
            password = hashlib.sha224(password + salt).hexdigest()
            user['salt'] = salt
            user['username'] = user['username'].lower()
            user['password'] = password
            user['reg_id'] = ObjectId()
            usermodel = User.from_json(dumps(user))
            usermodel.username = usermodel.username.lower()
            usermodel.email = usermodel.email.lower()
            usermodel.save()
            if callback != None:
                return callback(usermodel)
            return usermodel
        
    @staticmethod
    def _update(user,user_data,callback=None):
        user_data = UserActions._clean_user_json(user_data)
        for k, v in user_data.items():
            if k == '_id' : continue
            if k == 'username': continue
            if k not in ['name','about','email']: continue
            if v == None: continue
            field = user._fields[k]

            if isinstance(field, ReferenceField):
                v = DBRef(field.document_type._get_collection_name(), ObjectId(v))
            setattr(user,k, v)
#         print dumps(user)
        user.date_modified = datetime.datetime.now()
        user.save()
        if callback != None:
            return callback(user)
        return user
    
    @staticmethod
    def _clean_user_json(user_data):
        clean_data = {}
        update_fields = ['name','about','email','username']
        for k in user_data:
            if k in update_fields:
                clean_data[k] = user_data[k]
        return clean_data
        
    @staticmethod
    def _update_password(user,password,save=True):
        pass
    
    @staticmethod
    def _update_username(user,username,save=True):
        user.username = username
        if save:
            user.save()

    @staticmethod
    def _update_name(user,name,save=True):
        user.name = name
        if save:
            user.save()
    
    @staticmethod
    def _update_email(user,email,save=True):
        user.email = email
        if save:
            user.save()
    
    

    @staticmethod
    def _get_notifications(user_id,nresults=20,page=1,callback=None):
        user = User.objects(id=user_id).first()
        start = ((page-1) * nresults)
        end = (((page-1) * nresults)+nresults)
        nots = user.notifications
        nots.reverse()
        nots = nots[start:end]
        if callback != None:
            return callback(nots)
        return nots
        
    

    @staticmethod
    def _add_tags_default(user,tags,save=True,callback=None):
        tags = list(set(tags) - set(user.default_tags))
        user.update(add_to_set__default_tags=tags)
        if save:
            user.save()
        user = UserActions._get_user_by_id(user.id)
#         print set(user.default_tags) 
#         print set(tags) - set(user.default_tags) 
        Tag.objects(id__in=tags).update(inc__frequency=1)
#         print  "tags",Tag.objects(id__in=tags)
        #Push a notification to the users that says you are following them
        if len(tags) > 0:
            message = user.username + " has added you as a tag."
            n = TagNotification(message=message,user=user)
            User.objects(Q(id__in=tags) & Q(id__ne=user.id)).update(push__notifications=n)
            

        if callback != None:
            return callback(user)
        return user
    
    @staticmethod
    def _remove_tags_default(user,tags,save=True,callback=None):
        tags = list(set(tags) & set(user.default_tags))
        user.update(pull_all__default_tags=tags)
        if save:
            user.save()

        user = UserActions._get_user_by_id(user.id)
        Tag.objects(id__in=tags).update(dec__frequency=1)
#         print Tag.objects(id__in=tags)
        if callback != None:
            return callback(user)
        return user
    
    @staticmethod
    def _get_default_tags(user,callback=None):
        excludes = ["password","notifications","current_tags","votes","salt","email"]
        tags = Tag.objects(id__in=user.default_tags).exclude(*excludes)
        if callback != None:
            return callback(tags)
        return tags
    
    @staticmethod
    def _get_followers(uid,callback=None):
        excludes = ["password","notifications","current_tags","votes","salt","email"]
        followers = User.objects(default_tags=ObjectId(uid)).exclude(*excludes)
        if callback != None:
            return callback(followers)
        return followers
    
    
    @staticmethod
    def _activate(user,save=True):
        user.active = True
        if save:
            user.save()
    
    @staticmethod
    def _add_notification(user,notification,save=True):
        user.update(push__notifications=notification)
        if save:
            user.save()

    @staticmethod
    def _remove_notification(user,notification_id,save=True):
        user.update(pull__notifications=next((x for x in user.notifications if x.id == notification_id), None))
        if save:
            user.save()

    @staticmethod
    def _read_notification(user,notification_id,save=True):
        nots = filter(lambda x: x.id == ObjectId(notification_id), user.notifications)
        if len(nots) != 1:
            raise Exception("There can only be one!!")
        nots[0].read = True
        if save:
            user.save() 
        return nots[0]
    
    @staticmethod
    def _remove_all_notifications(user,save=True):
        user.notifications = []
        if save:
            user.save()

    @staticmethod
    def _read_all_notifications(user,save=True):
        for notification in user.notifications:
            notification.read = True
        if save:
            user.save()
        return True
    
    @staticmethod
    def _vote(user,post_id,state,save=True):
        vote = next((x for x in user.votes if x.id == post_id),None)
        if vote == None:
            vote = Vote(post_id=post_id,state=state)
            user.update(push__votes=vote)
        vote.state = state
        if save:
            user.save()
    
    @staticmethod
    def _delete_user(user,callback=None):
        user.delete()
        ProfileImage.objects(owner=user.id).delete()
        if callback != None:
            return callback(user)
        return user

    
