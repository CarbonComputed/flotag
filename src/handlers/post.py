from handlers.base import RestHandler
from models.response import ResponseModel
from models.post import *
from models.tag import *
from models.user import *
from handlers.user import *
from util.MongoEncoder import *

from tornado import gen
import tornado.web
import util.ranking

from bson import ObjectId

from util.callit import *

from util.memoize import *

class PostHandler(RestHandler):
    
    @tornado.web.authenticated
    @tornado.web.asynchronous
    @gen.coroutine
    def get(self,post_id):
        response = ResponseModel()
        try:
            nresults = int(self.get_argument("nresults",strip=True,default=25))
            page = int(self.get_argument("page",strip=True,default=1))
            sort = self.get_argument('sort',strip=True,default='erank')
            tags = self.get_argument("tags", default=None, strip=True)
        except Exception, e:
            response.success = False
            response.args['Message'] = "Error parsing arguments"
            logger.error(e)
            self.write_json(response)
            return  
        try:
            user,error = yield gen.Task(CallIT.gen_run,UserActions._get_user_by_id,self.current_uid())
            if tags == None or len(tags) == 0:
                tags = user.default_tags
            else:
                tags = loads(tags)

            response.model['posts'],error = yield gen.Task(CallIT.gen_run,PostActions._get_feed,user, tags, nresults, page, sort,_update=True)
        except Exception, e:
            response.success = False
            response.args['Message'] = e.message
            logger.error(e)
        self.write_json(response)    
    
    @tornado.web.authenticated
    @tornado.web.asynchronous
    @gen.coroutine
    def post(self,post_id):
        response = ResponseModel()
        try:
            post_model = self.get_json_model("post")
            
            user = yield gen.Task(UserActions._get_user_by_id,self.current_uid())
            response.model['post'],error = yield gen.Task(CallIT.gen_run,PostActions._create_post,user, post_model)
        except Exception, e:
            response.success = False
            response.args['Message'] = e.message
            logger.error(e)
        self.write_json(response)
    
    @tornado.web.authenticated
    @tornado.web.asynchronous
    @gen.coroutine
    def put(self,post_id):
        response = ResponseModel()
        try:
            post = yield gen.Task(PostActions._get_post_by_id,post_id)
            post_model = self.get_json_model("post")

            user = yield gen.Task(UserActions._get_user_by_id,self.current_uid())
            response.model['post'] = yield gen.Task(PostActions._update_post,user, post,post_model)
        except Exception, e:
            response.success = False
            response.args['Message'] = e.message
            logger.error(e)
        self.write_json(response)

    @tornado.web.authenticated
    @tornado.web.asynchronous
    @gen.coroutine
    def delete(self,post_id):
        response = ResponseModel()
        try:
            cur_user = yield gen.Task(UserActions._get_user_by_id,self.current_uid())
            cur_post = yield gen.Task(PostActions._get_post_by_id,post_id)
            post = yield gen.Task (PostActions._delete_post,cur_user,cur_post)
            response.model['post'] = post
        except Exception, e:
            response.success = False
            response.args['Message'] = e.message
            logger.error(e)
        self.write_json(response) 
    

class PostActions:
    
    @staticmethod
    def _get_posts(user,tags,nresults=50,page=1,sort="rank",callback=None):
            
            if sort == 'rank' or None:
                posts = Post.objects(tags__tag__in=tags).no_dereference().skip(nresults * (page-1)).limit(nresults).order_by('-rank')
            if sort == 'date':
                posts = Post.objects(tags__tag__in=tags).no_dereference().skip(nresults * (page-1)).limit(nresults).order_by('-date_created')
            if callback != None:
                return callback(posts)
            return posts  
        
    @staticmethod
    @memoize("_get_feed")
    def _get_feed(user,tags,nresults=25,page=1,sort="erank",callback=None):
        post_coll = Post._get_collection()
        order = -1
        if sort=="new":
            sort = "date_created"
            order =-1 
        feed = post_coll.aggregate([    
                                    { "$match" : { "tags" : { "$elemMatch" : { "tag" : { "$in" : tags}}}}},
                                    {"$unwind" : "$tags"},
                                    {"$group": {"_id" : "$tags.tag", "name" :{ "$first": "$tags.name"}, "is_user" :{ "$first": "$tags.is_user"},"posts" : {"$addToSet" : {"postid" : "$_id", "content" : "$content",
        "rank" : "$rank","user" : "$user", "reply_count" : "$reply_count", "upvotes" : "$upvotes", "downvotes" : "$downvotes", "date_created" : "$date_created", "date_modified" : "$date_modified"
        }},
                                    "trank" : {"$max" :   "$rank"}}},

    {"$unwind" : "$posts"},
    {"$project":{ "_id" : "$posts.postid", "rank" : "$posts.rank", "content" : "$posts.content","reply_count": "$posts.reply_count", "user" : "$posts.user", "tag" : {"id" :"$_id","name" : "$name" ,"is_user" : "$is_user"},
    "upvotes" : "$posts.upvotes", "downvotes" : "$posts.downvotes", "date_created" : "$posts.date_created", "date_modified" : "$posts.date_modified",
        "erank" : {"$divide" : ["$posts.rank","$trank"]}}},
     
       {"$group" : {"_id" : "$_id","tags" : {"$addToSet" : { "tag" : "$tag.id","name": "$tag.name","is_user" : "$tag.is_user"
        }},"erank" : {"$max" : "$erank"
        },"content" :{"$first" : "$content"},"rank" :{"$first" : "$rank"},"user" :{"$first" : "$user"},"reply_count" : {"$first" : "$reply_count"},
        "upvotes" : {"$first" : "$upvotes"}, "downvotes" : {"$first" : "$downvotes"}, "date_created" : {"$first" : "$date_created"}
        , "date_modified" :{"$first": "$date_modified"}
        }},
        {"$sort" : {sort : order,"_id" : 1}},
        {"$skip" : (page -1)*nresults},
        {"$limit" : nresults}])

        if callback != None:
            return callback(feed['result'])
        return feed['result']
    
    @staticmethod
    def _get_feed_cache(user,tags,nresults=25,page=1,sort="erank",callback=None):
        pass
        
        
    @staticmethod
    def  _create_post(user,post_model,max_tags=1,callback=None):
            post_model = PostActions._clean_post_json(post_model)
            post = Post()
            tags = post_model['tags']
            post.content = post_model['content']
            post.user = user
            post.rank = util.ranking.hot(1,0,post.date_created)
            if post.rank == 0:
                post.rank = 1
            ptags = tags
            tags = Tag.objects(id__in=tags)
            
            emtags = []
            tctr = 0
            for t in tags:
                if(tctr == max_tags):
                    break
                tag = EmbeddedTag(name=t.name,tag=t,is_user=False)
                emtags.append(tag)
                tctr += 1
            #check if user and notify
            #support for more than one tags
            utag = EmbeddedTag(name=user.name,tag=user,is_user=True) 
            emtags.append(utag)
            post.tags.extend(emtags)
            post.save()
            vote = Vote(post_id=post.id,state=1)
            user.reload()
            user.update(push__votes=vote)
            user.update(inc__reputation=2)
            if len(tags) > 0:
                message = user.username + " has tagged you in a post"
                n = PostNotification(message=message,user=user.id,post=post.id)
                User.objects(Q(id__in=ptags) & Q(id__ne=user.id)).update(push__notifications=n)
            user.save()
            if callback != None:
                return callback(post)
            return post
    
    
    @staticmethod
    def  _update_post(user,post,post_model,callback=None):
        if post.user.id == user.id:
            post_model = PostActions._clean_post_json(post_model)
            for k, v in post_model.items():
                if k == '_id'  or k == 'tags': continue
                if v == None: continue
                field = post._fields[k]
    
                if isinstance(field, ReferenceField):
                    v = DBRef(field.document_type._get_collection_name(), ObjectId(v))
                setattr(post,k, v)
#             print dumps(tag)
            post.date_modified = datetime.datetime.now()
            post.save()
        else:
            raise Exception("Invalid Permissions")
        if callback != None:
            return callback(post)
        return post
    
    
    @staticmethod
    def _get_post_by_id(_id,deref=True,excludes=None,includes=None,callback=None):
            if includes == None:
                includes = []
            if excludes == None:
                excludes = []
            #excludes.extend(["owner"])
            
            post = None
            if deref:
                post = Post.objects(id=_id).exclude(*excludes).only(*includes).first()

            else:
                post = Post.objects(id=_id).no_dereference().exclude(*excludes).only(*includes).first()

            if callback != None:
                return callback(post)
            return post
    
    @staticmethod
    def  _delete_post(user,post,callback=None):
        #remove reputation too!
        if user.id == post.user.id:
            post.delete()
        user.update(inc__reputation=-2)
        user.save()
        if callback != None:
            return callback(post)
        return post
    
    @staticmethod
    def  _vote_post(user,post,direction,callback=None):
        pass

    @staticmethod
    def _clean_post_json(post_data):
        clean_data = {}
        update_fields = ['content','tags']
        for k in post_data:
            if k in update_fields:
                clean_data[k] = post_data[k]
        return clean_data
    
    