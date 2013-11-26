from handlers.base import RestHandler
from models.response import ResponseModel
from models.tag import *
from models.post import *
from handlers.user import UserActions
from handlers.profile_image import ProfileImageActions
from util.MongoEncoder import *
from mongoengine import *
from datetime import date, timedelta

from util.callit import *

from tornado import gen
import tornado.web

import logging
import datetime

import random

logger = logging.getLogger(__name__)

    
class TagHandler(RestHandler):
    
    @tornado.web.asynchronous
    @gen.coroutine
    def get(self,tag_id):
        response = ResponseModel()
        q = self.get_argument("q",strip=True,default=False)
        try:
            nresults = int(self.get_argument("nresults",strip=True,default=50))
            page = int(self.get_argument("page",strip=True,default=1))
            tagids = self.get_argument("tag_ids",strip=True,default=False)
        
            if q:
                response.model['tags'],error = yield gen.Task(CallIT.gen_run,TagActions._get_tags_by_freq,q, nresults, page)
            elif tagids:
                response.model['tags'],error = yield gen.Task(CallIT.gen_run,TagActions._get_tags_by_ids,tagids)
            elif tag_id != None:
                response.model['tags'],error = yield gen.Task(CallIT.gen_run,TagActions._get_tag_by_id,tag_id)
            else:
                response.model['tags'],error = yield gen.Task(CallIT.gen_run,TagActions._get_top_tags,nresults, page)
            if not response.model['tags']:
                self.set_status(404, "Tag not found")
        except Exception, e:
            response.success = False
            response.args['Message'] = e.message
            logger.error(e)

        self.write_json(response)    
        
    
    @tornado.web.authenticated
    @tornado.web.asynchronous
    @gen.coroutine
    def post(self,tag_id):
        response = ResponseModel()
        img = self.get_json_model("profile_img",default=None)
        try:
            tag_model = self.get_json_model("tag")
            
            user = yield gen.Task(UserActions._get_user_by_id,self.current_uid())
            tag,error = yield gen.Task(CallIT.gen_run,TagActions._create_tag,user, tag_model)
            response.model['tag'] = tag
            if img != None:
                pro_img,error = yield gen.Task(CallIT.gen_run,ProfileImageActions.save_profile_image,tag.id, user, img)
        except Exception, e:
            if isinstance(tag,Document):
                tag.delete()
            if isinstance(pro_img,Document):
                pro_img.delete()
            response.success = False
            response.args['Message'] = e.message
            logger.error(e)
        self.write_json(response) 

    @tornado.web.authenticated
    @tornado.web.asynchronous
    @gen.coroutine
    def put(self,tag_id):
        response = ResponseModel()
        try:
            img = self.get_json_model("profile_img",default=None)
            user = yield gen.Task(UserActions._get_me_by_id,self.current_uid())
            tag = yield gen.Task(TagActions._get_tag_by_id,tag_id)
            tag_model = self.get_json_model("tag")
            response.model['tag'] = yield gen.Task(TagActions._update_tag,user, tag,tag_model)
            if img != None:
                yield gen.Task(ProfileImageActions.save_profile_image,tag.id,user, img)
        except Exception, e:
            response.success = False
            response.args['Message'] = e.message
            logger.error(e)
        self.write_json(response)

    def delete(self,tag_id):
        pass


class TrendingTagHandler(RestHandler):
    
    @tornado.web.asynchronous
    @gen.coroutine
    def get(self):
        response = ResponseModel()
        try:
            nresults = int(self.get_argument("nresults",strip=True,default=50))
            page = int(self.get_argument("page",strip=True,default=1))
            timeago = int(self.get_argument("timeago", default=80, strip=True))
            response.model['tags'],error = yield gen.Task(CallIT.gen_run,TagActions._get_tags_by_trend,timeago,nresults, page)

        except Exception, e:
            response.success = False
            response.args['Message'] = e.message
            logger.error(e)
        self.write_json(response)    

class OwnerTagHandler(RestHandler):

    @tornado.web.authenticated
    @tornado.web.asynchronous
    @gen.coroutine
    def get(self):
        response = ResponseModel()
        try:
            nresults = int(self.get_argument("nresults",strip=True,default=50))
            page = int(self.get_argument("page",strip=True,default=1))
            response.model['tags'],error = yield gen.Task(CallIT.gen_run,TagActions._get_tags_by_owner,self.current_uid(),nresults, page)

        except Exception, e:
            response.success = False
            response.args['Message'] = e.message
            logger.error(e)
        self.write_json(response)    

class RandomTagHandler(RestHandler):
 
    @tornado.web.authenticated   
    @tornado.web.asynchronous
    @gen.coroutine
    def get(self):
        response = ResponseModel()
        try:
            nresults = int(self.get_argument("nresults",strip=True,default=1))
            excludes = self.get_argument("exclude",strip=True,default="[]")
            excludes = loads(excludes)
            response.model['tags'],error = yield gen.Task(CallIT.gen_run, TagActions._get_tags_by_random,excludes,nresults)

        except Exception, e:
            response.success = False
            response.args['Message'] = e.message
            logger.error(e)
        self.write_json(response)    

class TagActions:
    

    
    @staticmethod
    def _get_tag_by_id(_id,deref=True,excludes=None,includes=None,callback=None):
            if includes == None:
                includes = []
            if excludes == None:
                excludes = ["reg_id","password","notifications","current_tags","votes","salt","email","date_modified"]
            #excludes.extend(["owner"])
            
            tag = None
            if deref:
                tag = Tag.objects(id=_id).exclude(*excludes).only(*includes).first()
#                 print tag.to_json()
#                 print dumps(tag.owner)
#                 print tag.owner.name
            else:
                tag = Tag.objects(id=_id).no_dereference().exclude(*excludes).only(*includes).first()

            if callback != None:
                return callback(tag)
            return tag

    @staticmethod
    def _get_tags_by_ids(_ids,deref=True,excludes=None,includes=None,callback=None):
            if includes == None:
                includes = []
            if excludes == None:
                excludes = ["reg_id","password","notifications","current_tags","votes","salt","email","date_modified"]
            #excludes.extend(["owner"])
            
            tags = None
            _ids = loads(_ids)

            if deref:
                tags = Tag.objects(id__in=_ids).exclude(*excludes).only(*includes)
#                 print tag.to_json()
#                 print dumps(tag.owner)
#                 print tag.owner.name
            else:
                tags = Tag.objects(id__in=_ids).exclude(*excludes).only(*includes)
            print tags
            if callback != None:
                return callback(tags)
            return tags
                
    @staticmethod
    def _get_recommended_tags(user,tag_string,callback=None):
        pass
    
    @staticmethod
    def _get_top_tags(nresults=50,page=1,callback=None):
            excludes = ["reg_id","password","notifications","current_tags","votes","salt","email","date_modified"]

            tags = Tag.objects().no_dereference().exclude(*excludes).skip(nresults * (page-1)).limit(nresults).order_by('-frequency')
            if callback != None:
                return callback(tags)
            return tags

    @staticmethod
    def _get_tags_by_owner(ownerid,nresults=50,page=1,callback=None):
            excludes = ["reg_id","password","notifications","current_tags","votes","salt","email","date_modified"]

            tags = Tag.objects(owner=ownerid).no_dereference().exclude(*excludes).skip(nresults * (page-1)).limit(nresults).order_by('-frequency')
            if callback != None:
                return callback(tags)
            return tags    
        
    @staticmethod
    def _get_tags_by_freq(tag_string,nresults=50,page=1,callback=None):
            excludes = ["reg_id","password","notifications","current_tags","votes","salt","email","date_modified"]

            tags = Tag.objects(Q(name__istartswith=tag_string)|Q(username__istartswith=tag_string)).no_dereference().exclude(*excludes).skip(nresults * (page-1)).limit(nresults).order_by('username','name','-frequency')
            if callback != None:
                return callback(tags)
            return tags   

    @staticmethod
    def _get_tags_by_trend(hoursago=24,nresults=50,page=1,callback=None):
        
        d=datetime.datetime.utcnow( )-timedelta(hours=hoursago)
        post_coll = Post._get_collection()
            #excludes = ["reg_id","password","notifications","current_tags","votes","salt","email","date_modified"]
        tags = post_coll.aggregate(   
                [
                 { "$unwind" : "$tags" },
                 { "$match" :{ "date_created":{ "$gte" : d}, "tags.is_user": False} },
                 { "$group" : { "_id" : "$tags.tag" , "name" :{ "$first": "$tags.name"}, "number" : { "$sum" : 1 } } },
                 { "$sort" : { "number" : -1 } },
                 {"$skip" : (page -1)*nresults},
                 {"$limit" : nresults}
                 ]) 
        if callback != None:
                return callback(tags['result'])
        return tags['result']    

    @staticmethod
    def _get_tags_by_random(excludeTags=[],nresults=1,callback=None):
        tagc = Tag.objects(id__nin=excludeTags).no_sub_classes().only("name","date_created","about").count()
        tags = []
        if nresults > 20:
            nresults = 1
        if tagc > 0:
            for i in range(0,nresults):
                t = Tag.objects(id__nin=excludeTags).no_sub_classes().only("name","date_created","about").skip(random.randint(0, tagc-1)).first()
                excludeTags.append(t.id)
                tagc -= 1
                tags.append(t)
        if callback != None:
                return callback(tags)
        return tags   
                
    @staticmethod
    def _create_tag(user,tag_model,callback=None):
            tag_model = TagActions._clean_tag_json(tag_model)
            tag = Tag.from_json(dumps(tag_model))
            tag.owner = user
            tag.save()
            if callback != None:
                return callback(tag)
            return tag
    
    @staticmethod
    def _update_tag(user,tag,tag_model,callback=None):
        if tag.owner.id == user.id:
#             tag_model = TagActions._clean_tag_json(tag_model)
            tag.about = tag_model['about']
#             print dumps(tag)
            tag.date_modified = datetime.datetime.now()
            tag.save()
        else:
            raise Exception("Invalid Permissions")
        if callback != None:
            return callback(tag)
        return tag
    
    @staticmethod
    def _delete_tag(user,tag,callback=None):
        #If theres more than 100 "followers" the user shouldnt delete it
        if tag.owner.id == user.id and tag.frequency < 100:
            tag.delete()
        elif tag.frequency >= 100:
            raise Exception("This tag has too many people following it to delete it")
        else:
            raise Exception("Invalid Permissions")

    @staticmethod
    def _change_owner(user,tag,newuser,callback=None):
        pass

    @staticmethod
    def _clean_tag_json(tag_data):
        clean_data = {}
        update_fields = ['name','about','related']
        for k in tag_data:
            if k in update_fields:
                clean_data[k] = tag_data[k]
        return clean_data
    
